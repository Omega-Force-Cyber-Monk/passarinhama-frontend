import React, { useEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n";
import { useAppToast } from "../../components/ui/AppToastProvider";
import { getApiErrorDisplayMessage } from "../../utils/apiErrorMessages";
import {
  useGetUserPermissionsQuery, useGetMemberPermissionsQuery, useGetUserByIdQuery,
  useCreateUserPermissionMutation, useUpdateUserPermissionMutation,
  useCreateMemberPermissionMutation, useUpdateMemberPermissionMutation,
} from "../../redux/features/members/membersApi";
import type { UserPermission } from "../../redux/features/members/membersTypes";
import { PERMISSION_FEATURES, PERMISSION_ACTIONS, type PermissionAction } from "../../redux/features/auth/permissionUtils";

type ActionValues = Record<PermissionAction, boolean>;
type PermissionDraft = { original: ActionValues; values: ActionValues; savedProfileVersion?: number };

type Props = {
  kind: "role" | "member";
  targetId: string;
  canManage: boolean;
  onBusyChange?: (busy: boolean) => void;
};

// Both editors use the existing feature-level API; member overrides are never
// written to the role endpoint. IDs always come from the currently loaded target.
export function AdminPermissionsEditor({ kind, targetId, canManage, onBusyChange }: Props) {
  const { translate } = useI18n();
  const toast = useAppToast();
  const roleQuery = useGetUserPermissionsQuery({ role_id: targetId }, { skip: !canManage || !targetId || kind !== "role" });
  const memberQuery = useGetMemberPermissionsQuery({ user_id: targetId }, { skip: !canManage || !targetId || kind !== "member", refetchOnMountOrArgChange: true });
  const profileQuery = useGetUserByIdQuery(targetId, { skip: !canManage || !targetId || kind !== "member", refetchOnMountOrArgChange: true });
  const query = kind === "role" ? roleQuery : memberQuery;
  const [createRole] = useCreateUserPermissionMutation();
  const [updateRole] = useUpdateUserPermissionMutation();
  const [createMember] = useCreateMemberPermissionMutation();
  const [updateMember] = useUpdateMemberPermissionMutation();
  const [drafts, setDrafts] = useState<Record<string, PermissionDraft>>({});
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const records: UserPermission[] | undefined = Array.isArray(query.currentData) ? query.currentData : undefined;
  const member = kind === "member" ? profileQuery.currentData : undefined;
  const profileUnavailable = kind === "member" && (member?.id !== targetId || profileQuery.isError);
  const refreshing = query.isFetching || (kind === "member" && profileQuery.isFetching);
  const profileVersion = profileQuery.fulfilledTimeStamp ?? 0;
  const readServerValues = (feature: string): ActionValues | undefined => {
    if (kind === "role") {
      const row = records?.find(record => record.feature === feature);
      return Object.fromEntries(PERMISSION_ACTIONS.map(action => [action, row?.[action] === true])) as ActionValues;
    }
    const row = Array.isArray(member?.permissions) ? member.permissions.find(permission => permission.feature === feature) : undefined;
    if (!row || PERMISSION_ACTIONS.some(action => typeof row[action] !== "boolean")) return undefined;
    return Object.fromEntries(PERMISSION_ACTIONS.map(action => [action, row[action]])) as ActionValues;
  };
  const finalPermissionsAvailable = kind !== "member" || PERMISSION_FEATURES.every(feature => readServerValues(feature) !== undefined);

  // These are form snapshots, never authorization decisions. Reconcile fresh
  // profiles without overwriting edited actions, and retain saved values until
  // the automatic final-profile refresh has completed.
  useEffect(() => {
    if (kind !== "member" || profileUnavailable || !finalPermissionsAvailable || saving || profileQuery.isFetching) return;
    setDrafts(current => {
      let next = current;
      for (const [feature, draft] of Object.entries(current)) {
        if (draft.savedProfileVersion !== undefined && profileVersion <= draft.savedProfileVersion) continue;
        const original = readServerValues(feature);
        if (!original) continue;
        const values = Object.fromEntries(PERMISSION_ACTIONS.map(action => [action,
          draft.values[action] !== draft.original[action] ? draft.values[action] : original[action],
        ])) as ActionValues;
        const dirty = PERMISSION_ACTIONS.some(action => values[action] !== original[action]);
        if (!dirty) {
          if (next === current) next = { ...current };
          delete next[feature];
        } else if (draft.savedProfileVersion !== undefined || PERMISSION_ACTIONS.some(action => original[action] !== draft.original[action] || values[action] !== draft.values[action])) {
          if (next === current) next = { ...current };
          next[feature] = { original, values };
        }
      }
      return next;
    });
  }, [kind, targetId, member?.permissions, profileVersion, profileQuery.isFetching, profileUnavailable, finalPermissionsAvailable, saving]);

  const savePermission = async (feature: string) => {
    if (!canManage || !targetId || pending.current || !records || refreshing || query.isError || profileUnavailable || !finalPermissionsAvailable) return;
    const draft = drafts[feature];
    if (!draft) return;
    const record = records.find(row => row.feature === feature);
    if (kind === "member" && record && !record.id) return;
    const changes = Object.fromEntries(PERMISSION_ACTIONS
      .filter(action => draft.values[action] !== draft.original[action])
      .map(action => [action, draft.values[action]]));
    if (!Object.keys(changes).length) return;
    const values = { ...draft.values };
    const savedProfileVersion = profileVersion;
    pending.current = true;
    setSaving(true);
    onBusyChange?.(true);
    try {
      if (kind === "role") {
        if (record?.id) await updateRole({ id: record.id, role_id: targetId, ...changes }).unwrap();
        else await createRole({ role_id: targetId, feature, ...values }).unwrap();
      } else {
        if (record?.id) await updateMember({ id: record.id, user_id: targetId, ...changes }).unwrap();
        else await createMember({ user_id: targetId, feature, ...values }).unwrap();
      }
      setDrafts(current => {
        const next = { ...current };
        if (kind === "member") next[feature] = { original: values, values: current[feature]?.values ?? values, savedProfileVersion };
        else delete next[feature];
        return next;
      });
      toast.success(translate("adminPanelPage.operationSuccessful"));
    } catch (error) {
      toast.error(getApiErrorDisplayMessage(error, translate));
    } finally {
      pending.current = false;
      setSaving(false);
      onBusyChange?.(false);
    }
  };

  if (!canManage || !targetId) return null;
  if (query.isError || (kind === "member" && profileQuery.isError)) return <div role="alert" className="space-y-3">
    <p>{getApiErrorDisplayMessage(query.error || profileQuery.error, translate)}</p>
    <button type="button" className="rounded-xl border px-4 py-2 focus-visible:ring-2 focus-visible:ring-primary" disabled={query.isFetching || profileQuery.isFetching} onClick={() => { void query.refetch(); if (kind === "member") void profileQuery.refetch(); }}>{translate("adminPanelPage.retryFetch")}</button>
  </div>;
  if (query.currentData === undefined || (kind === "member" && member?.id !== targetId) || (!finalPermissionsAvailable && profileQuery.isFetching)) return <p role="status">{translate("common.loading")}</p>;
  if (!records || !finalPermissionsAvailable) return <div role="alert" className="space-y-3">
    <p>{translate("adminPanelPage.memberPermissions.finalPermissionsUnavailable")}</p>
    <button type="button" className="rounded-xl border px-4 py-2 focus-visible:ring-2 focus-visible:ring-primary" onClick={() => { void query.refetch(); if (kind === "member") void profileQuery.refetch(); }}>{translate("adminPanelPage.retryFetch")}</button>
  </div>;

  return <div className="min-w-0 space-y-4" aria-busy={saving || refreshing || profileUnavailable}>
    <p className="text-xs text-slate-500">{translate(`adminPanelPage.${kind === "role" ? "rolePermissions" : "memberPermissions"}.permissionsHint`)}</p>
    {kind === "member" && refreshing && <p role="status" className="text-xs text-slate-500">{translate("adminPanelPage.memberPermissions.refreshing")}</p>}
    {PERMISSION_FEATURES.map((feature) => {
      const record = records.find(row => row.feature === feature);
      const serverValues = readServerValues(feature)!;
      const draft = drafts[feature];
      const values = draft?.values ?? serverValues;
      const original = draft?.original ?? serverValues;
      const dirty = PERMISSION_ACTIONS.some(action => values[action] !== original[action]);
      const missingRecordId = kind === "member" && Boolean(record && !record.id);
      return <fieldset key={feature} disabled={saving || profileUnavailable || (kind === "role" && query.isFetching)} className="min-w-0 rounded-2xl border border-slate-200 p-4">
        <legend className="px-2 text-sm font-bold">{translate(`adminPanelPage.rolePermissions.features.${feature}`)}</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {PERMISSION_ACTIONS.map((field) => <label key={field} className="flex min-w-0 cursor-pointer items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-xs font-bold">
            {translate(`adminPanelPage.rolePermissions.actions.${field.slice(4)}`)}
            <input type="checkbox" className="h-4 w-4 shrink-0 accent-primary focus-visible:ring-2 focus-visible:ring-primary" checked={values[field]} onChange={(event) => {
              const checked = event.target.checked;
              setDrafts(current => {
                const previous = current[feature] ?? { original: { ...serverValues }, values: { ...serverValues } };
                return { ...current, [feature]: { ...previous, values: { ...previous.values, [field]: checked } } };
              });
            }} />
          </label>)}
        </div>
        {missingRecordId && <p className="mt-3 text-xs text-slate-500">{translate("adminPanelPage.memberPermissions.missingRecordId")}</p>}
        <button type="button" disabled={!dirty || saving || refreshing || profileUnavailable || missingRecordId} onClick={() => { void savePermission(feature); }} className="mt-3 rounded-xl bg-slate-900 px-4 py-3 text-xs font-bold text-white focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50">
          {translate(kind === "member" ? "adminPanelPage.memberPermissions.savePermissions" : "adminPanelPage.rolePermissions.savePermission")}
        </button>
      </fieldset>;
    })}
  </div>;
}
