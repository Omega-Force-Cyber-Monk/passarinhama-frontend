import React, { useRef, useState } from "react";
import { useI18n } from "../../i18n";
import { useAppToast } from "../../components/ui/AppToastProvider";
import { getApiErrorDisplayMessage } from "../../utils/apiErrorMessages";
import {
  useGetUserPermissionsQuery, useGetMemberPermissionsQuery, useGetUserByIdQuery,
  useCreateUserPermissionMutation, useUpdateUserPermissionMutation,
  useUpdateMemberPermissionMutation,
} from "../../redux/features/members/membersApi";
import type { UserPermission } from "../../redux/features/members/membersTypes";
import { PERMISSION_FEATURES, PERMISSION_ACTIONS, getMergedPermissions, hasPermission, type PermissionAction } from "../../redux/features/auth/permissionUtils";

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
  const memberQuery = useGetMemberPermissionsQuery({ user_id: targetId }, { skip: !canManage || !targetId || kind !== "member" });
  const profileQuery = useGetUserByIdQuery(targetId, { skip: !canManage || !targetId || kind !== "member", refetchOnMountOrArgChange: true });
  const query = kind === "role" ? roleQuery : memberQuery;
  const [createRole] = useCreateUserPermissionMutation();
  const [updateRole] = useUpdateUserPermissionMutation();
  const [updateMember] = useUpdateMemberPermissionMutation();
  const [drafts, setDrafts] = useState<Record<string, Partial<Record<PermissionAction, boolean>>>>({});
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const permissions = query.currentData;
  const member = kind === "member" ? profileQuery.currentData : undefined;
  const profileUnavailable = kind === "member" && (member?.id !== targetId || profileQuery.isFetching || profileQuery.isError);
  const inherited = getMergedPermissions(member ? { ...member, is_superuser: false, user_permissions: [] } : null);

  const savePermission = async (feature: string) => {
    if (!canManage || !targetId || pending.current || !permissions || query.isFetching || query.isError || profileUnavailable || !drafts[feature]) return;
    const original = permissions.find((row) => row.feature === feature);
    // The established create contract requires a full boolean row. Blocking it
    // preserves inheritance until partial/nullable creation is documented.
    if (kind === "member" && !original?.id) return;
    // PATCH only explicit edits: null/omitted actions continue to inherit.
    const changes = Object.fromEntries(PERMISSION_ACTIONS
      .filter((field) => typeof drafts[feature]?.[field] === "boolean" && drafts[feature][field] !== original?.[field])
      .map((field) => [field, drafts[feature][field]]));
    if (!Object.keys(changes).length) return;
    const values = Object.fromEntries(PERMISSION_ACTIONS.map((field) => [field, Boolean(drafts[feature]?.[field] ?? original?.[field])])) as Record<PermissionAction, boolean>;
    pending.current = true;
    setSaving(true);
    onBusyChange?.(true);
    try {
      if (kind === "role") {
        if (original?.id) await updateRole({ id: original.id, role_id: targetId, ...changes }).unwrap();
        else await createRole({ role_id: targetId, feature, ...values }).unwrap();
      } else {
        await updateMember({ id: original!.id!, user_id: targetId, ...changes }).unwrap();
      }
      setDrafts((current) => { const next = { ...current }; delete next[feature]; return next; });
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
  if (!permissions || (kind === "member" && member?.id !== targetId)) return <p role="status">{translate("common.loading")}</p>;

  return <div className="min-w-0 space-y-4" aria-busy={saving || query.isFetching || profileUnavailable}>
    <p className="text-xs text-slate-500">{translate(`adminPanelPage.${kind === "role" ? "rolePermissions" : "memberPermissions"}.permissionsHint`)}</p>
    {kind === "member" && <p role="note" className="text-xs text-slate-500">{translate("adminPanelPage.memberPermissions.inheritanceUnavailable")}</p>}
    {PERMISSION_FEATURES.map((feature) => {
      const original: UserPermission | undefined = permissions.find((row) => row.feature === feature);
      const values = Object.fromEntries(PERMISSION_ACTIONS.map((field) => [field, Boolean(drafts[feature]?.[field] ?? original?.[field])])) as Record<PermissionAction, boolean>;
      const dirty = Boolean(drafts[feature]) && (!original || PERMISSION_ACTIONS.some((field) => field in drafts[feature] && values[field] !== original[field]));
      const missingOverride = kind === "member" && !original?.id;
      const preview = member ? { ...member, user_permissions: [...permissions.filter((row) => row.feature !== feature), { ...original, feature, ...drafts[feature] }] } : null;
      return <fieldset key={feature} disabled={saving || query.isFetching || profileUnavailable || missingOverride} className="min-w-0 rounded-2xl border border-slate-200 p-4">
        <legend className="px-2 text-sm font-bold">{translate(`adminPanelPage.rolePermissions.features.${feature}`)}</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {PERMISSION_ACTIONS.map((field) => <label key={field} className="flex min-w-0 cursor-pointer items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-xs font-bold">
            {translate(`adminPanelPage.rolePermissions.actions.${field.slice(4)}`)}
            {kind === "member" ? <span className="min-w-0 space-y-1 text-right">
              <select aria-label={translate(`adminPanelPage.rolePermissions.actions.${field.slice(4)}`)} className="rounded-lg border border-slate-200 bg-white p-2 focus-visible:ring-2 focus-visible:ring-primary" value={typeof drafts[feature]?.[field] === "boolean" ? String(drafts[feature][field]) : original?.[field] == null ? "inherit" : String(original[field])} onChange={(event) => {
                const value = event.target.value;
                if (value === "inherit") {
                  if (original?.[field] != null) return;
                  setDrafts((current) => { const next = { ...current[feature] }; delete next[field]; return { ...current, [feature]: next }; });
                } else if (value === "true" || value === "false") {
                  setDrafts((current) => ({ ...current, [feature]: { ...current[feature], [field]: value === "true" } }));
                }
              }}>
                <option value="inherit" disabled={original?.[field] != null}>{translate("adminPanelPage.memberPermissions.inherit")}</option>
                <option value="true">{translate("adminPanelPage.memberPermissions.allow")}</option>
                <option value="false">{translate("adminPanelPage.memberPermissions.deny")}</option>
              </select>
              <span className="block font-normal">{translate("adminPanelPage.memberPermissions.inheritedValue", { value: translate(`adminPanelPage.memberPermissions.${inherited[feature][field] === true ? "allow" : "deny"}`) })}</span>
              <span className="block font-normal">{translate("adminPanelPage.memberPermissions.effectiveValue", { value: translate(`adminPanelPage.memberPermissions.${hasPermission(preview, feature, field) ? "allow" : "deny"}`) })}</span>
            </span> : <input type="checkbox" className="h-4 w-4 shrink-0 accent-primary focus-visible:ring-2 focus-visible:ring-primary" checked={values[field]} onChange={(event) => {
              const checked = event.target.checked;
              setDrafts((current) => ({ ...current, [feature]: { ...current[feature], [field]: checked } }));
            }} />}
          </label>)}
        </div>
        {missingOverride && <p className="mt-3 text-xs text-slate-500">{translate("adminPanelPage.memberPermissions.newOverrideUnavailable")}</p>}
        <button type="button" disabled={!dirty || saving || query.isFetching || profileUnavailable || missingOverride} onClick={() => { void savePermission(feature); }} className="mt-3 rounded-xl bg-slate-900 px-4 py-3 text-xs font-bold text-white focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50">
          {translate("adminPanelPage.rolePermissions.savePermission")}
        </button>
      </fieldset>;
    })}
  </div>;
}
