import React from 'react';
import { useSelector } from 'react-redux';
import { Navigate, useLocation } from 'react-router-dom';
import { RootState } from '../redux/store';
import LoadingIndicator from './ui/LoadingIndicator';
import SessionError from './SessionError';
import { isActiveUser } from '../redux/features/auth/permissionUtils';
import AccessRestrictedNotice from './ui/AccessRestrictedNotice';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { status, user } = useSelector((state: RootState) => state.auth);
  const location = useLocation();
  if (status === 'initializing') return <LoadingIndicator fullScreen />;
  if (status === 'error') return <SessionError />;

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!isActiveUser(user)) return <AccessRestrictedNotice />;

  return <>{children}</>;
};

export default ProtectedRoute;
