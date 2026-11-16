# Frontend cache management fixes — 16 November 2026

Implementation against `71874a7`, following [the cache audit](frontend-cache-management-audit-2026-11-16.md). Redux Toolkit/RTK Query, routes, existing backend URLs, permission policy and default retention remain in place. No dependency was added. No backend was changed. Folder deletion remains active-superuser-only; unsafe personal-override creation/reset remains blocked.

## A. Executive summary

**16/16 audit findings Fixed within the frontend scope. Partially Fixed: 0. Blocked: 0.** This status describes implemented and tested client behavior, not backend authorization certification or immediate delivery of changes to another user's session.

The implementation publishes trusted current-profile evidence consistently, prevents older profile responses and obsolete sessions from restoring state, validates admin editor targets, removes durable profile JSON and persistent forum topic overlays, links missing cache dependencies, preserves dirty drafts, and loads Admin/content tabs on demand.

Controlled HTTP dispatch measurements include:

- Admin's cold Members **tab data**: **16 → 2** requests. This excludes the shared application session/layout requests in both measurements.
- Notification preference update: **6 → 3**, retaining the fresh write-authorization `/me` call.
- Article creation on Published: **4 → 3**, removing the inactive Draft-list request.
- Member role update with ME/list/detail/roles subscribed: **5 → 4**, avoiding an unnecessary second ME read while refreshing the changed member.
- Event registration with two events' projections subscribed: **10 → 6**, preserving the affected event's detail, registrations, month and upcoming projections.
- Forum replies **4 → 6** and document uploads **3 → 4** in the measured fixtures: the additional requests correct missing parent/pinned/folder-count freshness, rather than representing a regression in redundant traffic.

**209 tests passed: 158 existing + 51 new.** TypeScript and production build passed. Five actual React server renders also passed. Browser E2E was unavailable because Playwright is not installed in this workspace; no dependency was installed to run it. Remaining limitations concern backend contracts, remote revocation delivery and browser-platform verification, detailed below.

## B. C01–C16 status matrix

File paths in this table are relative to `src/` unless under `tests/`. Names abbreviated here are listed fully in section E.

| Finding | Status | Files changed | Fix | Verification |
| --- | --- | --- | --- | --- |
| C01 Fresh ME synchronization | Fixed | `redux/features/api/apiSlice.ts`, auth normalizer/slice/types, `membersApi.ts`, `ProtectedRoute.tsx` | Same-session, matching-identity ME responses publish into auth and the current-profile cache. Client request ordering rejects older profile evidence; final writes and late reads recheck newer known revocations. Inactive/deleted profiles restrict protected routes. Successful self-profile responses are published without another mandatory GET. | Fresh revoked/inactive/deleted preflights; delayed old ME; concurrent preflight revocation; late protected read; existing session/authorization tests; self-profile network count. |
| C02 Wrong-record admin editor | Fixed | `pages/AdminPanel.tsx`, `utils/recordDraft.ts` | All five affected detail hooks use currentData. Form initialization and submission require the selected target's own successful response. Unresolved editors are disabled; target changes reset initialization. | A→B→A for all five hook blocks; actual effect/submit tests verify B cannot receive A's privileged fields; successful B payload, loading and error checks. |
| C03 Cross-tab session coherence | Fixed | auth storage/sync/slice, store, API, attachments | Atomic credential/session record; storage/focus reconciliation; genuine replacement/logout resets identity-bound state; token rotation preserves cache. Same-origin refresh uses Web Locks where available. Obsolete refresh/logout cannot overwrite a newer login. Files read the resolved Redux credential and reject late session results. | Two simulated stores/tabs and storage events; token rotation preserves cache/version; replacement/logout clears cache; obsolete writes; real attachment helper headers and late completion; existing concurrent-401 test. |
| C04 Profile persistence | Fixed | `authSlice.ts`, `sessionStorage.ts` | Full profile/permission JSON is no longer written. Legacy user JSON is removed during restoration and credential writes. Only credentials/session identity remain durable. | Storage assertions after login and successful ME; restored auth still starts without trusted profile grants; existing malformed legacy-profile test. |
| C05 Deleted detail reuse | Fixed | article/training/TechnicoPro/member APIs | Successful delete invalidates entity IDs plus lists/projections. Detail and permission entries participate. Supported self hard/soft deletion logs out only the matching current session after success. | Read→delete→revisit tests for all four families issue a server-backed 404; permission entries removed; self-delete clears identity-bound cache. |
| C06 Folder/document graph | Fixed | `documentsApi.ts`, `DocumentLibrary.tsx` | Recursive tree IDs; folder-content tags; upload/delete counts; rename/capability dependencies; one captured branch invalidation batch for folder deletion/ACL changes; document-tagged download descriptors. File-route validation waits for the current content request. | Upload target versus unrelated folder; tree count invalidation; nested ACL/delete/permissions/descriptors; rename/delete; original preview/cancellation tests. |
| C07 Forum graph/counts | Fixed | `forumApi.ts`, `moderationApi.ts`, `Forums.tsx` | Topic IDs connect topic pages and pinned copies; reply changes refresh parent counts. Forum delete and ACL changes capture known descendant topics/posts. Unknown parent relationships use a conservative Post fallback. Moderation refreshes relevant projections without changing policy. | Reply create/edit/delete; topic/parent/pinned tag relationships; forum deletion; forum ACL descendants; existing owner/lock/moderation tests. |
| C08 Local pinned shadow cache | Fixed | `Forums.tsx` | Removed persistent local topic/post arrays and hidden-ID overlays. Pin results reconcile through server/RTK data; no full-record local copy can override a later response. No new optimistic patch or rollback path was needed. | Real pin handler followed by empty/changed server topic results; existing pin restrictions and forum UI tests. |
| C09 Previous-argument rendering | Fixed | Articles, Directory, Admin, Agenda, Events, DocumentLibrary | CurrentData isolates rows/counts/participants by arguments. Loading states distinguish missing-current responses from valid same-key background reuse. Agenda participant query uses the actual detail event ID. | Existing standalone detail transition tests; five admin currentData transitions; document fetch-wait check; existing Agenda/member modal tests and actual React rendering. |
| C10 Sidebar generation race | Fixed | `SidebarCategorySection.tsx` | Generation changes on page-one response/timestamp/skip changes. Late obsolete page results cannot append or clear a newer request's loading state. Page-one freshness resets extra-page accumulation, including structurally shared results. | Actual pending page-two callback resolved after page-one reset; obsolete rows are ignored and page remains reset. |
| C11 Search freshness | Fixed | dashboard API/layout | Trim/default-normalized keys; Search tag; declarative subscription only while open; preserved 300 ms debounce; current term/result agreement; explicit retry/reopen behavior without last-term suppression. | Earlier-term results hidden; unchanged automatic calls suppressed; forced refresh; failed-query reopening; cache reuse versus invalidation; feature-filtered rows/counts remain covered. |
| C12 Role member profiles | Fixed | member API/cache tag helper | Profile/list/ME entries provide RoleMembers dependencies using real role IDs where present. Grant mutations invalidate affected role members; unknown role metadata has a conservative fallback. Target user tags connect personal overrides and own ME without refetching every unrelated profile. | Affected/unrelated role profile test; existing local role reassignment/ME test; permission editor still blocks unsafe create/reset; endpoint assertions updated to the new dependency model. |
| C13 Embedded categories | Fixed | article/training/TechnicoPro/event APIs | Dedicated category-list and category-ID dependencies. Renames reach embedded detail/list metadata. Deletions also rebuild collection membership/pagination, including pages without the deleted category. | Training/TechnicoPro rename versus unrelated detail; Article/Training/TechnicoPro delete-category pagination tests; event tag breadth test. |
| C14 Dirty drafts | Fixed | Profile, Articles, Admin, `recordDraft.ts`, localized labels | Per-target baseline reconciliation refreshes pristine drafts and preserves changed values/files. Server changes produce a visible conflict notice. Intentional target changes reset drafts; permission checks continue independently. | Actual Profile/Article/Admin effects preserve unsaved values; target switch resets; local files survive; own-save response reconciles; authorization regression tests retained. |
| C15 Broad/failed invalidation | Fixed | API definitions, cache tag helper, permission editor | Dedicated preference/role/category/aggregate tags; event registration uses entity tags. Definite non-write failures retain good cache; ambiguous network/timeouts/5xx reconcile scoped dependencies. Removed redundant manual permission/pinned refetch intent. Non-pinned reply changes leave unrelated pinned snapshots alone, and pinning does not refresh unchanged replies. | Notification 6→3; registration 10→6; unrelated event/category/profile preservation; definite 403 versus ambiguous transport; existing fresh write guards. |
| C16 Hidden Admin data | Fixed | AdminPanel, Articles | Inactive tab hooks skip. Roles load for Members/roles views; other lookups/settings/moderation load in their tab. Only active article status subscribes. Valid cached tabs reuse normal RTK retention. | Actual Admin query blocks dispatch 2 cold Members GETs, 2 first Articles GETs, 0 cached-return GETs; leaving Admin suppresses unrelated GETs; common session requests remain. |

## C. Cache invalidation and lifecycle changes

### Trusted session/profile publication

- `normalizeProfile.ts` is the shared normalization boundary for raw current-user data and member representations. Role IDs are retained through repeated normalization.
- The base API's current-profile function publishes successful matching-identity ME evidence before authorizing a mutation. Denied operations therefore cannot leave known revoked grants visible.
- `profileRequestOrder` orders client requests; it is **not** an invented authoritative server profile version. An older request completing late returns the newer accepted profile rather than overwriting auth/ME.
- Canonical target reads remain fresh per protected write. A request-local map avoids repeating the same canonical read if newer known profile evidence requires another authorization check within that operation. It is never reused by a future write.
- Session/version/identity checks remain around request, refresh, authorization and completion boundaries. Protected reads completing after confirmed feature revocation are rejected. Final write guards continue to check permissions, ownership, parent capability and locks.
- Self-profile/photo success publishes the authoritative matching profile; photo cache busting is preserved. Uploading another member's photo does not patch the actor's ME identity. Failed/older sessions cannot perform those success updates.
- `/me` transport/timeouts/5xx do not establish revocation; existing recoverable-session behavior remains. Initial hydration still fails closed. Inactive/deleted successful profile evidence now prevents the protected layout from staying visible.

### Cross-tab credentials

Credentials now use one atomic `archicopro-session` localStorage record containing session ID, access token and refresh token. A fresh login/replacement has a new client session ID; token rotation retains it. Startup migrates the legacy individual token keys and removes `user` JSON. This record is a credential container, not persisted Redux/user/permission state.

Storage/focus events reconcile other tabs without writing the record again, preventing event loops. Account replacement/logout resets auth and API state; rotation updates credentials without full-cache invalidation. Network boundaries also reconcile storage so a delayed storage event cannot authorize using an obsolete login. Old-session refresh/logout checks refuse to replace another login's credentials.

Refresh remains one flight per tab/session, with same-origin Web Locks serialization when that browser feature is available. No token/profile BroadcastChannel payload was introduced. Direct attachment requests use the same resolved Redux credentials, require an eligible session for protected origins, and reject results after a session change. External asset URLs still do not receive the app bearer token.

### Tags and dependencies

New tag types are `ArticleCategory`, `UserRole`, `RoleMembers`, `NotificationPreference`, `Search` and `Dashboard`. Existing resource tags remain.

- **User:** ME also provides its actual user ID and role-membership dependency. User lists/details provide real role IDs when available, with `UNKNOWN` only for responses without that metadata. Role-list/preferences have dedicated tags, eliminating accidental general User fanout. Successful self-profile saves update cached self detail pessimistically without forcing another ME GET.
- **Content:** deleted entity ID plus LIST/MY_LIST tags remove detail, permission and membership copies. Home continues to use feature query caches and receives list invalidation.
- **Categories:** category lists provide LIST and returned IDs. Content representations embedding category metadata provide category IDs. Rename refreshes affected copies; delete invalidates collection membership because page boundaries/cascades/reassignment can affect rows outside the deleted category's current page. Unrelated details do not refetch solely for a rename.
- **Events:** lists/upcoming/detail provide event IDs. Registration refreshes the affected event, registrations and lists that contain it, without invalidating unrelated events or calendar statistics. Event CRUD retains collection/stat invalidation where membership or dates may change.
- **Documents:** tree tags include nested IDs. Folder contents provide folder ID plus document IDs. Upload/delete refresh folder contents and tree counts; rename invalidates document/descriptor copies. Folder ACL/delete capture known descendants and document IDs before the tree changes, then issue **one** invalidation batch. They do not dispatch a second overlapping root invalidation after a first automatic refetch.
- **Forums:** topic pages/pinned copies provide topic IDs; replies refresh parent counts and topic snapshots. Delete/ACL lifecycle handlers capture known descendant IDs and invalidate in one batch. If a cached post collection has no known parent mapping, the Post fallback favors correctness over guessed parent metadata. Moderation refreshes queue/logs and topic/forum projections; no new moderation authority was added.
- **Search/dashboard:** relevant resource mutations invalidate Search:GLOBAL and activity projections. Statistics use explicit dependencies rather than relying on a general tag being reached by a specific LIST tag. Search rows/counts retain feature filtering.
- **Failures:** 400/401/403/404/405/409/422 are treated as definite non-writes by the invalidation helper. Network/timeout/5xx outcomes may have committed, so their scoped dependencies can refresh. This does not assert backend transaction behavior from an HTTP status.

### Retention, subscriptions and drafts

No global polling, retention change, blanket mount refetch, alternate cache library or mutation-driven full-cache reset was added. RTK's existing unused-entry retention remains 60 seconds. Identity changes/logout still reset the shared API.

Admin tabs and inactive article status views unsubscribe through skip; revisits reuse valid cache. Search is subscribed while open and uses its normalized debounced term. The permission editor and topic deletion no longer issue an unnecessary explicit refetch in addition to adequate tag invalidation. The previous audit demonstrated that an immediate manual refetch can deduplicate while pending; this implementation does not misrepresent that as an independently measured duplicate HTTP request.

Draft reconciliation is per record, not a separate server-state cache. Pristine drafts can follow fresh server data. Dirty values/files survive refresh and show a conflict notice when the server's form data changed. Closing/reopening or intentionally changing records reinitializes the draft. Permission changes still immediately restrict routes/actions; preserving draft text does not preserve authority.

## D. API request optimization results

Measurements count actual `fetch` dispatches, not renders, hook counts or estimated percentage improvements. Responses are controlled mocks. An eligible superuser is used for write workflows so ordinary-user canonical ownership/page scans do not distort the comparison; those necessary checks remain covered by authorization tests.

The baseline Admin/preference measurements were captured before edits. Additional version comparisons loaded immutable `HEAD` TypeScript source via read-only `git show` in an isolated stdin runner, then executed the same workflow against current source. This did not replace working files. Each mutation count begins after initial subscriptions settle and includes its ME preflight, write and resulting active query refetches. It excludes unrelated application/layout traffic. The event fixture deliberately subscribes both A and B to expose invalidation breadth.

| Workflow | API/endpoint scope | Requests before | Requests after | Reason |
| --- | --- | --- | --- | --- |
| Initial Admin Members tab data | Sixteen original list/settings hooks; common session/layout excluded | 16 | 2 | Only member list and role lookup subscribe. |
| First switch to Articles tab data | Article list and categories | Not measured | 2 | Active tab requests its own data. |
| Return to cached Members | Member list/roles | Not measured | 0 | Valid same-key cache reused within normal retention. |
| Member role update; ME/list/detail/roles subscribed | `/user/users/me`, PATCH member, list/detail refetch | 5 | 4 | Fresh preflight publishes ME; selected member list/detail refresh; actor ME is not redundantly fetched. |
| Member role update in Admin tab-block fixture | Only Members list/role subscriptions | Not measured | 3 | ME + PATCH + member list GET. Different scope from the row above. |
| Update after leaving Admin | Same tab-block fixture, all tab subscriptions released | Not measured | 2 | ME + PATCH only; no hidden Admin refetch. |
| Notification preference update | ME/preferences/online/roles subscribed | 6 | 3 | ME + preference PATCH + preferences GET; no role/online/second ME GET. |
| Article creation on Published view | Published/draft article lists plus category lookup | 4 | 3 | Inactive draft list no longer subscribes; ME + POST + Published GET. |
| Event registration | A/B details, registrations, month lists, upcoming A, calendar stats | 10 | 6 | ME + POST + four matching A projections; B and calendar stats preserved. |
| Forum reply creation | Forum list, topic page, posts and pinned copy | 4 | 6 | Adds the previously missing forum-count and pinned refetches; all six reads/writes serve freshness or authorization. |
| Document upload | Folder tree and target-folder contents | 3 | 4 | Adds the previously missing folder-tree/count refresh. |
| Reopen unchanged valid search | Normalized search cache | Not measured | 0 additional GETs | Search key reuse; no forced request on unrelated render. |
| Reopen search after invalidation | Search cache removed while closed | Not measured | 1 GET | Deliberate fresh result instead of stale reuse. |
| Failed search retry | Rejected search entry | Not measured | 1 retry GET | Failure is retryable; no last-term suppression. |
| Two concurrent same-key subscribers | Members query | 1 (audit verified deduplication) | 1 | Working RTK deduplication is preserved. |
| Same-record cached navigation | Same-key member query within retention | Not measured | 0 additional GETs | No global mount refetch was introduced. |
| Self-profile save; ME subscribed | ME/profile PATCH | Not measured | 2 | Fresh authorization GET + PATCH; authoritative response publishes state without another ME GET. |

For reply and document workflows, lowering the count back to the old value would reintroduce stale aggregates. Ordinary-user writes can legitimately add canonical resource/folder/forum reads. No fixed refresh interval, global throttle or global deduplication was used to hide them.

## E. Files changed

The earlier audit Markdown was already present from the preceding task and was preserved. The implementation changes the following files; build output is ignored and no dependency/configuration file was changed.

| File | Purpose |
| --- | --- |
| `src/components/ProtectedRoute.tsx` | Hide protected layout after confirmed inactive/deleted profile. |
| `src/i18n/locales/en.json` | English dirty-draft conflict notice. |
| `src/i18n/locales/fr.json` | French dirty-draft conflict notice. |
| `src/layouts/DashboardLayout.tsx` | Debounced normalized current-term search, subscription reuse and retry. |
| `src/layouts/SidebarCategorySection.tsx` | Pagination generation/timestamp safeguards. |
| `src/pages/AdminPanel.tsx` | Current-target forms, protected submission, drafts, current rows/loading and inactive-tab skips. |
| `src/pages/Agenda/Agenda.tsx` | Current event/month/registration responses and participant loading. |
| `src/pages/Articles.tsx` | Current list arguments, active status subscription and dirty editor preservation. |
| `src/pages/DocumentLibrary.tsx` | Current contents and correct loading/file-route validation. |
| `src/pages/Events.tsx` | Current month data and delayed record transition handling. |
| `src/pages/Forums.tsx` | Remove local server-record overlays and redundant pinned refetch. |
| `src/pages/MemberDirectory.tsx` | Current filters/rows and consistent loading state. |
| `src/pages/Profile.tsx` | Preserve dirty draft; use centralized profile/photo publication. |
| `src/pages/admin/AdminPermissionsEditor.tsx` | Rely on automatic invalidation after save. |
| `src/redux/features/admin/adminApi.ts` | Definite-failure invalidation policy. |
| `src/redux/features/api/apiSlice.ts` | Ordered trusted profile publication, session reconciliation, refresh coordination and final identity checks; new tag types. |
| `src/redux/features/api/cacheTags.ts` | Shared failure policy, role-membership and projection tags. |
| `src/redux/features/articles/articlesApi.ts` | Entity deletion, categories and search/activity dependencies. |
| `src/redux/features/auth/authApi.ts` | Shared profile normalizer. |
| `src/redux/features/auth/authSlice.ts` | Session identity/order and nonpersistent profile state; guarded credential updates. |
| `src/redux/features/auth/authTypes.ts` | Session identity and client profile-order fields. |
| `src/redux/features/auth/normalizeProfile.ts` | Trusted response normalization shared by profile representations. |
| `src/redux/features/auth/sessionStorage.ts` | Atomic credential record, legacy migration and profile JSON cleanup. |
| `src/redux/features/auth/sessionSync.ts` | Storage/focus reconciliation and Web Locks adapter. |
| `src/redux/features/dashboard/dashboardApi.ts` | Search key normalization, exported declarative hook and aggregate tags. |
| `src/redux/features/documents/documentsApi.ts` | Folder graph, counts/capabilities, descriptors and captured branch invalidation. |
| `src/redux/features/events/eventsApi.ts` | Precise event/registration/category dependencies. |
| `src/redux/features/forum/forumApi.ts` | Counts, pinned/topic copies, descendant deletion/ACL invalidation. |
| `src/redux/features/members/membersApi.ts` | Role-membership tags, central ME lifecycle, self-account cleanup, safe photo/self-detail updates. |
| `src/redux/features/moderation/moderationApi.ts` | Moderation-specific queue/log tags and related topic/forum projections. |
| `src/redux/features/notifications/notificationsApi.ts` | Dedicated self-preference tag. |
| `src/redux/features/technicopro/technicoproApi.ts` | Deleted detail, category and projection dependencies. |
| `src/redux/features/trainings/trainingsApi.ts` | Deleted detail, category and projection dependencies. |
| `src/redux/store.ts` | Reset on external account replacement; register cross-tab listener. |
| `src/utils/attachments.ts` | Resolved credential/eligibility checks and session-safe Blob completion. |
| `src/utils/recordDraft.ts` | Small per-target draft baseline reconciliation helper. |
| `tests/admin-permissions.test.mjs` | Updated legitimate dependency/refetch expectations; preserve override restrictions. |
| `tests/admin-ui.test.mjs` | Supply new editor draft lifecycle state in isolated handler fixtures. |
| `tests/agenda-documents-modals.test.mjs` | Supply participant current-fetch state in existing modal fixture. |
| `tests/frontend-authorization.test.ts` | Correct upcoming-events response fixture for entity tag evaluation; all security assertions retained. |
| `tests/home-search-permissions.test.mjs` | Supply current/debounced search term in visibility fixture. |
| `tests/members-admin-modals.test.mjs` | Supply editor readiness/conflict lifecycle in existing six-module fixtures. |
| `tests/modal-foundations.test.mjs` | Explicitly isolate the file presentation tests from newly imported session dependencies. |
| `tests/modal-post-audit-fixes.test.mjs` | Preserve route-validation coverage and add current-folder fetching wait assertion. |
| `tests/cache-management.test.ts` | 34 actual-store/auth/cache/asset regression tests. |
| `tests/cache-performance.test.ts` | 3 HTTP-dispatch/subscription/cache-reuse measurement tests. |
| `tests/cache-ui-regressions.test.mjs` | 14 actual callback/query-block/draft/pagination/search behavior tests. |
| `docs/frontend-cache-management-fixes-2026-11-16.md` | This implementation/verification report. |

## F. Regression tests and validation

| Check | Final result |
| --- | --- |
| `node --test tests/*.test.mjs` (final repeat with dot reporter) | **134 passed**, including the original 120 and 14 new UI regressions. |
| `node scripts/test-article-authorization.mjs` | **4 passed**. |
| `node scripts/test-article-authorization.mjs ../tests/frontend-authorization.test.ts` | **17 passed**. |
| `node scripts/test-article-authorization.mjs ../tests/session-lifecycle.test.ts` | **12 passed**, including actual timeout and concurrent 401 recovery. |
| `node scripts/test-article-authorization.mjs ../tests/roles-permissions-audit.test.ts` | **5 passed**. |
| `node scripts/test-article-authorization.mjs ../tests/cache-management.test.ts` | **34 passed**. |
| `node scripts/test-article-authorization.mjs ../tests/cache-performance.test.ts` | **3 passed**. |
| `npm.cmd run lint` | Passed (`tsc --noEmit`). |
| `npm.cmd run build` | Passed; Vite large-chunk advisory remains. |
| Actual React server renders | AdminPanel, Profile, Articles, Forums and DocumentLibrary rendered successfully with real providers. Not counted as unit tests or browser interaction. |
| Browser E2E | Not run: `playwright` is unavailable in this workspace. Existing E2E source was retained; no package was installed, test removed or skipped to manufacture a pass. |
| Diff/working tree | Whitespace checks passed; application/test/document changes only, no package/lockfile/config changes. |

**Total: 209 passing tests, 51 newly added, zero unresolved failed assertions.** Tests use the established Node/TypeScript/VM patterns, actual store/API middleware and controlled fetches. VM tests execute actual expressions/handlers; they do not merely assert text matches. Existing fixtures were extended for new lifecycle dependencies; assertions encoding redundant manual refetch/general-tag coupling were updated to the verified behavior. No security test was removed.

The default sandbox initially denied Vite's configuration ancestry read. The same production build succeeded with approved broader filesystem access. No application configuration workaround was introduced. Early implementation/test runs surfaced fixture gaps and a cleanup typo; those were corrected and the relevant checks rerun. No initial failure is concealed as a final pass.

### Verification limits

- These are frontend and controlled-network results, not deployed HTTP/backend integration tests. Request counts apply to the named fixtures and subscription scopes, not an estimated production percentage.
- Two-tab behavior is simulated with real stores/storage reconciliation; actual browser storage events, background suspension and Web Locks scheduling still need supported-browser E2E verification.
- Where Web Locks is unavailable, refresh falls back to the existing per-tab flight plus storage/session comparisons. Simultaneous rotating-token recovery across such environments still depends on server recovery/grace semantics; no new server contract is claimed.
- Default retention remains unchanged. Cached navigation/reopen measurements occur within that retention window.
- Dirty-draft protection prevents local silent replacement. It cannot guarantee a server-side concurrent-update merge without an authoritative version/ETag contract.

## G. Remaining backend dependencies

These do not block the independently implemented frontend corrections:

1. **Atomic authorization:** backend must enforce current identity, eligibility, feature actions, ownership, parent association/capabilities, locks and cascade rules at commit time. Frontend preflights cannot secure an endpoint that trusts client assertions.
2. **Remote resource/feature revocation:** the administrator's store invalidation is not push to another user's session. Existing focus/reconnect hydration remains; no polling was invented. Immediate cross-session revocation needs an agreed notification/refresh contract. Resource-only ACL changes require server filtering and a defined freshness mechanism.
3. **Asset/download authorization and caching:** backend asset routes/signed URLs/HTTP headers must enforce access and expiry. Already downloaded files and opened independent Blob tabs cannot be recalled by cache invalidation. No deployed Cache-Control policy was verified.
4. **Folder/category/forum cascades and counts:** frontend invalidates known relationships conservatively. The server must define atomic cascade/reassignment/count semantics and authorize them. No folder owner/cascade field was invented; ordinary folder deletion remains denied.
5. **Personal permission inheritance:** unsafe first override creation and persisted reset-to-inherit remain blocked pending the documented inheritance-safe API contract. Role-grant/member-profile refresh does not enable those writes.
6. **Response ordering/conflicts:** client request order prevents older client completions from overwriting newer accepted evidence. It cannot infer a server-authoritative permission/profile version, transactional snapshot, or conflict token not supplied by the API.
7. **Rotating-token recovery:** server token invalidation/rotation/grace behavior and concurrent recovery across environments without browser Web Locks remain integration dependencies. Cross-tab replacement checks protect newer login credentials; this is not certification of server token revocation.

The known bounded forum-target scans, missing individual document target contract and delegated-account safe default role remain existing authorization/API limitations. No replacement endpoint, ownership model or permission contract was introduced as a cache optimization.
