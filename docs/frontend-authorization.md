# Frontend authorization implementation and backend checklist

Implemented 4 November 2026 against the [pre-change audit](user-permissions-audit-2026-11-04.md). This repository contains the frontend. Backend authorization has not been inspected, modified or verified.

## Implemented behavior

- Protected operations require authentication, a resolved matching current identity, active status and `is_deleted === false`. Inactive/deleted superusers are denied.
- Existing inherited grants and individual overrides remain in use. Each action is independent; individual `false` overrides inherited `true`. Ownership alone grants nothing.
- Articles, events, trainings, TechnicoPro, documents, forum topics and posts require the applicable action grant plus API ownership for ordinary edit/delete/status changes. Publishing uses edit plus ownership.
- Ordinary replies/topics require create and explicit forum `can_post`; replies also require an explicitly unlocked topic. A role name grants no cross-owner moderation.
- Shared categories, forum-container management, existing folder modification/deletion, pinning, moderation, roles/permissions, account administration, exports, admin settings/logs/backups, and standalone URL-based file deletion are active-superuser-only.
- Ordinary topic deletion is limited to server `reply_count === 0`. Nonempty topics and folder/container deletion require a superuser until safe cascade authorization exists.
- Document uploads and nested folder creation require `document.create` plus verified parent `can_upload`. Document rename/delete checks `uploaded_by.id`.
- Member directory hides privileged controls from ordinary users. Delegated creation strips everything outside an ordinary-account field allowlist at both submission and final request. Existing account administration requires superuser; self editing stays through `/me`.
- Shared uploads carry feature/target/parent locators, never caller-supplied authorization decisions. Server ownership is fetched; client-only metadata is stripped before sending requests.
- Protected RTK requests fetch the current profile, check session identity/eligibility, and apply an explicit endpoint policy. Ordinary writes fetch canonical targets. Unknown writes are denied. Sensitive reads/exports and ordinary feature view grants are guarded. Existing token refresh/logout and error handling remain.
- Controls and final handlers recheck authorization, including confirmations/forms after revocation.
- `/events` now persists creation through the existing create API; temporary fabricated records/owners were removed. Success requires an API success.

## Changed files

| Area | Files |
| --- | --- |
| Shared policy/API | `src/redux/features/auth/permissionUtils.ts`, new `resourceAuthorization.ts`, new `src/redux/features/api/mutationAuthorization.ts`, `apiSlice.ts` |
| Hooks/navigation | `src/hooks/usePermissions.ts`, `useArticleAuthorization.ts`, `src/components/PermissionRoute.tsx`, `src/layouts/DashboardLayout.tsx` |
| Content pages | `src/pages/Articles.tsx`, `Agenda/Agenda.tsx`, `Events.tsx`, `DocumentLibrary.tsx`, `Trainings.tsx`, `TechnicoPro.tsx`, `Forums.tsx` |
| Administrative pages | `src/pages/MemberDirectory.tsx`, `AdminPanel.tsx`, `Moderation.tsx` |
| Resource APIs/types | `src/redux/features/articles/articleAuthorization.ts`, `articlesApi.ts`, `src/redux/features/documents/documentsApi.ts`, `src/redux/features/forum/forumApi.ts`, `src/types/forum.ts` |
| Tests/runner | New `tests/frontend-authorization.test.ts`; updated article authorization, admin UI, agenda/documents modal, members/admin modal and trainings/TechnicoPro modal tests; `scripts/test-article-authorization.mjs` |
| Documentation | `RBAC_GUIDE.md`, `docs/article-authorization.md`, this document |

The audit is retained as the historical findings report. No dependencies, styles, routes or backend services were added.

## Validation

```powershell
node scripts/test-article-authorization.mjs
node scripts/test-article-authorization.mjs ../tests/frontend-authorization.test.ts
node --test tests/*.test.mjs
npm.cmd run lint
npm.cmd run build
```

The new suite exercises each feature/action combination, owners/nonowners/missing owners, personal overrides, revoked grants despite stale client state, inactive/deleted superusers, unresolved identity, forum posting/locks/cascades, publishing, categories/containers, member escalation payloads, files, direct RTK calls, confirmation/form revocation, token refresh/logout and server 403. Existing UI fixtures now supply authorized contexts; additional denial tests execute actual handlers. Fetch is mocked: these are frontend regression tests, not backend integration tests. Live browser interaction and backend integration were not performed.

Results: 4 article authorization tests, 11 cross-module authorization tests, and 85 existing UI/permission tests passed (100 total). TypeScript and production build passed. The first sandboxed build could not read Vite's config ancestry; the same build succeeded with broader filesystem access. Vite reported its large-chunk advisory.

## Missing backend contracts and limits

1. **Delegated ordinary account creation:** frontend create-account types historically require `role_id`. Ordinary requests deliberately omit role, status, superuser, permissions and payment fields. The server must select a safe nonprivileged default. If it requires `role_id`, delegated creation will fail with its validation error until a safe server default workflow exists. No privileged default is inferred from a role name or list order.
2. **Folder/category/forum-container/member creator IDs:** reliable immutable creator IDs are absent. Ordinary modifications stay blocked. Categories/forum containers are intentionally shared superuser-managed configuration.
3. **Cascade authorization:** no trusted atomic capability guarantees that deleting a topic/folder/container cannot remove others' descendants. Ordinary users can delete only empty topics; folders/containers require superuser.
4. **Forum target access:** no established individual-topic/post GET exists here. Ordinary preflights use existing paginated forum/topic lists with parent locators and exact target matching. Searches stop after 100 pages of 100 items; unresolved/inaccessible targets deny writes. Canonical target/capability endpoints would reduce reads and remove this bound. Missing `can_post` or `is_locked` denies ordinary posting.
5. **Documents:** no individual document GET contract exists here. Preflight uses folder contents and verifies ID, folder and uploader. Missing parent context denies ordinary direct mutations. Folder `can_upload` must describe the authenticated actor.
6. **Files:** standalone deletion takes only a URL, without trusted file/parent ownership metadata. It stays superuser-only. Attachment removal through parent updates still needs server validation that each URL belongs to that parent.
7. **Canonical ownership:** articles use `author.id`; events/trainings use `created_by.id`; documents use `uploaded_by.id`; TechnicoPro uses `author.id` or `author_id` (conflicts deny); forum list rows use `author.id`. Missing data is never filled with viewer IDs or display author text.

Fresh profile/target reads add requests and deny actions when reads fail or return insufficient data. The shared page profile query refetches on mounts when older than 30 seconds; final protected requests always fetch the profile independently. Unrecoverable 401 triggers existing logout/cache reset and may abort the pending RTK request.

## Required backend security checks

Concrete paths are in the [audit endpoint inventory](user-permissions-audit-2026-11-04.md#write-endpoint-inventory-for-backend-verification).

| Endpoint family | Server checks still required |
| --- | --- |
| All protected operations | Authenticate; require active/non-deleted account including superusers; derive grants/superuser status from trusted storage; enforce resource restrictions |
| Articles, events, trainings, TechnicoPro, documents, forum topics/posts | Independent action grant plus immutable persisted ownership for ordinary writes; prevent owner reassignment, target/parent substitution and mass assignment |
| Creation | Require feature create; assign creator server-side; reject caller ownership/privilege evidence |
| Members, account create/update/delete/soft-delete/restore/validate, photo upload | Ordinary field allowlist and safe defaults; superuser-only administrative fields/actions; `/me` and photos scoped to self or superuser |
| Categories, folders, forum containers | Shared configuration policy; parent write capability; protection against cross-owner descendant/cascade deletion |
| Topics/replies | Create plus posting capability, unlocked discussions, verified parent relationships |
| Publish/status endpoints and status fields | Edit plus owner or active superuser; allowed transitions |
| Role/personal/resource bulk permissions | Active-superuser-only; validate every target and field; recompute affected permissions |
| Shared uploads/deletion and attachment-removal URLs | Assign file ownership; check parent/action/file association; reject arbitrary other-user URLs/paths and unauthorized physical deletion |
| SMTP, logs, backups, moderation, exports | Active superuser for configuration, cross-owner moderation, clearing/deletion and sensitive reads/exports/downloads |
| Profile/password/notifications/signup/recovery/registration | Separate self-service policy and field allowlists; prevent privilege spoofing; self-scoped participation and capacity/state checks |
| Lists/search/dashboard/downloads | Filter resources and sensitive fields server-side; enforce read/export rights independently of routes |
| Every write | Authorize atomically against current permissions, ownership, locks and descendants; deny with 403 or deliberate concealment 404 without record/file side effects |

Repeat the matrix using real authenticated requests bypassing this frontend, spoofed creator/role/superuser fields, and changes between read and write. Do not describe the application as fully secure until backend verification passes.
