import {
  ROLE_SLUGS,
  normalizeRoleSlug,
  type UserProfile,
  type UserPermission,
} from './authTypes';

export const PERMISSION_FEATURES = [
  'article',
  'document',
  'event',
  'forum',
  'training',
  'technicopro',
  'user',
] as const;

export type PermissionFeature = (typeof PERMISSION_FEATURES)[number];

export const PERMISSION_ACTIONS = [
  'can_view',
  'can_create',
  'can_edit',
  'can_delete',
] as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export type PermissionActionKey = 'view' | 'create' | 'edit' | 'delete';

type PermissionMap = Record<PermissionFeature, UserPermission>;

const ACTION_FIELD_MAP: Record<PermissionActionKey, PermissionAction> = {
  view: 'can_view',
  create: 'can_create',
  edit: 'can_edit',
  delete: 'can_delete',
};

const buildEmptyPermission = (feature: PermissionFeature): UserPermission => ({
  feature,
  can_view: false,
  can_create: false,
  can_edit: false,
  can_delete: false,
});

const isPermissionFeature = (feature: string): feature is PermissionFeature =>
  PERMISSION_FEATURES.includes(feature as PermissionFeature);

type FeaturePermission = UserPermission & { feature: PermissionFeature };

const buildSuperuserPermission = (feature: PermissionFeature): UserPermission => ({
  feature,
  can_view: true,
  can_create: true,
  can_edit: true,
  can_delete: true,
});

const normalizePermissions = (
  permissions: UserPermission[] | undefined,
): FeaturePermission[] =>
  (permissions ?? []).filter(
    (permission): permission is FeaturePermission =>
      Boolean(permission?.feature) && isPermissionFeature(permission.feature),
  );

export const getMergedPermissions = (
  user: UserProfile | null | undefined,
): PermissionMap => {
  const basePermissions = PERMISSION_FEATURES.reduce((acc, feature) => {
    acc[feature] = user?.is_superuser
      ? buildSuperuserPermission(feature)
      : buildEmptyPermission(feature);
    return acc;
  }, {} as PermissionMap);

  if (!user || user.is_superuser) {
    return basePermissions;
  }

  normalizePermissions(user?.permissions).forEach((permission) => {
    basePermissions[permission.feature] = {
      ...buildEmptyPermission(permission.feature),
      ...Object.fromEntries(
        Object.entries(permission).filter(([, value]) => value !== null && value !== undefined),
      ),
    };
  });

  normalizePermissions(user?.user_permissions).forEach((permission) => {
    const nextPermission = { ...basePermissions[permission.feature] };

    PERMISSION_ACTIONS.forEach((action) => {
      if (permission[action] !== null && permission[action] !== undefined) {
        nextPermission[action] = permission[action];
      }
    });

    basePermissions[permission.feature] = {
      ...nextPermission,
      id: permission.id,
      role_id: permission.role_id,
      user_id: permission.user_id,
      feature: permission.feature,
    };
  });

  return basePermissions;
};

export const getPermissionForFeature = (
  user: UserProfile | null | undefined,
  feature: PermissionFeature,
): UserPermission => getMergedPermissions(user)[feature];

export const hasPermission = (
  user: UserProfile | null | undefined,
  feature: PermissionFeature,
  action: PermissionAction | PermissionActionKey,
): boolean => {
  if (!user) return false;
  if (user.is_superuser) return true;
  if (user.is_deleted || user.status !== 'active') return false;

  const permission = getPermissionForFeature(user, feature);
  const field = ACTION_FIELD_MAP[action as PermissionActionKey] ?? action;

  return Boolean(permission[field as PermissionAction]);
};

export const hasAnyPermission = (
  user: UserProfile | null | undefined,
  feature: PermissionFeature,
  actions: Array<PermissionAction | PermissionActionKey> = [
    'can_view',
    'can_create',
    'can_edit',
    'can_delete',
  ],
): boolean => actions.some((action) => hasPermission(user, feature, action));

export const canAccessFeature = (
  user: UserProfile | null | undefined,
  feature: PermissionFeature,
): boolean => hasPermission(user, feature, 'view');

export const canAccessAdminPanel = (user: UserProfile | null | undefined) =>
  Boolean(user?.is_superuser);

export const canAccessModeration = (user: UserProfile | null | undefined) =>
  Boolean(user?.is_superuser) ||
  (!user?.is_deleted &&
    user?.status === 'active' &&
    normalizeRoleSlug(user?.role_details?.slug || user?.role) === ROLE_SLUGS.MODERATOR);

export const hasRole = (
  user: UserProfile | null | undefined,
  allowedRoleSlugs: string[],
): boolean => {
  if (!user) return false;
  if (user.is_superuser) return true;
  if (user.is_deleted || user.status !== 'active') return false;

  const roleSlug = normalizeRoleSlug(user.role_details?.slug || user.role);
  return allowedRoleSlugs.map(normalizeRoleSlug).includes(roleSlug);
};
