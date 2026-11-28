# Member Permissions: disabled Save button fix

Date: 2026-11-28

## Root cause reproduced in the browser

The authenticated deployed Administration modal was inspected through native Chrome. Checking Article Create visibly checked the box, but **Save Permissions stayed disabled** and the missing-record-ID explanation remained visible. No permission mutation was submitted in production; the local edit was discarded by closing the modal.

The actual GET `/user/user-permissions?user_id=<member-id>` response was inspected in DevTools. It includes inherited-feature placeholders such as:

```json
{
  "id": null,
  "user_id": "selected-member-id",
  "feature": "article",
  "can_view": null,
  "can_create": null,
  "can_edit": null,
  "can_delete": null
}
```

The editor found this row by feature and evaluated `Boolean(record && !record.id)` as true. It consequently treated an inherited placeholder as an existing override with a missing ID and blocked both the rendered button and the save handler. The POST branch was unreachable for these members despite valid final `permissions` and a dirty checkbox draft. This was the blocker observed in the deployed modal.

A second, independently reproduced condition was `refreshing`: either member-list or profile `isFetching` disabled Save and made the handler silently return, even with usable initial data. The earlier regression test explicitly expected this restriction. It now verifies saving with those requests still pending.

## Disabled conditions before and after

| Element/condition | Before | After |
| --- | --- | --- |
| Member Save button | `!dirty || saving || refreshing || profileUnavailable || missingRecordId` | `!dirty || saving || profileUnavailable || missingRecordId` |
| Member parent fieldset | `saving || profileUnavailable` | Unchanged |
| Missing record ID | Any feature row with a falsy ID blocked saving | A null/absent-ID row with all four actions null is an inherited placeholder and takes POST. A non-placeholder saved row still needs a nonempty string ID. |
| No changes | Disabled | Still disabled; visible No unsaved changes explanation |
| Active save | Disabled controls, synchronous pending guard, modal close blocked | Unchanged, with visible Saving permissions status |
| Background `isFetching` with loaded member data | Checkboxes editable, Save disabled and handler returned | Checkboxes and dirty Save enabled; use loaded target data, without waiting for background reads |
| Initial data / final permissions unavailable | Loading/error, editor withheld | Unchanged |
| Unauthorized / missing target | Editor withheld; final mutation preflight enforced | Unchanged |
| Role editor fetching | Parent fieldsets and Save disabled | Unchanged; this fix targets the member modal |

The modal wrapper, its body, CSS, and parent Administration markup were inspected. There is no enclosing member-form disabled fieldset, pointer-event restriction, or `aria-disabled` applied to this modal's Save controls. `closeDisabled` applies to closing the dialog. The editor's own fieldset and button are the relevant disabled ancestors/elements.

Dirty calculation correctly compares boolean drafts with separate original values. Reverting a checkbox clears dirtiness. Profile reconciliation continues to preserve edited actions, update untouched values, and keep acknowledged saves visible until refreshed final permissions arrive. Neither was the cause of the observed missing-ID lock.

## Focused changes and API behavior

The editor now excludes only the confirmed inherited placeholder shape when selecting a saved record. Changing one checkbox immediately enables its feature's Save button. No existing direct record means the existing full-boolean POST; a stable saved record means the existing changed-boolean PATCH. Non-placeholder rows with missing, empty, or whitespace-only IDs remain blocked with the existing visible explanation, and the handler reports that explanation if invoked directly. No ID is guessed.

Successful POST cache synchronization now replaces the matching inherited placeholder with the validated server-created row. Previously it only appended when no feature row existed, so the placeholder could also prevent publication of the new record ID. Replacing it allows a subsequent edit to use PATCH while automatic refetch is pending. Existing response identity/session checks and targeted invalidation are preserved.

Final member checkbox values and all authorization checks still use only server `permissions`. Placeholder/direct action values are not merged into final permissions. Authorization/mutation policies, backend endpoints, request contracts, role editing, counts, and unrelated functionality are unchanged. Historical revision `ff38c6e` was inspected with `git show` as text only; no historical files or scripts were restored or run.

Files modified:

- `src/pages/admin/AdminPermissionsEditor.tsx`
- `src/redux/features/members/membersApi.ts`
- `src/i18n/locales/en.json`
- `src/i18n/locales/fr.json`
- `tests/admin-permissions.test.mjs`
- `tests/admin-agenda-member-permissions.test.mjs`
- `tests/fixtures/member-permission-save.html`
- `tests/fixtures/member-permission-save.jsx`
- `docs/member-permission-save-button-fix.md`

## Actual browser interaction results

The browser access host was unavailable, but native Chrome control worked. The regression fixture mounted the **production React editor and Modal, real Redux store, RTK Query endpoints/middleware, translations, and toast provider**. Only API transport/data were replaced by an explicitly local test fixture; requests could not reach the live API. Its controls deliberately held both background reads open, and an Inspect button read the actual mounted DOM using `button.matches(':disabled')`, `fieldset.disabled`, and checkbox `checked` values.

| Interaction | Observed result |
| --- | --- |
| Open fixture member without individual overrides | View/Edit checked from final permissions; null-ID/null-action placeholders did not show a missing-ID error |
| Hold background reads, then check Create | Native button enabled immediately; DOM inspection: `disabled:false`, `parentDisabled:false`, values `[true,true,true,false]` |
| Click that native Save button before releasing reads | Captured **POST** `/user/user-permissions`, body below; success toast |
| Release reads, close, reopen | Values `[true,true,true,false]` persisted in the fixture API; no unsaved changes; Save correctly disabled |
| Open fixture member with existing overrides; hold reads; uncheck View | Native Save enabled; DOM inspection: `disabled:false`, `parentDisabled:false`, values `[false,false,true,false]` |
| Click that native Save button before releasing reads | Captured **PATCH** `/user/user-permissions/fixture-existing-article`, body `{"can_view":false}`; success toast |
| Release reads, close, reopen existing-override member | Values `[false,false,true,false]` persisted in the fixture API; no unsaved changes; Save correctly disabled |

Captured POST body:

```json
{
  "user_id": "fixture-new",
  "feature": "article",
  "can_view": true,
  "can_create": true,
  "can_edit": true,
  "can_delete": false
}
```

The untouched View/Edit grants and Delete denial were retained. The PATCH sent explicit false and no untouched actions. Browser testing used ordinary native checkbox/button clicks, not direct invocation of the save handler. The local test tab and temporary Vite server were closed after verification.

To repeat the fixture, start Vite with `VITE_API_BASE_URL=http://127.0.0.1:5178/fixture-api` on localhost port 5178, and open `/tests/fixtures/member-permission-save.html`. The fixture is test-only and is not imported by the production entry point or bundle.

## Automated verification and limits

- TypeScript `npx.cmd --no-install tsc --noEmit`: passed, exit 0.
- Existing `npm.cmd run lint`: passed, exit 0.
- Focused editor/cache/count suite: **34 passed, 0 failed**. Includes rendered button and ancestor assertions for POST/PATCH, checked/unchecked edits, either/both background reads left pending, inherited placeholders, malformed saved IDs, rejected saves, duplicate submission, reconciliation, reopen, and target isolation.
- `npm.cmd test`: **233 passed, 0 failed, 0 skipped**. Existing authorization regressions still deny ordinary users and inactive/deleted Superusers, reject unsupported null writes, and permit valid active-Superuser POST/PATCH.
- `npm.cmd run build`: passed, exit 0; existing large-chunk advisory. Local Vite/build used approved sandbox escalation for installed esbuild resolution.
- `git diff --check`: passed.

The disabled interaction was reproduced on the deployed site, and corrected native button interaction and save/reopen behavior were verified against the local test API. **The corrected code has not been deployed; live POST/PATCH persistence after this fix remains unverified.** No production permissions, backend contracts, commits, pushes, or deployments were changed. This report supersedes the background-fetch and inherited-placeholder restrictions described in the earlier checkbox restoration report.
