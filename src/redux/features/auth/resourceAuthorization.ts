import type { UserProfile } from './authTypes';
import { hasPermission, isActiveSuperuser, type PermissionFeature } from './permissionUtils';

type Resource = Record<string, any> | null | undefined;

// Folder responses have no creator or delete-specific capability. Their delete
// action uses the existing document.delete grant on a server-visible folder;
// can_upload only controls creation/upload, never deletion.
export const canDeleteFolder = (user: UserProfile | null | undefined, folder: Resource): boolean =>
  Boolean(folder?.id && hasPermission(user, 'document', 'delete'));

export const findFolder = <T extends { id: string; children?: T[] }>(folders: T[], id: string): T | undefined => {
  for (const folder of folders) {
    if (folder.id === id) return folder;
    const child = folder.children && findFolder(folder.children, id);
    if (child) return child;
  }
};

// Only identity fields in existing API responses qualify. Display author text never does.
export const getResourceOwnerId = (feature: PermissionFeature, resource: Resource): string | undefined => {
  let id: unknown;
  switch (feature) {
    case 'article': id = resource?.author?.id; break;
    case 'event':
    case 'training': id = resource?.created_by?.id; break;
    case 'document': id = resource?.uploaded_by?.id; break;
    case 'technicopro': {
      if (resource?.author?.id && resource?.author_id && resource.author.id !== resource.author_id) return;
      id = resource?.author?.id ?? resource?.author_id;
      break;
    }
    case 'forum': id = resource?.author?.id ?? resource?.author_id; break;
    // Account and container ownership is not part of the current contract.
    default: return;
  }
  return typeof id === 'string' && id.length > 0 ? id : undefined;
};

export const canModifyResource = (
  user: UserProfile | null | undefined,
  feature: PermissionFeature,
  resource: Resource,
  action: 'edit' | 'delete',
  restriction = true,
): boolean => {
  if (!resource?.id || !hasPermission(user, feature, action)) return false;
  if (isActiveSuperuser(user)) return true;
  return restriction === true && (!Object.hasOwn(resource, 'can_write') || resource.can_write === true) &&
    getResourceOwnerId(feature, resource) === user?.id;
};

export const canCreateInResource = (
  user: UserProfile | null | undefined,
  feature: PermissionFeature,
  allowed: unknown,
): boolean => hasPermission(user, feature, 'create') &&
  (isActiveSuperuser(user) || allowed === true);

export const canReplyToTopic = (
  user: UserProfile | null | undefined,
  canPost: unknown,
  locked: unknown,
): boolean => canCreateInResource(user, 'forum', canPost === true && locked === false);

// Explicit allowlist: no role, superuser, status, payment, or permission assignments.
export const ORDINARY_ACCOUNT_FIELDS = [
  'email', 'password', 'first_name', 'last_name', 'phone', 'mobile',
  'address', 'city', 'society', 'department', 'avatar',
] as const;

export const ordinaryAccountPayload = <T extends object>(input: T): Partial<T> =>
  Object.fromEntries(ORDINARY_ACCOUNT_FIELDS.filter((key) => Object.hasOwn(input, key))
    .map((key) => [key, (input as Record<string, unknown>)[key]])) as Partial<T>;
