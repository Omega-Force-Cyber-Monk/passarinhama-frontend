# Frontend Roles and Permissions Audit

Audit date: 9 November 2026. Scope: this frontend repository only. No backend code, database assignments, production credentials, or authenticated live API responses were inspected. API shapes below are the frontend's existing contracts, not proof of deployed behavior. Tests use mocked fetch or component harnesses.

## 1. Executive Summary

| Reported issue | Classification | Conclusion |
| --- | --- | --- |
| 1. TechnicoPro member sees unauthorized articles | Frontend bugs; reported backend behavior unable to verify without backend testing | Feature guards already exist. Fixed stale detail rendering and added profile refresh on focus/reconnect. Resource-level filtering must be verified on the server; no live unauthorized response was captured. |
| 2. Assigned role permissions do not apply | Administrator role assignment already implemented correctly; inheritance unable to verify without backend testing | Both administrator creation forms submit the selected role ID without empty permission arrays or a follow-up permission request. Fixed current-profile invalidation after user updates. Backend must resolve role inheritance and personal overrides. |
| 3. Global Save does not save every permission | Backend dependency for a genuine bulk save; additional frontend bug fixed | Only single-feature role/member writes are established here. No global Save control/handler exists in this checkout. Preserved row saves. Fixed PATCHes that converted untouched inherited actions into explicit denials. |

No role-name authorization rule, TechnicoPro-specific restriction, endpoint, dependency, or backend code was added. The permissions interface was not redesigned.

## 2. Issue-by-Issue Findings

### Issue 1: TechnicoPro access and article visibility

**Expected:** only granted modules/actions and server-authorized resources are accessible, including by direct URL.

**Existing permission model and login trace**

1. `src/pages/Login.tsx` submits through `authApi.login` (`POST /auth/login`, form-encoded credentials), then dispatches `setCredentials`.
2. `src/redux/features/auth/authSlice.ts` starts a new session version, marks authentication/permissions unresolved, and does not trust the stored profile for restored-session authorization. `src/redux/store.ts` clears RTK Query state on login credentials and logout.
3. The persistent `src/components/SessionInitializer.tsx` subscription calls `membersApi.getUsersMe`: `GET /user/users/me`. `normalizeUser` in `membersApi.ts` normalizes role details and permission arrays. `onQueryStarted` dispatches version-checked `sessionResolved`, which stores the profile in Redux and localStorage. Missing permission arrays default to empty, denying ordinary grants rather than inventing inheritance.
4. `getMergedPermissions` / `hasPermission` in `src/redux/features/auth/permissionUtils.ts` start with denied actions, apply `permissions`, then overlay non-null actions from `user_permissions`. Personal `false` overrides inherited `true`; null/omitted actions inherit. Ordinary accounts require active status and `is_deleted === false`. Active `is_superuser === true` has the existing bypass. Role names alone grant nothing.
5. `src/hooks/usePermissions.ts` only exposes a user after session and permissions are resolved. The direct-permissions hook has no current call sites; it is not the effective authorization path.

**Navigation, URLs, content, and API checks**

- `src/layouts/DashboardLayout.tsx` gates module links and category subscriptions by their corresponding feature. Search results are filtered by feature permission before rendering.
- `src/routes/index.tsx` wraps article lists/categories/details in `PermissionRoute feature="article"` and TechnicoPro lists/categories/details in `PermissionRoute feature="technicopro"`. `PermissionRoute.tsx` checks view permission; `ProtectedRoute.tsx` waits for hydration or shows session errors. Direct URLs receive the same guards.
- `src/pages/Home.tsx` skips unauthorized module queries and hides those sections.
- `src/pages/Articles.tsx` checks article view and independent write grants. `src/pages/TechnicoPro.tsx` checks TechnicoPro view; lifecycle tabs depend on create/edit/delete grants. Its list already uses `currentData` and filters the selected status.
- `src/redux/features/api/mutationAuthorization.ts` maps article and TechnicoPro query endpoints to their separate feature grants. Direct RTK calls are checked too. `apiSlice.ts` uses the resolved session for reads and fresh `/me` evidence for protected writes. Resource modification also checks the existing action/ownership rules.
- Article and TechnicoPro detail pages handle backend 403 before rendering content. Their query hooks previously used RTK `data`, which can retain the previous argument's response while another ID is loading.

**Confirmed frontend fixes**

- `src/pages/ArticleDetail.tsx` and `src/pages/TechnicoProDetail.tsx` now use `currentData` and show loading when a new target is fetching without its own response. The previous record is no longer rendered under the next URL.
- The persistent profile subscription had no focus/reconnect refresh, and the store had no RTK browser listeners. `SessionInitializer.tsx` now opts into both refresh triggers; `store.ts` installs `setupListeners`. External grant changes can therefore reach the UI on those events, in addition to refresh/login/explicit refetch/invalidation.

**API requests and resource-level limits**

| Request | Existing frontend response expectation / behavior |
| --- | --- |
| `GET /articles/articles?page=1&page_size=20&status=published` | Paginated article `results`, totals and pages; list page uses size 20. Home uses size 4. Optional `category_id`, `search`, `details`. |
| `GET /articles/articles/{id}` | Article object including body and attachment references; route parameter is named `slug` but passed as ID. |
| `GET /technicopro/technicopros?page=1&page_size=20&status=published&details=true` | Paginated TechnicoPro objects; optional category/search filters. |
| `GET /technicopro/technicopros/{id}` | TechnicoPro object including body and structured attachment references. |
| `GET /articles/my-articles?page={page}&page_size={size}`; `GET /technicopro/my-technicopros?page={page}&page_size={size}` | Separate author-list APIs, also feature guarded. They are not substitutes for a permitted published-content list. |
| `GET /home/?q={query}&limit=10` (optional `type`) | Cross-module search results and totals. Frontend hides disallowed feature types; server must filter individual resources and metadata. |

These main article/TechnicoPro objects do not establish a per-viewer `can_read` capability. Separate resource permission arrays are administrator-only reads, not an ordinary-user effective visibility API. Therefore, the frontend cannot safely infer individual article access from ownership, author text, category, or role name. Returned records are rendered after feature checks. If a response includes resources outside the user's resource ACL, server filtering/detail authorization is required; filtering must occur before pagination and search totals.

**Remaining uncertainty:** there is no captured live request/response proving unauthorized delivery, incorrect role assignments, or incorrect `/me` grants. Real role/resource ACL testing remains necessary. Focus/reconnect is not continuous revocation delivery; open sessions and cached content do not become a server security boundary. Previously cached resource ACL changes with unchanged feature grants need live testing and an agreed refresh strategy.

### Issue 2: Role assignment and inheritance

**Expected:** administrator selects a role; the server assigns it and returns the role's effective grants without manual permission creation.

**Existing behavior and evidence**

- `src/pages/AdminPanel.tsx`: member `SelectField` options use `role.id`; `formData.role_id` is required. `handleSubmit` sends that exact value in `CreateUserRequest`.
- `src/pages/MemberDirectory.tsx`: the role select also uses `role.id`; administrator submission requires a role. A new form defaults to the member-role ID when available, otherwise the existing first-role fallback; the current selection is sent unchanged. No fallback was added by this audit.
- `buildCreateUserFormData` in `src/redux/features/members/membersApi.ts` appends `role_id` to `POST /user/users`. Other supported fields are email/password, names/contact/address, society/city/department, status, payment flag, superuser flag and optional avatar. It appends neither `permissions` nor `user_permissions`.
- Both forms make one create mutation and no second permission-saving mutation. The shared request policy preserves administrator fields. Delegated ordinary account creation intentionally strips role/privilege fields via the existing allowlist; it is a separate workflow, not the administrator role-assignment complaint.
- `PATCH /user/users/{id}` also serializes `role_id`. Role metadata changes use `PATCH /user/roles/{id}` with name/description; role feature grants use `/user/permissions`. Individual overrides use `/user/user-permissions`.
- Create/update/detail responses use `normalizeUser`. `GET /user/users/me` supplies current grants; `GET /user/users/{id}` and `GET /user/users` supply member detail/list data. The member permission editor loads only direct overrides from `GET /user/user-permissions?user_id={id}`; it is not a display of the effective inherited permissions. An empty override table is not evidence that the user has no inherited grants.

**Confirmed frontend fix:** `membersApi.updateUser` invalidated member detail/list tags but omitted `User/ME`. Changing the logged-in administrator's own role/account permissions could leave Redux authorization stale. It now invalidates `ME`, causing the persistent subscription to refresh. Existing role/personal permission mutations already invalidate `ME`; role metadata mutations already invalidate the general User tag.

**Backend responsibility, not confirmed defect:** assigning the selected role and computing inheritance must happen server-side. If `/me` returns no inherited grants for a correctly assigned role, frontend default-deny behavior cannot repair that omission. The frontend should not fetch administrator-only role permissions on behalf of a member or copy role grants into user overrides.

**Related save bug fixed:** the permission editor previously sent all four booleans for any edited existing row. `Boolean(null)` and `Boolean(undefined)` became `false`, replacing inherited actions with explicit denials. It now PATCHes only explicitly edited, changed boolean actions, and skips reverted/no-op submissions. This preserves untouched null/omitted actions. It does not retroactively repair already persisted denials.

**Contract limitation:** creating a missing personal override row still follows the existing POST contract requiring all four booleans; unselected values remain false. There is no established partial-create or reset-to-inherit mutation contract in this repository. Changing that contract or adding a tri-state editor requires backend agreement; no nullable write fields were invented here.

### Issue 3: Saving the permissions table

**Expected:** edit multiple feature rows and submit all changes atomically in one request.

**Actual checkout:** `src/pages/admin/AdminPermissionsEditor.tsx` renders seven feature fieldsets, each with one `savePermission(feature)` button. `AdminPanel.tsx` mounts separate keyed role/member instances. The `adminPanelPage.savePermissions` translation remains in the dictionaries, but no control or global handler references it. The reported nonworking main button is not present in this source version.

Each row chooses POST if there is no persisted ID, otherwise PATCH. Role rows and personal overrides use separate endpoint families. Existing drafts cover the whole table; saving one row preserves other rows' drafts. Dirty checks, valid fixed feature/action choices, boolean construction, target checks, synchronous duplicate-submit protection, disabled inputs while saving/fetching, toast errors/success, query refetch and permission/profile invalidation are already implemented. Failed saves preserve drafts. No array/table validation or global submission exists because no matching write contract is established.

**Decision: Scenario B.** Keep the working row-level workflow. No repeated-request loop or fake bulk save was introduced. The only editor change is the confirmed PATCH inheritance/no-op fix above. Backend needs to supply or document an atomic role/member feature-table write before a global Save workflow can be implemented safely.

## 3. Permissions Save API Analysis

### Role/member feature permissions

`A` below denotes the existing fields `can_view`, `can_create`, `can_edit`, `can_delete`.

| Endpoint definition | Method and exact path | Body | Typed successful response |
| --- | --- | --- | --- |
| `createUserPermission` | `POST /user/permissions` | `{ role_id, feature, ...A }`, all four booleans required | One `UserPermission` row |
| `updateUserPermission` | `PATCH /user/permissions/{id}` | Changed action booleans only; locator `id`/cache `role_id` are stripped | One `UserPermission` row |
| `createMemberPermission` | `POST /user/user-permissions` | `{ user_id, feature, ...A }`, all four booleans required | One `MemberPermission` row |
| `updateMemberPermission` | `PATCH /user/user-permissions/{id}` | Changed action booleans only; locator `id`/cache `user_id` are stripped | One `MemberPermission` row |

All are JSON writes in `membersApi.ts`; successful row types contain feature/action fields and optional role/user association, with personal rows requiring ID/user ID. These are expected types, not captured server responses. Role loads use `GET /user/permissions?role_id={id}`, member loads use `GET /user/user-permissions?user_id={id}`; both expect arrays. Saving also makes a fresh-profile authorization read and subsequent query refreshes: one row mutation does not mean only one total HTTP request.

### Existing resource bulk permissions: different scope

| Method and exact path | Existing JSON body | Typed response |
| --- | --- | --- |
| `PATCH /articles/article/permissions/bulk` | `{ article_id: string[], role_id: string[], can_read, can_write }` | `{ updated, permissions: ArticlePermission[] }` |
| `PATCH /technicopro/technicopro/permissions/bulk` | `{ technicopro_id: string[], role_id: string[], can_read, can_write }` | `{ updated, permissions: TechnicoProPermission[] }` |
| `PATCH /trainings/training/permissions/bulk` | `{ training_id: string[], role_id: string[], can_read, can_write }` | `{ updated, permissions: TrainingPermission[] }` |
| `PATCH /forums/forums/permissions/bulk` | `{ forum_id: string[], role_id: string[], can_read, can_post }` | `{ updated, permissions: ForumPermission[] }` |
| `PATCH /documents/folder/permissions/bulk` | `{ folder_id: string[], role_id: string[], can_read, can_upload }` | `{ updated, permissions: FolderPermission[] }` |

Definitions are in the corresponding `articlesApi.ts`, `technicoproApi.ts`, `trainingsApi.ts`, `forumApi.ts`, and `documentsApi.ts`, with types in each feature or `src/types/forum.ts`. They apply one capability pair across resources and roles; they do not accept heterogeneous feature-action rows or individual user overrides. The role/member editor calls none of them. No current page calls these bulk mutation hooks. Read counterparts are resource-specific `GET .../{id}/permissions` endpoints, also administrator guarded.

**Explicit answers**

- **How many distinct endpoints?** Four feature-permission write definitions/path templates used by the editor; nine permission-saving definitions/path templates across the repository when the five resource bulk writes are included. Role metadata CRUD is separate (`POST /user/roles`, `PATCH/DELETE /user/roles/{id}`).
- **One endpoint or multiple for rows?** Two families, each choosing collection POST for new rows or ID-specific PATCH for existing rows. Not one universal endpoint.
- **Existing one-request bulk support?** Resource bulk support is declared; bulk role/member feature-table support is not established. No backend schema was available to prove there is no additional deployed API.
- **Safe global Save now?** No, not against the known contracts. An array body or loop of independent row writes would be an invented contract or fail the single-request requirement.
- **UI changed?** No layout/buttons were changed. Row saves remain necessary. Only their existing-row request construction was corrected.

## 4. Backend Developer Handoff

### A. Verify unauthorized content and effective identity

**Exact methods/paths:** `GET /user/users/me`; `GET /articles/articles`; `GET /articles/articles/{id}`; `GET /technicopro/technicopros`; `GET /technicopro/technicopros/{id}`; `GET /home/` with the query parameters above. Include the two `my-*` reads if the reproduction uses them. No request body on these reads.

**Current observed request/response:** no live response captured. Frontend mocks show TechnicoPro-only profiles are blocked from article requests before fetch and permitted to request TechnicoPro. Frontend types expect resource objects/paginated lists and search results. This does not demonstrate backend filtering.

**Reproduction:** use an active non-superuser assigned a role granting only TechnicoPro view. Record `/me` role ID/details, `permissions`, and `user_permissions`. Test article URLs, TechnicoPro allowed/denied item URLs, categories, and search. Repeat direct authenticated API requests bypassing this frontend; record HTTP status and redacted actual responses. Repeat after changing feature and resource ACLs, refreshing, logging in again, and refetching the profile. Use a second role and a superuser as controls.

**Expected response:** `/me` must reflect trusted effective role grants and direct overrides. Denied module/detail reads must return the backend's appropriate 403 or concealment 404. Lists/search must contain only permitted resources, including filtered totals/snippets/body/attachments. Feature access alone must not bypass resource ACLs.

**Required backend action if reproduction fails:** resolve effective grants from trusted identity, enforce them on every read, apply role/resource restrictions before pagination/search, and enforce attachment access. Confirm assignment and existing personal denials before changing code. Do not label unauthorized delivery a confirmed backend bug without the captured response.

### B. Verify role assignment and default inheritance

**Exact methods/paths:** `POST /user/users` (multipart); `PATCH /user/users/{id}` (multipart `role_id` when changed); `GET /user/users/{id}`; `GET /user/users/me`; `GET /user/permissions?role_id={id}`; `GET /user/user-permissions?user_id={id}`.

**Current request:** administrator creation submits `email`, `password`, selected `role_id`, and supported optional profile/account fields. It submits no permission arrays. The test verifies one create POST. Live creation/update responses and persisted inheritance were not tested. Frontend expects a user object with role/details and permission arrays; absent arrays normalize to empty.

**Reproduction:** configure a Member role with a known grant through the existing editor, create an account selecting that role, and capture the multipart `role_id`. Verify the returned/persisted role ID; inspect role grants and direct overrides. Sign in as the created user and compare `/me` effective actions with the role and non-null personal overrides. Change the role and repeat with no overrides, explicit grants, explicit denials and null inheritance.

**Expected behavior:** persist the chosen role and resolve its configured grants without copied per-user grants or another permission-saving request. Preserve the established independent override precedence on role changes. Return the authoritative permission arrays expected by this client, or explicitly document a revised contract before frontend changes.

**Required backend action if reproduction fails:** fix role persistence/effective-permission resolution or stale server/token permission caches. Existing explicit personal denials may be legitimate; do not erase them automatically. Delegated non-superuser creation separately needs a safe server default because its existing client policy intentionally strips `role_id`.

### C. Genuine bulk feature-table save

**Existing exact methods/paths:** the four role/member feature-permission writes listed in section 3. Current request/typed response supports one row; no live batch response or deployed schema was available.

**Reproduction:** modify article and TechnicoPro actions in the role editor. Click one row save and inspect the request: it targets only that feature/ID; the other row stays dirty. Repeat in the member override editor. There is no global Save handler to invoke in this checkout.

**Expected capability:** one authenticated administrative request accepting all intended changed feature rows for a role or user, including mixed new/existing rows and different action values. Validate every row and target before any commit; define all-or-nothing errors, duplicate-feature handling, nullable inheritance/reset semantics, and an authoritative success result. Recompute/invalidate affected effective grants server-side.

**Required backend action:** document an existing supported operation if one exists, or implement genuine transactional bulk support. The final URL, HTTP method, body schema, and response must be supplied by the backend team; none is invented here. Existing resource bulk writes cannot fulfill this feature-table contract. Once established, frontend can implement one validated global submit with dirty state, busy/error/success handling and cache refresh.

### D. Preserve/reset inheritance on first personal override

**Exact existing endpoint:** `POST /user/user-permissions`, JSON `{ user_id, feature, can_view, can_create, can_edit, can_delete }`. Existing `PATCH /user/user-permissions/{id}` supports optional boolean actions in the frontend type; read rows permit null. No established nullable-write/reset/delete contract exists here.

**Current behavior:** creating a new override row submits all four booleans, with unchecked actions false. The server response is typed as one personal permission row; actual persistence semantics were not verified. The corrected PATCH path omits untouched actions.

**Reproduction:** give a role TechnicoPro view, leave the user without a TechnicoPro override row, and create an override changing only another action. Inspect all four POST values and resulting `/me`. Separately inspect whether any historical editor saves changed previously null actions to false.

**Expected capability / backend action:** confirm whether a missing row intentionally creates a full override. If untouched actions must inherit, document or implement partial/nullable creation and a way to reset an action to inheritance, including response semantics. Then a corresponding frontend control can be implemented. Review historical denials with an administrator; this audit does not mutate existing assignments or assume they are accidental.

## 5. Verification

| Check | Result |
| --- | --- |
| `node --test tests/*.test.mjs` | Passed: 98 tests, including 16 permission-editor tests and 4 detail-navigation regressions. |
| `node scripts/test-article-authorization.mjs ../tests/roles-permissions-audit.test.ts` | Passed: 5 tests covering grant merging/module separation, direct denied reads, selected-role create payload, role-update profile invalidation, focus/reconnect refresh. |
| `node scripts/test-article-authorization.mjs` | Passed: 4 existing article authorization tests. |
| `node scripts/test-article-authorization.mjs ../tests/frontend-authorization.test.ts` | Passed: 11 existing cross-module authorization tests. |
| `node scripts/test-article-authorization.mjs ../tests/session-lifecycle.test.ts` | Passed: 12 existing session lifecycle tests, including profile revocation and refresh/login race handling. |
| `npm.cmd run lint` | Passed: TypeScript `tsc --noEmit`. This package has no separate ESLint script. |
| `npm.cmd run build` | Passed with broader filesystem access; Vite reported its chunk-size advisory. |

Total: 130 tests passed, zero failed. `git diff --check` also passed. The TypeScript check covers application source; the repository's TypeScript test runner transpiles and executes its test files.

Dependencies were initially absent, so the first test/lint attempts could not start. Installed the existing lockfile from the local cache with `npm.cmd ci --offline --ignore-scripts --no-audit --no-fund`; no dependency declarations/lockfile changes. Sandboxed installation could not access the shared cache; installation succeeded with broader filesystem access. The first sandboxed Vite build could not read config ancestry; it was retried with broader filesystem access.

Not verified: real browser interactions, deployed API schemas, actual role assignments or database inheritance, resource ACL filtering, server-side authorization, authenticated attachment access, server cache revocation, or cross-session delivery of permission changes. These require authorized backend test accounts and captured responses. Frontend handoff is prepared; end-to-end resolution is not certified.
