import React, { useRef, useState } from "react";
import { useI18n } from "../../i18n";
import { useAppToast } from "../../components/ui/AppToastProvider";
import { getApiErrorDisplayMessage } from "../../utils/apiErrorMessages";
import {
  useGetUserPermissionsQuery, useGetMemberPermissionsQuery,
  useCreateUserPermissionMutation, useUpdateUserPermissionMutation,
  useCreateMemberPermissionMutation, useUpdateMemberPermissionMutation,
} from "../../redux/features/members/membersApi";
import type { UserPermission } from "../../redux/features/members/membersTypes";
import { PERMISSION_FEATURES, PERMISSION_ACTIONS, type PermissionAction } from "../../redux/features/auth/permissionUtils";

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
  const query = kind === "role" ? roleQuery : memberQuery;
  const [createRole] = useCreateUserPermissionMutation();
  const [updateRole] = useUpdateUserPermissionMutation();
  const [createMember] = useCreateMemberPermissionMutation();
  const [updateMember] = useUpdateMemberPermissionMutation();
  const [drafts, setDrafts] = useState<Record<string, Partial<Record<PermissionAction, boolean>>>>({});
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const permissions = query.currentData;

  const savePermission = async (feature: string) => {
    if (!canManage || !targetId || pending.current || !permissions || query.isFetching || query.isError || !drafts[feature]) return;
    const original = permissions.find((row) => row.feature === feature);
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
        if (original?.id) await updateMember({ id: original.id, user_id: targetId, ...changes }).unwrap();
        else await createMember({ user_id: targetId, feature, ...values }).unwrap();
      }
      await query.refetch().unwrap();
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
  if (query.isError) return <div role="alert" className="space-y-3">
    <p>{getApiErrorDisplayMessage(query.error, translate)}</p>
    <button type="button" className="rounded-xl border px-4 py-2 focus-visible:ring-2 focus-visible:ring-primary" disabled={query.isFetching} onClick={() => { void query.refetch(); }}>{translate("adminPanelPage.retryFetch")}</button>
  </div>;
  if (!permissions) return <p role="status">{translate("common.loading")}</p>;

  return <div className="min-w-0 space-y-4" aria-busy={saving || query.isFetching}>
    <p className="text-xs text-slate-500">{translate(`adminPanelPage.${kind === "role" ? "rolePermissions" : "memberPermissions"}.permissionsHint`)}</p>
    {PERMISSION_FEATURES.map((feature) => {
      const original: UserPermission | undefined = permissions.find((row) => row.feature === feature);
      const values = Object.fromEntries(PERMISSION_ACTIONS.map((field) => [field, Boolean(drafts[feature]?.[field] ?? original?.[field])])) as Record<PermissionAction, boolean>;
      const dirty = Boolean(drafts[feature]) && (!original || PERMISSION_ACTIONS.some((field) => field in drafts[feature] && values[field] !== original[field]));
      return <fieldset key={feature} disabled={saving || query.isFetching} className="min-w-0 rounded-2xl border border-slate-200 p-4">
        <legend className="px-2 text-sm font-bold">{translate(`adminPanelPage.rolePermissions.features.${feature}`)}</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {PERMISSION_ACTIONS.map((field) => <label key={field} className="flex min-w-0 cursor-pointer items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-xs font-bold">
            {translate(`adminPanelPage.rolePermissions.actions.${field.slice(4)}`)}
            <input type="checkbox" className="h-4 w-4 shrink-0 accent-primary focus-visible:ring-2 focus-visible:ring-primary" checked={values[field]} onChange={(event) => {
              const checked = event.target.checked;
              setDrafts((current) => ({ ...current, [feature]: { ...current[feature], [field]: checked } }));
            }} />
          </label>)}
        </div>
        <button type="button" disabled={!dirty || saving || query.isFetching} onClick={() => { void savePermission(feature); }} className="mt-3 rounded-xl bg-slate-900 px-4 py-3 text-xs font-bold text-white focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50">
          {translate("adminPanelPage.rolePermissions.savePermission")}
        </button>
      </fieldset>;
    })}
  </div>;
}
