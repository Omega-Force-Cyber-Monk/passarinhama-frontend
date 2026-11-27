# ARCHICOPRO — final stabilization and security audit

Audit date: 2026-11-27, Asia/Dhaka. Starting revision: `55acb39`.

The working tree was clean before this work. No commits, pushes, production writes, credential changes, history rewrites, or deployments were performed. Existing architecture and dependencies were retained. This report supersedes older repository descriptions of frontend permission merging for the decisions changed here.

## A. Executive summary

**Release assessment: REQUIRES FURTHER VERIFICATION.** Repository execution paths have been remediated, but prior execution/credential exposure, authenticated backend enforcement, and two badge definitions remain unresolved. This is not approval for production deployment.

| Measure | Result |
| --- | --- |
| Total findings | 15 |
| Confirmed frontend findings (F) | 6 |
| Confirmed backend defects (B) | 0; authenticated backend behavior was not tested |
| Integration findings (I) | 2 |
| Security findings (S) | 3 |
| Clarification/verification findings (Q) | 4 |
| Code remediations | 10 findings addressed in source |
| Findings closed at source | 9, with verification limits below |
| Open/partial findings | 6, including prior security exposure |

The central authorization change follows the user's explicit clarification: **“use only `permissions` to all the check.”** The frontend now treats `permissions` as final server action decisions. It does not merge `user_permissions`, `role_permissions`, or `effective_permissions` into access decisions. Active-account and actual Superuser-flag rules remain in place. Backend inheritance and override removal still require confirmation; they were not reimplemented in the client.

Home visibility and landing destinations now share the sidebar's order. A TechnicoPro-only user lands on TechnicoPro; a Documents-only user lands on Documents. Home appears only for users with at least one of its four feed permissions. Direct restricted routes retain the existing yellow Access Denied notice.

Administration now subscribes independently to six count sources: members, forums, articles, TechnicoPro, trainings, and roles. Paginated badges use a validated `total`, never the current page length. Events and Settings/Backups show an unavailable state until their global count source/definition is confirmed. No all-time Event total was fabricated from a monthly list.

Release blockers are incident-response sign-off for potentially executed loaders; authorized browser/API regression against normal-user and administrator accounts; an all-time Event total contract; the Settings/Backups badge definition; and resolution of the refresh and override-management questions in the handover.

## B. Findings table

Categories: F = confirmed frontend; B = confirmed backend; I = integration; Q = clarification/verification; S = security. Severity reflects impact, not proof of exploitation.

| ID | Issue / severity | Root cause and evidence | Affected files | Responsibility | Status / verification |
| --- | --- | --- | --- | --- | --- |
| SEC-01 | Build/dev remote execution — critical | Original Vite config lines 18–53 contained three remote-fetch IIFEs, one executing response text with `eval`. Original `init` line 33 hid 33,478 characters of obfuscated executable code after whitespace. Both npm start/build scripts invoked `init`. Tracked `.env` supplied the encoded remote URL. | `init`, `vite.config.ts`, `package.json`, `.env`, `.gitignore`; Docker/CI invoke build | S, repository/incident response | Active loaders and execution hooks removed; evidence hashes retained. Prior host/CI exposure remains open. Static inspection, history, regression test, sanitized build. |
| SEC-02 | Stored-HTML execution paths — high | Seven `dangerouslySetInnerHTML` sinks rendered API/editor content without the existing sanitizer. Malicious HTML could reach those sinks if accepted by backend/editor. An exploit against production was not attempted. | `Forums.tsx`, `Moderation.tsx`, `AdminPanel.tsx`, `Agenda/Agenda.tsx`, `utils/richContent.ts` | S, frontend; backend input/output controls unverified | Shared sanitizer now wraps all seven sinks. Static/AST invocation tests pass. Real-browser sanitizer harness supplied but not executed. |
| SEC-03 | CI ignores lint failure — medium | Workflow used `npm run lint || true`, making a failed quality gate nonblocking. | `.github/workflows/deploy.yml` | S, CI/frontend | Removed unconditional success; static regression. Workflow itself not executed. |
| AUTH-01 | Conflicting permission sources — high | Existing `getMergedPermissions` overlaid raw direct rows onto `permissions`. User confirmed `permissions` alone must drive checks. Raw rows could reverse server decisions. | `permissionUtils.ts`, `useDirectUserPermissions.ts`, related tests | I, frontend consuming backend decisions | Fixed centrally, without new permission hook/system. All seven feature/action combinations and contradictory arrays tested. |
| NAV-01 | Home visible/default without Home content — medium | Sidebar always inserted Home; Home displayed a module-link fallback, and a location-state flag could add a yellow notice during ordinary navigation. | `DashboardLayout.tsx`, `Home.tsx`, new `utils/navigation.ts` | F | Fixed; shared order and permission-aware Home redirect. Pure-policy and rendered-component harness tests. |
| HOME-01 | Feed errors masked as empty content — medium | Home did not read query error state; failed requests fell through to empty-section messages. | `Home.tsx` | F | Authorized sections now show actual translated/API errors and retry; denied sections remain omitted. Component harness tests. |
| COUNT-01 | Inactive-tab badges show zero/disappear; trainings truncated — medium | Queries were skipped outside selected tab; undefined data defaulted to zero. Trainings flattened a page of up to 100 records before taking its length. Members count depended on the selected/filtered table source. | `AdminPanel.tsx`, new `admin/adminCounts.ts`, EN/FR strings | F | Six sources corrected with persistent metadata subscriptions, unfiltered args, error/loading/stale states. Real RTK with mocked transport plus count tests. Backend metadata not authenticated/runtime-verified. |
| MEMBER-01 | Existing role replaced by default / explicit ID ignored — medium | Directory edit initialization used `role_details?.id || defaultRoleId`; missing nested details silently selected the creation default. Admin detail sync ignored raw `role_id`. Supplied `/me` example establishes a string `role_id` field, but member-detail response remains unverified. | `MemberDirectory.tsx`, `AdminPanel.tsx`, API/user types | F | Explicit stable ID preferred; nested ID retained as compatibility fallback; missing edit assignment remains blank. Form/submit tests pass. Exact reported live dropdown symptom still needs reproduction. |
| ADMIN-01 | Effective/inherited permission display inconsistent with server source — low | Editor predicted effective access by constructing direct rows and invoking frontend merge; inherited display treated final permissions as role baseline. | `admin/AdminPermissionsEditor.tsx`, API/user types | F | Effective display now uses current server `permissions`; drafts do not claim to have changed access before save. Inheritance display uses `role_permissions` only as explanatory metadata, or an unavailable marker. Harness tests. |
| QA-01 | Administration UI suite could not load — low | Duplicate `createRequire` import and duplicate `require` declaration caused a SyntaxError before tests ran. | `tests/admin-ui.test.mjs`, test scripts/package script | F | Duplicates removed; existing TypeScript loader shared with a full Node test command. Automated suite executes. |
| API-01 | Refresh request shapes disagree — medium | Exported refresh mutation sends JSON string; automatic 401 recovery sends `{refresh_token: ...}`. No accepted runtime contract supplied. | `auth/authApi.ts`, `api/apiSlice.ts` | I | Open. Both paths preserved pending contract; no guessed API change. |
| COUNT-02 | Two global badge counts undefined — medium | Event endpoint requires year/month and yields a monthly array; available calendar stats are annual. Settings/Backups used a hardcoded `2` without a stated record definition. | `eventsApi.ts`, `eventTypes.ts`, `AdminPanel.tsx` | Q | Open; honest unavailable markers. Need existing global metadata and Settings definition. |
| PERM-01 | New/reset personal overrides unsupported by documented client contract — high | Existing create requires four booleans, PATCH allows booleans only, no delete/reset endpoint is defined. Existing editor/final request boundary deliberately block unsafe creation/reset. Meaning of null/missing and `is_override` remains undocumented for management writes. | `membersTypes.ts`, `membersApi.ts`, `AdminPermissionsEditor.tsx`, `mutationAuthorization.ts` | Q | Open; safety restrictions preserved, not bypassed. |
| SESSION-01 | External permission changes/backend ACL enforcement unverified — high | Client invalidations are store-local. No server push/version/JWT claim contract is available. Search and module/resource endpoints require server filtering independently of client visibility. | `SessionInitializer.tsx`, `sessionSync.ts`, APIs/resource guards | Q | Existing focus/reconnect/hydration/preflight behavior tested with mocked HTTP. No confirmed backend leak; live enforcement and cross-session timing remain open. |
| VERIFY-01 | Authenticated/browser reproduction unavailable — high | `/me` returned 401 to unauthenticated request; public OpenAPI paths are empty. Supplied response is a Superuser sample only. Browser tools stopped for policy enforcement. No authorized test credentials or normal-user response provided. | Application/test environment | Q | Open. No claim of live role-save, live counts, full browser matrix, or backend inheritance testing. |

## C. Authorization architecture

### Before

Login posts URL-encoded credentials to `/auth/login`; the client receives access/refresh tokens. `setCredentials` clears the previous identity and enters initializing/loading state. `SessionInitializer` subscribes to `getUsersMe`; `/user/users/me` is normalized and published to Redux through the shared base-query profile path. Restored storage contains credentials, not an authorization-ready profile.

`getMergedPermissions` previously treated `permissions` as a baseline and overlaid non-null direct `user_permissions` actions. Explicit false was already respected; create/edit/delete did not imply view. The problem was the competing interpretation of server decisions, not an `||` merge bug. `useDirectUserPermissions` additionally exposed a raw-row boolean check, although no active consumers were found.

`usePermissions` exposes decisions only when auth is authenticated and permissions are ready. `ProtectedRoute` handles initialization, session errors, unauthenticated users, and inactive/deleted users. `PermissionRoute` checks feature view or explicit administrator predicates and renders the yellow notice for unauthorized direct access. Page-level controls and final RTK request authorization provide additional safeguards.

### After

The same lifecycle and exported utilities remain. `getMergedPermissions` now normalizes only recognized features/actions from `permissions`, with strict `=== true` grants and false defaults. Missing/null actions in this **final decision array** deny; they are not reinterpreted as role inheritance. No role-name grant was added. Actual active Superusers still receive all feature actions without assignments; inactive/deleted accounts remain restricted. `role_permissions`, `user_permissions`, and `effective_permissions` cannot grant or revoke access through client merging.

Raw role/direct records remain available for permission administration. `role_permissions` is used only to explain the role baseline in that editor. The editor's effective indicator shows currently saved server decisions, not a speculative draft merge. The unused legacy direct-permission hook delegates checks to `usePermissions`; its raw map is management metadata only.

`NAVIGATION_ITEMS` records the existing order: Home, Agenda, Articles, Forums, Trainings, TechnicoPro, Documents, Members, Administration. `getVisibleNavigation` uses existing permission utilities. Home availability requires Forum, Event, Training, or Article view. `getDefaultDestination` reads the same filtered configuration. Home redirects only after the session guard/hook resolves; no accessible module produces the existing restricted notice, not a redirect loop. Restored deep links still pass through their route guards.

Home section queries are skipped for denied modules, and their sections are omitted entirely. No denied-section placeholder is inserted. The old location-state banner was removed from ordinary Home rendering; the actual Access Denied component and direct route protections remain.

Global search uses module view checks to filter rows and visible counts. It skips searches and disables submission when there is no searchable module access. This prevents unnecessary requests; it does not establish that the server correctly filters results. Recently shown Home content and related Article lists remain behind the corresponding feature guard. Notifications in this repository are preference settings, not a notification-preview feed. Online presence is a shared authenticated endpoint whose field exposure requires backend review.

### Mutation, cache, and session lifecycle

| Change | Current client propagation | Important limit |
| --- | --- | --- |
| Member role/status update | PATCH, targeted User ID/LIST invalidation; subscribed matching profiles/list pages refetch | Another user's browser has a separate store |
| Role permission update | Role permission tag plus `RoleMembers:<role_id>` and unknown-role tags invalidate subscribed matching profiles | Requires current `/me` to include final decisions |
| Direct permission edit | User-permission tag, target User ID, search/activity projections invalidate | Unsupported create/reset remains blocked |
| Role create/delete | Role list invalidated; deletion also invalidates matching role members | Server reassignment/deletion policy unverified |
| Current-session profile read | Normalization publishes ordered `sessionResolved`, updates canonical profile cache | Background transport failure retains previous resolved identity; UI does not invent new decisions |
| Refresh / logout / login | Refresh preserves session identity; login/logout/replacement reset identity-bound RTK caches | Refresh payload consistency needs backend contract |
| Full page refresh | Tokens restored; profile/grants withheld until fresh `/me` | No persisted profile is trusted |
| New tab | Hydrates its own `/me` | Already-open foreground tab is not notified of remote admin changes |
| Tab focus/reconnect | Subscribed `/me` refetches once via RTK listeners | No continuous polling or arbitrary timer was introduced |

Writes already perform fresh-profile preflights and applicable target/ownership checks. Older profile completions cannot supersede newer authorization evidence; session-version guards reject obsolete responses. These are frontend UX safeguards. Server authorization must be atomic at the actual operation.

An administrator updating another user refreshes the administrator's relevant caches. The affected user's session receives changes on hydration, focus, reconnect, or an existing write preflight. Immediate updates to a continuously open foreground session are not promised. JWT permission claims, token revocation, and server-side session versions were not inspected or inferred from token values.

### Resource restrictions preserved

Forum posting requires the existing `can_post` capability and unlocked-topic policy. Training/Article/TechnicoPro permission endpoints and server `can_write`/ownership data remain in place. Document creation/upload uses folder `can_upload`; folder deletion remains active-Superuser-only because cascade ownership metadata is absent. Ordinary content edits/deletes still require canonical ownership plus their action grant. No module grant was substituted for resource ACLs. Read visibility of individual restricted resources must be enforced by the backend.

The final source usage inventory is captured in `authorization-usage-inventory.txt`; it is a location aid, not runtime evidence. Original behavior was inspected separately in the starting source and history. Old documentation and role-display labels are not treated as access policy.

## D. Security audit

### Scope inspected before project execution

Inspected package manifest/lock, Vite config, TypeScript config, index HTML, Dockerfile, npm scripts, existing test loader/scripts, `.vscode/settings.json`, the deployment workflow, local Git configuration, hooks inventory, hidden files, tracked/untracked file inventory, public assets, suspicious line lengths, external requests, HTML execution sinks, and recent/relevant Git history. No additional AGENTS.md instructions were found in the workspace or checked ancestors.

No ESLint, separate Tailwind/PostCSS config, VS Code tasks/extensions file, Husky config, GitLab CI, Compose file, tracked shell/PowerShell script, repository font file, or unexpected binary executable was present in the inspected inventory. Tailwind is configured through the legitimate Vite plugin. Git hooks contained standard `.sample` files; no enabled custom hook or `core.hooksPath` override appeared in local config. Global/system hooks and host persistence were outside the repository audit.

`public/logo.png` is 5,172 bytes, has PNG magic and IHDR/pHYs/sRGB/gAMA/tEXt/IDAT/IEND chunks, and no bytes after IEND. It was inspected as bytes, not executed. `public/_redirects` is static routing data. No local fonts were present; Google Fonts import is an established stylesheet request, not proof of malicious behavior. The ignored `security-scanner-v3.py` was inspected as text, contains scanner patterns, and was not executed or modified.

All lockfile resolved URLs inspected were under the npm registry. Install-script flags appeared for expected `fsevents`, `protobufjs`, and nested esbuild packages. Dependencies were installed with `npm ci --ignore-scripts --no-audit --no-fund` using a temporary cache; no lifecycle hooks were run. No dependency or lockfile change was made. This is not an exhaustive upstream-package vulnerability or malware certification.

### Confirmed malicious/unauthorized execution

The remote `eval` chain was active in `vite.config.ts`, including redundant network loaders. The destination was Base64-encoded in a misleading `AUTH_API_KEY` variable. It was a remote script location, not an authentication integration. No request to that destination was made.

The appended `init` code has hex/XOR strings, arithmetic obfuscation, character transposition, global/require wiring, and dynamically constructed function execution. Only independent arithmetic/string transforms on inert data were used to inspect it; the original code/decoder/function bodies were never executed. Its subsequent stages were not fully reverse-engineered. It has no legitimate frontend initialization requirement. The small original directory/state scaffold was retained, but it is disconnected from npm startup/build.

### Relevant history

| Commit | Date in available history | Evidence |
| --- | --- | --- |
| `aa84705`, `ac76007`, `68db493` | Aug–Sep 2026 | Inspected versions of Vite/package files lack this particular AUTH_API_KEY chain/init script hook. This does not certify those entire revisions clean. |
| `625beef` | 2026-11-16 | Earliest observed introduction of `init`, npm dev/build `node init` hooks, tracked encoded `.env`, and remote-eval Vite code. Also contains extensive legitimate cache/UI changes; not reverted wholesale. |
| `ec2e4c5` | 2026-11-17 | Commit titled security cleanup changes the obfuscated init and adds a further Vite remote-fetch block; original eval remains. |
| `55acb39` | 2026-11-23 | Another cleanup title; init grows to 34,212 bytes and Vite still contains all three loaders. This was the starting working tree. |

Titles/author metadata are not proof of intent or attribution. Other repositories, server images, remote branches not available locally, and deployment logs were not audited. No whole commit was reverted and history was not rewritten.

### Evidence preservation and remediation

`security-evidence.json` records original paths, sizes, HEAD and SHA-256 hashes. Original source remains in local Git history as inert evidence; do not execute historical init/config files. No separate executable quarantine copy was created.

Removed the appended `init` payload, all Vite remote loaders/eval and their unused environment-loading code, the encoded `.env` entry, and both npm `node init` execution hooks. Legitimate React/Tailwind plugins, aliases, and application changes were preserved. `.gitignore` once again ignores environment files and no longer conceals itself or `config.bat`. A file already tracked by Git is not untracked by this ignore rule; the tracked `.env` is now empty and history still contains its old value. No index or history mutation was performed.

Seven raw HTML sinks now call the existing `sanitizeRichContent`. Safe editor formatting/tables remain supported. A controlled class is restored for known YouTube wrappers so sanitized embeds keep their layout. No additional sanitization dependency was introduced. CI now fails when its existing lint/typecheck command fails.

### Remaining risk and incident response

The current source changes remove identified execution paths; they do **not** establish that development machines, CI runners, deployment hosts, previously built images, or credentials are clean. Prior execution is possible through dev/build/Docker/CI. The Vite loader's actual success depends on environment/runtime conditions; historical execution was not established. Remote stages were deliberately not retrieved.

Incident response should identify hosts/jobs that ran affected revisions and review outbound traffic, runner/build/deployment logs, persistence, SSH/Git configuration and credential access. Rotate/revoke potentially exposed GitHub/GitLab tokens, SSH keys, API keys, environment/database/deployment credentials, and browser/OS secrets accessible to those processes, from a trusted environment. Review action permissions, repository access and suspect sessions. Rebuild deployment artifacts from reviewed source on a trusted runner after incident response. Do not assume the deployment is clean merely because this working tree builds.

No secret/token value or user contact details from the supplied profile are reproduced in this report. No project source or credentials were uploaded to a third-party scanning service.

## E. Frontend fixes

| Fix | Implementation and new behavior | Regression risk / evidence |
| --- | --- | --- |
| Authoritative access decisions | `permissionUtils.ts` uses `permissions` only, strictly true; legacy hook delegates | Relies on user's confirmed backend contract; role/direct inheritance must be computed server-side. All module/action policy tests pass. |
| Home/navigation/landing | Shared configuration in `navigation.ts`; Home feed predicate; resolved no-feed redirect; no ordinary location-state warning | Deep links keep direct route guards. No-module account gets notice without loop. TechnicoPro/Documents/Members-only and multi-module cases tested. |
| Home errors/search | Home error/retry presentation; no search request/submission without searchable access; rows remain filtered | Backend resource filtering still essential. Feed failure tests retain actual error evidence. |
| Member roles | Raw string `role_id` typed and preferred; nested role ID fallback; no creation default substituted for an existing unassigned member | Does not prove backend accepted role PATCH. Unsaved choices survive sync; another target resets; failed save retains modal; payload retains stable selected ID and omits direct overrides. |
| Administration counts | Independent six-source subscriptions; page 1/size 1 metadata queries; no table filters; validated nonnegative safe integer totals | Roles use existing whole-array endpoint. Missing global event/settings count remains unavailable. Six count sources add bounded reads; cached identical args share RTK requests. |
| Count states | Loaded zero is `0`; initial loading `…`; missing/failed total `—` with bilingual explanation; cached total retained and labelled stale on error; failed sources can retry | No fake zero or page-length fallback. API metadata still needs real-account verification. |
| Permission editor display | Current server decisions shown as effective; raw role metadata only explains inheritance | Unsaved direct drafts intentionally do not claim effective access. Write/create/reset contracts unchanged. |
| Tests/security | Full Node test script reuses the existing TS loader; broken duplicate declarations fixed; execution/HTML regressions added | Uses existing dependencies/framework; no new package or lockfile changes. DOM harness is supplied but unexecuted. |

Security changes are detailed in section D. Tests use local synthetic fixtures and mocked transport for verification only; no mock data was introduced into production application behavior.

## F. Backend developer handover

See [backend-investigation-required.md](backend-investigation-required.md) for endpoint-level requests, observed versus unavailable responses, reproduction steps, hypotheses, acceptance criteria, and required clarifications. None of the unverified server behaviors is labelled a confirmed backend defect.

## G. Questions requiring clarification

1. **Global Event total:** Which existing endpoint/metadata yields an all-time, unfiltered total? Monthly events and annual statistics do not answer that question. A new endpoint was not introduced. This blocks a numeric Events badge.
2. **Settings/Backups:** Should this badge count backups, configuration sections, or something else? The prior constant `2` lacked a definition. This blocks its numeric badge.
3. **Count payloads:** Supply sanitized responses for the six list sources and confirm `page_size=1`, `total`, whole-array roles, and whether `archived=false` is the intended Members population. Runtime metadata/error handling is implemented, but actual server totals are not authenticated-verified.
4. **Override management:** What do missing/null actions and `is_override:false` mean in create/PATCH/reset operations? Which endpoint clears an override without replacing inheritance with explicit false? Authorization decisions already follow the user's `permissions`-only instruction; this question blocks new/reset override management only.
5. **Refresh:** Is the accepted JSON body a string or `{refresh_token: ...}`? The two frontend paths disagree. This blocks selecting one request shape safely.
6. **External-session timing:** Must an already-open foreground session receive changes immediately, or is fresh `/me` on focus/reconnect/write acceptable? Are permissions stored in JWT claims, and what refresh/revocation mechanism is supported? No polling or socket was added.
7. **Member runtime reproduction:** Provide sanitized GET member and PATCH role payload/response, including slow/error/reopen cases, or authorized test-environment access. Static/form tests cannot establish whether a server rejects or ignores a role change.
8. **Incident response:** Which workstations/runners/servers executed the affected revisions, and have exposed credentials/hosts been investigated? Source cleanup alone cannot close SEC-01.

Resolved during this task: `permissions` is the only frontend permission-check source; Administration badges should represent unfiltered totals; active Superuser access matches the supplied example.

## H. Verification results

| Method | Actual result / limit |
| --- | --- |
| Security inspection | Completed static repository/history inspection before npm install/build/test/dev. Identified loaders removed without execution. No host/deployment cleanliness claim. |
| TypeScript | `npx.cmd --no-install tsc --noEmit` and direct local compiler; passed. Windows `.cmd` equivalent avoids PowerShell's blocked npm/npx ps1 launcher. |
| `npm run lint` | Passed; repository script runs TypeScript, **not ESLint**. No ESLint dependency/config/script exists, so independent ESLint was not performed. |
| Automated suite | `npm.cmd test`: **218 passed, 0 failed, 0 skipped**, about 44 seconds. Full Node built-in suite, including component/AST and real Redux/RTK with mocked HTTP. Baseline mjs run had 127 passes and one unloadable test file; duplicate declarations repaired. |
| Final targeted checks | After the final type placement/search-effect dependency adjustment, final stabilization, Home/search, and cache UI suites: **30 passed, 0 failed**. TypeScript and production build were rerun successfully. |
| Integration | Existing/new RTK request/invalidation/session tests exercise real middleware/reducers with mocked transport. Not live backend integration. |
| Production build | Sanitized `npm.cmd run build` passed. Sandbox initially denied esbuild ancestor-directory resolution; normal filesystem execution succeeded. Existing >500 kB chunk warning remains; no unrelated bundle redesign. |
| Browser | Not completed. Browser access host unavailable; native Chrome fallback stopped because service could not determine URL confidently enough to enforce policy. No bypass attempted. `tests/browser/rich-content.html` contains 12 real-DOM checks ready for a trusted browser. Existing Playwright e2e suite was inspected but not run. |
| Runtime API | Actual unauthenticated GET `/user/users/me`: HTTP 401. GET `/openapi.json`: HTTP 200, 75-byte JSON with empty `paths`, preserved in `api-openapi-observed.json`. No production writes. |
| Supplied evidence | User supplied Superuser `/me` JSON with `role_id`, role object, active/nondeleted flags, `permissions`, `effective_permissions`, `role_permissions`, and direct overrides. This is supplied response evidence, not this agent's authenticated HTTP test. Personal fields not copied to artifacts. |
| Dependency/repository review | Lockfile/dependency versions unchanged; no commit/push; diff/status reviewed. New tests and scripts contain no added `any`, `@ts-ignore` or lint suppressions. Pre-existing broad types were not rewritten globally. |
| Diff whitespace check | `git -c core.whitespace=cr-at-eol diff --check` passed, recognizing the repository's Windows line endings. |

### Authorization regression matrix

| Scenario | Evidence completed | Remaining live verification |
| --- | --- | --- |
| A active Superuser | All features/actions; no assignments; matches supplied sample | Authenticated browser |
| B role-only user | Final `permissions` interpreted without name-based grants | Server computes role baseline correctly |
| C/D direct deny/allow | Contradictory raw rows cannot override final server true/false | Backend inheritance/overrides produce correct final `permissions` |
| E view denied, other actions allowed | Navigation/Home hide feature; feature routes retain view protection | Real account deep links/search |
| F/G/H independent actions | Existing per-feature action and resource tests | Actual controls/API with test accounts |
| I TechnicoPro only | Home redirect, sidebar config, skipped feeds tested | Live login and normal navigation |
| J no modules | Null fallback/restricted state; no redirect target | Live browser |
| K role update | Selected string ID, retained drafts, target switch, rejected save, profile invalidation | Server acceptance/list/reopen under slow network |
| L role permissions | Targeted role-member cache invalidation | Another logged-in foreground session |
| M direct edit | Correct existing PATCH contract; final profile source honored | Live server recalculation |
| N override removed | Missing final actions deny; client does not invent reset operation | Reset/delete contract remains blocked |
| O restricted direct URL | Existing guards preserved; rendered detail denial tests | Browser address-bar test |
| P refresh | Fresh `/me` gate, no trusted persisted grants, delayed/error tests | Actual refresh in browser |
| Q logout/login | Session replacement, old-response/cache reset tests | Two real accounts |
| R resource ACL | Existing ownership/folder/forum/locking tests retained | Server read/download/list filtering |
| S search | Module filtering/counts and query gate tested | Unauthorized resource omission by server |
| T inactive/deleted | Active eligibility, inactive Superuser tests retained | Server token/session revocation |

Administration checks cover six simultaneous count subscriptions, tab cache reuse, paginated totals, loading/error/stale/zero states, targeted mutation refresh, selected role ID, failed role update, different-member reset, existing modal payloads, and English/French labels. Browser-only interaction cases are not represented as unit-tested browser behavior.

## I. Final release assessment

**REQUIRES FURTHER VERIFICATION.** The current frontend is materially improved and source remediation is reviewable, but the requested end-to-end stabilization is not fully demonstrated. Do not declare all reported symptoms resolved from compilation/tests alone.

Before joint client testing, complete incident-response review, verify normal-user server permission results, resolve the count/refresh/override-management contracts, and execute the authenticated browser matrix. No confirmed backend defect is asserted without runtime evidence. See the handover for concrete acceptance criteria.
