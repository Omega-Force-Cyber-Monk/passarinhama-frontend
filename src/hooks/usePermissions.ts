import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import { canCreateInResource, canModifyResource, canReplyToTopic } from '../redux/features/auth/resourceAuthorization';
import type { UserProfile } from '../redux/features/auth/authTypes';
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
  const auth = useSelector((state: RootState) => state.auth);
  const ready = auth.status === 'authenticated' && auth.permissionsStatus === 'ready';
  const user: UserProfile | null = ready ? auth.user : null;
  const permissions = getMergedPermissions(user);

  return {
    user,
    ready,
    isLoading: auth.status === 'initializing' || auth.permissionsStatus === 'loading',
    isError: auth.status === 'error',
    permissions,
    canModify: (feature: PermissionFeature, resource: Record<string, any> | null | undefined, action: 'edit' | 'delete', restriction = true) =>
      canModifyResource(user, feature, resource, action, restriction),
    canCreateIn: (feature: PermissionFeature, allowed: unknown) => canCreateInResource(user, feature, allowed),
    canReply: (canPost: unknown, locked: unknown) => canReplyToTopic(user, canPost, locked),
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
