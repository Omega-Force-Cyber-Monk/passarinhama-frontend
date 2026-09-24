import React, { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import RouteError from '../components/RouteError';


// Lazy load pages
const Home = lazy(() => import('../pages/Home'));
const Login = lazy(() => import('../pages/Login'));
const Signup = lazy(() => import('../pages/Signup'));
const ForgotPassword = lazy(() => import('../pages/ForgotPassword'));
const OTPVerification = lazy(() => import('../pages/OTPVerification'));
const MemberDirectory = lazy(() => import('../pages/MemberDirectory'));
const Forums = lazy(() => import('../pages/Forums'));
const Articles = lazy(() => import('../pages/Articles'));
const Agenda = lazy(() => import('../pages/Agenda/Agenda'));
const Events = lazy(() => import('../pages/Events'));
const Trainings = lazy(() => import('../pages/Trainings'));
const TrainingDetail = lazy(() => import('../pages/TrainingDetail'));
const TechnicoPro = lazy(() => import('../pages/TechnicoPro'));
const TechnicoProDetail = lazy(() => import('../pages/TechnicoProDetail'));
const DocumentLibrary = lazy(() => import('../pages/DocumentLibrary'));
const AdminPanel = lazy(() => import('../pages/AdminPanel'));
const Profile = lazy(() => import('../pages/Profile'));
const ArticleDetail = lazy(() => import('../pages/ArticleDetail'));

const LoadingFallback = () => (
  <div className="flex min-h-[40vh] items-center justify-center px-6">
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-600 shadow-sm">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <span>Loading page...</span>
    </div>
  </div>
);

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
