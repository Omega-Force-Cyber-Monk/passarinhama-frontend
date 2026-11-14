# Authorization fixes — 14 November 2026

Targeted implementation of the six findings in the [source audit](user-roles-permissions-audit-2026-11-14.md). Historical audits are unchanged. The [RBAC guide](../RBAC_GUIDE.md) is the current policy reference. No routes, dependencies, backend fields or endpoints were added.

## Finding status

| Finding | Status | Result |
| --- | --- | --- |
| F1: unsafe shared-folder deletion | Fixed (frontend) | Folder controls, target handlers, shared helper and final RTK authorization require an active, non-deleted superuser. File deletion still requires document Delete plus uploader ownership for ordinary users. Upload/nested creation rules are unchanged. |
| F2: dashboard read authorization | Fixed (frontend) | All three dashboard reads are explicitly administrative. Policies use endpoint names rather than encoded/decoded URL prefixes. Unknown reads deny even superusers. Public auth/profile hydration and shared online-presence/preferences/search exceptions are named explicitly. Other administrative operations are also classified explicitly. Dashboard/standalone Moderation remain unrouted. |
| F3: personal permission inheritance | Partially Fixed | Unsafe first-row creation is blocked in the UI and final RTK guard. Existing boolean PATCH preserves untouched inherited actions; null-reset writes deny. The editor loads the selected member's profile and displays Inherit/Allow/Deny, inherited grants and effective access including drafts, eligibility and superuser behavior. Full creation and saved reset-to-inherit await a verified inheritance-safe backend contract. |
| F4: stale Training detail | Fixed | Uses currentData and a loading state when the requested ID lacks its own response. Loading, 403, 404, transport error and successful current-record rendering are covered. |
| F5: module-only Home access | Fixed | TechnicoPro-only, directory-only and document-only users receive authorized module links instead of a misleading restriction. No-grant/ineligible users remain restricted; existing feeds keep their view-based query skips. |
| F6: publication policy | Fixed (frontend policy clarified) | Initial Draft and Published records both require Create. Modifying/publishing existing content requires Edit plus ownership; Delete remains independent. Status-field help and guards document the distinction. No new publish/approval permission was added. |

## Intentional behavior changes

- Ordinary document Delete no longer authorizes folder deletion, including empty/visible/uploadable folders. No recursive client deletion is attempted.
- Protected reads require an explicit feature, administrative or shared policy. Dashboard/statistics, activity logs, configuration, logs/backups and sensitive exports use eligible-superuser policies. New endpoints must declare a policy.
- Personal override POST is unavailable, including direct RTK calls, because its known four-boolean contract cannot preserve untouched inheritance. This does not delete or repair historical stored overrides. Role-row creation and existing member boolean PATCH remain supported.
- Search hides unknown/denied result types and counts only visible returned rows. The visible count is not an unfiltered server total.

Create and View remain independent: normal module routes require View, while a direct collection POST checks Create. This existing distinction is preserved rather than silently granting View or requiring it for creation. Eligible superuser bypass and independent action/ownership checks remain in place. Role names grant no authority.

## Files changed

| Files | Purpose |
| --- | --- |
| `src/redux/features/auth/resourceAuthorization.ts` | Superuser-only shared-folder helper. |
| `src/redux/features/api/mutationAuthorization.ts` | Explicit read/admin/public policies, default-deny reads, safe personal-override boundary, publication policy comment. |
| `src/pages/DocumentLibrary.tsx` | Folder control and handler policy; file rules unchanged. |
| `src/pages/admin/AdminPermissionsEditor.tsx` | Selected-member profile, inherited/effective summaries, explicit states, safe blocked creation/reset and preserved changed-field PATCH. |
| `src/pages/TrainingDetail.tsx` | Parameter-specific currentData rendering. |
| `src/pages/Home.tsx` | Authorized landing links for users without feed permissions. |
| `src/layouts/DashboardLayout.tsx` | Authorized search rows/count; unauthenticated and unknown types fail closed. |
| `src/components/ui/ContentListing.tsx`, `src/pages/Articles.tsx`, `src/pages/Trainings.tsx`, `src/pages/TechnicoPro.tsx` | Creation/existing publication help without changing grants or accepted status workflows. |
| `src/i18n/locales/en.json`, `src/i18n/locales/fr.json` | Localized inheritance, landing and publication explanations. |
| `tests/admin-permissions.test.mjs` | Safe blocked first override, inherited/effective display, explicit Allow/Deny, untouched fields, unsupported reset, profile failure and preserved existing editor tests. |
| `tests/frontend-authorization.test.ts` | Direct folder/dashboard/unknown-read/override rejection, forged stale superuser write state, legitimate reads/file writes, independent creation and existing publication transitions. |
| `tests/permission-detail-navigation.test.mjs` | Training coverage and successful/403/404/transport-error transitions for all three detail pages. |
| `tests/session-lifecycle.test.ts` | Corrected folder policy; real permitted document reads replace an unmapped synthetic probe while preserving concurrent refresh assertions. |
| `tests/home-search-permissions.test.mjs` (new) | Restricted/module-only/superuser Home, skipped queries, visible search metadata/count, publication choices and bilingual labels. |
| `RBAC_GUIDE.md`, `docs/frontend-authorization.md`, `docs/article-authorization.md`, `docs/agenda-category-ui.md` | Current policy, lifecycle, publication, category and backend limitations. |
| `docs/user-manual/COMPLETE_USER_MANUAL.md`, `CRUD_AND_PERMISSIONS_MATRIX.md`, `FILE_OPERATIONS_REFERENCE.md`, `FORM_FIELD_REFERENCE.md` | Remove unverified default-role rights and correct moderator, member, forum-container, inheritance, file and publication guidance. |
| This implementation summary | Status, verification and remaining dependencies; preserves historical reports. |

## Validation

| Command / suite | Result |
| --- | --- |
| `node --test tests/*.test.mjs` | 120 passed. |
| `node scripts/test-article-authorization.mjs` | 4 passed. |
| `node scripts/test-article-authorization.mjs ../tests/frontend-authorization.test.ts` | 17 passed. |
| `node scripts/test-article-authorization.mjs ../tests/session-lifecycle.test.ts` | 12 passed. |
| `node scripts/test-article-authorization.mjs ../tests/roles-permissions-audit.test.ts` | 5 passed. |
| `npm.cmd run lint` | Passed (`tsc --noEmit`). |
| `npm.cmd run build` | Passed with broader filesystem access after Vite's config loader hit the sandbox ancestry restriction; existing large-chunk advisory. |

**158 tests passed, zero unresolved failures; 28 added tests.** Existing tests were retained. Assertions for ordinary folder deletion and unsafe first override creation were deliberately updated to the corrected policy. One token-refresh test initially failed because its synthetic endpoint was correctly denied; it now uses an actual permitted document read with the same concurrency, success, single-refresh and ready-state assertions. The final complete JavaScript suite passed after all test additions.

No browser or deployed backend integration was performed. Tests execute actual endpoint guards and selected component/handler code with mocked fetch or VM harnesses. They establish frontend request rejection/behavior, not deployed server enforcement.

## Remaining backend dependencies and limits

- **Personal overrides:** the established create type requires four non-null booleans; PATCH permits optional booleans. No partial/nullable create or persisted inheritance-reset contract is established. Backend must document or implement those semantics before blocked workflows can be enabled. Existing historical denials need administrator review rather than automatic removal.
- **Atomic authorization:** server must enforce identity, eligibility, effective grants, immutable ownership, parent/capability checks, publication rules and folder/file cascades at commit time. Frontend state can be tampered with; fresh-profile write tests do not secure a server that trusts client assertions. Stored/forged role names never grant frontend permissions.
- **Resource reads/search/assets:** lists, details, drafts, snippets, extras, metadata, totals and asset routes/signed URLs require server filtering and authorization. Existing direct attachment fetch/preview/download helpers remain unchanged and sit outside RTK preflight. Attaching a token is not proof of resource authorization.
- **Revocation:** focus/reconnect and mutation invalidation still refresh the current profile; refreshed grants immediately govern controls and handlers, and final writes still fetch fresh profile/targets. No polling was added. Resource-only ACL changes with unchanged feature grants require backend enforcement and an agreed cache-refresh strategy. Already downloaded files/open Blobs cannot be revoked by client checks.
- **Existing contract limits:** delegated account creation still needs a safe server default role; target preflights still use bounded forum lists and folder contents. No guessed capability, owner field, endpoint or role baseline was introduced.
