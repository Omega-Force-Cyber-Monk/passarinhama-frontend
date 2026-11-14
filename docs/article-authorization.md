# Article authorization

An authenticated, active, non-deleted ordinary user needs matching `article.author.id` / current-user ID and the corresponding article action grant for existing-record modifications. Edit and delete are independent; ownership grants neither. Publishing an existing draft requires edit plus ownership. Creating a new Draft or Published article requires create; View is independently required for normal page navigation. Only active `is_superuser === true` accounts bypass feature grants and ownership. Missing identity, target/owner data or permissions fails closed; personal denials override inherited grants.

`articleAuthorization.ts` delegates to the shared `auth/resourceAuthorization.ts` helper. `useArticleAuthorization` uses the server-profile-backed `usePermissions` hook. Card actions, edit modal opening/submission, publishing and delete confirmation use the same policy. Shared article categories and resource permissions are superuser-only; detail pages remain read-only.

The shared API base query now owns the former article-specific preflight. `api/mutationAuthorization.ts` fetches `/user/users/me`, checks session identity/account eligibility, and fetches `/articles/articles/{id}` before ordinary-user edit/delete/publish. Missing/mismatched targets or read errors deny writes. Active superusers bypass owner reads. Creation uses its independent create grant. Shared uploads carry editor locators; standalone URL-based deletion is superuser-only until trusted file/parent ownership metadata exists. Existing error handling remains.

Run `node scripts/test-article-authorization.mjs`, `node scripts/test-article-authorization.mjs ../tests/frontend-authorization.test.ts`, and `npm.cmd run lint`.

Tests mock fetch around real RTK endpoints. They do not verify deployed backend enforcement. The server must check account eligibility, action grants, immutable ownership, status transitions, attachment associations and privileges atomically at write time. Frontend preflight cannot prevent direct external requests or permission changes between read and write.

See the [cross-module implementation and backend checklist](frontend-authorization.md).
