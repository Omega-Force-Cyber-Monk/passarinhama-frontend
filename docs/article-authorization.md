# Article edit/delete authorization

Ordinary users need both matching article.author.id/currentUser.id and the existing article edit or delete permission. Edit and delete remain independent. Only is_superuser === true bypasses ownership. Role names and display author strings never grant access. Missing user, article, author ID, or ordinary permissions deny modification. A superuser can modify an existing article even if author data is absent.

The shared helper calls the existing hasPermission resolver. This repository currently resolves permissions plus user_permissions (including explicit overrides); effective_permissions is not its established source of truth. No independent array merge or new edit_any/delete_any capability was added. A future change of the authoritative permission source belongs in the central resolver and API types, with backend contract tests.

## Frontend coverage

- Articles.tsx preserves the API author object, filters card actions per article, guards opening/submitting edit forms and opening/confirming deletion, and uses currentData to prevent the previous article query result from authorizing a different ID.
- AdminPanel.tsx applies the same checks to article table actions, edit forms, and delete confirmation handlers. Other entity handlers keep their existing behavior.
- useArticleAuthorization denies actions until the connected current-user query is successful and matches the Redux user, and while that query is refreshing or failed. Redux user changes recompute authorization.
- updateArticle/deleteArticle re-fetch /user/users/me and the target article before PATCH/DELETE, so manually invoking RTK mutations, forged modal state, or stale Redux grants cannot bypass the frontend check. This adds two GET requests per modification and requires access to the article detail endpoint. Read failures deny the operation.
- API 403 errors pass through unwrap() to the existing error toasts; no success is reported on failure.
- ArticleDetail.tsx is read-only. There is no standalone article edit route. Creation, publishing, categories, article-specific read/write permissions, and request payloads keep their existing behavior.

## Required backend enforcement (not implemented here)

This repository is frontend-only; backend security has not been verified or fixed. The backend must authorize atomically when processing each PATCH /articles/articles/{id} and DELETE /articles/articles/{id}:

1. Resolve the authenticated user and current permissions from trusted server data.
2. Allow an explicitly flagged superuser; otherwise require an eligible active user, the matching article can_edit/can_delete permission, and the persisted article owner ID matching the authenticated user ID.
3. Deny other owners even for roles named admin/Administrator and even when article-specific can_write is granted; preserve existing resource restrictions as additional checks.
4. Never accept client-provided author, role, permission, or superuser values as authorization evidence; prohibit owner reassignment through article update payloads.
5. Return HTTP 403 for denied operations without changing the article or related attachments. Enforce the check at the write itself because ownership/permissions can change after the frontend GET checks.
6. If cross-owner access is later needed, define and return explicit action-specific backend capabilities, then extend the shared authorization helper under that contract. Ordinary can_edit/can_delete must continue to require ownership.

Review alternative article write paths, including publishing and attachment deletion, for backend resource authorization while retaining the existing workflow. Frontend publishing behavior was intentionally preserved in this change.

## Validation

Run node scripts/test-article-authorization.mjs (Node 22.15+ with registerHooks support) and npm run lint.

Automated tests cover the ownership/permission matrix, superusers, Administrator role names, missing data, inactive/deleted users, direct permission overrides, direct RTK mutation calls with another owner, revoked server permissions despite stale Redux grants, authorized PATCH/DELETE, and read/write HTTP 403 responses. Fetch is mocked; these are frontend regression tests, not backend integration tests.

Backend integration tests must repeat the full matrix using real authenticated PATCH/DELETE requests, including requests made without this frontend, spoofed ownership fields, ownership/permission changes between read and write, inactive/deleted users, article-specific restrictions, and 403 responses with unchanged records/files. Verify creation, draft/pending/published transitions, category management, reading, and article permission management against the deployed API. Browser interaction testing of loading states and dialogs remains a manual validation step.

Modified/added files: src/pages/Articles.tsx, src/pages/AdminPanel.tsx, src/hooks/useArticleAuthorization.ts, src/redux/features/articles/articleAuthorization.ts, src/redux/features/articles/articlesApi.ts, src/redux/features/auth/authApi.ts (exports the existing profile normalizer), tests/article-authorization.test.ts, scripts/test-article-authorization.mjs, and this document.
