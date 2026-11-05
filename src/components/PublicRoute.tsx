import React from 'react';
import { useSelector } from 'react-redux';
import { Navigate, useLocation } from 'react-router-dom';
import { RootState } from '../redux/store';
import LoadingIndicator from './ui/LoadingIndicator';
import SessionError from './SessionError';
import { authDestination } from '../utils/authDestination';

interface PublicRouteProps {
  children: React.ReactNode;
}

const PublicRoute: React.FC<PublicRouteProps> = ({ children }) => {
  const { status } = useSelector((state: RootState) => state.auth);
  const location = useLocation();
  if (status === 'initializing') return <LoadingIndicator fullScreen />;
  if (status === 'error') return <SessionError />;

  if (status === 'authenticated') {
    return <Navigate to={authDestination(location.state?.from)} replace />;
  }

  return <>{children}</>;
};

export default PublicRoute;
