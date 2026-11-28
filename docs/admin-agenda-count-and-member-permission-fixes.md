# Administration Agenda count and member-permission fixes

Date: 2026-11-28, Asia/Dhaka. Starting revision: `6484fb9`.

Follow-up clarification: the original dropdown report concerned completely disabled controls, not post-save value reversion. This report's cache fixes remain valid, but do not establish resolution of that original symptom. See [member-permission-disabled-dropdown-fix.md](member-permission-disabled-dropdown-fix.md) for the targeted disabled-state investigation, explicit first-override creation workflow, and current operation limits. Its findings supersede this report's description of blanket creation blocking.

The starting working tree was clean. Earlier stabilization/security changes were inspected and preserved. No dependency, backend endpoint, authorization architecture, Edit Member role control, or Agenda calendar behavior was changed. No commit, push, deployment, production mutation, or historical-script execution was performed.

## 1. Audit findings

### Agenda badge

**Original behavior:** the Events/Agenda entry in `AdminPanel.tsx` always assigned `{ status: "unavailable" }` to its badge. The previous audit required a confirmed all-time total and deliberately avoided labelling the monthly array length or annual metric as that total.

**Confirmed frontend cause:** the independently available calendar-statistics query was not subscribed by Administration. This was an intentional limitation under the old requirement, not evidence of a failed backend endpoint. The new brief explicitly permits an annual count with an explanation of its period.

Evidence inspected:

- `eventsApi.ts` already defines GET `/events/events/calendar-stats` and `useGetCalendarStatsQuery` with the cache tag `Event:STATS`.
- `eventTypes.ts` defines the existing response contract as `CalendarStats { events_this_year: number }`.
- `HANDOVER.md` lists the existing calendar-statistics endpoint. The previous audit documents the annual field and its runtime-verification limit.
- Event create, update, delete, and category deletion already invalidate `Event:STATS`. Event date edits therefore already trigger the required annual-statistic refresh.
- The existing `/events/events` request requires year/month and may be category-filtered. Its monthly list is not a confirmed all-time total. No more suitable all-time count was found in the inspected client contracts.

Responsibility: frontend count wiring/period presentation. No confirmed backend defect. The annual field is an existing client contract, not a newly invented response field; its live authenticated response remains unverified.

### Member permission action dropdowns

The user clarified that the affected control is **Allow/Deny/Inherit in the per-member Permissions modal**, not a member selector or the Edit Member role dropdown. This checkout has no separate Member Permissions tab/member selector, so none was added.

The existing controlled selects already update `drafts` with booleans and call the existing PATCH mutation on Save Permission for supported existing records. Tests confirm immediate selection changes and the exact changed-action payload. No evidence justified changing native select positioning, pointer events, role IDs, or those event handlers.

Two frontend synchronization gaps were identified:

1. **Post-save value reversion:** `AdminPermissionsEditor` clears the saved draft after the PATCH resolves. `updateMemberPermission` previously only invalidated tags. While the automatic GET was pending, the editor could render the old cached action again. A regression using real Redux/RTK and a deliberately held GET reproduced this: the cache still contained `can_view:false` after a successful PATCH returned `can_view:true`. The test failed before the fix and passed after it.
2. **Cached direct rows on reopening:** the member profile query already refetched on mount/argument change, but the direct-permission query did not. Reopening a member within the RTK retention interval could therefore pair a freshly fetched profile with cached management rows. The member permission query now uses the same freshness policy for opening/switching targets.

Affected files: `AdminPermissionsEditor.tsx`, `membersApi.ts`, associated regression tests. Responsibility: frontend synchronization. These findings do not establish the precise behavior of the deployed endpoint without its sanitized response.

The existing disabled states were also audited. Missing direct-row IDs, initial/failed profile data, background fetches, active saves, and lost authorization intentionally prevent unsafe writes. Creating an override where there is no saved row, and resetting a saved boolean to Inherit, remain blocked because those contracts were unresolved in the earlier audit. Those restrictions were not removed to make the controls appear operational.

## 2. Implemented fixes

| File | Exact change | Reason / expected behavior |
| --- | --- | --- |
| `src/pages/AdminPanel.tsx` | Subscribe to `useGetCalendarStatsQuery(undefined, { skip: !canAccessAdminPanel })`; read its annual field for Agenda | Count loads without opening Agenda and is independent of table search, pagination, category/month selection, or active tab |
| `src/pages/AdminPanel.tsx` | Add annual-period tooltip plus an `aria-describedby` explanation; include this query in the existing failed-count retry path | Explain the period without calling it all-time; retain existing error recovery |
| `src/pages/admin/adminCounts.ts` | Allow an explicit `events_this_year` numeric field, retaining `total` as the default | Reuse strict nonnegative-safe-integer validation and all existing count states without changing other counts |
| `src/i18n/locales/en.json` / `fr.json` | Add only the annual-period description | English: “Events in the current calendar year”; French: “Événements de l’année civile en cours” |
| `src/pages/admin/AdminPermissionsEditor.tsx` | Add `refetchOnMountOrArgChange:true` to the existing member-permission query | Refresh direct management records when opening/reopening a member; no per-render polling or extra React permission source |
| `src/redux/features/members/membersApi.ts` | Add a successful-response cache update for the matching existing direct row | The saved selection remains visible while the existing invalidation GET refreshes; no extra GET is dispatched by this lifecycle |
| `tests/admin-agenda-member-permissions.test.mjs` | Add annual-count and real RTK permission-save/race regressions | Reproduce the actual timing gap, verify request counts, failures and target isolation |
| `tests/admin-permissions.test.mjs` | Exercise all four supported action selects and verify changed-action PATCH; assert fresh direct-row subscription policy | Preserve explicit false, existing Inherit restrictions, failed-save behavior and target IDs |
| `tests/cache-performance.test.ts` | Include the new statistics subscription in the actual Admin query-block harness | Verify one initial stats request, stable tab switching, cache reuse, and bounded additional work |

The member response cache update is **pessimistic**: it waits for the server response and never copies intended values from the request. It requires matching permission ID and user ID, boolean/null values for all existing action fields, the same session version, and a matching existing feature row. It does not create missing rows or write values into Redux authentication permissions. A mismatched/malformed response is not published to the direct-row cache; the normal GET remains responsible for reconciliation.

All normal invalidation tags remain intact, including profile/search/activity updates. A rejected mutation leaves its previous cached row intact and the existing editor error handler reports the error without success. No new `any`, suppressions, timers, polling, reloads, dependencies, or full-member/list downloads were introduced.

## 3. Agenda count contract

**Endpoint:** GET `/events/events/calendar-stats`.

**Existing response field:** `events_this_year`.

**Period:** current calendar year as calculated by the backend. This is **annual**, not all-time or monthly. The request has no year/month/category/search/page arguments; server calendar/time-zone semantics remain a backend contract detail. The frontend does not sum months or infer a different population.

Expected existing shape, shown as a synthetic contract example rather than an observed live response:

```json
{"events_this_year":12}
```

A valid all-time source was not found in the available contracts. Annual statistics are the next priority expressly allowed by the new brief. No monthly fallback was added: silently switching to an unconfirmed list population would misrepresent the statistic or hide a statistics error. If this endpoint does not actually provide a valid annual field, a sanitized response is needed before choosing a different source.

**Cache behavior:** one argument-free RTK cache key; tag `Event:STATS`; initial Administration subscription independent of selected tab; duplicate same-key subscribers share a request. Existing create/delete/update invalidation refreshes the annual count. The regression simulates a date change moving a record outside the counting year and verifies one fresh statistic request. The backend remains responsible for calculating the changed annual number.

**Presentation:** validated integer zero displays `0`; initial load displays the existing loading marker; unavailable/malformed metadata is not treated as zero; failed first load displays the existing error state; previously loaded valid data is retained with the existing stale indication when a later request fails. The existing retry button includes the Agenda source. Period text accompanies ready, loading, error, and stale states.

Other six data-backed count sources and the unresolved Settings/Backups definition are unchanged. The performance harness observes eight initial Members-page requests: its table, seven count subscriptions including roles, and no unnecessary full Agenda list request. Revisiting cached tabs does not reload the annual statistic.

## 4. Member permission dropdown

### State, IDs and query lifecycle

- The existing `permissionMember` state is selected from a member's row. Stable `permissionMember.id` remains the React key and the editor's `targetId`.
- Member queries remain keyed by `{ user_id: targetId }` and profile queries by `targetId`. They use `currentData`, so a different query argument does not display another member's last response.
- The keyed editor is remounted for a different member. Its existing local **unsaved form drafts** do not become another member's drafts. The prior close/save restrictions remain in place.
- Both profile and direct-row reads now request fresh data when the member editor opens. Cached rows for a different member cannot replace current-target data. No member-list pagination or selection architecture was changed; the clarified control is the action select, not a population selector.
- Allow/Deny change the corresponding local action immediately. Save sends only explicit boolean changes, the stable permission-record ID, and the selected user ID as client mutation context. The API serializer continues to exclude that context user ID from the PATCH body.
- After successful PATCH, only a matching server-returned row is published to that member's existing direct-row cache. The automatic GET still runs once through existing invalidation. The editor can clear its saved draft without reverting to the pre-save cache value during that GET.
- Another member's slow response cannot populate this cache key or overwrite the selected member's row. Session-version checks prevent obsolete mutation completions from repopulating a replacement session.
- There is no member-list effect resetting a choice, no new selection effect, and no new authentication/permission state.

### Restrictions preserved

Authorization still uses only final server `permissions`, through the existing utilities/hooks/guards. `role_permissions` and `user_permissions` remain management/display data; `effective_permissions` was not introduced as a competing access source. Active Superuser, inactive/deleted accounts, explicit false, module and resource rules, mutation preflights and Access Denied behavior are unchanged.

The role baseline/effective labels remain governed by the earlier audit: explanatory role metadata and current server authorization decisions respectively. Unsaved selections do not claim to be effective access before the server updates it.

No-record creation and saved-to-Inherit reset are still unsupported. Inherit can be restored for an unsaved edit of an originally null/missing action; it cannot reset an already saved boolean without the unresolved backend contract. Missing/deleted member profiles or permission records are not replaced with guessed IDs or fabricated records.

### Scope of the diagnosis

The timing failure was reproduced using mocked HTTP with real middleware/cache state. This confirms a frontend issue and its source fix. It does **not** prove that every reported disabled dropdown shares that cause. If a particular dropdown remains disabled, the next evidence needed is its sanitized GET `/user/user-permissions?user_id=<member-id>` response plus the member profile and status/error information. No such response was supplied in this follow-up, so no payload mapping or inheritance rule was guessed.

## 5. Verification

The following results were obtained from the final commands. Mocked HTTP tests are not authenticated runtime API tests or browser interaction tests.

| Check | Result / evidence |
| --- | --- |
| Before-fix reproduction | Four Agenda checks passed; the new post-PATCH cache test failed (`false !== true`) while the refresh GET was deliberately held |
| Targeted regression | The initial targeted run passed all 27 tests across the new regression file, permission-editor suite and Admin query/cache suite; further target-isolation cases were then added |
| TypeScript | `npx.cmd --no-install tsc --noEmit`: passed, exit 0 |
| Existing lint script | `npm.cmd run lint`: passed, exit 0; this repository script is TypeScript checking, not ESLint |
| Full automated suite | `npm.cmd test`: **226 passed, 0 failed, 0 skipped**, about 44 seconds; includes existing authorization, role editing, modal, cache/session, EN/FR tests and all new regressions |
| Production build | `npm.cmd run build`: passed, exit 0, about 13 seconds; normal filesystem execution used because esbuild needed it in the earlier audit. Existing large-chunk warning remains; no unrelated bundle redesign |
| Browser testing | Not performed. Browser access host unavailable. Native Chrome fallback was stopped by the service because it could not establish the current URL confidently enough to enforce policy. No bypass attempted. No claim that native dropdown opening/closing was exercised in a real browser |
| Authenticated runtime API | Not performed. No authorized test account/response was supplied; no production writes or credentials were used. Calendar/PATCH examples in tests are synthetic |
| Repository review | Final diff reviewed against `6484fb9`; intended files only, no dependency/lockfile/security-loader restoration, no commit/push/deploy |

Regression coverage includes:

- Annual field versus unrelated total metadata; valid zero, loading, malformed data, failed refresh and cached stale values.
- One statistics request for concurrent subscribers; initial Administration entry without Agenda selection; tab reuse without an extra statistics request.
- Annual refetch after event creation, deletion, and date update, using existing invalidation.
- Supported action dropdown changes, precise changed-action PATCH, explicit false, failed-save drafts, unavailable profile states, and existing unsupported Inherit/create restrictions.
- Matching server-result cache publication before a slow automatic GET; one GET refresh per save, not an added manual refetch.
- Slow Member A read alongside Member B save, separate stable cache keys, A → B → A reopening behavior, wrong-user/wrong-record/malformed-action responses and rejected PATCH.
- Existing Edit Member Role dropdown/form tests, all authorization-only-`permissions` tests, active/inactive/deleted restrictions and resource checks.

## 6. Remaining backend requirements

**No new backend change is confirmed or required for these frontend fixes under the existing contracts.** No endpoint or request shape was added or modified.

Runtime contract confirmation is still required:

1. Confirm GET `/events/events/calendar-stats` returns a nonnegative integer `events_this_year` for an authorized administrator and recalculates it after create/delete/date changes. A missing field remains unavailable rather than being guessed.
2. Confirm PATCH `/user/user-permissions/{id}` returns the updated row with matching `id`, `user_id`, `feature`, and the existing boolean/null actions. The cache update rejects a mismatched or malformed row and waits for the normal GET instead. If the backend returns a different shape, provide a sanitized response before changing the mapping.
3. Confirm GET `/user/user-permissions?user_id=...` returns the existing documented array with stable row IDs for supported edits. Empty/missing rows remain intentionally restricted; no new-override contract was inferred.
4. The earlier unresolved new/reset override contracts, Settings/Backups count definition, host/credential incident-response work and broader backend enforcement verification remain open. This focused change does not resolve or supersede those security/contract findings.

These are unverified contracts and follow-up evidence requests, not confirmed backend defects.

## 7. Final status

| Issue | Classification | Reason |
| --- | --- | --- |
| Agenda count | **FRONTEND FIXED — RUNTIME VERIFICATION REQUIRED** | Annual source is wired and period-labelled; cache/state/mutation behavior tested with mocked responses; live annual payload not authenticated-verified |
| Member permission action dropdown | **FRONTEND FIXED — RUNTIME VERIFICATION REQUIRED** | Confirmed save/cache timing and reopen freshness gaps addressed; supported select/PATCH and target isolation tested; real browser/payload verification still required |

The classifications apply to the confirmed frontend defects, not to unsupported override creation/reset or every possible deployed dropdown failure. Joint testing must still verify the actual server responses and native browser behavior.
