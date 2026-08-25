import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
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
  redirectTo?: string;
}

const PermissionRoute: React.FC<PermissionRouteProps> = ({
  children,
  feature,
  action = 'view',
  allow,
  redirectTo = '/dashboard',
}) => {
  const location = useLocation();
  const { user, canAccessFeature, hasPermission } = usePermissions();

  const isAllowed = allow
    ? allow(user)
    : feature
      ? action
        ? hasPermission(feature, action)
        : canAccessFeature(feature)
      : true;

  if (!isAllowed) {
    return (
      <Navigate
        to={redirectTo}
        replace
        state={{ from: location }}
      />
    );
  }

  return <>{children}</>;
};

export default PermissionRoute;
