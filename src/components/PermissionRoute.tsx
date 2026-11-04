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
  redirectTo = '/',
}) => {
  const location = useLocation();
  const { user, hasPermission, isLoading } = usePermissions();

  if (isLoading) return <div role="status" className="flex min-h-[40vh] items-center justify-center"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  const isAllowed = allow
    ? allow(user)
    : feature
      ? hasPermission(feature, action)
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
