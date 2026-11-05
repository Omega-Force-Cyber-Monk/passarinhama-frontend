import React from 'react';
import LoadingIndicator from './ui/LoadingIndicator';
import AccessRestrictedNotice from './ui/AccessRestrictedNotice';
import SessionError from './SessionError';
import { usePermissions } from '../hooks/usePermissions';
import type { UserProfile } from '../redux/features/auth/authTypes';
import type {
  PermissionAction,
  PermissionActionKey,
  PermissionFeature,
} from '../redux/features/auth/permissionUtils';

interface PermissionRouteProps {
  children: React.ReactNode;
  feature?: PermissionFeature;
  action?: PermissionAction | PermissionActionKey;
  allow?: (user: UserProfile | null) => boolean;
}

const PermissionRoute: React.FC<PermissionRouteProps> = ({
  children,
  feature,
  action = 'view',
  allow,
}) => {
  const { user, hasPermission, isLoading, isError } = usePermissions();

  if (isLoading) return <LoadingIndicator />;
  if (isError) return <SessionError />;

  const isAllowed = allow
    ? allow(user)
    : feature
      ? hasPermission(feature, action)
      : true;

  if (!isAllowed) {
    return <AccessRestrictedNotice />;
  }

  return <>{children}</>;
};

export default PermissionRoute;
