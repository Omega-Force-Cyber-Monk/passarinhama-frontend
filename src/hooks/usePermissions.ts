import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import { useGetUsersMeQuery } from '../redux/features/members/membersApi';
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
  const profile = useGetUsersMeQuery(undefined, { skip: !auth.isAuthenticated || !auth.token, refetchOnMountOrArgChange: 30 });
  const ready = Boolean(auth.isAuthenticated && auth.token && profile.isSuccess &&
    !profile.isFetching && !profile.isError && profile.currentData?.id === auth.user?.id);
  const user: UserProfile | null = ready ? profile.currentData as UserProfile : null;
  const permissions = getMergedPermissions(user);

  return {
    user,
    ready,
    isLoading: Boolean(auth.isAuthenticated && !profile.isError && (profile.isLoading || profile.isFetching)),
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
