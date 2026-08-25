import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import {
  PermissionAction,
  PermissionActionKey,
  PermissionFeature,
  canAccessAdminPanel,
  canAccessFeature,
  canAccessModeration,
  getMergedPermissions,
  hasAnyPermission,
  hasPermission,
} from '../redux/features/auth/permissionUtils';

export const usePermissions = () => {
  const user = useSelector((state: RootState) => state.auth.user);
  const permissions = getMergedPermissions(user);

  return {
    user,
    permissions,
    hasPermission: (
      feature: PermissionFeature,
      action: PermissionAction | PermissionActionKey,
    ) => hasPermission(user, feature, action),
    hasAnyPermission: (
      feature: PermissionFeature,
      actions?: Array<PermissionAction | PermissionActionKey>,
    ) => hasAnyPermission(user, feature, actions),
    canAccessFeature: (feature: PermissionFeature) =>
      canAccessFeature(user, feature),
    canAccessAdminPanel: canAccessAdminPanel(user),
    canAccessModeration: canAccessModeration(user),
  };
};
