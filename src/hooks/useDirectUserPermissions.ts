import { useMemo } from 'react';
import { usePermissions } from './usePermissions';
import type { UserPermission } from '../redux/features/members/membersTypes';
import type {
  PermissionAction,
  PermissionActionKey,
  PermissionFeature,
} from '../redux/features/auth/permissionUtils';

type DirectPermissionMap = Partial<Record<PermissionFeature, UserPermission>>;

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
  const { user: currentUser, hasPermission } = usePermissions();

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
    // Legacy name retained for compatibility; checks use the same authoritative
    // decisions as routes and navigation, never raw management records.
    return hasPermission(feature, action);
  };

  return {
    directPermissions,
    hasDirectPermission,
  };
};
