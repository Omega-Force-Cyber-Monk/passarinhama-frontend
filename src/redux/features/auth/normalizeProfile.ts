import type { UserProfile, UserProfileApiResponse } from './authTypes';

// One normalization boundary for hydration, authorization preflights and self updates.
export const normalizeUserProfile = (user: UserProfileApiResponse | UserProfile): UserProfile => ({
  ...user,
  role: typeof user.role === 'string' ? user.role : user.role?.slug || user.role?.name || '',
  role_details: typeof user.role === 'string' ? ('role_details' in user ? user.role_details : null) : user.role,
  is_superuser: user.is_superuser ?? false,
  permissions: user.permissions ?? [],
  user_permissions: user.user_permissions ?? [],
});
