# ARCHICOPRO — backend investigation and contract clarification

Prepared 2026-11-27, Asia/Dhaka, from frontend revision `55acb39` plus the accompanying uncommitted fixes.

This handover separates confirmed client inconsistencies from unverified backend behavior. **No backend defect has been confirmed by an authenticated runtime test.** Use an authorized staging/test environment for the reproduction steps. Do not run destructive tests against production users or resources.

The frontend owner confirmed two requirements during the audit:

- Only the response field `permissions` should drive frontend access checks. The frontend no longer recomputes grants from `user_permissions`, `role_permissions`, or `effective_permissions`.
- Administration badges should show unfiltered totals. The Settings/Backups count definition remains open.

The supplied Superuser profile has a string `role_id`, a nested role object, active/nondeleted status, all-true `permissions`, and direct rows that mostly deny access. The actual `is_superuser` flag explains all-module access. Its role name alone must not grant administrator access. No contact details, credentials, tokens, or real user IDs from that response are reproduced here.

## Evidence and contract inventory

Only the following requests were made against the supplied live API:

| Method / endpoint | Request / status | Actual observed response | Interpretation |
| --- | --- | --- | --- |
| GET `https://api.archicopro.cloud/user/users/me` | No credentials; HTTP 401 | Unauthorized; no authenticated profile retrieved | Authentication required; no conclusion about normal-user fields or ACLs |
| GET `https://api.archicopro.cloud/openapi.json` | No credentials; HTTP 200 | `{"openapi":"3.1.0","info":{"title":"FastAPI","version":"0.1.0"},"paths":{}}` | Public schema defines no endpoint contracts |

The owner-supplied `/me` JSON is response evidence from the conversation, not an authenticated request performed by the agent. The remaining rows below describe **existing frontend expectations**, not proof of actual server response shapes. HTTP status is **not observed** for every endpoint in this second table.

| Method / endpoint | Existing request arguments or payload | Existing frontend response expectation | Runtime status / mismatch |
| --- | --- | --- | --- |
| POST `/auth/login` | URL-encoded `email`, `password`, `otp_value` | `access_token`, `refresh_token`, `token_type`, status, optional role | Not verified; profile is subsequently hydrated from `/me` |
| POST `/auth/refresh` | Automatic path: JSON object with `refresh_token`; exported mutation: JSON string | Token pair with `access_token` | Not verified; confirmed client inconsistency, API-01 |
| GET `/user/users/me` | Bearer credentials for authenticated use | Identity, `role_id`, role object/string, active/deleted flags, final `permissions` | Only unauthenticated 401 observed; supplied Superuser example available |
| GET `/user/users/{id}` | Stable user ID in path | Member profile with `role_id` and/or nested role ID; final `permissions` if used for display | Not verified; role initialization now honors explicit `role_id` |
| PATCH `/user/users/{id}` | Multipart form with changed profile fields, `role_id`, status/payment/Superuser fields as applicable | Updated member object | Not verified; no production writes performed |
| GET `/user/users` | `archived=false&page=1&page_size=1` for badge; other pages/filter args for table | `total`, `results`, counts metadata | Not verified; badge uses validated `total`, never page length |
| GET `/user/roles` | No parameters | Existing whole-array role list; string `id`, name/slug | Not verified; array completeness must be confirmed |
| POST `/user/roles` | JSON `name`, optional description | Created role | Not verified |
| PATCH `/user/roles/{id}` | JSON name/description | Updated role | Not verified |
| DELETE `/user/roles/{id}` | No body | Existing client expects no result | Not verified; assigned-user deletion/reassignment policy unknown |
| GET `/user/permissions` | `role_id=<role-id>` | Role feature/action rows | Not verified |
| POST `/user/permissions` | JSON role ID, feature, four boolean action values | Created permission row | Not verified |
| PATCH `/user/permissions/{id}` | JSON only explicitly changed boolean actions; role ID is client cache context, not body | Updated row | Not verified |
| GET `/user/user-permissions` | `user_id=<user-id>` | Direct feature/action rows and record IDs | Not verified; supplied `/me` rows additionally include `is_override` |
| POST `/user/user-permissions` | Existing typed request requires user ID, feature, four booleans | Created override | Not verified; existing client deliberately blocks unsafe creation pending inheritance semantics |
| PATCH `/user/user-permissions/{id}` | JSON explicitly changed boolean actions; user ID remains client cache context | Updated direct row | Not verified; null reset not allowed by current typed/client request boundary |
| GET `/forums/forums` | `page=1&page_size=1` for badge | Paginated `total` and results | Not verified |
| GET `/articles/articles` | `page=1&page_size=1`; no status/category/search filter for badge | Paginated `total` and results | Not verified |
| GET `/technicopro/technicopros` | `page=1&page_size=1`; no status/category/search filter for badge | Paginated `total` and results | Not verified |
| GET `/trainings/trainings` | `page=1&page_size=1`; no status/category/search filter for badge | Paginated `total` and results | Not verified; old flatten-to-array path lost metadata and capped visible count |
| GET `/events/events` | Existing client requires `year`, `month`, optional category | Monthly array | Not verified; cannot establish all-time unfiltered total from its length |
| GET `/events/events/calendar-stats` | No client parameters | `events_this_year` | Not verified; annual count is not an all-time total |
| GET `/home/` | `q=<term>&limit=10`, optional type | Search rows, snippets, extra routing fields and meta totals | Not verified; module/resource ACL filtering must be server-side |

## API-01 — refresh body mismatch

**Severity:** medium; **category:** I; **feature:** token recovery. **Status:** confirmed inconsistent frontend request shapes, accepted server body unknown.

Affected endpoint: POST `/auth/refresh`.

Sanitized alternatives already present in the frontend:

```json
{"refresh_token":"<redacted>"}
```

and a top-level JSON string containing the same redacted token. No real token was sent or recorded by this audit.

Actual authenticated response/status: unavailable. Existing expected response: an object containing `access_token`, optional rotated `refresh_token`, and token type. Client locations: `src/redux/features/api/apiSlice.ts` automatic 401 handling and `src/redux/features/auth/authApi.ts` exported mutation. Active call-site search found no ordinary UI use of the exported refresh hook; its inconsistent contract is still a maintenance/integration risk.

Reproduction: in staging, obtain a disposable test session and submit each currently documented request shape separately. Record sanitized status/schema, validation errors, and rotation behavior. Test concurrent expired requests and retrying the original request after rotation. Do not log token bodies.

Backend investigation: publish the accepted refresh schema and invalid-token/expired-token status contract. Determine whether rotating tokens are single-use and whether replay detection/session invalidation is expected. No evidence currently proves that either payload is the wrong server contract.

Required clarification/change: choose the supported request shape; then align both frontend paths. Backend modification is not presumed necessary.

Acceptance: both paths use the confirmed shape; successful recovery retries with the new token; rejection handling distinguishes invalid credentials from transport/5xx failures; obsolete responses cannot replace another login; concurrent recovery is serialized/deduplicated according to supported rotation behavior.

## PERM-01 — inheritance and personal override lifecycle

**Severity:** high; **category:** Q; **feature:** role/direct permission administration. **Status:** blocked contract, not a confirmed server defect.

Affected endpoints: GET `/user/users/me`, GET `/user/users/{id}`, role permission GET/POST/PATCH, direct permission GET/POST/PATCH. No delete/reset override operation exists in the current frontend API definitions.

Sanitized management examples requiring clarification:

```json
{"user_id":"test-user-id","feature":"article","can_view":false}
```

```json
{"can_view":null}
```

These examples are questions about supported shapes, not newly implemented requests. Existing direct creation requires all four booleans. Existing PATCH sends explicitly changed booleans only. Existing client request authorization rejects unsupported null/reset payloads and direct creation to avoid replacing inheritance with a guessed full row.

Actual observed evidence: supplied Superuser `/me` contains `permissions`, `effective_permissions`, `role_permissions`, and direct rows with four booleans plus `is_override:true`. The owner instructed the frontend to use only `permissions` for checks. There is no normal-user response or management response proving partial/null/reset behavior.

Frontend behavior after fixes: server final `permissions` controls navigation/routes/actions. Raw direct/role arrays cannot change access locally. Effective display uses saved server decisions; role metadata is explanatory only. Existing direct rows can be edited with booleans. New override/reset functionality remains unavailable with its existing translated explanation. Role changes do not clear or rewrite direct overrides.

Reproduction in staging:

1. Create a disposable ordinary user and role through approved setup, with Article view enabled in the role.
2. Read role rows, direct rows, and final `/me.permissions` for that user.
3. Configure a direct denial, then an allowance, using the supported backend contract. Verify final `/me.permissions` changes accordingly.
4. Exercise null, omitted actions, missing feature rows, and `is_override:false` only where the backend documents them as valid.
5. Clear an override using the supported operation; verify final permissions revert to the role baseline.
6. Change the member's role and confirm untouched direct overrides survive, if that is the approved model.
7. Verify active Superuser bypass and inactive/deleted restrictions independently of role name.

Suggested backend investigation: distinguish storage rows from final decisions; define partial-action inheritance versus whole-feature replacement; define `is_override`; state whether multiple rows per feature can occur; document create/reset/delete schemas and recalculation after each mutation. Also document the shape returned from member-detail endpoints used by administrator displays.

Acceptance: final `permissions` is complete/current and follows approved deny/allow/inheritance semantics; missing/null final action values do not accidentally grant access; explicit false is preserved; clearing an override has a documented operation; the client can manage it without silently denying untouched actions or inventing extra permission state.

## COUNT-02 — global Events count and Settings/Backups definition

**Severity:** medium; **category:** Q; **feature:** Administration badges. **Status:** unfiltered semantics confirmed, two numeric counts still blocked.

Affected endpoints: GET `/events/events?year=<year>&month=<month>`, GET `/events/events/calendar-stats`, and whichever existing endpoint supports the agreed Settings/Backups population.

Actual authenticated responses/status: not available. Frontend source expects a monthly Event array and an annual `events_this_year` metric. Neither establishes an all-time total. The old Settings/Backups badge was literally `2`; it may have represented sections rather than records, but that was not established.

Current frontend behavior: both badges display an unavailable marker with translated explanation. Other six metadata sources load simultaneously. No monthly count is labelled global, and no new endpoint was invented.

Reproduction: in staging, create test events across different months and years. Compare the old current-month list length and annual statistic with the intended all-time Administration population. For Settings/Backups, first define whether the badge counts configuration sections, existing backups, enabled integrations, or another business entity.

Required clarification: identify an existing all-time Event total field/summary if available, including permitted statuses and deleted/archived policy. Define the Settings/Backups count and identify its existing data source. If no adequate count capability exists, discuss an API addition separately; it is not a confirmed required backend implementation yet.

Acceptance: all badges show their agreed totals simultaneously; changing month/table filters cannot change global totals; no full dataset download is needed for counting; legitimate zero, loading, stale, error, and unavailable states remain distinct; relevant mutations invalidate their agreed summary dependencies.

## COUNT-01 follow-up — verify six implemented total sources

**Severity:** medium; **category:** frontend fix with runtime verification outstanding. **Feature:** members/forums/articles/TechnicoPro/trainings/roles.

Affected GET requests are in the inventory above. Sanitized count query is `page=1&page_size=1` with no search/category/status filter; members additionally retain the existing `archived=false` population. Roles use the existing parameterless array endpoint.

Actual authenticated responses: unavailable. Existing frontend response shape is `{"total":<integer>,"results":[...]}` for paginated sources and an array for roles. This is not an observed server response. The new count helper accepts only nonnegative safe integer `total`; missing/malformed metadata shows unavailable rather than guessing. It never falls back to paginated `results.length`.

Evidence: original code skipped list queries on inactive tabs, defaulted missing badges to zero, and took trainings array length after a paginated transform. Tests now exercise real RTK subscriptions with mocked responses; changing tabs preserves bounded count subscriptions, identical cache arguments share requests, and relevant mutations invalidate totals.

Reproduction/verification: use more records than one page; compare each displayed badge with independently verified database/API totals; switch tabs and pages; apply search/status/category filters; create/delete records; activate/deactivate a member; edit role assignments; force count request failure and retry. Verify role arrays are complete and whether members should include archived records. No production mutations are needed to inspect read contracts.

Required clarification: provide sanitized list metadata; confirm supported minimum page size and population definitions. If a server uses another field, document it before changing the parser. No `count`/`total` fallback was guessed.

Acceptance: six values equal verified unfiltered totals, including >100 trainings, zero, failed-first-load, and cached-error cases; one-record metadata queries are supported; no thousands-of-record counting request; archived/status semantics are explicit.

## MEMBER-01 follow-up — verify actual role save lifecycle

**Severity:** medium; **category:** confirmed frontend initialization defect plus unverified integration symptom. **Feature:** Directory/Admin Edit Member.

Endpoints: GET `/user/users/{id}`, GET `/user/roles`, PATCH `/user/users/{id}`, GET `/user/users`.

Sanitized expected request:

```text
PATCH /user/users/test-user-id
Content-Type: multipart/form-data; boundary=<generated>
role_id: selected-role-id
```

The patch can include other changed profile fields; it should not rewrite direct permission arrays. Actual runtime PATCH response/status: unavailable. Expected: documented success with the persisted stable role ID; failed validation/authorization must return an error response with actionable detail.

Confirmed frontend evidence: Directory form substituted its creation default when `role_details.id` was absent; Admin sync ignored explicit `role_id`. These paths now prefer explicit `role_id`, fall back to nested role ID, and leave unknown existing roles blank. The supplied `/me` confirms that string `role_id` exists, but does not prove member-detail shape is identical.

Automated coverage: actual form initialization/submit handlers, selected ID through detail sync, another-member reset, no mutation of direct overrides, rejected save keeps the modal and emits no success. Existing controlled SelectField/unknown-option behavior remains. This does not prove the originally reported live dropdown symptom has been reproduced or that the server persisted a change.

Reproduce with disposable Users A/B and Roles R1/R2: open A, verify R1; select R2, verify immediate selection; save; inspect multipart ID, HTTP status, persisted response; refetch/reopen A; open B; cancel an unsaved change; delay role list/detail; repeat edits; delete/unavailable selected role; force rejected update. Verify fresh detail/list response still returns R2 after success.

Suggested backend investigation: compare authenticated request field parsing with role assignment logic; verify cache/database read-after-write behavior and serialization of `role_id`/nested role. Determine whether a successful response can omit or stale the assignment. There is no evidence yet that the backend ignores the request.

Acceptance: successful selected ID is persisted and returned consistently; rejected updates do not appear successful; missing/deleted roles return documented validation; A/B values remain separate; role changes preserve direct overrides under approved rules.

## SESSION-01 — permission propagation, JWTs, and resource authorization

**Severity:** high; **category:** Q; **feature:** security/session lifecycle. **Status:** frontend-supported behavior established, server/session enforcement unverified.

Endpoints: `/user/users/me`, role/member permission mutations, `/auth/refresh`, `/home/`, module lists/details, forum/topic/post reads, document folder/list/download descriptors, and file URLs returned by the API.

Actual authenticated responses/status: unavailable beyond supplied Superuser profile. No JWT claims were inspected. No live data leak has been observed. The need for backend push/session-version changes is therefore a question, not a confirmed backend defect or prescribed architecture.

Current frontend behavior:

- Administrator mutations invalidate narrowly related administrator-store caches; affected user browsers have independent stores.
- Page refresh/new tab hydrates `/me` before showing protected UI. Focus/reconnect refetch the persistent profile subscription.
- Writes use fresh `/me`/resource preflights; known newer revocations supersede older in-flight client results.
- An already-open foreground session has no server change notification. No polling or WebSocket was added.
- Search rows are client-filtered by module, and module routes/controls are guarded. These measures cannot prevent unauthorized API responses or CDN/file access.

Reproduce with two authorized staging sessions: admin changes role/direct permissions; observe affected user's foreground state, focus/reconnect, fresh-tab hydration, refresh, token refresh, and actual server read/write authorization. Test inactive/deleted user while old access/refresh tokens remain present. Record time and version of each sanitized profile result rather than relying on UI alone.

For resource security, use users allowed into a module but denied one category/folder/resource. Attempt its list, detail, search snippets, related previews, and download URL directly through authorized test tools. Verify search totals do not reveal restricted categories/resources. Test forum posting/locking and ownership/cascade rules separately from module grants. Review online presence fields for accounts without Members view if this shared endpoint is intentionally accessible.

Backend investigation questions: are permission decisions database-derived per operation or embedded in JWTs? Does `/me` recompute final `permissions` after each role/direct change? Are inactive/deleted sessions rejected consistently? What propagation timing is required? How are file/CDN access and nested-resource read ACLs enforced? Do global search snippets/counts use the same ACL scope?

Acceptance: unauthorized resources are omitted or denied by the server, not merely hidden by React; no protected title/snippet/body/file is returned to a denied account; every write authorizes atomically; `/me` reflects changes on the documented lifecycle; JWT refresh/revocation meets the agreed timing; inactive/deleted users cannot keep operating with old tokens. If a leak is observed, record sanitized HTTP evidence as a new confirmed backend security issue.

## SEC-01 incident-response handover

**Severity:** critical; **category:** S; **feature:** development/build/deployment trust. This is not an application-backend defect, but backend/deployment owners may hold affected credentials.

No HTTP request to the malicious remote script was made. Repository starting `init` line 33, Vite config lines 18–53, npm scripts, and encoded `.env` formed the execution paths. Relevant revisions: `625beef` introduction, `ec2e4c5` and `55acb39` subsequent loader changes despite cleanup titles. Legitimate cache/UI work from those commits was retained.

Evidence hashes and sizes are in `security-evidence.json`; malicious bytes remain in Git history and should never be run. Active payloads/hooks were removed and sanitized source builds successfully. No conclusion about earlier execution can be drawn from source cleanup or build success.

Investigation: determine which hosts/runners/servers ran dev/build/CI/Docker on affected revisions; inspect logs/outbound activity/persistence and potentially accessed credential stores. Revoke/rotate potentially exposed Git/SSH/API/database/environment/deployment/browser/OS credentials from trusted systems. Examine repository/CI/deployment access and rebuild artifacts from reviewed source after incident response.

Acceptance: repository remediations reviewed, relevant environments investigated, affected secrets revoked/rotated, unauthorized sessions/access removed, and deployment provenance re-established. This audit did not perform host scanning, credential rotation, or deployment cleanup.

## Required evidence to close the handover

Provide sanitized normal-user `/me`, member GET/PATCH, list/count, refresh and override-management contracts; define Event/Settings totals and propagation timing; supply authorized staging test accounts/environment; and record incident-response outcomes. Do not send tokens/passwords in chat or commit them to the repository.

No server change should be classified as mandatory merely because a frontend type assumes it. Confirm the intended contract first, then change the appropriate side and rerun the documented acceptance cases.
