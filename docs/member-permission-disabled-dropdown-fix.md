# Member permission disabled-dropdown investigation and fix

Date: 2026-11-28, Asia/Dhaka.

This is a targeted follow-up to the Administration audit. The user clarified that the original symptom was **completely disabled Allow/Deny/Inherit controls**, not post-save reversion. The earlier cache synchronization fixes address a separate issue and are preserved. This report supersedes earlier statements that all first-override creation must remain blocked.

The working tree already contained the preceding Agenda/count/cache changes at the start of this task. They were retained. No commit, push, deployment, dependency change, production write, or historical startup-script execution was performed.

## 1. Exact disabled-state cause

The Member Permissions editor uses native `<select>` elements inside feature `<fieldset>` elements. The selects did not have their own `disabled` prop. They inherited the parent's disabled state:

```tsx
disabled={saving || query.isFetching || profileUnavailable || missingOverride}
```

`missingOverride` was `kind === "member" && !original?.id`. For a valid empty direct-permission array, there is no `original` row for any feature, so this expression is true for every feature. All seven parent fieldsets—and therefore all 28 action dropdowns—were disabled even for an authorized Superuser.

`profileUnavailable` also included `profileQuery.isFetching`. Consequently, both the direct-permission query and the profile query could disable valid controls during background refetches, not just initial loading.

These are confirmed code-level causes. No affected member's authenticated GET response was supplied, so the exact flag active in a particular deployed session was not observed. An empty override array or missing row IDs is sufficient to reproduce the reported total lockout in the original source.

## 2. Disabled-condition audit

Line references in the “before” column refer to the editor snapshot at the start of this targeted task; they are not the line numbers after the edits.

| Condition / source before fix | Reason | Legitimate restriction? | Incorrectly blocks normal interaction? | Disposition |
| --- | --- | --- | --- | --- |
| `!canManage || !targetId`, `AdminPermissionsEditor.tsx:72` | Unauthorized caller or no selected member | Yes | No | Preserved; no controls rendered |
| `!permissions` or mismatched profile ID, editor `:77` | Initial loading or unavailable current target | Yes | No | Preserved loading state; no guessed records or other-member content |
| Permission/profile `isError`, editor `:73–75` | Failed reads cannot establish a writable target | Yes | No | Preserved error/retry presentation; no permission fields rendered |
| Fieldset `saving`, editor `:88` | Prevent conflicting edits while mutation runs | Yes | No | Preserved; rendered parent fieldsets disable during the active save |
| Fieldset `query.isFetching`, editor `:88` | Prevent acting on refreshing direct rows | Saving must wait; local editing need not | **Yes**, when valid `currentData` already exists | Member controls remain editable during background fetch; Save still waits |
| `profileUnavailable` includes profile `isFetching`, editor `:37`, used at `:88` | Treats every profile refresh as unavailable | Initial/mismatched profile protection is legitimate | **Yes**, for a valid cached profile of the selected member | Separate current-profile availability from background refreshing; Save still waits |
| `missingOverride`, editor `:86,88` | Existing PATCH needs a record ID | Yes for PATCH; not a reason to prohibit local selection or supported creation | **Yes**, all features for an inherited-only member | Remove it from fieldset disabling; distinguish new record versus malformed existing row; support explicit full-row POST |
| Inherit option disabled when original action is non-null, editor `:103` | Saved reset contract is unknown | Blocking an unsupported reset save is legitimate | It prevented even a safe, explained local selection | Option is locally selectable; unsupported reset disables Save for that feature and displays an explanation |
| Save `!dirty`, editor `:116` | No changed action | Yes | No | Preserved; comparisons now distinguish null draft intent from false |
| Save fetching/unavailable/saving/missing-ID predicates, editor `:116` | Require a current, supported mutation | Yes when applied to Save | They were also applied unnecessarily to controls | Retained/replaced as specific Save validation: refresh, active save, unavailable target, malformed ID, incomplete new row, unsupported reset |
| `pending.current`, editor `:40` | Synchronously block duplicate handler calls | Yes | No | Preserved, independently of rendered disabled state |
| Retry button disabled during requests, editor `:75` | Avoid duplicate retry requests | Yes | No | Preserved |
| `canEditMembers` and modal condition, `AdminPanel.tsx:386,5695–5698` in starting source | Existing feature/action checks and selected member | Yes | No evidence of an incorrect Superuser check | Preserved; stable member ID is the editor key and target argument |
| Modal `closeDisabled={isSavingMemberPermission}`, same AdminPanel region | Prevent closing during a save | Yes | Does not itself disable dropdowns | Preserved |
| `dialogLifecycle.ts:43,96,105–107`, modal stack `inert`/pointer events | Only the top active dialog may receive interaction | Yes | No evidence this caused the reported lockout | Preserved; no shared modal/select redesign |
| Unconditional `createMemberPermission` rejection, `mutationAuthorization.ts:101–103` | Earlier mitigation against default-false full-row creation | Necessary for unsafe partial/null payloads, overly broad for an explicitly specified full row | Prevented the first supported override from ever saving | Replace with exact existing payload validation plus the active-Superuser administrative guard |

The Edit Member Role dropdown is a separate native select helper. It was not changed. No CSS/pointer overlay defect was established, and no unrelated z-index or modal lifecycle changes were made.

## 3. Members with no individual records

An empty `[]` response is usable management data, not evidence of zero effective access. The user can still have role-derived access in the server's final `permissions` array.

After the fix, a resolved selected member with an empty direct array has enabled View/Create/Edit/Delete controls for all seven features. Each initially displays Inherit. Opening the modal makes reads only; it does not create permission rows, placeholder IDs, or implicit denials.

The existing creation endpoint accepts a **full boolean feature row**. To use it safely, the administrator must explicitly choose Allow or Deny for **all four actions** of the feature before Save is enabled. There is no automatic copy of role permissions and no conversion of untouched Inherit values to false. A clear English/French instruction explains that this creates a full feature override.

If a feature row exists but has no ID, local choices remain available, but saving is blocked with a distinct missing-record-ID explanation. The editor does not misclassify a malformed existing row as a missing row and attempt a duplicate POST.

## 4. Confirmed frontend root causes

1. Save capability and local dropdown interaction were coupled through the disabled parent fieldset. Missing direct IDs disabled the entire interface.
2. Initial loading and background fetching were not separated. Valid current-target controls were disabled during both direct-row and profile refetches.
3. The final mutation boundary rejected every direct permission POST, although the existing API definitions, documentation and prior implementation establish a full-four-boolean creation workflow. The actual unsafe behavior was the previous defaulting of unselected actions, not the existence of the POST operation itself.
4. Saved reset-to-Inherit was represented by disabling the option rather than separating local draft choice from unsupported persistence. It is now selectable locally, with an explicit Save limitation.

The earlier post-save cache race was not the original root cause. Its matching-response cache publication and fresh-on-open query behavior remain intact.

## 5. Backend limitations: established versus unknown

**Established repository contract:** full-row POST and changed-boolean PATCH. These workflows are implemented using their existing method, path and fields.

**Not established:** partial/nullable creation, nullable PATCH reset, DELETE/reset operation, or the effect of `is_override:false` on persisted inheritance. Read types allowing null do not prove that null is accepted on writes.

No new backend defect has been confirmed by this task. The user could not provide live responses and asked to locate the pre-existing implementation; that implementation and its exact payload were found locally. This is repository-contract evidence, not authenticated runtime verification.

## 6. Files modified by this targeted follow-up

| File | Changes |
| --- | --- |
| `src/pages/admin/AdminPermissionsEditor.tsx` | Separate interaction from save validation; allow local choices without row IDs and during valid background refresh; require four explicit creation actions; restore existing create mutation; retain partial PATCH; show unsupported reset/missing-ID/refresh explanations |
| `src/redux/features/api/mutationAuthorization.ts` | Allow only the established full creation payload through the existing active-Superuser guard; reject partial, null, unknown-feature, empty-target and extra-field payloads; preserve boolean-only PATCH validation |
| `src/redux/features/members/membersApi.ts` | Publish a matching, server-created row to the existing subscribed management cache after successful POST; preserve the preceding PATCH cache fix and existing invalidation |
| `src/i18n/locales/en.json`, `fr.json` | Explain full-row creation, missing IDs, background refresh and unsupported reset; retain both languages |
| `tests/admin-permissions.test.mjs` | Render actual HTML to inspect inherited fieldset disabling; exercise creation, missing IDs, background refresh, loading/error/authorization, active save and transition behavior |
| `tests/frontend-authorization.test.ts` | Verify exact full POST under active Superuser, reject unauthorized/invalid creation and nullable reset, preserve existing PATCH |
| `tests/admin-agenda-member-permissions.test.mjs` | Real RTK mocked-HTTP creation success/failure and returned-row cache tests; preceding Agenda/PATCH/switching regressions preserved |
| `docs/admin-agenda-count-and-member-permission-fixes.md` | Add a follow-up note correcting the scope of the earlier dropdown diagnosis |
| `docs/member-permission-disabled-dropdown-fix.md` | This report |

The total working-tree diff also includes prior Agenda/count changes from the preceding task. They were not discarded or expanded in this targeted follow-up. Authentication permission utilities, route/resource guards, dependency manifests/lockfile, safe startup scripts and the Agenda implementation remain unchanged by this follow-up.

## 7. Implementation details

### Interaction versus persistence

With usable current-target data, member fieldsets no longer disable because of missing overrides or background fetching. Active mutation still disables them. Initial loading, errors, unavailable target IDs and lost administration access still withhold the controls.

Save waits for refreshed profile/direct rows, an actual dirty draft, an available target, and a supported operation. The synchronous handler repeats these protections, so invoking a disabled button's handler programmatically cannot bypass them.

Management drafts may now contain null solely to represent an unsaved Inherit choice. This draft is **not an authorization source**, is not sent as a null write, and does not change the saved effective-access indicator. A reset request blocks the **whole feature save**, so other selected booleans are not misleadingly persisted while an unsupported Inherit choice is ignored.

Existing nullable/omitted actions on a row with a valid ID can still change to explicit Allow/Deny using a changed-boolean PATCH. Untouched actions are omitted from that request. For first-row creation, all four choices must be explicit booleans. False is preserved as an intentional denial.

### Authorization

Only server `permissions` drives access through the existing permission utility/hook/route architecture. The actual active Superuser flag remains the administrator bypass; role names do not grant administration. Inactive/deleted actors remain denied. Role/direct arrays are management and explanatory data; no effective-permission merge was reintroduced.

`createMemberPermission` is handled by the existing administrative endpoint policy. Before that policy permits the request, the final request boundary validates POST `/user/user-permissions`, a nonempty stable user ID, a recognized feature, exactly the four boolean action fields, and no unknown keys. Partial/null/extra-field requests fail closed. Existing fresh-profile preflight and backend authorization responsibilities remain.

### Cache and target isolation

The prior `currentData`, stable member-ID React key, query arguments, refetch-on-open behavior and matching PATCH-response cache update are preserved. Successful first creation additionally publishes only the returned server ID/row after matching user/feature/action validation. No row is inserted before the server succeeds.

Existing invalidation still refreshes direct rows and relevant profiles/projections. No manual extra GET, timeout, reload, polling, or parallel permission state was introduced. Obsolete session completions cannot repopulate a replacement session through the new lifecycle. Malformed/mismatched responses are not used to synthesize records; the normal invalidated GET remains the reconciliation path.

## 8. API contract evidence

| Endpoint | Evidence found | Implemented interpretation / limit |
| --- | --- | --- |
| GET `/user/users/{id}` | Existing `getUserById`, normalization and profile types | Require current-target profile ID; use role metadata only for display; initial/mismatch/error blocks interaction |
| GET `/user/user-permissions?user_id={id}` | Existing query and `MemberPermissionsResponse = MemberPermission[]` | `[]` is handled as no direct rows, not fabricated records or denied effective access; actual affected response not supplied |
| POST `/user/user-permissions` | Current `CreateMemberPermissionRequest`; existing members API query; `FRONTEND_ROLES_PERMISSIONS_AUDIT.md` sections describing exact payload; Git `ff38c6e:src/pages/admin/AdminPermissionsEditor.tsx` contains the create branch | Restore the existing six-field full-row request only after all four action choices are explicit |
| PATCH `/user/user-permissions/{id}` | Current `UpdateMemberPermissionRequest`, serializer and previous editor | Send only changed booleans; ID in URL and user ID retained as cache context, not added to PATCH body |
| Reset/delete / nullable writes | No established endpoint or write schema found in inspected definitions/history/docs | Not implemented; local Inherit preview is not classified as a saved reset |

Exact existing full creation shape, using synthetic identifiers:

```json
{
  "user_id": "test-member-id",
  "feature": "article",
  "can_view": true,
  "can_create": false,
  "can_edit": false,
  "can_delete": false
}
```

The historical create branch filled unselected actions with false. That code was inspected as text and was not restored wholesale or executed. The new workflow requires explicit administrator intent for every field, preserving the existing request contract without silently overwriting inherited actions.

The expected POST/PATCH return type is the existing permission record with `id`, `user_id`, `feature`, and its actions. The matching cache publication validates those fields at runtime. No live POST/PATCH response was captured; no production mutations were made. No claim is made that TypeScript or historical frontend code proves current backend acceptance or reset semantics.

## 9. Regression verification

Tests inspect **rendered HTML**, including inherited `<fieldset disabled>` state, rather than only calling `onChange`:

- Empty direct rows: 28 selects rendered with no disabled parent fieldset or own select disability; no create call on opening; partial creation remains blocked.
- Existing direct rows: editable Allow/Deny controls and exact changed-action PATCH.
- Inherited actions with a saved record ID: explicit Allow/Deny PATCH without changing untouched null actions.
- Background direct/profile refetch: controls stay editable, local choices persist, Save is blocked until refreshed evidence is available.
- Initial loading, failed API and mismatched profile: no actionable dropdowns; error and retry remain visible.
- Active save: all seven parent fieldsets disable; duplicate submissions are blocked; controls return after completion.
- First creation: four explicit booleans required, exact POST payload, server-created row cached, failed creation leaves `[]` and no fabricated IDs.
- Saved Allow/Deny to Inherit: local selection works, explanation visible, no unsupported request or partial success.
- Normal users/inactive or deleted Superusers: final mutation guard still denies permission creation; valid active Superuser can use the existing full-row POST.
- Existing cache synchronization, A/B target isolation, new annual badge, Edit Member role and broader authorization regressions remain in the suite.

| Verification | Result |
| --- | --- |
| Targeted suite | Intermediate targeted run: 52 passed, 0 failed, across permission-editor, final authorization and real RTK Agenda/member tests; final full suite also includes the two subsequently added initial/active-save rendered-state checks |
| TypeScript | `npx.cmd --no-install tsc --noEmit`: passed, exit 0 |
| Existing lint | `npm.cmd run lint`: passed, exit 0; this is the repository's TypeScript lint script, not independent ESLint |
| Full automated suite | `npm.cmd test`: **236 passed, 0 failed, 0 skipped**, about 44 seconds; includes the final rendered disabled-state checks and creation/cache/authorization regressions |
| Production build | `npm.cmd run build`: passed, exit 0, about 12 seconds; existing large-chunk warning retained |
| Browser/native select interaction | Not performed in this targeted pass. The preceding browser attempt had no browser access host and the native Chrome fallback stopped because its current URL could not be verified safely. No working authenticated test environment was supplied; no browser policy bypass attempted |
| Runtime API | No authenticated GET/POST/PATCH performed in this targeted pass. Synthetic HTTP fixtures are explicitly test-only |
| Source/diff | Prior uncommitted work preserved; manifests/lockfile/startup loaders/authorization source and route guards not changed; no commit/push/deploy |

## 10. Operation-by-operation status

“Supported/tested” here means frontend behavior verified with rendered HTML/component tests and/or real RTK using mocked HTTP. **Live persistence and native browser operation remain unverified.**

| Operation | Local dropdown interaction | Persistence status |
| --- | --- | --- |
| Existing Allow → Deny | Enabled | Supported changed-boolean PATCH; tests pass; live verification required |
| Existing Deny → Allow | Enabled | Supported changed-boolean PATCH; tests pass; live verification required |
| Inherit → Allow, existing row ID | Enabled | Supported boolean PATCH of that action; untouched actions omitted |
| Inherit → Deny, existing row ID | Enabled | Supported boolean PATCH of that action, including explicit false |
| Inherit → Allow/Deny, no record | Enabled | Full-row POST supported **only after all four actions have explicit Allow/Deny choices**; not a partial inherited row |
| Allow → Inherit, saved value | Enabled as unsaved draft, with explanation | **UNSUPPORTED / CONTRACT UNRESOLVED**; Save blocked, no null/reset call |
| Deny → Inherit, saved value | Enabled as unsaved draft, with explanation | **UNSUPPORTED / CONTRACT UNRESOLVED**; Save blocked, no null/reset call |
| Revert an unsaved Allow/Deny choice to an originally inherited value | Enabled | Restores draft to original state; no reset mutation needed |
| First individual override, all four choices explicit | Enabled | Existing full-row POST restored with active-Superuser validation and returned-row cache synchronization; live verification required |
| First override with some actions left at Inherit | Enabled locally | **NOT PERSISTABLE WITH THE ESTABLISHED FULL-ROW CONTRACT**; explicit explanation and disabled Save |
| Existing row missing its record ID | Enabled locally | **BLOCKED BY INVALID/INCOMPLETE RECORD DATA**; no guessed ID or duplicate POST |

The source-level cause of complete disabling has been removed for usable current-member data, and its rendered-state tests pass. That does not certify the original production/browser scenario as resolved end to end. Unsupported operations above are not classified as fixed.

## 11. Remaining questions and backend handover

The user could not supply runtime examples and asked to find the prior contract. Full-row POST was found and implemented without inventing fields. No further confirmation is needed to describe that repository workflow; the remaining questions concern live behavior and capabilities not found in the source.

1. **Partial inheritance on first creation:** does POST accept missing or null actions while preserving role inheritance? If so, provide the actual documented schema and sanitized response. Current implementation intentionally requires all four explicit booleans.
2. **Saved reset:** which existing operation resets/deletes an individual action or feature override? Does it use nullable PATCH, another established operation, or a documented `is_override` meaning? Nothing was invented.
3. **Malformed row IDs:** if GET returns feature rows without IDs, determine whether these are inherited display rows or persisted overrides and document how they should be mutated. The frontend cannot safely PATCH an unidentified record.
4. **Current runtime schema:** verify GET arrays and full POST/PATCH responses in an authorized test environment, plus backend recomputation of final `permissions` after saving.

**Exact handover for unresolved inheritance/reset capability:** affected feature is individual permission management; endpoints are the existing GET, POST and PATCH paths above. Actual runtime request/response examples are unavailable. Expected business capability is an explicit single-action override while untouched actions inherit, and an explicit way to restore saved inheritance. Reproduce with a disposable user whose role grants Article View and has no direct rows; attempt one explicit action override without changing other inherited actions, then restore it. Confirm backend behavior before selecting an implementation. Acceptance requires untouched inherited actions remain inherited, explicit false is retained, final `permissions` reflects the saved result, and no unsupported reset or silent full-row replacement is used.

**No backend change is confirmed necessary for the established full-four-boolean POST or existing boolean PATCH.** Partial/nullable creation and reset require contract clarification; if genuinely unsupported, backend capability work must be agreed separately. No new endpoint is prescribed as an established requirement.

## 12. Final assessment

**Frontend disabled-state correction implemented; browser and authenticated runtime verification required.** Empty inherited-only members now have interactive controls and can create the first full override through the existing explicit four-action workflow. Supported existing edits remain available. Background refetches no longer unnecessarily lock usable controls. Initial loading, failed reads, authorization loss, active saves, record-ID validity and unsupported persistence protections remain.

Real-browser verification must still open the actual modal, exercise mouse/keyboard selection, save existing and first full-row overrides in an authorized test environment, reopen them, and verify server final `permissions`. The prior security/host investigation and unrelated unresolved backend findings remain outside this targeted correction.
