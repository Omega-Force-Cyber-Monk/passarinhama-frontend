# User roles and permissions audit

Audit date: 14 November 2026. Scope: the current frontend checkout, its routes, page controls and handlers, RTK endpoint policies, session lifecycle, tests, and the documentation in `docs/`, `docs/user-manual/`, `FRONTEND_ROLES_PERMISSIONS_AUDIT.md`, and `RBAC_GUIDE.md`.

This is a frontend source and mocked-runtime audit. No backend implementation, database role assignments, deployed API schema, authenticated live responses, or browser interactions were inspected. Sending a request in a mocked probe establishes frontend behavior; it does not establish that a deployed server accepts it. Application behavior and permission assignments were not changed by this audit.

## Findings, in priority order

### F1 — High policy risk: ordinary document deletion includes shared, nonempty folders

**Evidence:** [resourceAuthorization.ts](../src/redux/features/auth/resourceAuthorization.ts), `canDeleteFolder` at line 9; [mutationAuthorization.ts](../src/redux/features/api/mutationAuthorization.ts), `deleteFolder` at line 127; [DocumentLibrary.tsx](../src/pages/DocumentLibrary.tsx), `canChangeTarget` at line 411.

An ordinary user with `document.delete` can delete any folder returned in the canonical folder tree. The policy checks the grant and visible target ID. It does not check ownership, a delete-specific capability, emptiness, or descendant owners. `can_upload` does not control deletion. The page, final request guard, and existing session-lifecycle regression test deliberately agree on this behavior.

**Scenario reproduced with mocked RTK endpoints:** an active non-superuser with document view/delete targets a shared folder with `can_upload: false` and `document_count: 3`. The client sends `DELETE /documents/documents/folders/shared-folder` after fetching `/me` and the folder tree.

**Impact:** the frontend permits a potentially cross-owner cascade. Actual cascade behavior and server acceptance remain unverified. This is an explicit policy risk, rather than an accidental bypass of the current helper. `RBAC_GUIDE.md` describes this grant-based deletion, while the older implementation notes and user manual still say superuser-only.

**Recommendation:** establish one folder deletion policy and an atomic backend guarantee for descendants. If ordinary deletion is required, return a trusted delete/cascade capability and enforce it on the server. Otherwise restrict shared-folder deletion to superusers. Updating only the manual would not resolve the cascade risk.

### F2 — Medium: encoded dashboard URLs miss the administrative read guard

**Evidence:** [dashboardApi.ts](../src/redux/features/dashboard/dashboardApi.ts), base path at line 3 and endpoints at line 79; [mutationAuthorization.ts](../src/redux/features/api/mutationAuthorization.ts), administrative path check at line 94 and GET fallback at line 107.

Dashboard reads use `/admin%26modarator/dashboard/...`. The administrative prefix check expects `/admin&modarator/`, without decoding the URL. The three dashboard endpoints are absent from `sensitiveReads` and `readFeatures`. Consequently they fall through to the rule allowing an unmapped GET for any active authenticated account.

**Scenario reproduced through real RTK endpoints with mocked fetch:** an ordinary session with no feature grants sends `getDashboardStats`, `getDashboardActivity`, and `getDashboardUpcomingEvents` successfully to the mocked server. The activity contract includes actor identities, target IDs, descriptions, and timestamps.

**Impact and limit:** the intended frontend administrative boundary is missing at these request entry points. `Dashboard.tsx` is currently unrouted, so this is not an exposed dashboard page through normal navigation. Backend access is unverified. Moderation queue/log reads have explicit sensitive endpoint entries and do not share this particular gap.

**Recommendation:** explicitly classify the dashboard endpoint names under the agreed access policy. Make unknown protected reads deny by default, with an explicit allowlist for self-service and common reads. URL encoding should not determine authorization.

### F3 — Medium: the first personal override can revoke unrelated inherited actions

**Evidence:** [AdminPermissionsEditor.tsx](../src/pages/admin/AdminPermissionsEditor.tsx), changed-field PATCH at line 41, full values at line 45, member POST at line 55, and checkbox presentation at line 80; [permissionUtils.ts](../src/redux/features/auth/permissionUtils.ts), personal override merge at line 97.

Existing-row PATCH preserves untouched null/omitted actions correctly. Creating a missing personal row still sends all four booleans. Actions absent from the draft and row become `false`. The editor displays direct overrides, without showing the inherited effective value or offering an inherit/reset state.

**Scenario:** a role grants `article.view`; the member has no article override row. An administrator checks only Create and saves that row. The request contains `can_view: false, can_create: true, can_edit: false, can_delete: false`. Under the client merge policy, the member loses article view. Their normal article route is blocked even though Create is now true.

The existing editor test confirms this full-row POST payload, and a separate runtime merge probe confirmed the loss of inherited view. It is also documented as an unresolved contract limitation in the 9 November audit. This is not a newly introduced regression.

**Recommendation:** show inherited and effective values separately; agree on partial/nullable creation and a reset-to-inherit contract before adding a tri-state editor. If full replacement is intentional, clearly explain every resulting override before save. Do not infer that an empty direct-override table means no effective access.

### F4 — Medium: Training detail can render the previous record under a new URL

**Evidence:** [TrainingDetail.tsx](../src/pages/TrainingDetail.tsx), query at line 20 and loading branch at line 24. Compare [ArticleDetail.tsx](../src/pages/ArticleDetail.tsx), line 28, and [TechnicoProDetail.tsx](../src/pages/TechnicoProDetail.tsx), line 20.

Training detail uses RTK `data` and checks only `isLoading`. On a parameter change, RTK may retain the previous argument's response while `isFetching` is true and `currentData` is absent. The page can render the previous title, description, and attachment references at the next training URL until that request settles.

**Scenario reproduced in a component harness:** route parameter is a new restricted ID; query returns previous-record `data`, no `currentData`, `isLoading: false`, and `isFetching: true`. The returned tree contains the previous training title. A settled 403 does show the restriction notice; the issue is the unresolved transition. It does not establish delivery of the denied training.

**Recommendation:** use `currentData` and show loading when the new ID is fetching without its own response. Extend `permission-detail-navigation.test.mjs`, which currently covers only Article and TechnicoPro.

### F5 — Medium usability defect: TechnicoPro-only users receive a misleading Home restriction

**Evidence:** [Home.tsx](../src/pages/Home.tsx), feature checks at line 102, `canViewAnyHomeSection` at line 107, and early restricted return at line 163.

Home considers forum, article, event, training, and document view grants, but never TechnicoPro. An active account with only `technicopro.view` therefore receives the access-restricted Home state after login, while the sidebar and `/technicopro` route correctly allow entry. A user with only `user.view` has the analogous directory-only experience. `document.view` is counted as a Home section despite there being no corresponding document feed section.

**Recommendation:** distinguish having no portal access from having no available feed sections. Provide authorized module links or a suitable landing destination for TechnicoPro-only, directory-only, and document-only users.

### F6 — Medium policy ambiguity: create permission can publish immediately

**Evidence:** [ContentListing.tsx](../src/components/ui/ContentListing.tsx), `ContentStatusField`; create form payloads in [Articles.tsx](../src/pages/Articles.tsx), [Trainings.tsx](../src/pages/Trainings.tsx), and [TechnicoPro.tsx](../src/pages/TechnicoPro.tsx); collection POST policy in [mutationAuthorization.ts](../src/redux/features/api/mutationAuthorization.ts), line 232.

New content forms offer both Draft and Published. Collection POST checks only the independent create grant and does not inspect status. Thus an ordinary user with view/create but no edit can submit a new published article, training, or TechnicoPro record. Publishing an existing draft requires edit plus ownership. No separate publish grant or approval permission exists in this client.

**Impact and limit:** this may be the intended creation policy, but the blanket statement that publishing requires edit plus ownership does not describe initial creation. Actual accepted statuses and publication workflow remain backend-dependent.

**Recommendation:** document this distinction explicitly. If publication requires approval or edit authority, enforce that policy on create as well as subsequent transitions, both server-side and in the form.

## Effective authorization model

The implementation uses seven feature keys: `article`, `document`, `event`, `forum`, `training`, `technicopro`, and `user`. Each has independent `can_view`, `can_create`, `can_edit`, and `can_delete` actions.

1. Login/restoration resolves the current profile using the persistent `getUsersMe` subscription. Stored profile data is not trusted as restored-session permission evidence. Session versions prevent old profile/refresh responses from replacing a newer login.
2. Ordinary grants start denied. The client reads base grants from `/me.permissions`, then overlays non-null actions from `/me.user_permissions`. Personal `false` denies an inherited `true`; null/omitted personal actions inherit. The frontend does not resolve role inheritance by fetching the role table for ordinary users.
3. Eligibility requires a nonempty string ID, `status === 'active'`, and `is_deleted === false`. Missing eligibility fields deny protected operations. Payment validation and email verification are not additional gates in `hasPermission`.
4. Only eligible `is_superuser === true` accounts bypass feature grants and ownership. For these accounts, personal feature denials do not remove the bypass. `admin`, `moderator`, or any other role name alone grants nothing.
5. For ordinary content modifications, action permission and canonical ownership must both pass. If a resource explicitly includes `can_write`, it must be exactly true. An absent `can_write` is not itself a denial. Resource/container exceptions are listed below.
6. Sidebar links and category subscriptions follow view grants; direct module routes use the same view gate. Page controls and final handlers apply action/resource checks. The shared API layer checks direct RTK entry points too.
7. Reads use the resolved Redux profile. Protected writes independently fetch fresh `/me`; ordinary resource writes fetch canonical targets. Final session/identity checks run before dispatch. Unknown writes deny. Unmapped reads currently allow eligible sessions, as demonstrated by F2.

Sources: [permissionUtils.ts](../src/redux/features/auth/permissionUtils.ts), [usePermissions.ts](../src/hooks/usePermissions.ts), [resourceAuthorization.ts](../src/redux/features/auth/resourceAuthorization.ts), [authSlice.ts](../src/redux/features/auth/authSlice.ts), [apiSlice.ts](../src/redux/features/api/apiSlice.ts), and [mutationAuthorization.ts](../src/redux/features/api/mutationAuthorization.ts).

### Role names versus actual rights

| Profile / role scenario | Actual frontend outcome |
| --- | --- |
| `role: admin`, `is_superuser: false` | Ordinary grant and ownership rules; no Admin panel access. |
| `role: moderator`, `is_superuser: false` | Ordinary grant and ownership rules; no cross-owner moderation, pinning, or Admin access. |
| `membre`, `auditeur`, partner, committee, or custom role | Exactly the supplied effective feature grants; no hardcoded persona defaults or category/folder scopes. |
| Active, non-deleted superuser, regardless of role label | All feature actions and administrative access; ordinary ownership/capability restrictions bypassed. |
| Inactive/deleted superuser | Protected feature actions and administrative access denied. |
| Missing feature grants | Denied for ordinary users; not filled from role names. |
| Payment unvalidated or email unverified, but active/non-deleted | Not independently denied by the shared grant helper; server/business rules may add restrictions. |

Actual default role assignments and per-resource role ACLs cannot be established from frontend role constants or the manual's persona tables.

## Page and action matrix

The following describes ordinary eligible users unless a superuser requirement is stated. Normal module pages require view in addition to the action needed for a button. Independent create/edit/delete grants do not automatically make a view-denied route reachable.

| Page / route family | Entry/read rule | Create / participation | Edit / delete / special scenarios |
| --- | --- | --- | --- |
| `/login`, `/signup`, `/forgot-password` | Guest routes; authenticated sessions redirect. | Public auth/OTP/recovery API exceptions. Signup submits the member role constant. | Backend must constrain signup role/privilege fields. |
| `/verify-otp` | Public route, not wrapped in the guest-only guard. | OTP verification/resend. | Server must validate purpose/session/OTP. |
| `/` Home | Resolved authenticated shell; individual feeds query only when view is granted. | Links to authorized modules. | TechnicoPro-only/directory-only restriction defect: F5. |
| `/directory` | `user.view` | `user.create`; ordinary account fields only. | Existing member edit/delete/restore/validation and CSV export require superuser, even with `user.edit/delete`. Self changes use `/profile`. |
| `/articles`, `/articles/category/:categoryId` | `article.view` | `article.create`; new status can be Draft/Published. | `article.edit/delete` plus `author.id` ownership. Publishing existing content uses edit. Categories require superuser. Draft tabs require any create/edit/delete grant. |
| `/articles/:slug` | `article.view`; server handles item access. | Read-only detail; attachment open/download; related items. | No CRUD controls. Uses `currentData`; settled 403 handled before content. |
| `/agenda`, `/agenda/:agendaId` | `event.view` | `event.create`; register/unregister uses view and current-user registration endpoint. | Edit/delete require grant plus `created_by.id`. Roster requires ownership plus edit **or** delete, or superuser. Categories require superuser. Ownership alone cannot read roster. |
| `/events`, `/events/:eventId` | `event.view` | `event.create`; quick-add persists through the API. | Delete uses grant plus `created_by.id`; no edit UI. |
| `/trainings`, `/trainings/category/:categoryId` | `training.view` | `training.create`; new status can be Draft/Published. | Edit/delete require grant plus `created_by.id`. Categories require superuser. Draft tabs require a write grant. |
| `/trainings/:trainingId` | `training.view`; server handles item access. | Read-only detail and attachments. | Stale detail transition: F4. |
| `/technicopro`, `/technicopro/category/:categoryId` | `technicopro.view`, independent of `article.view` | `technicopro.create`; new status can be Draft/Published. | Edit/delete require grant plus `author.id` or `author_id`; conflicting supplied IDs deny. Existing publication requires edit. Categories require superuser. |
| `/technicopro/:technicoproId` | `technicopro.view`; server handles item access. | Read-only detail and attachments. | Uses `currentData`; settled 403 handled before content. |
| `/documents` | `document.view`; folder tree supplied by server. | Root folder: `document.create`, no parent capability needed. | Folder rename superuser-only; visible-folder deletion uses `document.delete` without ownership, including nonempty folders: F1. |
| `/documents/folder/:folderId` | `document.view`; server filters folder visibility. | Upload/nested folder: `document.create` plus parent `can_upload === true`. | File rename/delete require corresponding grant plus `uploaded_by.id`. Final writes verify target ID and parent folder. Folder rules as above. |
| `/documents/folder/:folderId/file/:fileId` | Same folder rule; file must be in returned folder contents. | Preview/download. | Document delete remains grant plus uploader ownership; superuser bypass. |
| `/forums` | `forum.view` | Forum-container creation requires superuser, not merely `forum.create`. | Forum-container edit/delete require superuser. |
| `/forums/:forumId` | `forum.view`; server supplies accessible forum/topics. | Topic: `forum.create` plus forum `can_post === true`. | Topic edit requires edit plus author ownership. Ordinary delete additionally requires `reply_count === 0`; nonempty/missing count denies. Pinning requires superuser. |
| `/forums/:forumId/topics/:topicId` | `forum.view` and available topic data. | Reply: create plus forum `can_post === true` and topic `is_locked === false`. Missing capability/lock state denies. | Reply edit/delete require independent action plus author ownership. Current owner-edit/delete policy does not additionally require an unlocked topic or `can_post`; those conditions govern creation. |
| `/profile` | Authenticated shell; no `user.view` requirement. | Self photo/password/notification workflows. | `/me` serializer permits only supported self fields; other-user photo upload requires superuser. Final protected self writes still require account eligibility. |
| `/admin` | Eligible superuser only. | Members, content, roles/permissions, moderation, SMTP, logs, backups. | Role grants alone cannot delegate administrative access. Separate endpoint policies restrict administrative writes/reads. F2 affects unrouted dashboard reads. |
| `/dashboard`, `/moderation` | Neither route is registered; wildcard redirects to `/`. | Corresponding page components exist. | Moderation works inside superuser Admin panel. Registering a standalone route would not grant moderator-role access under the current helper. |
| Header search | Eligible authenticated session; endpoint is not feature-mapped. | Searches across modules via `GET /home/?q=...&limit=10`. | UI filters known result types by feature view. Raw results and metadata require backend filtering; totals caveat below. |

Route evidence: [routes/index.tsx](../src/routes/index.tsx), [PermissionRoute.tsx](../src/components/PermissionRoute.tsx), [ProtectedRoute.tsx](../src/components/ProtectedRoute.tsx). Resource details: corresponding pages and the shared endpoint policy. ProtectedRoute itself checks session status, not account activity; the feature/action helpers and protected API checks enforce activity. Inactive resolved accounts can therefore still reach the authenticated shell/self page while protected operations deny.

## Scenario matrix

| Scenario | Actual outcome / limit |
| --- | --- |
| Anonymous opens a module URL | Redirect to login, preserving the requested destination. |
| Stored token/profile on reload | Wait for current `/me`; stored grants are not accepted as resolved authority. |
| Initial `/me` network/403/5xx failure | Recoverable session error; protected module content does not render. Unrecoverable 401 logs out. |
| Background profile request fails | Existing resolved identity/grants remain; no automatic logout for non-401 errors. Writes still require their independent fresh-profile check. |
| Only module view granted | Read module; no creation or owner modifications. Forum view alone cannot create replies. |
| Only module create granted, view denied | Normal module route is blocked. The final collection POST policy checks create independently, so a direct RTK create can be allowed. Target preflight reads are also not separate view-grant checks. |
| View/create, no edit | Can create; can choose Published initially (F6). Cannot edit or publish an existing draft afterward. |
| View/edit, owner, no delete | Can edit/publish existing owned content; cannot delete. |
| View/delete, owner, no edit | Can delete owned content; cannot edit/publish. Folder deletion is the F1 exception; nonempty forum topics remain blocked. |
| Edit/delete granted, other or missing owner | Ordinary content modification denied; superuser exception only. |
| Base view true, personal view false | Denied, regardless of role label. |
| Base view false, personal view true | Allowed if eligible. |
| Personal action null/omitted | Inherits base action; no new grant is invented. First-row full boolean POST can replace this with false (F3). |
| Forum posting disabled or lock unknown/true | Ordinary reply creation denied. Superuser bypass applies. |
| Folder upload disabled | Ordinary upload/nested creation denied. Does not deny folder deletion when document delete is granted. |
| Permission revoked while modal is open | After profile refresh, current render/handlers deny; final writes independently refetch grants/target, preventing a stale UI grant from authorizing the mocked request. |
| Permission changed in another session | Applied on focus/reconnect, profile invalidation/refetch, or login/reload. No polling/push/continuous revocation is configured. |
| Feature view revoked and refreshed | Route/sidebar hide that feature. This does not by itself purge every previously cached resource response. |
| Resource ACL changes but feature grants stay the same | Client cannot derive new per-item read access from feature grants; cached responses and direct assets need server enforcement and a refresh strategy. |
| Backend denies a detail request | Article/Training/TechnicoPro show a restriction state for 403. Training has the unresolved transition defect in F4. |
| Session changes while request is pending | Session-version/identity checks reject stale completion; login/logout reset RTK cache. |

## Role assignment and permission administration

- Both administrator member forms select actual role IDs and send the selected `role_id` in multipart `POST /user/users`; they do not submit empty permission arrays or copy role permissions into overrides. Assignment/inheritance computation must happen on the backend.
- `PATCH /user/users/{id}` carries role changes and invalidates current profile `User/ME`, member detail, and list. Role/override permission saves also invalidate `ME`. Invalidation in the administrator's store is not push delivery to another user's browser.
- Delegated `user.create` strips role, superuser, status, payment, and permission assignment fields at the page and final request layer. The server must provide a safe ordinary default role; the historical request type still requires `role_id`, so backend validation may reject delegated creation until that contract is resolved.
- Role permission reads/writes use `/user/permissions`; direct overrides use `/user/user-permissions`. These are separate administrator-only families. Existing rows use PATCH of changed booleans; new rows use POST of all four booleans.
- Seven rows have separate Save buttons. There is no global feature-table Save handler or established transactional feature-table endpoint. Other row drafts survive saving one row. There is no inherit/reset control; F3 remains relevant.
- Five declared resource bulk endpoints cover article, TechnicoPro, training, forum, and folder role ACLs. They are administrator guarded, but no current page consumes their bulk mutation hooks. They do not implement bulk saving of heterogeneous role/member feature rows. Article/forum page-local permission dialogs were removed; do not assume those controls exist because the APIs are declared.

Sources: [membersApi.ts](../src/redux/features/members/membersApi.ts), [MemberDirectory.tsx](../src/pages/MemberDirectory.tsx), [AdminPanel.tsx](../src/pages/AdminPanel.tsx), [AdminPermissionsEditor.tsx](../src/pages/admin/AdminPermissionsEditor.tsx), and the 9 November audit's endpoint inventory.

## Documentation reconciliation

The 4 November audit is explicitly historical: its missing ownership, forum-reply create, privileged account payload, and inactive-superuser findings are largely addressed by the current shared implementation. Do not present that report's old findings as current defects. The 9 November root audit accurately records later fixes and still-open backend/editor limitations, but is narrower than this page/scenario review.

| Document / claim | Current source finding |
| --- | --- |
| `RBAC_GUIDE.md`: folder delete uses independent document delete on visible folder | Matches current code and tests. Its demand for atomic server cascade restrictions remains unverified. |
| `docs/frontend-authorization.md`, manual, CRUD matrix: folder deletion requires superuser | Stale relative to current code; see F1. Root folder creation is also permitted by create without parent capability. |
| Manual role diagram/persona: moderator has Moderation Desk access | Incorrect for non-superusers; helper and `/admin` guard require eligible superuser. Unrouted standalone Moderation is not the sole reason for denial. |
| CRUD matrix: fixed baseline access for member/auditor/partner/committee | These are persona assumptions, not executable role defaults or verified assignments. An auditor can write if actually granted; a member can have no view grants. Category/folder/resource scopes depend on server ACLs. |
| CRUD matrix forum-container CREATE: `forum.create` | Incorrect; page and endpoint policy require superuser. Topic/reply creation uses create plus capabilities. |
| Manual directory edit: `user.edit / Superuser`; frontend audit route table also mentions user edit | Existing member administration is superuser-only. Ordinary `user.edit` does not enable it. |
| Manual directory Trash action described as soft delete | Directory calls `deleteUser`: `DELETE /user/users/{id}`. A separate `/soft` endpoint exists and Admin has separate account actions. Server semantics of the plain DELETE are unverified; do not promise archiving from this control. |
| `docs/agenda-category-ui.md`: event create grants category mutations | Historical UI statement; current Agenda category controls and final API require superuser. |
| User-manual frontend audit: search `GET /dashboard/search` | Stale endpoint. Current search is `GET /home/?q=...&limit=10`. |
| Implementation notes: all protected requests fetch fresh profile; hook refetches on mount after 30 seconds | Stale lifecycle description. GET/HEAD use resolved profile; writes independently fetch `/me`; persistent initializer refreshes on focus/reconnect. `usePermissions` does not start a query or enforce a 30-second freshness window. |
| Manual: publishing needs edit/ownership | Accurate for existing records; creation can choose Published with create alone (F6). |

Other UI/file reference documents were reviewed for their permission-related claims and workflows. They describe interface changes and file mechanics, not evidence of deployed authorization. The existing historical reports have been preserved.

## Backend and cache verification still required

1. **Feature and resource reads:** feature view is not per-record read authorization. The ordinary article/training/TechnicoPro object contracts do not establish a universal effective `can_read`. Lists, categories, drafts, details, related content, forum lists, directory fields, and search must be filtered on the server before pagination/totals. The client displays returned records after feature checks; it cannot safely invent ACLs from role labels or author names.
2. **Search totals:** the header filters visible result rows but displays unfiltered `meta.total_results` (`DashboardLayout.tsx`, lines 345–353 and 469). If the API includes forbidden results in that total, the UI can reveal their existence/count and display a misleading count. No live leak is established. Verify server-filtered rows, snippets, extras, and totals together; frontend row filtering alone is insufficient.
3. **Attachments/downloads:** shared file helpers use direct fetch/links, outside RTK endpoint authorization. Same-origin/API-origin requests attach a stored bearer token; external URLs do not. These helpers do not independently refresh profile or check resource ACLs. Every asset route or signed URL must enforce the intended access/expiry. A downloaded file or opened Blob cannot be revoked by hiding the page afterward.
4. **Canonical targets:** forum writes may scan up to 100 pages of 100 records. Document writes use folder contents, with no individual-document GET contract. Missing/unresolved targets deny; this can also block legitimate operations beyond list limits. The forum UI itself relies on loaded forum/topic pages for direct-link selection, so an unavailable notice need not mean a permission denial.
5. **Atomic writes:** fresh frontend reads do not prevent permission/owner/lock changes between preflight and commit. The backend must recheck action, eligibility, immutable ownership, parent association, publication state, and descendant/file effects atomically. Standalone file deletion and cross-owner moderation remain superuser-only in the frontend.
6. **Live accounts:** validate two ordinary owners, a view-only account, TechnicoPro-only account, moderator without the flag, active superuser, inactive/deleted accounts, and explicit personal grant/denial/null cases. Test direct HTTP requests bypassing the UI; capture redacted actual responses and verify no unauthorized side effects. Include role reassignment, remote grant revocation, resource ACL-only changes, initial publication, and shared-folder cascades.

## Verification performed

| Check | Current result |
| --- | --- |
| `node --test tests/*.test.mjs` | 98 passed. |
| `node scripts/test-article-authorization.mjs` | 4 passed. |
| `node scripts/test-article-authorization.mjs ../tests/frontend-authorization.test.ts` | 11 passed. |
| `node scripts/test-article-authorization.mjs ../tests/session-lifecycle.test.ts` | 12 passed. |
| `node scripts/test-article-authorization.mjs ../tests/roles-permissions-audit.test.ts` | 5 passed. |
| `npm.cmd run lint` | Passed (`tsc --noEmit`). |
| Additional inline runtime probes | Reproduced all three ordinary dashboard reads, nonempty shared-folder DELETE, first-override effective-view denial, and stale Training detail rendering. Network fetches mocked; component rendered in a VM harness. |

Total existing tests: **130 passed, zero failed**. These tests do not cover all findings: some deliberately assert the current full-row override and folder-delete policies, and detail-navigation regressions omit Training. Passing tests therefore do not resolve the policy risks or certify backend security.

Dependencies were initially absent, so the first tests/TypeScript attempts could not start. Installed the existing lockfile offline with lifecycle scripts disabled; the local-cache install required broader filesystem access after the sandbox denied the shared npm cache. No dependency declarations or lockfile changes were made. No production build or live backend/browser test was performed for this documentation-only audit.
