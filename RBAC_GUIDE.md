# Frontend authorization

Protected operations require authentication and an active, non-deleted account, including superusers. Use independent feature grants: view to read, create to create, edit plus API ownership to edit/publish/change status, and delete plus API ownership to delete. Ownership alone grants nothing. Explicit individual denials override inherited grants. Only trusted active `is_superuser === true` bypasses feature grants and ownership; role names never do.

Use `usePermissions` for controls and `canModify(feature, apiResource, action)` for resource actions. The hook requires a successful current-user query matching the session. Never authorize from local storage, display names, form owner fields, or caller-supplied owner IDs. `permissionUtils.ts` resolves grants, `resourceAuthorization.ts` checks ownership, and `mutationAuthorization.ts` applies final fresh-profile/target checks through the shared RTK base query. Client-only parent locators are stripped from requests.

Shared categories, forum containers, existing folder modifications, roles/permissions, account administration, cross-owner moderation, exports, settings/logs/backups and standalone file deletion are active-superuser-only. Ordinary users can delete only empty forum topics until safe cascade authorization exists. Replies require create, explicit `can_post` and an explicitly unlocked topic. Document uploads and nested folder creation require create plus parent `can_upload`.

Delegated `user.create` sends only ordinary fields, with no role, superuser, status, permissions or payment assignment. The server must choose a safe default account role; a required caller-selected `role_id` contract must be resolved server-side. Existing account administration requires superuser. Preserve self-profile changes through `/user/users/me`; password, photo, notifications, registration, signup and recovery use separate self-service policies.

Missing permissions, ownership, capability data, inactive/deleted accounts or unresolved/mismatched identity fail closed. New writes must declare a final endpoint policy. Check current authorization on rendering, opening, submitting and confirming; hiding controls is insufficient.

Frontend checks are UX safeguards and cannot secure the backend. See [implementation notes, changed files, tests and backend checklist](docs/frontend-authorization.md).
