import React, { Suspense } from 'react';
import { lazyPage } from '../utils/lazyPage';
import LoadingIndicator from '../components/ui/LoadingIndicator';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import RouteError from '../components/RouteError';


// Lazy load pages
const Home = lazyPage(() => import('../pages/Home'));
const Login = lazyPage(() => import('../pages/Login'));
const Signup = lazyPage(() => import('../pages/Signup'));
const ForgotPassword = lazyPage(() => import('../pages/ForgotPassword'));
const OTPVerification = lazyPage(() => import('../pages/OTPVerification'));
const MemberDirectory = lazyPage(() => import('../pages/MemberDirectory'));
const Forums = lazyPage(() => import('../pages/Forums'));
const Articles = lazyPage(() => import('../pages/Articles'));
const Agenda = lazyPage(() => import('../pages/Agenda/Agenda'));
const Events = lazyPage(() => import('../pages/Events'));
const Trainings = lazyPage(() => import('../pages/Trainings'));
const TrainingDetail = lazyPage(() => import('../pages/TrainingDetail'));
const TechnicoPro = lazyPage(() => import('../pages/TechnicoPro'));
const TechnicoProDetail = lazyPage(() => import('../pages/TechnicoProDetail'));
const DocumentLibrary = lazyPage(() => import('../pages/DocumentLibrary'));
const AdminPanel = lazyPage(() => import('../pages/AdminPanel'));
const Profile = lazyPage(() => import('../pages/Profile'));
const ArticleDetail = lazyPage(() => import('../pages/ArticleDetail'));

const LoadingFallback = LoadingIndicator;

import ProtectedRoute from '../components/ProtectedRoute';
import PublicRoute from '../components/PublicRoute';
import PermissionRoute from '../components/PermissionRoute';
import { canAccessAdminPanel } from '../redux/features/auth/permissionUtils';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <PublicRoute><Suspense fallback={<LoadingFallback />}><Login /></Suspense></PublicRoute>,
    errorElement: <RouteError />,
  },
  {
    path: '/signup',
    element: <PublicRoute><Suspense fallback={<LoadingFallback />}><Signup /></Suspense></PublicRoute>,
    errorElement: <RouteError />,
  },
  {
    path: '/forgot-password',
    element: <PublicRoute><Suspense fallback={<LoadingFallback />}><ForgotPassword /></Suspense></PublicRoute>,
    errorElement: <RouteError />,
  },
  {
    path: '/verify-otp',
    element: <Suspense fallback={<LoadingFallback />}><OTPVerification /></Suspense>,
    errorElement: <RouteError />,
  },
  {
    path: '/',
    element: <ProtectedRoute><DashboardLayout /></ProtectedRoute>,
    errorElement: <RouteError />,
    children: [
      {
        index: true,
        element: <Home />,
        errorElement: <RouteError />,
      },
      
      {
        path: 'directory',
        element: <PermissionRoute feature="user"><MemberDirectory /></PermissionRoute>,
        errorElement: <RouteError />,
      },
      {
        path: 'forums',
        element: <PermissionRoute feature="forum"><Forums /></PermissionRoute>,
        errorElement: <RouteError />,
      },
      {
        path: 'forums/:forumId',
        element: <PermissionRoute feature="forum"><Forums /></PermissionRoute>,
        errorElement: <RouteError />,
      },
      {
        path: 'forums/:forumId/topics/:topicId',
        element: <PermissionRoute feature="forum"><Forums /></PermissionRoute>,
        errorElement: <RouteError />,
      },
      {
        path: 'articles',
        element: <PermissionRoute feature="article"><Articles /></PermissionRoute>,
        errorElement: <RouteError />,
      },
      {
        path: 'articles/category/:categoryId',
        element: <PermissionRoute feature="article"><Articles /></PermissionRoute>,
        errorElement: <RouteError />,
      },
      {
        path: 'articles/:slug',
        element: <PermissionRoute feature="article"><ArticleDetail /></PermissionRoute>,
        errorElement: <RouteError />,
      },
      {
        path: 'agenda',
        element: <PermissionRoute feature="event"><Agenda /></PermissionRoute>,
        errorElement: <RouteError />,
      },
      {
        path: 'agenda/:agendaId',
        element: <PermissionRoute feature="event"><Agenda /></PermissionRoute>,
        errorElement: <RouteError />,
      },
      {
        path: 'events',
        element: <PermissionRoute feature="event"><Events /></PermissionRoute>,
        errorElement: <RouteError />,
      },
      {
        path: 'events/:eventId',
        element: <PermissionRoute feature="event"><Events /></PermissionRoute>,
        errorElement: <RouteError />,
      },
      {
        path: 'trainings',
        element: <PermissionRoute feature="training"><Trainings /></PermissionRoute>,
        errorElement: <RouteError />,
      },
      {
        path: 'trainings/category/:categoryId',
        element: <PermissionRoute feature="training"><Trainings /></PermissionRoute>,
        errorElement: <RouteError />,
      },
      {
        path: 'trainings/:trainingId',
        element: <PermissionRoute feature="training"><TrainingDetail /></PermissionRoute>,
        errorElement: <RouteError />,
      },
      {
        path: 'technicopro',
        element: <PermissionRoute feature="technicopro"><TechnicoPro /></PermissionRoute>,
        errorElement: <RouteError />,
      },
      {
        path: 'technicopro/category/:categoryId',
        element: <PermissionRoute feature="technicopro"><TechnicoPro /></PermissionRoute>,
        errorElement: <RouteError />,
      },
      {
        path: 'technicopro/:technicoproId',
        element: <PermissionRoute feature="technicopro"><TechnicoProDetail /></PermissionRoute>,
        errorElement: <RouteError />,
      },
      {
        path: 'documents',
        element: <PermissionRoute feature="document"><DocumentLibrary /></PermissionRoute>,
        errorElement: <RouteError />,
      },
      {
        path: 'documents/folder/:folderId',
        element: <PermissionRoute feature="document"><DocumentLibrary /></PermissionRoute>,
        errorElement: <RouteError />,
      },
      {
        path: 'documents/folder/:folderId/file/:fileId',
        element: <PermissionRoute feature="document"><DocumentLibrary /></PermissionRoute>,
        errorElement: <RouteError />,
      },
      
      {
        path: 'admin',
        element: <PermissionRoute allow={canAccessAdminPanel}><AdminPanel /></PermissionRoute>,
        errorElement: <RouteError />,
      },
      {
        path: 'profile',
        element: <Profile />,
        errorElement: <RouteError />,
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
