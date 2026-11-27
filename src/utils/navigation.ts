import type { UserProfile } from '../redux/features/auth/authTypes';
import { canAccessAdminPanel, canAccessFeature, type PermissionFeature } from '../redux/features/auth/permissionUtils';

export const HOME_CONTENT_FEATURES: readonly PermissionFeature[] = ['forum', 'event', 'training', 'article'];

// Sidebar order also defines the authenticated landing destination.
export const NAVIGATION_ITEMS = [
  { path: '/', label: 'common.home', icon: 'Home' },
  { path: '/agenda', label: 'common.agenda', icon: 'Calendar', feature: 'event' },
  { path: '/articles', label: 'common.articles', icon: 'FileText', feature: 'article' },
  { path: '/forums', label: 'common.forums', icon: 'MessageSquare', feature: 'forum' },
  { path: '/trainings', label: 'common.training', icon: 'BookOpen', feature: 'training' },
  { path: '/technicopro', label: 'common.technicopro', icon: 'Wrench', feature: 'technicopro' },
  { path: '/documents', label: 'common.documents', icon: 'FolderOpen', feature: 'document' },
  { path: '/directory', label: 'common.members', icon: 'Users', feature: 'user' },
  { path: '/admin', label: 'common.administration', icon: 'Settings' },
] as const;

export const canViewHome = (user: UserProfile | null | undefined): boolean =>
  HOME_CONTENT_FEATURES.some(feature => canAccessFeature(user, feature));

export const getVisibleNavigation = (user: UserProfile | null | undefined) =>
  NAVIGATION_ITEMS.filter(item => item.path === '/' ? canViewHome(user)
    : 'feature' in item ? canAccessFeature(user, item.feature) : canAccessAdminPanel(user));

export const getDefaultDestination = (user: UserProfile | null | undefined): string | null =>
  getVisibleNavigation(user)[0]?.path ?? null;
