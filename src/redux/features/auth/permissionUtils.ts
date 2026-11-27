import {
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

export const isActiveUser = (user: UserProfile | null | undefined): user is UserProfile =>
  Boolean(typeof user?.id === 'string' && user.id.trim() && user.status === 'active' && user.is_deleted === false);

export const isActiveSuperuser = (user: UserProfile | null | undefined): boolean =>
  isActiveUser(user) && user.is_superuser === true;

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
  (Array.isArray(permissions) ? permissions : []).filter(
    (permission): permission is FeaturePermission =>
      Boolean(permission?.feature) && isPermissionFeature(permission.feature),
  );

export const getMergedPermissions = (
  user: UserProfile | null | undefined,
): PermissionMap => {
  const basePermissions = PERMISSION_FEATURES.reduce((acc, feature) => {
    acc[feature] = isActiveSuperuser(user)
      ? buildSuperuserPermission(feature)
      : buildEmptyPermission(feature);
    return acc;
  }, {} as PermissionMap);

  if (!user || user.is_superuser) {
    return basePermissions;
  }

  // The backend publishes the final action decisions in permissions. Do not
  // merge raw role/direct rows here: that can reverse the server's decisions.
  normalizePermissions(user.permissions).forEach((permission) => {
    const normalized = buildEmptyPermission(permission.feature);
    PERMISSION_ACTIONS.forEach((action) => {
      normalized[action] = permission[action] === true;
    });
    basePermissions[permission.feature] = normalized;
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
  if (!isActiveUser(user)) return false;
  if (isActiveSuperuser(user)) return true;

  const permission = getPermissionForFeature(user, feature);
  const field = ACTION_FIELD_MAP[action as PermissionActionKey] ?? action;

  return permission[field as PermissionAction] === true;
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
  isActiveSuperuser(user);

export const canAccessModeration = (user: UserProfile | null | undefined) =>
  isActiveSuperuser(user);

export const hasRole = (
  user: UserProfile | null | undefined,
  allowedRoleSlugs: string[],
): boolean => {
  if (!isActiveUser(user)) return false;
  if (isActiveSuperuser(user)) return true;

  const roleSlug = normalizeRoleSlug(user.role_details?.slug || user.role);
  return allowedRoleSlugs.map(normalizeRoleSlug).includes(roleSlug);
};
