import { useMemo } from 'react';
import { useGetUsersMeQuery } from '../redux/features/members/membersApi';
import type { UserPermission } from '../redux/features/members/membersTypes';
import type {
  PermissionAction,
  PermissionActionKey,
  PermissionFeature,
} from '../redux/features/auth/permissionUtils';

type DirectPermissionMap = Partial<Record<PermissionFeature, UserPermission>>;

const ACTION_FIELD_MAP: Record<PermissionActionKey, PermissionAction> = {
  view: 'can_view',
  create: 'can_create',
  edit: 'can_edit',
  delete: 'can_delete',
};

const isPermissionFeature = (feature: string): feature is PermissionFeature =>
  [
    'article',
    'document',
    'event',
    'forum',
    'training',
    'technicopro',
    'user',
  ].includes(feature);

export const useDirectUserPermissions = () => {
  const { data: currentUser } = useGetUsersMeQuery();

  const directPermissions = useMemo<DirectPermissionMap>(() => {
    const permissions = currentUser?.user_permissions ?? [];

    return permissions.reduce<DirectPermissionMap>((acc, permission) => {
      if (!permission?.feature || !isPermissionFeature(permission.feature)) {
        return acc;
      }

      acc[permission.feature] = permission;
      return acc;
    }, {});
  }, [currentUser?.user_permissions]);

  const hasDirectPermission = (
    feature: PermissionFeature,
    action: PermissionAction | PermissionActionKey,
  ) => {
    const permission = directPermissions[feature];
    if (!permission) return false;

    const field = ACTION_FIELD_MAP[action as PermissionActionKey] ?? action;
    return Boolean(permission[field as PermissionAction]);
  };

  return {
    directPermissions,
    hasDirectPermission,
  };
};
