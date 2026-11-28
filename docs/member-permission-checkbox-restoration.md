# Member permission checkbox restoration

Date: 2026-11-28

## Previous and restored behavior

The member editor previously displayed Inherit / Allow / Deny selectors, raw override values, inherited/effective descriptions, and restrictions requiring all four actions to be selected manually before creating an override. The role editor already used checkboxes.

The earlier checkbox presentation in revision `ff38c6e` was inspected with `git show` as text only. No historical files, scripts, configuration, or commits were restored or executed. The current editor reuses its native checkbox, labelled feature fieldset, responsive grid, and per-feature Save layout.

All seven existing features (Articles, Forums, Training, TechnicoPro, Agenda/Events, Documents, Members) now have View / Create / Edit / Delete checkboxes. Checked means granted; unchecked means denied. Clicking a checkbox changes only the local form. Each feature retains its own Save Permissions button. French uses Voir / Créer / Modifier / Supprimer / Enregistrer les permissions. Role permission management retains its existing labels and endpoints.

## Files changed

- `src/pages/admin/AdminPermissionsEditor.tsx`: boolean form snapshots, final-permission initialization, checkboxes, save/change detection, and profile-refresh reconciliation.
- `src/i18n/locales/en.json`: simple save/unavailable labels; removal of unused three-state member UI keys.
- `src/i18n/locales/fr.json`: matching French changes.
- `tests/admin-permissions.test.mjs`: replaces obsolete dropdown expectations with checkbox interaction/save/refresh regressions, retaining role, endpoint, cache-tag, authorization, and target-isolation coverage.
- `tests/home-search-permissions.test.mjs`: updates translation assertions for the current member UI keys.
- `docs/member-permission-checkbox-restoration.md`: this report.

Reviewed integration points include `AdminPanel.tsx`, `membersApi.ts`, `membersTypes.ts`, `mutationAuthorization.ts`, `permissionUtils.ts`, and the related authorization, count, agenda, and member-role tests. Those production integration files are unchanged. No dependencies, endpoints, build configuration, or authorization architecture changed.

## Initialization and form state

Member values come exclusively from the selected member's final server `permissions` returned by the existing member-detail query. Role-derived and individual grants work identically because the backend has already calculated those final values. The editor does not merge `role_permissions`, `user_permissions`, or `effective_permissions`, and does not apply a client-side Superuser override to the selected member's checkbox values.

The final response must provide explicit boolean actions for each displayed feature. Initial requests show loading; unavailable/incomplete final values show a translated error and Retry instead of guessed unchecked values. The direct-record query supplies only feature existence and stable record IDs for POST/PATCH selection; its action values do not initialize member checkboxes. An existing record without an ID blocks that feature's save without locking its usable checkboxes or creating a duplicate record.

Each edited feature keeps separate `original` and `values` boolean snapshots. Change detection compares every checkbox with its original value. Reverting all changes disables Save, and both the handler and button prevent unchanged writes. Opening/closing without edits creates no records. Drafts are local form state and never an authorization source.

## Save payloads

For a feature with no individual record, the existing POST sends all four current checkbox values. For example, starting with View and Edit checked and then checking Create:

```http
POST /user/user-permissions
Content-Type: application/json
```

```json
{
  "user_id": "selected-member-id",
  "feature": "article",
  "can_view": true,
  "can_create": true,
  "can_edit": true,
  "can_delete": false
}
```

Untouched actions retain their initialized/current final values. One checkbox edit is sufficient to save; four manual choices are no longer required. As explicitly requested, creation stores a full individual feature override. Those four values no longer retain per-action inheritance for that feature.

For an existing individual record, unchecking Edit sends only the changed boolean action to its stable ID:

```http
PATCH /user/user-permissions/existing-record-id
Content-Type: application/json
```

```json
{
  "can_edit": false
}
```

The existing client retains `user_id` for cache targeting and removes it and `id` from the PATCH body. Explicit `false` is included. Untouched existing actions are not rewritten. Role POST/PATCH behavior remains separate. No global save or bulk endpoint was added; each changed feature succeeds or fails independently, and failed features keep their drafts and show an error without a success toast.

## Cache, refresh, and modal behavior

Both member queries continue to refetch on mount/target change and use `currentData`. The parent keys the editor by member ID, so reopening starts a fresh form and switching members does not reuse another member's draft. The existing mutation busy callback, disabled fieldsets during saves, synchronous duplicate-submit guard, and modal-close protection during a save remain intact.

Background requests keep usable member checkboxes editable, while Save waits for both queries to settle. A fresh final profile updates untouched actions and the comparison baseline while retaining actions the administrator changed. After a successful mutation, the submitted checkbox values remain visible until a newer final-profile fulfillment arrives. That refreshed final response becomes authoritative, including when it differs from the submitted values. Edits made during the refresh remain unsaved drafts.

Existing RTK Query lifecycle updates still publish only validated server-returned direct rows, never fabricated records. Existing targeted invalidation refreshes the selected member's direct rows, final profile, and dependent projections. Local saved snapshots do not change the authenticated user's access; authorization continues to depend on backend final permissions. There is no polling, arbitrary delay, page reload, or parallel authorization store.

## Safeguards and obsolete logic

Authorization utilities, route/resource guards, active Superuser handling, inactive/deleted restrictions, Access Denied behavior, Home/sidebar rules, and mutation preflights are unchanged. Full boolean POST validation and rejection of unsupported partial/null creation and null reset payloads remain in place. Administration unfiltered totals, Agenda counts, and Edit Member Role controls are unchanged and covered by the full regression suite.

Removed member UI logic includes nullable Inherit drafts, dropdown options, inherited/effective display lines, manual-four-choice creation checks, reset-to-Inherit restrictions/messages, and three-state dirty checks. Only the obsolete member translation keys with no remaining application consumers were removed. Record-ID, loading, error, and authorization protections remain.

## Verification

- `npx.cmd --no-install tsc --noEmit`: passed.
- `npm.cmd run lint` (the existing TypeScript lint script): passed.
- Targeted editor, agenda/count/cache/member-role, and Home/translation tests: **41 passed, 0 failed**.
- `npm.cmd test`: **231 passed, 0 failed**, including existing authorization and security regressions.
- `npm.cmd run build`: passed; Vite reported the existing large-chunk advisory. The build used the approved sandbox escalation needed for installed Vite/esbuild binary resolution.
- `git diff --check`: passed.

Tests invoke the current component handlers and reconciliation effects with controlled query/mutation state, render its checkbox markup, and exercise actual endpoint serializers and RTK Query behavior in the related cache tests. They cover role-derived initialization without direct rows, contradictory raw arrays, POST preserving untouched values, PATCH false, no-op/reverted edits, multiple feature outcomes, save failures, duplicate submission, background refresh, authoritative final reconciliation, reopen/member isolation, malformed record IDs, and English/French labels.

## Browser and backend limits

No authenticated browser or live persistence verification was performed for this change. The browser host was unavailable in the earlier verification attempt in this conversation, and no authorized test session/credentials were supplied. Automated component/serializer/cache verification is not evidence of live backend persistence or visual browser QA.

No backend change is required for the existing full-boolean creation and changed-boolean update contracts used here. Returning complete final `permissions` from member detail remains a backend requirement; an unavailable/incomplete response intentionally prevents editing. Override deletion/reset-to-inheritance is outside this checkbox workflow and its contract remains unconfirmed; unsupported null resets are still rejected. Live verification of POST/PATCH persistence, refreshed final values, and reopening with an authorized test member remains outstanding. No commit, push, or deployment was performed.
