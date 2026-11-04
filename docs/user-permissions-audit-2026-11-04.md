# User permissions audit

Date: 4 November 2026. Repository: `passarinhama-frontend`.

## Verdict and scope

**The frontend does not consistently implement the requested policy.** Article edit/delete is the strongest implementation. Most other content modules check feature permissions without checking ownership. Forum replies bypass create permission, forum topic/post modifications bypass edit/delete permissions, category controls combine unrelated permissions, and member management exposes privileged account fields to delegated users.

This is a source audit of every routed feature, supporting mutation definitions, shared authorization utilities, and relevant existing tests in this repository. It is **not a verification of the deployed backend or actual account assignments**. No backend implementation, database permission assignments, authenticated test accounts, or backend integration tests were available in this workspace. A frontend gap means the UI can offer or send an unauthorized operation; it does not establish that the server accepts it. Conversely, hiding a button cannot establish server security.

No application code or permission assignments were changed. This report is the only added file. No live content was created, edited, or deleted.

## Policy used for this audit

| Actor | Create | Edit | Delete |
| --- | --- | --- | --- |
| Unauthenticated user | Deny content creation | Deny | Deny |
| Active ordinary user without the corresponding feature/action grant | Deny | Deny | Deny |
| Active ordinary user with the corresponding feature/action grant | Allow creation for that feature | Allow only their own content | Allow only their own content |
| Ordinary user with a grant, targeting someone else's content | Not applicable | Deny | Deny |
| Superuser, identified by trusted `is_superuser === true` | Allow across features | Allow any owner's content | Allow any owner's content |

Interpretation: edit/delete require both the relevant action permission and ownership, matching the existing article implementation. Creating an item does not itself permanently grant edit/delete rights. If owners should retain modification rights after their permissions are revoked, that would be a different policy.

Account creation, self-profile changes, event registration, and moderation are called out separately because they are not equivalent to authoring website content. Public signup currently exists; this report does not assume that the request to restrict content creation also abolishes signup.

## Existing shared permission behavior

Source: [permissionUtils.ts](../src/redux/features/auth/permissionUtils.ts), [usePermissions.ts](../src/hooks/usePermissions.ts), [authSlice.ts](../src/redux/features/auth/authSlice.ts).

- Seven feature keys exist: `article`, `document`, `event`, `forum`, `training`, `technicopro`, and `user`.
- Each has `can_view`, `can_create`, `can_edit`, and `can_delete`.
- Ordinary users start with all actions denied. `user.permissions` supplies base permissions; non-null/non-undefined `user.user_permissions` values override individual actions. An explicit personal `false` overrides a base `true`.
- Ordinary inactive or deleted users fail `hasPermission`. Superusers return true before status/deletion checks; see finding F10.
- Admin panel access uses the superuser flag, not the `admin` role name. This matches the requested distinction.
- `hasPermission` has no resource or owner parameter. Calling it alone cannot implement “only their created content.”
- Auth state initially comes from local storage. The layout fetches `/user/users/me` and syncs returned profile changes, but most actions do not independently require a successful fresh profile check.
- `PermissionRoute` checks feature view permission by default. `ProtectedRoute` checks token-derived authentication state. These are page access controls, not create/edit/delete authorization.
- `useDirectUserPermissions` defines a separate direct-only permission interpretation, but no consumers were found. It is not currently protecting any feature.

## Module and feature matrix

“Present” describes frontend controls only. All server enforcement remains unverified.

| Module / operation | Creation control | Edit/delete control | Assessment |
| --- | --- | --- | --- |
| Articles | `article.create`, checked when opening and submitting | Owner plus separate action grant; superuser bypass; fresh profile/article preflight in RTK update/delete | Core edit/delete policy present; publish and files have separate gaps |
| Article categories | Superuser only for all three operations in category UI | Superuser only | Safe restrictive UI; ordinary permitted category authors cannot manage categories under a broader owner policy |
| Agenda events | `event.create`, including submit guard | Global `event.edit` / `event.delete`; no creator comparison | Ownership missing |
| Alternate `/events` calendar | `event.create` controls create button; creation is local component state only | Global delete permission controls UI; no creator comparison; no edit workflow | Ownership missing; creation does not persist |
| Documents | `document.create` checked on upload submit | Global edit/delete grants; no `uploaded_by.id` comparison | Ownership missing; folder upload capability also ignored by action guard |
| Document folders | `document.create` checked on submit | Global edit/delete grants; no ownership check | Ownership missing; folder type has no creator ID |
| Trainings | `training.create` controls create UI | Global edit/delete grants across listed items; no `created_by.id` comparison | Ownership missing; submit/delete handlers lack action rechecks |
| Training categories | Create **or** edit grant enables all category actions | Same combined boolean for create/edit/delete | Wrong action mapping and no ownership |
| TechnicoPro | `technicopro.create` controls create UI | Global edit/delete grants across listed items; no author comparison | Ownership missing; submit/delete handlers lack action rechecks |
| TechnicoPro categories | Create **or** edit grant enables all category actions | Same combined boolean for create/edit/delete | Wrong action mapping and no ownership |
| Forum containers | `forum.create` checked | Global edit/delete grants; no creator check | Ownership missing; container types lack stable creator ID |
| Forum topics | `forum.create` checked | Owner or superuser; does not check edit/delete grant | Ownership present; action permissions missing |
| Forum posts/replies | Forum **view** permission allows creation | Owner or superuser; action argument ignored | Create permission bypass; edit/delete grants ignored |
| Forum pin/unpin | Not applicable | Superuser only | Correctly restricted UI |
| Member directory | `user.create` checked on open and submit | Global `user.edit` / `user.delete`, with no creator scope | Cross-account management delegated by feature grants; privileged fields exposed |
| Admin content management | Superuser-only route and page | Broad CRUD within superuser-only panel | Correct high-level frontend boundary; no independent API boundary established |
| Roles, role/member permission editor | Superuser-only admin panel | Admin-only parent; editor checks `canManage` | Correct UI boundary; direct API calls depend on backend |
| SMTP, logs, backups | Superuser-only admin panel | Admin-only configuration, log clearing, backup deletion | Correct UI boundary; server authorization unverified |
| Profile, password, notification preferences | Authenticated self-service | `/me`, password reset, current-user photo/preferences flows | Self-scoped UI; API must reject spoofed target IDs and privileged fields |
| Event registrations | Authenticated feature viewer can register | Current-user registration endpoint for unregister | Participation flow; distinguish from content CRUD |
| Moderation | Not content creation | Helper permits active moderator or superuser | Cross-owner state changes require an explicit exception to requested policy; page currently unrouted |
| Home, search, directory viewing, content detail pages, dashboard | No additional content-authoring mutation found | No additional CRUD workflow found | Read/display surfaces, apart from linked workflows above |
| Public signup / OTP | Public flow sends `role: 'membre'` | No general content modification | Account bootstrap exception; server must constrain role and initial permissions |

## Findings, ordered by priority

### F1 — Potentially critical: delegated member management exposes superuser assignment

Evidence: [MemberDirectory.tsx:309](../src/pages/MemberDirectory.tsx#L309), [MemberDirectory.tsx:323](../src/pages/MemberDirectory.tsx#L323), [MemberDirectory.tsx:361](../src/pages/MemberDirectory.tsx#L361), [MemberDirectory.tsx:999](../src/pages/MemberDirectory.tsx#L999).

The directory is accessible with `user.view`. `user.create` or `user.edit` opens the corresponding member form. That form includes `is_superuser`, role, status, and payment validation fields. Both create and update payloads send `is_superuser`; there is no separate superuser check on these controls or payload fields.

**Example:** an ordinary user granted `user.view + user.create` can submit a new account with `is_superuser: true`. A user with `user.edit` can target an existing directory member. If the backend allows these fields under ordinary user-management permissions, this becomes privilege escalation. Server acceptance is unverified.

Required direction: only superusers may assign/remove superuser status or alter privileged role/permission fields. Enforce an explicit server field allowlist for delegated user-management and `/me` requests. Member records also lack a creator field in the current frontend contract; arbitrary directory editing/deletion does not satisfy an owner-only interpretation of account management.

### F2 — High: ownership absent for events, documents, trainings, TechnicoPro, and forum containers

Evidence:

- [Agenda.tsx:573](../src/pages/Agenda/Agenda.tsx#L573): edit checks only `canEditEvent`; delete confirmation checks only `canDeleteEventPermission` at line 598. `created_by.id` exists on the event type but is not compared.
- [Events.tsx:174](../src/pages/Events.tsx#L174): alternate-calendar deletion accepts an ID without owner validation; delete UI uses a feature-wide boolean.
- [DocumentLibrary.tsx:579](../src/pages/DocumentLibrary.tsx#L579) and [DocumentLibrary.tsx:630](../src/pages/DocumentLibrary.tsx#L630): delete/rename operate on any target ID with the corresponding feature permission, without comparing `uploaded_by.id`.
- [Trainings.tsx:293](../src/pages/Trainings.tsx#L293): every listed item receives edit/delete actions from global booleans, regardless of `created_by`.
- [TechnicoPro.tsx:284](../src/pages/TechnicoPro.tsx#L284): every listed item receives edit/delete actions from global booleans, regardless of `author` / `author_id`.
- [Forums.tsx:1339](../src/pages/Forums.tsx#L1339): forum container edit/delete uses only feature grants; open/update/delete paths do not establish ownership.

**Example:** users A and B both publish training content. A has `training.edit`. A sees and can submit edits to B's training through this frontend. Only a server owner check can ensure that request is rejected.

Required direction: a shared resource-aware rule must combine action grant and immutable creator ID, with a superuser exception. Apply it to buttons, modal opening, submission, confirmation, and actual server writes. Deny ordinary users when ownership is missing or unknown.

### F3 — High: forum view access grants reply creation

Evidence: [Forums.tsx:1338](../src/pages/Forums.tsx#L1338) sets `canPostMessage = canViewForum`; [Forums.tsx:1055](../src/pages/Forums.tsx#L1055) uses that value before calling `createTopicPost`.

**Example:** an ordinary user with `forum.view = true` and `forum.create = false` can compose and submit a reply. This directly violates the requested create rule at the frontend level.

The API exposes `ForumListItem.can_post`, but the reply authorization expression does not incorporate it either. Resource-level write restrictions must be preserved in addition to feature create permission and any superuser exception defined by the server.

### F4 — High: forum owners bypass edit/delete permissions

Evidence: [Forums.tsx:1342](../src/pages/Forums.tsx#L1342). `canEditTopic` checks owner or superuser; `canDeleteTopic` reuses that same result. `canManagePost` ignores its `_action` argument and also checks only owner or superuser.

**Example:** an owner whose `forum.delete` permission is explicitly revoked still sees delete controls for their own topic/post. An owner with edit allowed and delete denied receives both actions.

Ownership is already checked here, which is useful, but separate edit/delete permissions and current account eligibility must also be required. The final delete handler at line 1281 does not repeat even the existing checks after confirmation.

### F5 — High: category permissions map create/edit to deletion and ignore owners

Evidence:

- [Agenda.tsx:1765](../src/pages/Agenda/Agenda.tsx#L1765): event category `canCreate`, `canEdit`, and `canDelete` all receive `canCreateEvent`.
- [Trainings.tsx:102](../src/pages/Trainings.tsx#L102) and [Trainings.tsx:483](../src/pages/Trainings.tsx#L483): create or edit permission enables all three category actions.
- [TechnicoPro.tsx:97](../src/pages/TechnicoPro.tsx#L97) and [TechnicoPro.tsx:428](../src/pages/TechnicoPro.tsx#L428): same pattern.
- [Articles.tsx:188](../src/pages/Articles.tsx#L188): article categories use a different, superuser-only rule.

**Examples:** a create-only event user can delete an existing event category. An edit-only training user can create or delete a training category. None of these category managers checks ownership.

Current category types do not carry creator IDs. Before fixing, define categories as either shared superuser-managed configuration or ordinary owned content with separate action grants. Superuser-only management would close the overgrant but would intentionally restrict ordinary category creation.

### F6 — High: article publish changes another owner's content without the ownership guard

Evidence: [Articles.tsx:189](../src/pages/Articles.tsx#L189), [Articles.tsx:489](../src/pages/Articles.tsx#L489), [Articles.tsx:591](../src/pages/Articles.tsx#L591), [articlesApi.ts:190](../src/redux/features/articles/articlesApi.ts#L190).

Publishing uses only `article.edit`. The list action can be offered for any returned unpublished article, and the publish mutation does not call the article ownership preflight. The existing owner protection covers ordinary PATCH/DELETE, not this separate content-state mutation.

**Example:** an editor can submit publishing of someone else's draft returned by the API. This is a modification of someone else's content even though it uses a `/publish` endpoint rather than PATCH.

Training, TechnicoPro, event, and article forms also send status fields. Treat status transitions as writes subject to the same ownership policy, with separate publishing restrictions if required. TechnicoPro also defines a direct publish endpoint, currently used in the superuser-only admin panel.

### F7 — High verification gap: most mutation definitions have no authorization preflight

Evidence: mutation definitions in `eventsApi.ts`, `documentsApi.ts`, `trainingsApi.ts`, `technicoproApi.ts`, `forumApi.ts`, `membersApi.ts`, `adminApi.ts`, and `moderationApi.ts`. [apiSlice.ts](../src/redux/features/api/apiSlice.ts) attaches a bearer token and handles refresh; it does not authorize an action against its target.

Except for article update/delete, reviewed mutation definitions build and send requests directly. Calling a mutation outside its page bypasses the page's UI conditions. Article create, publish, categories, resource-permission changes, and file upload/delete likewise do not use `authorizeModification`.

This is **not proof of a backend vulnerability**: the server may already enforce these rules. Backend authorization must be verified before claiming that only permitted users can write. Extra frontend preflights improve UX but remain bypassable and cannot replace atomic checks at the server write.

### F8 — Medium: multiple handlers do not recheck authorization at submission/confirmation

Evidence: [Trainings.tsx:189](../src/pages/Trainings.tsx#L189), [Trainings.tsx:229](../src/pages/Trainings.tsx#L229), [TechnicoPro.tsx:184](../src/pages/TechnicoPro.tsx#L184), [TechnicoPro.tsx:220](../src/pages/TechnicoPro.tsx#L220), [Agenda.tsx:605](../src/pages/Agenda/Agenda.tsx#L605), [DocumentLibrary.tsx:590](../src/pages/DocumentLibrary.tsx#L590), [Forums.tsx:1281](../src/pages/Forums.tsx#L1281), [MemberDirectory.tsx:425](../src/pages/MemberDirectory.tsx#L425).

Some workflows guard button visibility or modal opening but later submit based only on form validity or a stored target ID. A permission revocation while a dialog is open can therefore leave a submission path available. In contrast, article update/delete repeats its checks, and member create/update repeats feature permission checks.

Required direction: authorize the current actor, action, and current target at every final handler. The backend must independently handle permission/ownership changes between reads and writes.

### F9 — Medium: ownership and resource-capability contracts are incomplete

Evidence: [documentsTypes.ts](../src/redux/features/documents/documentsTypes.ts), [forum.ts](../src/types/forum.ts), [apiTypes.ts](../src/redux/features/api/apiTypes.ts), [eventTypes.ts](../src/redux/features/events/eventTypes.ts), [trainingTypes.ts](../src/redux/features/trainings/trainingTypes.ts), [technicoproTypes.ts](../src/redux/features/technicopro/technicoproTypes.ts).

- Documents expose `uploaded_by.id`, events expose `created_by.id`, and trainings optionally expose `created_by.id`; these are available but unused for modification checks.
- TechnicoPro exposes optional `author.id` and `author_id`; a canonical owner contract is needed.
- Folder, category, and forum container types lack a stable authenticated creator ID. `author_name`, editable display author text, and timestamps cannot establish ownership.
- Member records lack an account-creator ID if member administration must follow creator ownership.
- Folder `can_upload` is displayed as descriptive information, but the actual upload guard uses only global `document.create` at [DocumentLibrary.tsx:524](../src/pages/DocumentLibrary.tsx#L524).
- Per-resource bulk permission endpoints exist, but feature-level flags must not be treated as overriding ownership or as granting ordinary cross-owner administration.

Required direction: server-returned immutable creator identity or explicit trusted action capabilities for every writable resource; keep resource restrictions as additional checks. Define how container deletion handles descendants belonging to other owners, including forum topics/posts and files inside folders. That behavior cannot be determined from this frontend.

### F10 — Medium / policy decision: stale client state and superuser lifecycle checks

Evidence: [authSlice.ts](../src/redux/features/auth/authSlice.ts), [DashboardLayout.tsx:215](../src/layouts/DashboardLayout.tsx#L215), [permissionUtils.ts](../src/redux/features/auth/permissionUtils.ts), [useArticleAuthorization.ts](../src/hooks/useArticleAuthorization.ts).

Most frontend permissions derive from a profile initially restored from editable local storage. The layout syncs a successfully fetched profile, but loading/failure does not itself make every write flow fail closed. A local-storage change can affect frontend controls; it must never affect backend authority. Cached role/permission grants may also persist until profile data is refreshed.

Superuser checks run before active/deleted checks in shared utilities and the article helper. Consequently a profile marked both superuser and inactive/deleted still receives frontend privileges. The requested policy does not specify this lifecycle exception; recommend denying suspended/deleted accounts regardless of privilege, enforced by the server.

The article hook is stronger: it waits for a successful non-fetching current-user query matching the Redux user ID, and update/delete independently refetch server data. Even that client preflight cannot guarantee write-time enforcement on the server.

### F11 — Medium / policy decision: moderation grants cross-owner changes by role

Evidence: [permissionUtils.ts](../src/redux/features/auth/permissionUtils.ts), [Moderation.tsx](../src/pages/Moderation.tsx), [moderationApi.ts](../src/redux/features/moderation/moderationApi.ts), [routes/index.tsx](../src/routes/index.tsx).

`canAccessModeration` permits an active user with the moderator role or a superuser. Moderate-post operations can approve, reject, flag, or forward posts without an owner comparison. If the requested policy includes every modification of someone else's content, moderator cross-owner changes need removal or an explicitly approved exception.

The standalone Moderation component currently has no registered route. The admin panel's moderation interface is inside the superuser-only panel. Therefore this audit does not claim ordinary moderators currently reach that standalone page through normal routing. The helper and mutation remain relevant to future wiring and server verification. The unused page also places hooks after a conditional authorization return, a lifecycle issue if it is enabled later.

### F12 — Lower priority: alternate calendar creation is temporary and RBAC documentation is stale

Evidence: [Events.tsx:98](../src/pages/Events.tsx#L98), [RBAC_GUIDE.md](../RBAC_GUIDE.md), [README.md](../README.md).

The `/events` create handler constructs an object and appends it to local state; it does not call `createEvent`. The success message therefore does not mean a server record exists. This duplicate calendar workflow should be reconciled with Agenda during the fix.

Existing RBAC guidance describes role-name-based full admin access and moderator workflows, while executable code primarily uses feature grants and `is_superuser`. It should be updated after the agreed policy is implemented to prevent regressions.

## What is already working

- Article `canModifyArticle` requires an actor ID, target ID, matching `author.id`, and the relevant edit/delete grant for ordinary users; superusers can target other owners. Missing owner data denies ordinary users.
- Article UI repeats these checks on opening/submitting edits and confirming/deleting. RTK update/delete fetches fresh `/user/users/me` and target article before sending a write.
- Direct personal permission denials override base grants in the shared permission utility.
- Ordinary inactive/deleted users fail shared feature permission checks.
- `/admin` has both a superuser route predicate and an internal page restriction. An account merely named `admin` is insufficient.
- Forum topic/post owner checks use user IDs, not display names. They need action-grant checks added.
- Profile edit targets `/user/users/me`; profile photo upload uses the current profile ID in the UI. No privileged fields are part of the typed self-profile payload.
- The role/member permission editor blocks writes while unauthorized, loading, errored, or already saving, and refreshes permission/profile caches after saves.

## Write-endpoint inventory for backend verification

All paths below are defined in this frontend. Listing them does not establish their deployed availability or authorization behavior. `{id}` and other braces are target identifiers.

| Family | Mutating endpoints / methods |
| --- | --- |
| Articles | `POST /articles/articles`; `PATCH, DELETE /articles/articles/{id}`; `POST /articles/articles/{id}/publish` |
| Article categories | `POST /articles/article-categories`; `PATCH, DELETE /articles/article-categories/{id}` |
| Shared files | `POST /articles/file-upload`; `POST /articles/file-delete` (deletion takes a URL) |
| Article resource permissions | `PATCH /articles/article/permissions/bulk` |
| Events | `POST /events/events`; `PATCH, DELETE /events/events/{id}` |
| Event categories | `POST /events/event-categories`; `PATCH, DELETE /events/event-categories/{id}` |
| Event participation | `POST, DELETE /events/events/{id}/register` |
| Document folders | `POST /documents/documents/folders`; `PATCH, DELETE /documents/documents/folders/{id}` |
| Documents | `POST /documents/documents/upload`; `PATCH, DELETE /documents/documents/{id}` |
| Folder permissions | `PATCH /documents/folder/permissions/bulk` |
| Trainings | `POST /trainings/trainings`; `PATCH, DELETE /trainings/trainings/{id}` |
| Training categories / permissions | `POST /trainings/training-categories`; `PATCH, DELETE /trainings/training-categories/{id}`; `PATCH /trainings/training/permissions/bulk` |
| TechnicoPro | `POST /technicopro/technicopros`; `PATCH, DELETE /technicopro/technicopros/{id}`; `POST /technicopro/technicopros/{id}/publish` |
| TechnicoPro categories / permissions | `POST /technicopro/technicopro-categories`; `PATCH, DELETE /technicopro/technicopro-categories/{id}`; `PATCH /technicopro/technicopro/permissions/bulk` |
| Forums | `POST /forums/forums`; `PATCH, DELETE /forums/forums/{id}`; `PATCH /forums/forums/permissions/bulk` |
| Topics | `POST /forums/forums/{forum_id}/topics`; `PATCH /forums/topics/{topic_id}/update`; `DELETE /forums/topics/{topic_id}/delete`; `PATCH /forums/topics/{topic_id}/pin` |
| Posts / moderation | `POST /forums/topics/{topic_id}/posts`; `PATCH, DELETE /forums/posts/{post_id}`; `PATCH /forums/posts/{post_id}/moderate` |
| Members | `POST /user/users`; `PATCH, DELETE /user/users/{id}`; `DELETE /user/users/{id}/soft`; `PATCH /user/users/{id}/restore`; `PATCH /user/users/{id}/validate`; `PATCH /user/users/{userId}/photo_upload` |
| Roles / feature permissions | `POST /user/roles`; `PATCH, DELETE /user/roles/{id}`; `POST /user/permissions`; `PATCH /user/permissions/{id}`; `POST /user/user-permissions`; `PATCH /user/user-permissions/{id}` |
| Self-service | `PATCH /user/users/me`; `PATCH /settings/notifications/preferences`; `POST /auth/reset_password` |
| Account bootstrap / recovery | `POST /auth/signup`, `/auth/login`, `/auth/send_otp`, `/auth/verify_otp`, `/auth/forgot_password`, `/auth/refresh` (separate identity flows) |
| Admin settings | `PUT /settings/admin/smtp`; `POST /settings/admin/smtp/test`; `DELETE /settings/admin/logs`; `PUT /settings/admin/backups/config`; `POST /settings/admin/backups/run`; `POST /settings/admin/backups/test-permissions`; `DELETE /settings/admin/backups/{id}` |

Read/export endpoints such as member CSV, document downloads, admin logs, and backup downloads also require their own access checks, but do not implement content create/edit/delete.

## Verification performed

| Check | Result | Meaning |
| --- | --- | --- |
| `node scripts/test-article-authorization.mjs` | 4 tests passed | Owner/action matrix, superuser behavior, missing/inactive data, overrides, direct RTK calls, refreshed grants, and 403 handling covered with mocked fetch |
| `node --test tests/admin-permissions.test.mjs` | 12 tests passed | Permission editor target isolation, denied/loading/error states, payloads, invalidation, and parent hook ordering covered |
| `npm.cmd run lint` | Passed | TypeScript `tsc --noEmit`; this is not an authorization/security test |
| Server/DB integration and authenticated browser role matrix | Not performed | No conclusion about deployed API enforcement or actual grants can be drawn |

PowerShell blocked the `npm.ps1` launcher under the machine execution policy; running `npm.cmd run lint` completed successfully without changing policy.

No new tests or fixes were added. Existing passing tests do not cover the identified cross-module authorization gaps.

## Recommended fix order and acceptance criteria

1. **Verify and secure backend authority first.** For every write, derive identity, eligibility, grants, and superuser status from the authenticated server context. Assign creators server-side; reject owner reassignment and privilege spoofing. Require the relevant action plus ownership for ordinary users at write time. Only superusers may override owner scope. Denials must leave records and associated files unchanged.
2. **Close privileged account changes.** Restrict `is_superuser`, role/permission escalation, and other administrative account fields to superusers. Define whether delegated member management is allowed at all and, if so, which records and fields it covers.
3. **Define missing owner/category/container contracts.** Return stable creator IDs or trusted capabilities. Decide category scope, moderator exceptions, inactive-superuser handling, and cross-owner descendant deletion before implementing those cases.
4. **Apply one consistent frontend resource rule.** Cover all content modules, create actions, status transitions, uploads/removals, modal opening, submission, and delete confirmation. Fix forum reply create permission and separate topic/post edit/delete grants. Respect additional resource restrictions.
5. **Cover API entry points, not just pages.** Review shared file deletion by URL, all bulk permission endpoints, publishing, alternate routes, photo targets, and account bootstrap fields. Reconcile the duplicate Events page and update RBAC documentation.
6. **Run the same integration matrix for every resource family.** Use ordinary users A/B and a superuser; test absent, base, overridden, and revoked grants; own versus other-owned and missing-owner records; direct requests bypassing UI; inactive/deleted accounts; spoofed owner/privilege fields; and permissions/ownership changing between GET and write. Confirm permitted requests succeed and denied writes return 403 (or deliberate concealment 404) without side effects. Verify superuser writes succeed across owners and feature grants under the agreed account lifecycle policy.

Before remediation can be declared complete, the backend implementation and actual permission assignments must be inspected or tested. This frontend-only audit establishes the gaps above, not production security certification.
