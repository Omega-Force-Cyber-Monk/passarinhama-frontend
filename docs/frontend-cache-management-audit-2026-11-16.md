# Frontend cache management audit — 16 November 2026

Audit-only review of checkout `71874a7`. No application code, existing tests, dependencies, configuration, or behavior was changed. This document is the sole deliverable. Evidence is current source, installed Redux Toolkit **2.11.2**, existing tests, and temporary in-memory mocked probes. No deployed backend, HTTP cache headers, real account data, or browser session was tested.

## A. Executive summary

The foundation is sound: one shared RTK Query API, argument-specific entries, deduplicated subscriptions, a persistent current-profile subscription, session-version checks, a single token-refresh flight, and cache reset on credentials replacement/logout. The main weaknesses are incomplete dependency tags, duplicated page-local copies of server records, and inconsistent treatment of argument transitions and fresh authorization responses.

**16 confirmed frontend findings: Critical 0; High 2; Medium 13; Low 1.** Counts group related symptoms by root cause; matrix entries do not constitute additional findings. “Confirmed” means reproduced with mocks or demonstrated directly by the current source, not confirmed against a deployed server.

| ID | Severity | Problem |
| --- | --- | --- |
| C01 | High | Fresh write-preflight `/me` can prove revocation without updating the visible session's permissions. |
| C02 | High | Admin detail/editor transitions reuse the previous record; its fields can populate another record's editor. |
| C03 | Medium | Tabs do not synchronize session changes; RTK and attachment fetches can use different identities. |
| C04 | Low | Complete profiles/permission arrays are persisted even though restoration deliberately ignores them. |
| C05 | Medium | Article, training, TechnicoPro and hard member deletion leave detail caches reusable. |
| C06 | Medium | Document and folder caches do not express their count, capability, content and download dependencies. |
| C07 | Medium | Forum mutations miss aggregate counts, pinned snapshots and some descendant caches. |
| C08 | Medium | Pinning installs a local topic snapshot that overrides subsequent authoritative topic responses. |
| C09 | Medium | Several lists and event participant transitions use previous-argument `data` without an equivalent identity guard. |
| C10 | Medium | A pending sidebar page can append stale results after page-one invalidation resets pagination. |
| C11 | Medium | Global search has no mutation dependencies and suppresses repeat queries after changes/errors. |
| C12 | Medium | Role-grant changes do not invalidate affected member profiles/effective permission summaries. |
| C13 | Medium | Training/TechnicoPro category changes miss category data embedded in detail and some personal-list caches. |
| C14 | Medium | Background server/profile synchronization overwrites unsaved form drafts. |
| C15 | Medium | Broad and failure-unconditional invalidation causes unrelated refetch work. |
| C16 | Medium | Admin mounts many hidden-tab queries, retaining subscriptions and amplifying invalidation traffic. |

The five implementation priorities are C01, C02, C05, C06 and C08. They respectively affect stale permission visibility, wrong-record editing, deleted-record navigation, document lifecycle correctness, and server/local-state consistency.

**Security interpretation:** stale permissions after a denied preflight are confirmed; an unauthorized write is not—the fresh guard correctly rejects it. Cross-tab identity incoherence is confirmed by storage/state behavior, but cross-user content delivery was not demonstrated. Retained internal cache data after feature revocation is not counted as exposure: feature routes and search rows continue to enforce refreshed feature grants. Resource-only revocation and asset authorization still require server verification and an agreed refresh policy.

Working safeguards include all three standalone detail pages' `currentData` handling, Training/TechnicoPro listing `currentData`, document folder-ID checks, forum topic/post `currentData`, target-specific permission-editor reads, current-profile invalidation for ordinary member updates, and fresh final write authorization. No replacement cache library or new dependency is warranted.

## B. Cache architecture map

### Store, keys and lifetime

| Aspect | Current implementation and implication |
| --- | --- |
| Store | `src/redux/store.ts:8–33`: reducers `api` and `auth`; one API middleware and one listener middleware. `setupListeners` at line 35 enables focus/reconnect events. |
| API slices | Exactly one `createApi`, `src/redux/features/api/apiSlice.ts:125`. Twelve feature files inject into that instance; exports named `articlesApi`, `membersApi`, etc. are not independent caches. Inventory: **51 query endpoints, 85 mutation endpoints, 136 total**. |
| Keys | No custom `serializeQueryArgs`. Installed `node_modules/@reduxjs/toolkit/src/query/defaultSerializeQueryArgs.ts:9` serializes endpoint name plus JSON arguments with sorted plain-object keys. IDs, search, page, filters and category args separate entries. Identity/token is not part of the key; isolation relies on resets and version checks. |
| Equivalent arguments | `{}` versus explicit defaults, `pageSize`/`page_size`/`limit` aliases, and untrimmed versus trimmed search can form distinct keys despite equivalent URLs. This is a default-serialization tradeoff, not a demonstrated current duplicate-request defect. Do not discard real pagination/filter fields to deduplicate them. |
| Retention | No API/endpoint `keepUnusedDataFor` override. Installed `createApi.ts:367–371` defaults to **60 seconds after the final unsubscribe**, not 60 seconds since fetch. Active subscriptions can retain data indefinitely. This is not a freshness TTL. |
| Refetch | API defaults: `refetchOnMountOrArgChange`, `refetchOnFocus`, `refetchOnReconnect` all false. New uncached args fetch; cached args normally reuse. Session initializer enables focus/reconnect only for `getUsersMe`. Permission editor forces member profile reads on mount/arg change. No polling. |
| Invalidation | Default `invalidationBehavior: 'delayed'`: tag processing waits for pending API queries/mutations to settle. Active matching entries refetch; unused matching entries are removed. A long pending request can defer unrelated invalidation in this shared API; no production stall was measured. |
| Normalization | Profiles normalize role/arrays; folder/content responses normalize shapes; forum pinned results normalize array/envelope; `getAllTrainings` extracts a page's results. No shared entity adapter. An entity may legitimately exist in several query documents; tags must connect those copies. |
| Pagination | Separate entries per page; no custom `merge`, `forceRefetch`, infinite-query endpoint or cursor accumulator. Only sidebar categories have manual infinite scrolling/local accumulation. |
| Persistence | No Redux Persist, RTK rehydration/extraction or durable API-cache implementation found. Browser reload loses RTK entries and hydrates `/me` from stored credentials. |
| Manual/cache updates | Only photo upload uses `updateQueryData`, after success (`membersApi.ts:442–483`). It is pessimistic, not optimistic; no rollback patch is needed on upload failure. No other optimistic update/rollback mechanism exists. |
| Development | React StrictMode is enabled (`src/main.tsx:12`). This alone does not prove duplicate requests; same-key subscriptions deduplicate, as tested. |

Framework semantics were checked against installed source and the primary [createApi reference](https://redux-toolkit.js.org/rtk-query/api/createApi), [tag/refetch reference](https://redux-toolkit.js.org/rtk-query/usage/automated-refetching), and [query state reference](https://redux-toolkit.js.org/rtk-query/usage/queries). Application-specific findings below come from this checkout.

### Query inventory and dependencies

Paths in this table are under `src/redux/features/`. `T:id` means an ID tag; bare `T` means a general tag. All use the retention/refetch defaults above unless explicitly noted.

| Definition file | Query endpoints and provided tags |
| --- | --- |
| `api/apiSlice.ts:145` | `getStats`: User, Topic, Event, Training. |
| `auth/authApi.ts:113` | `getMe`: User:ME. Same URL as `getUsersMe`, separate key/normalizer, no session-resolving callback; no current application caller of its generated hook found. |
| `members/membersApi.ts:172–373` | `getUsers`: returned User:ids + User:LIST; `getUsersOnline`: User:ONLINE; `getUserRoles`: User; `getUserPermissions`: User:PERMISSIONS-role; `getMemberPermissions`: User:USER-PERMISSIONS-user; `getUsersMe`: User:ME; `getUserById`: User:id. Only `getUsersMe` publishes hydration into auth. |
| `articles/articlesApi.ts:58–141` | `getArticles`: Article:ids + LIST; `getMyArticles`: Article:ids + MY_LIST; `getArticleCategories`: Article; `getArticleById`, `getArticlePermissions`: Article:id. |
| `trainings/trainingsApi.ts:54–179` | `getTrainingsPaginated`, `getAllTrainings`: Training:ids + LIST; `getTrainingCategories`: TrainingCategory; `getTrainingById`, `getTrainingPermissions`: Training:id. `getAllTrainings` defaults to a single page of 100, not all pages. |
| `technicopro/technicoproApi.ts:55–215` | `getTechnicoPros`: TechnicoPro:ids + LIST; `getMyTechnicoPros`: ids + MY_LIST; `getTechnicoProCategories`: TechnicoProCategory; `getTechnicoProById`, `getTechnicoProPermissions`: TechnicoPro:id. |
| `events/eventsApi.ts:54–186` | `getUpcomingEvents`, `getCalendarStats`, `getEvents`: Event; `getEventCategories`: EventCategory; `getEventById`, `getEventRegistrations`: Event:eventId. |
| `forum/forumApi.ts:112–394` | `getForums`: Forum:ids + LIST; `getForum`, `getForumPermissions`: Forum:id; `getForumTopics`: Forum:forumId + Topic:forumId; `getTopicPosts`: Post:topicId; `getPinnedTopics`: Topic:returned-topicIds + PINNED. |
| `documents/documentsApi.ts:82–183` | `getDocumentFolders`: top-level Folder:ids + LIST; children are embedded but not recursively tagged. `getFolderPermissions`: Folder:id-permissions. `getDocuments`: Document:ids + LIST; no folder tag. `downloadDocument`: no tags. |
| `dashboard/dashboardApi.ts:79–107` | `getDashboardStats`: User, Topic, Event, Training; `getDashboardActivity`: same + Article; `getDashboardUpcomingEvents`: Event; `getDashboardSearch`: none. Dashboard page is not routed; global search is mounted in the routed layout. |
| `notifications/notificationsApi.ts:6` | `getNotificationPreferences`: User. This is preferences, not an implemented notification inbox/read-status cache. |
| `admin/adminApi.ts:41–114` | `getActivityLogs`: Admin:returned-ids + LOGS_LIST; `getAdminSmtpSettings`: Admin:SMTP_SETTINGS; `getAdminSystemLogs`: Admin:SYSTEM_LOGS; `getAdminBackups`: Admin:BACKUPS. No mutation below invalidates LOGS_LIST. Activity logs have no current page consumer found. |
| `moderation/moderationApi.ts:11–19` | `getModerationLogs`: Post, Admin; `getModerationQueue`: Post. Admin uses these; standalone Moderation is unrouted. |

### Session and subscriptions

`App.tsx:6` mounts one initializer outside the router. `SessionInitializer.tsx:8–12` subscribes to `getUsersMe(undefined)` while a token exists, with focus/reconnect refresh. Profile's same query shares that entry. `usePermissions.ts:20–24` observes resolved auth; guards do not create further `/me` subscriptions. `SessionError.tsx:13` explicitly retries with `forceRefetch: true, subscribe: false`; there is no leaked manual subscription there.

`store.ts:8–12` resets the API synchronously through a listener on `logout` and `setCredentials`. `authSlice.ts:55–62,118–129` changes `sessionVersion`; token refresh does not change it or reset the cache. `apiSlice.ts:42–94` checks the version after fetch/refresh/retry, and `103–120` checks identity/version before protected dispatch. No automatic cancellation of all old network transfers is implemented, but their old-session results are rejected and their cache was reset. Existing tests verify delayed profile/login/refresh isolation.

Hooks own ordinary subscriptions and clean up on unmount. Lazy search/download hooks retain their most recently triggered subscription until replacement/unmount. Sidebar lazy queries similarly leave the latest extra page subscribed, but render an independent copied array (C10). There are no production manual subscribed `initiate()` calls; the explicit retry opts out. Test subscriptions are not application subscription leaks.

### Other layers

| Layer | Evidence and assessment |
| --- | --- |
| localStorage | `authSlice.ts:25–32,54–90,106–129`: access token, refresh token and complete user profile; `i18n/index.tsx:65–77`: language. Profile JSON is never read for session restoration. Tokens' persistence is existing auth architecture; this audit does not claim an exploit from their presence. C03/C04 concern synchronization and unnecessary profile duplication. |
| sessionStorage / IndexedDB / service worker | No usage/registration, Workbox/PWA integration, browser Cache API, Redux Persist or alternate client query-cache library found in application/config/public files. Transitive build-tool `lru-cache` is not an application data cache. CI npm/Docker caches are build caches. |
| Component state / memoization | Form drafts, event selections/day-modal snapshots, forum local arrays, sidebar extra pages; `useMemo` derives views and sanitized rich HTML, not a durable network cache. Successful lazy module imports are reused; `utils/lazyPage.tsx:7–25` retries rejected imports. |
| HTTP | `fetchBaseQuery` and `attachments.ts:203–205` do not explicitly choose `cache: 'no-store'`; no observable server/CDN headers were provided. Dockerfile packages assets but contains no HTTP header policy; `public/_redirects` is routing, not evidence of private-data cache control. Do not infer private API or asset caching safety. |
| Blob/object URLs | `FileUploadPreview.tsx:90–93`, `localFilePreview.ts:3–5`, `Articles.tsx:271–281` revoke local previews. `DocumentLibrary.tsx:441–480` cancels late preview publication and revokes URLs on change/unmount. Attachments revoke failed/closed-tab URLs and use 60-second/1-second cleanup for opened/downloaded Blobs (`attachments.ts:218–252`). Admin/member export helpers also revoke. No confirmed Blob leak found. |
| Direct assets | Attachments use storage token with same-origin/API-origin requests, bypass RTK recovery/preflights; external URLs receive no app bearer token (`attachments.ts:184–205`). Images/direct media/links may also use browser HTTP caches. No permission invalidation can recall a downloaded file or an already opened independent Blob tab. |
| History | Client back/forward reuses route components/query entries. No app-specific back-forward-cache/pageshow freshness handler found. Actual browser BFCache, HTTP caching and asset authorization were not verified. |

### Documentation reconciliation

Reviewed `RBAC_GUIDE.md`, `docs/frontend-authorization.md`, `docs/user-roles-permissions-audit-2026-11-14.md`, and `docs/authorization-fixes-2026-11-14.md`. The historical audit's Training-detail, folder-policy, dashboard-policy and permission-editor findings were addressed by the later implementation; they are not repeated as current defects. Current standalone Training detail passes the stale-route tests. The historical “all protected reads fetch fresh profile”/30-second-hook description is not the current architecture; current reads use resolved auth, and current docs explain this.

Current documents correctly describe focus/reconnect, no polling, final fresh writes, backend asset enforcement and resource-only revocation limits. Their statement that mutations refresh `/me` needs scope: member/permission operations often invalidate ME; content mutations generally do not. The independently fetched fresh write profile is **not** itself published to auth (C01). The old audit's unfiltered search-count claim is also obsolete: layout now counts visible feature-filtered rows. None of these documents was changed.

## C. Findings

Line references refer to the audited checkout. P01–P14 and V01–V06 identify the runtime probes recorded in section I. Recommendations are proposed work only.

### C01 — High — Fresh authorization evidence is not synchronized into session permissions

**Type/module:** protected data lifecycle and stale-permission visibility; auth/all writes.

**Evidence:** [apiSlice.ts](../src/redux/features/api/apiSlice.ts), lines 103–120, especially 108–115; [membersApi.ts](../src/redux/features/members/membersApi.ts), lines 348–361; [authSlice.ts](../src/redux/features/auth/authSlice.ts), lines 83–101; [usePermissions.ts](../src/hooks/usePermissions.ts), lines 20–24.

**Root cause:** writes fetch `/me` directly through the base query, authorize from that fresh response, but never dispatch `sessionResolved` or update `getUsersMe`. Only the query lifecycle does that. A rejected content write does not invalidate User:ME. Cached auth permissions can therefore disagree with authoritative evidence already received by this browser.

**Reproduction/actual:** resolve an ordinary actor with article View/Edit; server removes both; attempt `updateArticle`. Return fresh `/me` with no grants. P04 confirms client 403, zero target writes, but both `auth.user` and cached `getUsersMe` still grant View. The already mounted module and other read preflights keep using the old grants until a successful initializer refresh. The analogous inactive/deleted response denies the write without updating visible eligibility. Background non-401 failures also preserve old permissions (P11); that availability policy is separate from ignoring a successful authoritative response.

**Expected:** publish successful same-session, same-identity fresh profile evidence consistently before proceeding/denying; new revocations immediately govern routes/controls and dependent reads. Avoid treating transport/5xx errors as proof of revocation.

**Impact:** significant stale permission UI and unnecessary reads after known revocation. Final writes remain protected by the fresh guard. No successful unauthorized backend write or newly obtained protected record was established.

**Recommendation:** centralize normalized, session-checked profile publication for hydration and write preflights. Prevent an older same-session profile response from overwriting newer evidence using an ordering rule or authoritative version. Decide how confirmed grant/resource-policy changes invalidate protected entries without resetting all data on every token refresh.

**Backend dependency:** server must return trustworthy current eligibility/grants and enforce every read/write atomically. Remote revocation delivery/freshness SLA is not established.

### C02 — High — Admin editor can populate record B with record A's cached fields

**Type/module:** navigation and major CRUD integrity; Admin members/forums/TechnicoPro/events/trainings.

**Evidence:** [AdminPanel.tsx](../src/pages/AdminPanel.tsx), lines 811–903 (`data`, `isLoading`), 1081–1147 (unconditional detail-to-form effects), 1558–1564 (target ID and Article-only current-record check), 1693–1736 (member diff and PATCH), 3901–3916 (submit disabling checks mutations, not unresolved details). Article's query alone uses `currentData` at 835.

**Reproduction/actual:** fetch member A, close, open B while B's response is delayed. The hook can retain `data=A` with `isLoading=false, isFetching=true`. Opening B changes `editingItem`, so the actual effect copies A's profile/role/superuser fields into B's form. V01 confirms this; V05 confirms the detail selector also shows A while a new argument is unresolved. V06 executes the actual submit handler after that effect: it targets B with A's first name and `is_superuser: true`. The mutation call is mocked; no real account was changed. Five non-article detail hooks have the same pattern.

**Expected:** only render/initialize the requested record's own response; disable submission until that record is resolved successfully. Preserve deliberate user edits once initialized.

**Recommendation:** use parameter-specific `currentData`, explicit returned-ID checks and `isFetching && !currentData` loading consistently across these hooks/forms; reset per-target draft state. Verify the submitted target and source profile belong to the same ID.

**Impact/backend:** incorrect data can be shown/copied into another admin operation, including sensitive account attributes. This is not an ordinary user's privilege bypass; the backend still authorizes the administrator and validates fields. No deployed destructive PATCH was sent by this audit.

### C03 — Medium — Cross-tab sessions and attachment identity diverge

**Type/module:** session synchronization, identity coherence; auth/layout/files.

**Evidence:** [authSlice.ts](../src/redux/features/auth/authSlice.ts), lines 25–32, 55–90, 118–129; [apiSlice.ts](../src/redux/features/api/apiSlice.ts), lines 15–20; [attachments.ts](../src/utils/attachments.ts), lines 193–205; [store.ts](../src/redux/store.ts), lines 8–12. No storage-event/BroadcastChannel session listener exists in source.

**Reproduction/actual:** open two tabs as A. Log out or sign in as B in one tab. The other tab's Redux auth/cache/version is unchanged, but its direct attachment helper reads the newly shared storage token. P10 confirms external storage replacement does not change the resolved Redux token. RTK reads use A's memory token while attachments can use B's storage token. A later token refresh in the old tab can also write its credentials back into shared storage.

**Expected:** all tabs detect credential replacement/removal, clear old identity-bound state and resolve the new session before protected display/requests. Direct helpers use the same resolved credential source.

**Recommendation:** implement a session-change signal with loop protection and explicit account-change/logout semantics; refreshes must distinguish same-session token rotation from account replacement. Clear local drafts/asset work as appropriate. Do not broadcast full profiles/tokens unnecessarily.

**Impact/backend:** confirmed synchronization defect and mixed request identity sources; no two-tab server data exposure was tested. Backend token invalidation and file ACL enforcement determine the security outcome. Same-tab resets work correctly.

### C04 — Low — Unused complete profiles remain in durable storage

**Type/module:** privacy/retention and maintainability; auth.

**Evidence:** [authSlice.ts](../src/redux/features/auth/authSlice.ts), lines 25–32, 68–71, 83–90, 106–115, 127–129.

**Reproduction/actual:** resolve a profile; inspect storage's `user` JSON. It includes returned profile fields and permission arrays. Reload ignores it for authorization, but it survives browser close. Replacing credentials without a user payload leaves the previous stored profile until hydration or explicit logout. P10 confirms this. Logout does remove it.

**Expected/recommendation:** stop persisting the full unused profile, remove the legacy key during migration and credentials replacement, and keep authorization sourced from fresh hydration. Do not create a second profile persistence mechanism.

**Impact/backend:** unnecessary durable personal/permission data; no storage-driven permission restoration or exploitable disclosure was established. Credential storage architecture/XSS hardening is a separate security review, not a new cache vulnerability here.

### C05 — Medium — Deletion invalidates lists but leaves deleted details reusable

**Type/module:** cache correctness; Articles/Training/TechnicoPro/member administration.

**Evidence:** [articlesApi.ts](../src/redux/features/articles/articlesApi.ts), lines 135–166; [trainingsApi.ts](../src/redux/features/trainings/trainingsApi.ts), lines 173–179, 220–226; [technicoproApi.ts](../src/redux/features/technicopro/technicoproApi.ts), lines 172–174, 191–199; [membersApi.ts](../src/redux/features/members/membersApi.ts), lines 373–396.

**Reproduction/actual:** read detail X, delete X, then revisit X before its unused-cache expiry. P01 reproduces all four families: the old detail remains fulfilled and the next query returns it with **zero detail GETs**, even with the mocked server ready to return 404. `currentData` does not solve this: the stale object belongs to the requested key. Content permission-query caches sharing the missing entity tag also survive.

**Expected/recommendation:** successful deletion invalidates the entity ID and collection/parent dependencies; use a deliberate deleted/error state in active detail views. Preserve list invalidation so page membership/totals are rebuilt. Include member ME handling if an administrator can delete their own account.

**Impact/backend:** visibly resurrected deleted records and attachment references. Server authorization/asset deletion must still prevent access; stale display is confirmed, continued server accessibility is not.

### C06 — Medium — Folder/document graph misses lifecycle dependencies

**Type/module:** content/count/capability freshness; Documents/Folders/Files.

**Evidence:** [documentsApi.ts](../src/redux/features/documents/documentsApi.ts), lines 82–183, especially 112–117, 132–145, 159, 179–182; [DocumentLibrary.tsx](../src/pages/DocumentLibrary.tsx), lines 391–417, 596–629, 669–675.

**Root cause:** folder tree and contents have unrelated tags; contents embed folder name and `can_upload` but provide only Document tags. Upload/delete never refresh the tree's `document_count`. Rename/ACL/delete folder operations never invalidate folder contents. Download descriptors provide no tags. Nested folder IDs are not recursively tagged, although current LIST invalidations do refresh the whole tree.

**Reproduction/actual:** P02 confirms upload removes the documents cache but leaves the folder's count at zero. P03 confirms folder ACL change/deletion leaves its old documents/capability snapshot and download descriptor cached. Rename refreshes the navigation tree but not the contents' embedded folder metadata. Revoking upload capability can leave upload controls stale; final writes still perform fresh capability checks for ordinary users.

**Expected/recommendation:** tag contents by folder, individual document and collection membership; invalidate affected folder/ancestor counts after upload/delete. Connect folder rename/ACL/delete to contents and relevant descendants; connect download descriptors to their document. Define cascade invalidation from a trustworthy folder graph, not an arbitrary global purge. Continue checking returned folder ID before rendering.

**Impact/backend:** stale counts, navigation/content disagreement and old capability/download metadata. Deletion from the tree normally redirects the open library away; cached contents alone do not prove visible cross-boundary exposure. Backend must enforce resource read/asset access and cascade semantics; cached descriptor use in the actual download handler normally forces a lazy query first.

### C07 — Medium — Forum mutation tags miss counts, pinned copies and descendants

**Type/module:** aggregate/detail invalidation; Forums/Topics/Replies/Home.

**Evidence:** [forumApi.ts](../src/redux/features/forum/forumApi.ts), lines 112–137, 158–166, 203–209, 234–356, 381–394; [Forums.tsx](../src/pages/Forums.tsx), lines 643–660, 1300–1305.

**Reproduction/actual:** query forum totals, pinned topics, topic page and posts; create a reply. P06 confirms posts/topic page invalidate but `getForums.post_count` and the pinned topic's `reply_count` remain old. Reply edit/delete similarly omit pinned Topic:id. Topic update omits its Topic:id/PINNED dependency, so a pinned title/content can stay stale. Topic delete misses Forum:id (aggregate topic/post counts). Forum delete misses pinned-topic membership and descendant Post:topicId entries; live UI may navigate away, but dependent Home/pinned copies need updates.

**Expected/recommendation:** explicitly link forum counts/activity, topic fields/counts, pinned membership/snapshots and descendant posts. Distinguish changes to one topic from membership changes. Include optional parent locators in valid superuser calls or define a safe fallback invalidation when omitted.

**Impact/backend:** visible stale Home/forum totals, reply counts and pinned records. Server cascade/count behavior is unverified. A normal reply invalidation correctly refreshes subscribed posts/topic pages; do not discard that working relationship.

### C08 — Medium — Pinning makes a local snapshot outrank future server data

**Type/module:** local shadow cache and authorization metadata freshness; Forums.

**Evidence:** [Forums.tsx](../src/pages/Forums.tsx), lines 587–589, 716–748, 1216–1243.

**Reproduction/actual:** pin an API topic. `handleTogglePin` inserts the entire topic into `localTopics`. Subsequent rendering removes server rows with that ID and prepends the local snapshot. V02 runs the real handler and derivation: even a fresh empty server topic response leaves the old title/topic visible. Other actors' edits/deletions/ownership/lock changes can be masked; changing pages can continue showing the pinned local item outside that page. The local row has no invalidation generation, expiry or reconciliation.

**Expected/recommendation:** let RTK server data remain authoritative. Use a narrow transient pin-state patch with explicit reconciliation/rollback if immediate feedback is necessary, or wait for existing invalidation. Remove full-record local precedence and reconcile remote deletion. Do not weaken final ownership/lock checks.

**Impact/backend:** stale content and action metadata survive successful server refetches. Current pinning is superuser-only, so this runtime reproduction is not a demonstrated ordinary-user permission bypass; backend must still enforce all operations.

### C09 — Medium — Previous query data appears during list/participant transitions

**Type/module:** argument-specific UI correctness; Articles, Directory, Admin lists, Agenda/Events.

**Evidence:** [Articles.tsx](../src/pages/Articles.tsx), lines 200–225, 523–529, 568–581; [MemberDirectory.tsx](../src/pages/MemberDirectory.tsx), lines 234–247, 559 onward; [AdminPanel.tsx](../src/pages/AdminPanel.tsx), lines 600–657; [Agenda.tsx](../src/pages/Agenda/Agenda.tsx), lines 233–236, 285–296, 377–403, 1707–1716; [Events.tsx](../src/pages/Events.tsx), lines 60–66, 78–96.

**Reproduction/actual:** resolve article category/page A, change to uncached B and delay B. Hook `data` may remain A while `isLoading` is false; the page labels/URL reflect B but render A's cards/totals with a refresh message. Directory filtering has the same temporary mismatch. Agenda participant query uses `data` plus `isLoading` without checking the event identity; changing events can show previous-event registrations while the next request is fetching. This finding follows the documented hook semantics and the concrete render branches; unlike C02, no separate full-page browser reproduction was run.

**Expected/recommendation:** use `currentData` when rows/counts/participants claim to belong to the current arguments; show loading when it is absent. If preserving previous list content is intentional, clearly associate it with the prior filter and prevent current-argument actions. Agenda main detail already compares returned ID; preserve that safeguard and make its selection effect equally ID-specific. Use `isFetching` rather than only first-load state for missing-file/detail decisions.

**Impact/backend:** misleading rows, counts, dates and participant associations during transitions; not delivery of the next denied record. Backend filtering still governs returned data.

### C10 — Medium — Sidebar pagination has no invalidation generation guard

**Type/module:** in-flight/local pagination race; four sidebar category/forum sections.

**Evidence:** [SidebarCategorySection.tsx](../src/layouts/SidebarCategorySection.tsx), lines 87–101 and 118–155.

**Reproduction/actual:** start page-two lazy request; page one receives new data and resets `additionalItems/currentPage`; let the older page-two request finish. V03 executes the real callback and reset effect: its old rows append and page advances again. The callback captured old page-one rows. Normal invalidation can also initiate a new extra-page fetch whose result updates RTK but not the copied local array; only the trigger's original unwrap is consumed.

**Expected/recommendation:** version the category accumulation generation; ignore/abort pending work on reset and consume only responses for that generation. Derive pages from authoritative entries or refetch/reset them as a coherent group. Preserve deduplication and lazy loading.

**Impact/backend:** deleted/renamed categories can reappear and shifted page boundaries can omit/duplicate items. No backend dependency to fix the client race; stable server pagination/order remains desirable.

### C11 — Medium — Search is disconnected from mutations and repeat-query freshness

**Type/module:** cross-module search freshness; layout/dashboard search.

**Evidence:** [dashboardApi.ts](../src/redux/features/dashboard/dashboardApi.ts), lines 91–107 (no tags); [DashboardLayout.tsx](../src/layouts/DashboardLayout.tsx), lines 343–390, 455–476.

**Reproduction/actual:** search a term, create/edit/delete a matching resource, reopen the same term. No mutation invalidates search; `lastSearchQueryRef` suppresses another automatic trigger. P07 confirms an existing search entry survives article creation. A failed search also keeps the term in that ref, so repeating it does not automatically retry; Enter's forced submission does retry. Changing the typed term can briefly show previous results in the 300 ms before triggering, because display is not bound to the response's query.

**Expected/recommendation:** connect search to relevant module/entity invalidations or a deliberate mutation-driven stale flag and rerun when reopened. Compare displayed result arguments to the current normalized term; clear suppression on failure. Avoid refetching on every unrelated render.

**Impact/backend:** stale titles/snippets/deleted-result links and confusing query associations. Feature-revoked result types are filtered and visible counts are safe at that feature level. Per-resource ACL filtering and signed-asset expiry remain server responsibilities.

### C12 — Medium — Role permission updates miss affected member profile copies

**Type/module:** effective-permission synchronization; roles/member editor/directory.

**Evidence:** [membersApi.ts](../src/redux/features/members/membersApi.ts), lines 259–300, 373–376; [AdminPermissionsEditor.tsx](../src/pages/admin/AdminPermissionsEditor.tsx), lines 25–38, 56–62.

**Reproduction/actual:** cache member profile with inherited article View, change that role's View row. The mutation invalidates PERMISSIONS-role and ME, but member profiles/list copies have no role-membership tag. P05 confirms cached `getUserById(member)` still grants View. An already mounted member editor derives inherited/effective access from that stale profile. Its mount refetch helps reopening, not active cross-view consistency.

**Expected/recommendation:** tag user profile/list representations by role membership or explicitly invalidate known affected users/effective permission summaries. Keep ME invalidation. Avoid resetting all modules merely because a role label changed. Coordinate remote-user delivery independently of the administrator's store.

**Impact/backend:** administrator sees stale effective grants; the edited member's other browser is not notified by local tags. Backend must recompute authoritative effective grants; realtime delivery is not implied by the existing mutation.

### C13 — Medium — Category edits leave embedded category data stale

**Type/module:** dependent entity copies; Training/TechnicoPro details/personal lists.

**Evidence:** [trainingsApi.ts](../src/redux/features/trainings/trainingsApi.ts), lines 138–175; [technicoproApi.ts](../src/redux/features/technicopro/technicoproApi.ts), lines 87–102, 126–174; standalone detail pages render these returned category objects.

**Reproduction/actual:** cache detail containing category `Old name`; rename category to `New name`. P12 confirms both detail entries remain unchanged. The mutation invalidates category-list and main LIST tags, while detail provides only entity ID. TechnicoPro MY_LIST without a matching main LIST dependency can also retain embedded category data. Category deletion/reassignment consequences depend on server response semantics, but rename alone reproduces the gap.

**Expected/recommendation:** provide category-ID dependencies on representations embedding category data; invalidate those when renamed/deleted. Include personal lists where necessary. Article category general invalidation already reaches article details, albeit broadly.

**Impact/backend:** inconsistent detail breadcrumb/metadata after a successful admin change. Backend only needs to define delete/reassignment behavior; the rename invalidation fix is client-side.

### C14 — Medium — Background synchronization overwrites unsaved drafts

**Type/module:** server cache versus local edit state; Profile and content/admin editors.

**Evidence:** [Profile.tsx](../src/pages/Profile.tsx), lines 150–165; [Articles.tsx](../src/pages/Articles.tsx), lines 283–302; [AdminPanel.tsx](../src/pages/AdminPanel.tsx), lines 1081–1147; [SessionInitializer.tsx](../src/components/SessionInitializer.tsx), lines 8–12.

**Reproduction/actual:** edit unsaved first name; trigger focus refresh that returns changed profile data. V04 confirms the real effect replaces the draft. Toggling a notification preference can trigger a broad User refresh (C15), producing the same risk if the returned profile differs. Article/admin detail effects can replace dirty editor data when detail/category/profile dependencies change. Unchanged structurally shared responses may not rerun a data-only effect; the reproduction requires a changed dependency.

**Expected/recommendation:** initialize drafts once per target, track dirty fields, and reconcile changed server data explicitly. Fresh permissions should immediately restrict actions without silently reverting draft content. On conflict, offer reload/merge with a clear message.

**Impact/backend:** lost edits and stale overwrites on submit. Backend version/ETag conflict handling would improve concurrent-edit safety but is not required to stop local draft resets.

### C15 — Medium — Broad and unconditional tags cause unrelated network work

**Type/module:** performance; notification preferences, roles, categories, events/admin aggregates.

**Evidence:** [notificationsApi.ts](../src/redux/features/notifications/notificationsApi.ts), lines 6–17; [membersApi.ts](../src/redux/features/members/membersApi.ts), lines 226–257; [eventsApi.ts](../src/redux/features/events/eventsApi.ts), lines 103–180; [articlesApi.ts](../src/redux/features/articles/articlesApi.ts), lines 193–220.

**Reproduction/actual:** notification preference PATCH invalidates all User tags, reaching profiles, lists, online presence, role tables, permission tables and subscribed dashboard aggregates. P08 demonstrates five unrelated seeded query families selected by User. P13 confirms even a failed 500 preference save removes unused profile/role entries; subscribed ones refetch. Most callbacks ignore `_error`. Event register/unregister invalidate general Event **plus** Event:id: the latter is redundant; every subscribed month/upcoming/detail/registration Event cache can refetch. Category Article invalidation refreshes all Article-tagged records, not just categories.

**Expected/recommendation:** introduce precise preference/category/role-list and aggregate dependencies; preserve necessary ME refresh for permission-affecting writes. Gate invalidation on known successful writes, with an explicit exception for ambiguous outcomes where server state may have committed. Consider uncertain transport failures separately from definite authorization/validation denial.

**Impact/backend:** confirmed extra invalidation targets, not a measured production bandwidth/latency figure. Event-wide invalidation is correct but costly for unrelated records. Broad tags do not fix all aggregate dependencies: specific LIST tags do not invalidate general-only providers.

### C16 — Medium — Hidden Admin tabs keep unnecessary queries subscribed

**Type/module:** network/subscription performance; Admin.

**Evidence:** [AdminPanel.tsx](../src/pages/AdminPanel.tsx), lines 600–657, 799–809, 922–933. `activeTab` exists at 409 but is absent from these query options. Detail hooks do have modal/tab skips at 817–877.

**Reproduction/actual:** mount Admin on Members. Source unconditionally mounts **16 background/list/settings query hooks**: users, forums, articles, TechnicoPro, events, event categories, trainings, roles, moderation queue/logs, article/TechnicoPro/training categories, SMTP, system logs and backups. Some reuse existing cache; on a cold authorized mount these keys all fetch. Hidden-tab search/page-state changes and broad tags can refetch them while invisible. SMTP/config data is also loaded before its tab is needed, though the route is superuser-gated.

**Expected/recommendation:** skip or lazily mount data for inactive tabs, retaining only genuinely shared small lookups. Preserve permission-aware skips and correct cache reuse when returning to a tab. In-flight RTK work can complete safely; skipping need not erase useful cache.

**Impact/backend:** unnecessary startup/network load, retained active data and larger invalidation fanout. No ordinary-user admin request was reproduced; the route and final policy correctly restrict access. No backend change is required.

## D. CRUD mutation-to-cache invalidation matrix

This covers **all 85 declared mutation endpoints**, including GET exports modeled as mutations and the blocked personal-override create. Grouped names share the stated behavior. The query inventory above gives their provided tags. No absent CRUD action is inferred. Paths below are under `src/redux/features/`; each row cites its endpoint start line(s).

`L` = LIST; `ML` = MY_LIST; `ME` = User:ME; a bare tag invalidates all IDs of its type. “Expected” means the present relationship is appropriate, not a backend certification. All mutation invalidations are local to this store.

| Module / evidence | Mutation | Affected query/cache | Current invalidation/update | Issue | Recommendation |
| --- | --- | --- | --- | --- | --- |
| Auth `auth/authApi.ts:57,73` | `login`, `signup` | Session, API, auth forms | No tags; successful login/verification consumer dispatches setCredentials and resets API | Expected; signup does not itself establish a trusted restored profile | Keep reset + `/me` hydration; test activation/OTP branches |
| Auth `auth/authApi.ts:87,119` | `sendOtp`, `verifyOtp` | Verification form/session workflow | No tags; login OTP completion applies credentials in `OTPVerification.tsx:122` | Expected | Keep public-flow data outside protected cache |
| Auth `auth/authApi.ts:103` | `refresh` | Credentials | No tags; separate declared mutation unused; actual reauth is base query's single flight | Latent duplicate recovery path, no active duplicate established | Keep one supported recovery contract; preserve cache on token rotation |
| Auth `auth/authApi.ts:138,155` | `forgotPassword`, `resetPassword` | Recovery/password UX | No tags | Expected for non-profile payload; server token-revocation behavior unverified | Document resulting session semantics; do not arbitrarily clear content cache |
| Articles `articles/articlesApi.ts:117` | `createArticle` | All article lists including Home; search/activity | Article:L, ML | Lists correct; C11; general-only dashboard activity not reached | Add explicit search/activity dependencies as needed |
| Articles `articles/articlesApi.ts:180,168` | `updateArticle`, `publishArticle` | Detail/permissions/lists/Home/search | Article:id, L, ML | Correct primary content links; search/aggregate gap | Preserve ID/list tags; add dependent projections |
| Articles `articles/articlesApi.ts:161` | `deleteArticle` | Detail/permissions/lists/Home/search | Article:L, ML | C05, C11 | Add deleted ID and dependent projections |
| Article ACL `articles/articlesApi.ts:143` | `setArticlePermission` | Selected resource lists/detail/permission table | Article:L, ML + each selected Article:id | Correct in this store; search/remote-session caches untouched; no current UI hook consumer | Preserve ID/list links; define search/resource-revocation delivery |
| Article categories `articles/articlesApi.ts:193,204,215` | `createArticleCategory`, `updateArticleCategory`, `deleteArticleCategory` | Categories and all Article-tagged content | Article (general) | Correct broad reach, C15 cost | Separate category membership/IDs and embedded dependencies |
| Shared files `articles/articlesApi.ts:222` | `uploadFile` | New staged/rich-text attachment URL | None | Expected staged upload; no standalone files-list query exists | Parent save must invalidate its content; define orphan cleanup server-side |
| Shared files `articles/articlesApi.ts:230` | `deleteFile` | Existing parent records/search/assets if they reference URL | None | No page consumer found; latent missing parent relationship, server asset behavior unknown | Supply trusted parent relation before targeted invalidation; do not invent endpoint |
| Training `trainings/trainingsApi.ts:198` | `createTraining` | Paginated/all/Home lists; search/dashboard | Training:L | Primary lists correct; search/general-only aggregate gap | Preserve list tag, explicitly connect projections |
| Training `trainings/trainingsApi.ts:206` | `updateTraining` | Detail/permissions/all lists/Home | Training:id, L | Correct core invalidation; C11 projections | Preserve core; add projections |
| Training `trainings/trainingsApi.ts:220` | `deleteTraining` | Same + deleted detail | Training:L | C05 | Add Training:id |
| Training categories `trainings/trainingsApi.ts:138,152,166` | `createTrainingCategory`, `updateTrainingCategory`, `deleteTrainingCategory` | Categories, list/detail embedded category | TrainingCategory, Training:L | C13 for existing detail categories | Add category-ID dependencies; avoid refreshing unrelated details on create |
| Training ACL `trainings/trainingsApi.ts:181` | `setTrainingPermission` | Resource lists/detail/permission table | Training:L + each selected Training:id | Correct in this store; no current UI hook consumer; search/remote caches untouched | Keep ID links; verify remote/resource revocation strategy |
| TechnicoPro `technicopro/technicoproApi.ts:161` | `createTechnicoPro` | Main/personal lists/search | TechnicoPro:L, ML | Primary lists correct; C11 | Add projections |
| TechnicoPro `technicopro/technicoproApi.ts:176,201` | `updateTechnicoPro`, `publishTechnicoPro` | Main/personal/detail/permissions | TechnicoPro:id, L, ML | Correct core; C11 | Preserve and connect search |
| TechnicoPro `technicopro/technicoproApi.ts:191` | `deleteTechnicoPro` | Same including deleted detail | TechnicoPro:L, ML | C05 | Add TechnicoPro:id |
| TechnicoPro categories `technicopro/technicoproApi.ts:126,140,154` | `createTechnicoProCategory`, `updateTechnicoProCategory`, `deleteTechnicoProCategory` | Category list and embedded category copies | TechnicoProCategory, TechnicoPro:L | C13; ML/detail can survive | Category-ID dependencies across representations |
| TechnicoPro ACL `technicopro/technicoproApi.ts:217` | `setTechnicoProPermission` | Selected resource ACL/detail/main lists | TechnicoPro:L + selected ids | Personal list containing selected ID does match entity tag; no current UI consumer | Connect search and remote revocation explicitly |
| Events `events/eventsApi.ts:140,149,158` | `createEvent`, `updateEvent`, `deleteEvent` | Calendar/upcoming/Home/detail/attendees/dashboard event caches | Event general; update also id | Complete local Event reach, broad C15; C11 | Scope dependencies without missing months/upcoming/attendees |
| Event registration `events/eventsApi.ts:166,175` | `registerForEvent`, `unregisterFromEvent` | Registration detail, attendees, availability/counts in lists | Event general + Event:id | Correct refreshed primary state; unrelated Event traffic C15 | Target event membership/count dependencies; remove redundant general+id combination |
| Event categories `events/eventsApi.ts:103,115,127` | `createEventCategory`, `updateEventCategory`, `deleteEventCategory` | Categories and embedded Event metadata | EventCategory, Event general | Correct but broad | Category-specific dependencies and delete contract |
| Forum `forum/forumApi.ts:140,169` | `createForum`, `updateForum` | Forum lists/Home/detail/topic metadata | Create Forum:L; update Forum:id + L | Core links correct; search lacks dependency | Add search projection relation |
| Forum `forum/forumApi.ts:158` | `deleteForum` | Forum/topic lists, pinned topics, descendant posts | Forum:id, L; Topic:forumId | C07 descendants/pinned, C11 | Invalidate descendants/pinned membership using reliable relation |
| Topics `forum/forumApi.ts:211` | `createForumTopic` | Topic pages, forum aggregate counts/Home | Forum:forumId, Topic:forumId | Core counts/list correct; search gap | Preserve; connect projections |
| Topics `forum/forumApi.ts:250` | `updateTopic` | Topic/posts/pinned/search | Post:topicId; Topic:forumId if supplied | Pinned Topic:id omitted; C07 | Add topic/pinned snapshot dependency |
| Topics `forum/forumApi.ts:234` | `deleteTopic` | Topic/posts/pinned/forum totals | Post:topicId, Topic:topicId, PINNED, optional forumId | Forum totals omitted; C07; page manually refetches pinned too | Add Forum:forumId; rely on deduplicated invalidation |
| Replies `forum/forumApi.ts:287,307,321` | `createTopicPost`, `deletePost`, `updatePost` | Post pages/topic response and reply counts/forum/pinned copies | Post:topicId + optional Topic:forumId | Core post/topic-page link correct; Forum/pinned stale C07 | Explicit count/activity and pinned tags |
| Pinning `forum/forumApi.ts:341` | `pinTopic` | Topic/pinned state/posts | Post:topicId, Topic:PINNED + optional forumId | Posts refetch often unnecessary; C08 local snapshot overrides good refetch | Reconcile a narrow pin patch; target actual affected projections |
| Forum ACL `forum/forumApi.ts:358` | `setForumPermission` | Forum/permissions/topic pages/pinned/posts | Forum:L + selected Forum:ids | Topic pages match Forum:id; Post/pinned capabilities/content are not linked | Define read-revocation/descendant refresh contract; no current UI hook caller |
| Folders `documents/documentsApi.ts:93` | `createFolder` | Tree/parent navigation | Folder:L | Tree correct; no contents subfolder list is stored in getDocuments | Keep tree/count contract; search C11 |
| Folders `documents/documentsApi.ts:101` | `updateFolder` | Tree and embedded contents folder name | Folder:id, L | C06 contents metadata gap | Link folder contents to folder ID |
| Folders `documents/documentsApi.ts:112` | `deleteFolder` | Tree, descendant contents/ACL/download descriptors | Folder:L | Tree/navigation update correct; C06 descendants remain | Explicit descendant/content/permission invalidation |
| Folder ACL `documents/documentsApi.ts:123` | `updateFolderPermissionsBulk` | ACL tables, tree, content capability/read scope | selected Folder:id-permissions + L | C06 `getDocuments` capability remains | Add folder-content dependency; server read enforcement |
| Documents `documents/documentsApi.ts:148` | `uploadDocument` | Folder contents and tree/ancestor counts | Document:L | Contents correct; counts stale C06; all cached folders match | Scope folder membership and count invalidation |
| Documents `documents/documentsApi.ts:161` | `renameDocument` | Contents/download name/search | Document:id, L | Contents correct; descriptor/search disconnected | Connect descriptor + projections |
| Documents `documents/documentsApi.ts:173` | `deleteDocument` | Contents/counts/download/search | Document:L | Contents correct; tree count/descriptor gap C06 | Connect ID/folder/ancestor/descriptor dependencies |
| Members `members/membersApi.ts:213` | `createUser` | Directory/admin lists | User:L | Correct lists; generic dashboard stats not reached by specific LIST | Add explicit aggregate dependencies if used |
| Members `members/membersApi.ts:378` | `updateUser` | Selected detail/lists/current identity | User:id, L, ME | Correct role/status reassignment and current session refresh locally | Preserve; update role/effective-profile dependents deliberately |
| Members `members/membersApi.ts:391` | `deleteUser` | Selected detail/lists/current identity | User:L | C05; ME omitted for possible self-delete | Add id/conditional ME; define self-delete behavior |
| Members `members/membersApi.ts:398,408,419` | `softDeleteUser`, `restoreUser`, `validateUser` | Selected detail/lists/ME if acting on self | User:id, L | Selected data correct; ME not linked by actual user ID | Conditional ME if self-targeting supported; server eligibility policy |
| Self profile `members/membersApi.ts:364` | `updateUsersMe` | Header/auth/profile/directory/detail copy | ME, User:L; page dispatches setUser | Header/profile/list correct; independent getUserById(self) not invalidated | Link self detail ID without breaking hydration/draft behavior |
| Photo `members/membersApi.ts:430` | `uploadUserPhoto` | Self/detail/online/list avatars | Success patches getUsersMe/getUserById(userId)/online; User:L, ONLINE invalidation; page setUser | Current self flow works. Patcher unconditionally merges target into ME if an admin calls it for another user; no such UI consumer found | Gate ME patch on target=current actor and session; test direct admin target separately |
| Export `members/membersApi.ts:487` | `exportUsersCsv` | Returned Blob | No tags | Expected read-only side effect | Keep object URL cleanup; server authorization/HTTP cache verification |
| Roles `members/membersApi.ts:230,241,252` | `createUserRole`, `updateUserRole`, `deleteUserRole` | Roles/users/permissions/ME | User general | Freshness broad; C15; invalidates all User copies | More precise role/member relationships while preserving ME when relevant |
| Role grants `members/membersApi.ts:268,285` | `createUserPermission`, `updateUserPermission` | Role rows, ME, affected members | User:PERMISSIONS-role, ME | C12 affected profile copies missed | Role-membership dependency + remote-session strategy |
| Personal overrides `members/membersApi.ts:312,330` | `updateMemberPermission`, `createMemberPermission` | Override rows/target detail/list entries containing user/ME | User:USER-PERMISSIONS-user, User:userId, ME | PATCH links appropriate. Create is intentionally blocked before network; static invalidation can still run on rejection | Preserve safe block; gate definite-failure invalidation; no guessed nullable contract |
| Preferences `notifications/notificationsApi.ts:10` | `updateNotificationPreference` | Preference list | User general | C15 unrelated fanout, including on failure | Dedicated preference tag; avoid gratuitous profile refresh |
| Moderation `moderation/moderationApi.ts:21` | `moderatePost` | Queue/logs/topic post pages/pinned and forum/topic counts | Post general | Queue/logs/posts update; counts if changed have no Topic/Forum dependency | Define moderation outcome/count semantics; target projections |
| SMTP `admin/adminApi.ts:61` | `updateAdminSmtpSettings` | SMTP form/config | Admin:SMTP_SETTINGS | Correct core; failure refetch and draft synchronization need policy | Preserve targeted tag; dirty form handling |
| SMTP `admin/adminApi.ts:72` | `testAdminSmtpSettings` | Test result | None | Expected; no settings persistence claimed | No data invalidation unless API contract says it writes |
| System logs `admin/adminApi.ts:103` | `clearAdminSystemLogs` | Log lines | Admin:SYSTEM_LOGS | Correct primary query | Preserve; activity-log dependency only if specified |
| Downloads `admin/adminApi.ts:89,151` | `downloadAdminSystemLogs`, `downloadAdminBackup` | Returned Blob | None | Expected read-only/download response | Preserve cleanup; verify headers/assets server-side |
| Backups `admin/adminApi.ts:116,127,134,144` | `updateAdminBackupConfiguration`, `runAdminBackup`, `testAdminBackupPermissions`, `deleteAdminBackup` | Configuration/backups list/directory diagnostic state | Admin:BACKUPS | Coherent combined response; no need to invent finer tags without payload contract | Preserve; conditional success/ambiguous-error policy |
| Home/Dashboard | No own write endpoint | Composed article/training/event/forum queries; declared dashboard stats/activity/upcoming | Child tags above; dashboard aggregates provide general tags | Home lists usually update; forum counts/search and specific-to-general aggregate gaps remain | Use explicit aggregate tags; do not add redundant Home fetches |

Important asymmetry: invalidating `Article:LIST` reaches matching article lists but **does not** invalidate a query that provides only general `Article`. Thus `getDashboardActivity` does not refresh for most article CRUD, and general-only dashboard/stat queries miss many specific Training/Topic/User changes. P07/P08 verify this; it is a declared-but-unrouted dashboard risk, not an active Home aggregate defect. `getActivityLogs` likewise has no declared write dependency; do not promise realtime administrative logs.

## E. Authentication and permission lifecycle matrix

| Scenario | Current behavior / evidence | Assessment and required follow-up |
| --- | --- | --- |
| Login, including login OTP | Login/OTP consumer dispatches setCredentials; version increments; API resets; initializer resolves ME; protected routes wait | Correct same-tab lifecycle; existing delayed-login test passes |
| Signup/email verification | Public mutations and verification local workflow; no blanket authenticated profile assumption | Expected; real server activation/verification contract unverified |
| Browser refresh/restoration | Token loaded; `user=null`, authenticated false, status initializing; profile fetched once per same key | Correct fail-closed initialization; invalid stored JSON does not hydrate grants |
| Logout | Credentials/profile cleared, version increment, all RTK queries/mutations reset, protected layout unmounts | Correct same tab; independent downloads/open Blobs cannot be recalled; C03 other tabs |
| Account switch without reload | setCredentials resets cache and auth readiness; old request version cannot publish new data | Existing old-profile/refresh/login tests pass; general resource result uses same version guard |
| Token refresh | Shared flight per session; retries use renewed token; tokenRefreshed does not reset API or permissions | Correct request recovery/cache preservation. Existing simultaneous 401 test: two reads, one refresh, no `/me` reads |
| Refresh fails 401 / retry still 401 | Logout/reset; loop terminates | Correct; tested |
| Refresh transport/403/5xx failure | Preserve session, propagate error rather than falsely declaring expiry | Deliberate availability policy; tested; backend semantics still matter |
| Initial ME network/403/5xx | Auth error/retry view; token retained; no trusted user | Correct initialization safety; tested; 20-second timeout |
| Background ME failure | `sessionFailed` does nothing for already authenticated auth; RTK entry can be rejected with old data retained | P11 confirms stale grants remain on 403. Do not automatically equate a transient 5xx to revocation; define authoritative denial policy and stale-age visibility |
| Successful ME grant/revocation | sessionResolved publishes new profile; routes, sidebar and feature search filter recompute; no module purge/version change | Correct feature UI denial after refresh; P09 shows a pending same-session read may still fulfill internally. Internal retention is not a proven exposure |
| Fresh write ME denies revoked/inactive user | Write denied from fresh profile; auth/cache still old | C01 confirmed stale UI; publish trusted evidence without weakening final checks |
| Admin role reassignment | updateUser invalidates target ID/list/ME locally | Correct in initiating store; remote member tab waits for its next profile refresh |
| Admin changes personal permission | Target override/ID/ME invalidation locally; permission editor uses currentData | Correct own-store links; no push to other session |
| Admin changes role grants | Role table/ME refreshed, other member effective profiles not linked | C12; remote role changes still need server delivery strategy |
| User loses View while viewing module | Before next successful ME, old UI remains. After refresh PermissionRoute blocks module and unmounts its query consumers | Documented focus/reconnect-only freshness tradeoff. No immediate revocation SLA/polling/push; do not mislabel ordinary cache reuse as a flaw |
| Edit/Delete revoked with modal open | Successful ME updates controls/handler checks; fresh final write independently denies old grants | Good final safeguard. C01 leaves visible state stale when the only fresh ME was preflight; dirty drafts must not silently reset (C14) |
| Owner/capability changes, feature unchanged | Most reads do not refresh on focus/reconnect; ME changes do not invalidate entity entries | Existing detail/local owner/capability may remain stale; backend enforcement and resource invalidation strategy required. C06/C08 expose concrete local inconsistencies |
| Account inactive/deleted while logged in | Next successful ME supplies inactive/deleted user; shared grant helpers deny; Profile remains under authentication-only parent, with no feature grant required | No authenticated route eligibility teardown is implemented. Profile controls may remain, but protected API writes check eligibility; what `/me` may return is backend-dependent |
| Permission mutation succeeds, ME unchanged | Matching active ME invalidation normally refetches. Backend can return unchanged/lagged grants; another browser is not invalidated | Existing tests prove local updateUser/ME flow only; validate server recomputation/transaction ordering |
| Authorized read finishes after feature revocation | sessionVersion unchanged; base query accepts result; P09 confirms cache entry fulfills | Refreshed feature gate still hides module/search type. Consider permission-generation checks for stronger lifecycle guarantees; no confirmed visible bypass |
| Multiple tabs / identity replacement | No session signal; RTK memory token versus attachment storage token | C03; live two-tab security outcome unverified |

Administrative invalidation is not cross-user push. A fixed “cache for N minutes” does not establish revocation correctness: active entries do not expire after N seconds unused retention, and ME-only focus refresh does not refetch resource-only ACL changes. Agree separately on feature-revocation and resource-revocation freshness requirements before tuning durations.

## F. Navigation and stale-data matrix

| Transition / state | Handling | Result / action |
| --- | --- | --- |
| Article A → B detail; back/forward | `ArticleDetail.tsx:28–31` currentData; missing-current fetch loading; 403/error branches | Correct, existing five-state tests pass |
| Training A → B detail | `TrainingDetail.tsx:20–24` currentData | Historical defect fixed; same tests pass |
| TechnicoPro A → B detail | `TechnicoProDetail.tsx:20–24` currentData | Correct; same tests pass |
| Revisit deleted detail X | Correct argument key can still contain deleted X | C05; currentData cannot replace missing invalidation |
| Article category/page/status | Separate args; page reset effect `Articles.tsx:304–307`; `data` render | C09 previous rows/counts temporarily shown; published and authorized draft tabs both subscribe |
| Training/TechnicoPro category/status/page | currentData, fetching-aware skeleton; page reset effects | Correct current-argument isolation. Reset in an effect can briefly initiate new category with previous page before page one; no production request count measured |
| Directory search/filter | Args include trimmed search/role/status/page; input handlers reset page; no debounce | Correct separate keys; C09 previous rows; every distinct keystroke can issue a request |
| Admin detail/editor target switch | Five data hooks versus Article currentData; effects do not validate IDs | C02; blocking current target unresolved is necessary before save |
| Admin tab/list switch | Hidden queries remain mounted; list data can be previous args | C09/C16 |
| Forum/topic/post ID/page changes | Topic/post hooks currentData; scoped to current IDs | Good response isolation. Topics must exist in loaded page to select a detail; no canonical individual topic GET exists here |
| Pin then refresh/page navigation | Local topic array overrides server | C08; can ignore pagination boundaries and remote removal |
| Sidebar extra-page fetch versus invalidation | Copies extra pages; resets only from page-one data | C10; stale generation race despite ID deduplication |
| Document folder A → B | `DocumentLibrary.tsx:409–410` checks returned folder ID before files/capabilities | Good stale-folder content guard. File-route effect at 435–439 uses `isLoading`, not absence of current response plus isFetching; direct A-file → B-file navigation can redirect prematurely while B loads; focused browser verification recommended |
| Document preview source/file changes | Cancellation boolean and object URL release | Good late-preview/Blob cleanup; one render before effect reset may still retain previous preview state, not a proven exposure |
| Agenda event A → B | Main selected event requires matching ID (`293`); selection effect uses raw selectedEventDetails (`401–403`) | Main record isolation good; selectedEventId can temporarily remain previous ID, participant query needs C09 |
| Agenda participant A → B | data/isLoading, no event-response identity match | C09 association risk; use currentData/current event key |
| Calendar month A → B | Events/Agenda use data, first-load flags | Previous month list can persist until response; avoid deriving current-month navigation/modal state from it |
| `/events/:id` outside fetched current month | Selection from current month only; missing event redirects (`Events.tsx:78–96`) | Existing contract/navigation limitation, not demonstrated cache-key corruption; individual event endpoint exists elsewhere and should be considered if direct-link support is intended |
| Search term A → B / same term after write | 300 ms debounce, lazy trigger, last-term suppression | C11; pending old response belongs to old key, display must bind to current term |
| Modal close/reopen | Cached same-target records reuse normally | Expected. Dirty drafts/target reset must be explicit; C02/C14 |
| Mutation then immediate navigation | Matching tags invalidate all subscribed/unused matching entries; unmatched entries remain | Main lists/Home mostly correct; C05–C07/C11–C13 identify missing edges |
| Delete last row of final page | No consistent page clamp to new total was found in list handlers | Potential empty/out-of-range page if server returns normal empty page; not counted as a separately reproduced defect. Test server empty-page/404/clamping behavior before implementation |

No custom query serialization merges different IDs, no out-of-order response overwrites another RTK key, and no server-data infinite merge was found. The confirmed ordering defects are in local copied arrays/drafts, or freshness within the same session/key—not RTK confusing argument keys.

## G. Performance findings and tradeoffs

1. **ME:** startup/header/guards do not independently fetch it. Profile shares initializer's key. Each protected write intentionally performs an uncached fresh ME request; ordinary content writes additionally fetch canonical target. These are security preflights, not accidental duplicate subscriptions. Permission saves also invalidate ME, so one action can include both preflight and post-save profile reads with different purposes. C01 should reuse/publish evidence while preserving freshness.
2. **Concurrent 401:** one refresh flight per session is tested. Token rotation avoids full-cache invalidation. No reason to reset application data on every token refresh.
3. **Hidden queries:** C16's 16 Admin hooks and C15's general tags amplify each other. Article lists also fetch published and draft pages whenever lifecycle controls are available (`Articles.tsx:200–225`), even with one tab hidden. Decide whether immediate status switching justifies that work; drafts remain authorization-filtered server-side.
4. **Closed sidebar sections:** no request until first opened, but `hasEverOpened` keeps page-one subscription alive after collapse (`SidebarCategorySection.tsx:58–73`); this is a deliberate latency/freshness tradeoff. It is not an unmount leak. The lazy hook holds its last page and the copied pages need C10 reconciliation.
5. **Broad/failed invalidation:** C15 confirms extra target selection, including definite failures. General Event plus Event:id is redundant. ID/parent/aggregate tags should replace unnecessary breadth without losing event registration counts, Home lists or permission revocation.
6. **Manual refetch:** permission editor calls `query.refetch()` after tag-invalidating save; forum topic delete calls `refetchPinnedTopics()` after PINNED invalidation. These are redundant intent, but **not a confirmed double network fetch**. P14 measured initial role-row GET plus exactly one shared automatic/manual refresh while pending. A later explicit refetch after completion can issue another request; do not call every manual refetch a storm.
7. **Overlapping reads:** `getMe`/`getUsersMe`, `getAllTrainings`/paginated trainings, list/detail/upcoming and independent category page sizes have separate keys. The first ME hook and explicit refresh mutation have no current production consumer. Different page sizes/details are usually intentional. Target preflight reads bypass RTK by design; ordinary forum mutations may scan 100 × 100 rows (`mutationAuthorization.ts:59–70,83–92,168–184`), an explicit backend canonical-target contract opportunity.
8. **Retention/growth:** no configured infinite TTL, persistent API cache or unbounded RTK accumulation was found. Unused pages/search terms expire after 60 seconds; active entries and local pin/sidebar arrays last for the mounted component. No heap/load benchmark was run. Large trees/100-record detail lists and slow requests can increase memory; that is not evidence of a leak. Do not change retention arbitrarily to compensate for missing tags.
9. **Transformations:** response normalization is linear and occurs per fulfilled response; `useMemo` protects several derived views. No expensive transformation hotspot was measured. `getAllTrainings`' single-page name is misleading, not an automatic infinite fetch.
10. **Blob/export lifecycle:** cleanup exists; mutations can temporarily retain Blob results in mounted mutation-hook state until replacement/unmount/reset. No long-term Blob persistence or external memoization cache was found.

## H. Recommended fix plan

Implement in this order in a separate change pass. No fixes are applied here.

| Group / findings | Affected files | Expected behavior | Risks to preserve | Recommended regression tests |
| --- | --- | --- | --- | --- |
| 1. Security/data isolation: C01 | `apiSlice.ts`, `authSlice.ts`, `membersApi.ts`, profile normalizers | Same-session fresh profile evidence updates auth/ME; authoritative revocation immediately restricts visible actions | Older concurrent ME must not restore revoked grants; do not clear good session on transient failure or remove final fresh guards | Deferred old/new ME ordering; preflight revoked/inactive; failed ME; session switch during preflight; reads completing after revocation |
| 1. Security/data isolation: C03/C04 | `authSlice.ts`, `store.ts`, `App.tsx`/initializer, `attachments.ts` | Tab/session changes invalidate identity-bound state; files and RTK use one resolved credential source; unused profile storage removed | Token rotation must not loop or erase all cache; protect initializing/offline behavior | Two real tabs logout/login/refresh, simultaneous rotation/account replacement, attachment request headers, legacy stored profile cleanup |
| 2. Cache correctness: C05/C06 | Content/member APIs, `documentsApi.ts`, DocumentLibrary | Deletes evict entity projections; folder contents/counts/capabilities and descriptors track changes | Preserve parent/cascade access rules; no ordinary folder delete; invalidate known descendants safely | Read/delete/revisit each family; upload/delete tree counts; nested rename/delete/ACL; preview/download after removal |
| 2. Cache correctness: C07/C08 | `forumApi.ts`, `Forums.tsx` | Counts/pinned/post representations reconcile; server deletion beats local pin state | Keep locks, ownership, posting capabilities, safe topic cascades and page boundaries | Reply/create/edit/delete counts; pinned edit/delete; forum cascade; pin then external change/delete; failed pin rollback |
| 2. Cache correctness: C11–C13 | `dashboardApi.ts`, layout, members/training/TechnicoPro APIs, permission editor | Search, effective profiles and embedded categories become stale/refetch after relevant writes | Search feature filtering and safe personal override creation block remain | Search same term after mutation/failure; role row affects member summary; category rename affects main/personal/detail caches |
| 3. Navigation/UI: C02/C09 | AdminPanel, Articles, MemberDirectory, Agenda/Events | Current arguments own displayed rows/form fields/participants; unresolved target cannot submit | Avoid unnecessary blanking of correct same-ID background refresh; preserve independent grant checks | Deferred A→B success/403/404/offline; close/reopen B; assert PATCH B never carries A's copied fields; event attendee key transitions |
| 3. Navigation/UI: C10/C14 | SidebarCategorySection, Profile, Articles/Admin editor effects | Stale page generations ignored; dirty drafts survive background responses | Do not preserve revoked action availability; reset drafts on intentional identity/target switch | Page two delayed across page-one refresh/delete; dirty profile focus/notification change; edited content plus permission refresh/conflict |
| 4. Network optimization: C15/C16 | API tag declarations, AdminPanel, optional listing-tab hooks | Only affected subscribed projections refetch; hidden tabs load on demand | Preserve ME refresh for grants, Home list membership and server-ambiguous write reconciliation | Count cold Admin requests per tab; definite 403/422/500 versus ambiguous transport outcomes; notification changes avoid role/directory reads; event registration affects correct views |
| 5. Regression coverage / remaining risks | Existing `tests/` harnesses and `e2e/session-navigation.test.mjs` in a later implementation pass | Permanent tests cover actual store/tag/React lifecycle; backend contracts tested separately | Current mocked passes are not backend security certification; no new dependency needed | Preserve 158 existing tests; convert P/V probes into focused regressions; browser two-tab and back/forward tests; backend atomic authorization/headers/ACL revocation |

Before introducing polling, longer TTLs or push subscriptions, define acceptable revocation latency and resource-access semantics. Focus/reconnect of ME alone cannot establish resource ACL freshness. A permission generation or server-provided version can support late-response rejection, but its exact contract must be explicit. No TanStack Query, Redux redesign or new dependency is proposed.

## I. Verification results

### Existing checks executed

| Command | Result |
| --- | --- |
| `node --test tests/*.test.mjs` | **120 passed, 0 failed**; includes permission/detail navigation, Home/search visibility, editor and modal harnesses. |
| `node scripts/test-article-authorization.mjs` | **4 passed, 0 failed**. |
| `node scripts/test-article-authorization.mjs ../tests/frontend-authorization.test.ts` | **17 passed, 0 failed**. |
| `node scripts/test-article-authorization.mjs ../tests/roles-permissions-audit.test.ts` | **5 passed, 0 failed**. |
| `node scripts/test-article-authorization.mjs ../tests/session-lifecycle.test.ts` | **12 passed, 0 failed**, including deliberate 20-second timeout. |
| `npm.cmd run lint` | Passed (`tsc --noEmit`), exit 0. |
| AST inventory | 51 queries + 85 mutations; one createApi; no custom retention/serialization/merge/rehydration config. |

**158 existing tests passed; no existing tests were edited.** A production build was not run because this audit does not change application/build inputs and the build would rewrite existing dist artifacts. Existing browser E2E source was inspected but not executed; no Vite/browser/server session was started. No dependencies were installed.

### Temporary probes

Executed with inline `node --input-type=module` on stdin, using the existing TypeScript compiler/registerHooks pattern from `scripts/test-article-authorization.mjs`. API base URL was replaced in memory with `https://test.invalid`; fetch and localStorage were mocked. Actual store, endpoints, authorization and listeners ran. Store reset between probes; processes terminated after completion to avoid waiting for cache-retention timers. No probe/test file was created. Component probes evaluate actual AST-extracted callbacks/expressions in VM contexts; they are not full browser/hook timing tests.

| Probe | Observed result |
| --- | --- |
| P01 | Four delete families reused old detail with no GET; stale detail confirmed. |
| P02 | Document upload invalidated contents but folder tree count stayed zero. |
| P03 | Folder ACL mutation and folder deletion preserved old contents and download descriptor. |
| P04 | Fresh revoked write profile produced client 403 and zero writes; auth and ME cache still granted article View. |
| P05 | Role permission mutation left affected member's effective cached profile unchanged. |
| P06 | Reply create invalidated posts/topic page but left forum post count and pinned reply count stale. |
| P07 | Article create left existing search and declared dashboard activity caches fulfilled/unchanged. |
| P08 | General User invalidation selected ME, roles, preferences, online and dashboard stats; specific Article:LIST did not select general Article category provider. |
| P09 | Successful feature revocation hid permission in auth, but an already pending same-session article response still fulfilled internally. This is not a confirmed visible authorization bypass. |
| P10 | Full profile persisted; external storage token replacement did not update Redux; setCredentials without profile left old stored user JSON. |
| P11 | Background ME 403 preserved resolved auth and old View permission. |
| P12 | Training and TechnicoPro category rename left detail's old embedded category name. |
| P13 | Failed notification save (500) still invalidated profile/role caches. |
| P14 | Automatic permission invalidation and immediate manual refetch shared the pending request: two row GETs total including initial load, not three. |
| V01 | Actual Admin effect copied previous member A into selected B's form. |
| V02 | Real pin handler plus topic derivation retained pinned local topic after server results became empty. |
| V03 | Old sidebar page-two result appended after executing fresh page-one reset effect. |
| V04 | Actual Profile synchronization effect replaced an unsaved draft with changed server profile data. |
| V05 | Admin detail selector returned previous A with no loading state while current B was unresolved. |
| V06 | Actual Admin submit handler targeted B with previous A's copied first name and `is_superuser: true`; mutation invocation was mocked. |

**Final probe runs: 14 store/API probes and 6 component probes passed their reproduction assertions; 0 unresolved failures.** Passing a reproduction assertion confirms the stated defect/behavior rather than indicating the behavior is correct. An initial V03 harness run stopped because its mocked state setter accepted functional updates only; correcting the in-memory mock to accept arrays as React does resolved that harness error. No application change was needed.

To reproduce the core API pattern independently with the existing loader: establish credentials plus `sessionResolved`, mock fetch, query/seed a detail through `apiSlice.util.upsertQueryData`, dispatch its delete mutation, then dispatch that same detail `initiate(id, {subscribe:false})`. P01's assertion is that old data is returned without a detail GET. For C01, serve a revoked profile for preflight and assert both 403/no write and the stale `hasPermission(store.getState().auth.user, feature, 'view')`. For tag gaps, seed the named query pairs, dispatch the actual mutation, then inspect each endpoint selector and `apiSlice.util.selectInvalidatedBy`. Seeded tests isolate cache relationships; they do not claim every seeded query is currently routed.

### Unverified assumptions and backend-dependent work

- No confirmed sensitive-data exposure across users/authorization boundaries; **Critical = 0**. Backend authorization, resource ACL filtering, asset headers, signed URL expiry and token invalidation were not inspected.
- Confirmed stale-permission UI C01 does not establish a successful unauthorized write. Final mutation guards and refreshed feature routes are working. Background failure tolerance and remote focus-only revocation are documented tradeoffs; choose an SLA before changing them.
- Resource-only revocation can leave cached/readable content in a still feature-authorized page, and a same-session in-flight response is accepted. Whether that violates server policy depends on when read authorization is evaluated and the agreed client refresh contract. Verify cached detail/search/attachments with actual accounts; do not equate internal retention alone with a vulnerability.
- Two-tab authenticated behavior, real request aborts/browser HTTP caching/BFCache, simultaneous rotated refresh tokens across tabs, and memory/network load were not tested in a browser.
- Server-derived aggregates, folder cascade effects, category deletion/reassignment, background 403 meaning, personal permission inheritance create/reset and safe delegated account creation remain existing contract dependencies; this audit does not redesign those policies.
- Potential last-page clamping and premature document file-route redirection require focused browser/server-contract tests. They are listed for regression coverage and excluded from the confirmed finding totals.
- Photo upload's unconditional ME patch can affect another target if an administrator invokes the exported endpoint directly; only the self-photo page currently calls it. This latent caller-contract risk is recorded in the matrix, not counted as demonstrated cross-user exposure.

Workspace verification showed only this new Markdown file. All proposed implementation work belongs in a subsequent authorized change pass.
