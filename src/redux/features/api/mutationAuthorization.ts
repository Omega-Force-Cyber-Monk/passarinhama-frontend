import type { FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import type { UserProfile } from '../auth/authTypes';
import { hasPermission, isActiveSuperuser, isActiveUser, type PermissionFeature } from '../auth/permissionUtils';
import { canCreateInResource, canModifyResource, canReplyToTopic, ORDINARY_ACCOUNT_FIELDS } from '../auth/resourceAuthorization';

// Locators only: never accept an owner or a permission decision from mutation args.
export interface AuthorizationContext {
  forumId?: string;
  topicId?: string;
  folderId?: string;
  feature?: PermissionFeature;
  resourceId?: string;
}
export type AuthorizedFetchArgs = FetchArgs & { clientAuthorization?: AuthorizationContext };
type Result = { data?: any; error?: FetchBaseQueryError };
type Read = (url: string) => Promise<Result>;

export const forbidden = (): FetchBaseQueryError => ({ status: 403, data: { detail: 'You do not have permission to perform this action.' } });

const administrative = new Set([
  'createForum', 'updateForum', 'deleteForum', 'updateFolder', 'deleteFolder',
  'createArticleCategory', 'updateArticleCategory', 'deleteArticleCategory',
  'createEventCategory', 'updateEventCategory', 'deleteEventCategory',
  'createTrainingCategory', 'updateTrainingCategory', 'deleteTrainingCategory',
  'createTechnicoProCategory', 'updateTechnicoProCategory', 'deleteTechnicoProCategory',
  'setArticlePermission', 'setForumPermission', 'setTrainingPermission', 'setTechnicoProPermission', 'updateFolderPermissionsBulk',
  'createUserRole', 'updateUserRole', 'deleteUserRole', 'createUserPermission', 'updateUserPermission',
  'createMemberPermission', 'updateMemberPermission', 'updateUser', 'deleteUser', 'softDeleteUser', 'restoreUser', 'validateUser',
  'pinTopic', 'moderatePost', 'deleteFile',
]);
const sensitiveReads = new Set([
  'getUserRoles', 'getUserPermissions', 'getMemberPermissions', 'getFolderPermissions',
  'getArticlePermissions', 'getTrainingPermissions', 'getTechnicoProPermissions', 'getForumPermissions',
  'getModerationQueue', 'getModerationLogs', 'exportUsersCsv',
]);
const readFeatures: Partial<Record<string, PermissionFeature>> = {
  getUsers: 'user', getUserById: 'user',
  getForums: 'forum', getForum: 'forum', getForumTopics: 'forum', getTopicPosts: 'forum', getPinnedTopics: 'forum',
  getArticles: 'article', getMyArticles: 'article', getArticleById: 'article', getArticleCategories: 'article',
  getEvents: 'event', getEventById: 'event', getUpcomingEvents: 'event', getCalendarStats: 'event', getEventCategories: 'event',
  getDocumentFolders: 'document', getDocuments: 'document', downloadDocument: 'document',
  getTrainingsPaginated: 'training', getAllTrainings: 'training', getTrainingById: 'training', getTrainingCategories: 'training',
  getTechnicoPros: 'technicopro', getMyTechnicoPros: 'technicopro', getTechnicoProById: 'technicopro', getTechnicoProCategories: 'technicopro',
};
export const needsAuthorization = (endpoint: string, args: AuthorizedFetchArgs): boolean => {
  const path = '/' + args.url.replace(/^\//, '').split('?')[0];
  if (path.startsWith('/auth/') && endpoint !== 'resetPassword') return false;
  return !['getUsersMe', 'getMe'].includes(endpoint);
};

// Pagination is bounded. An unresolved target is denied, never inferred from client state.
async function findInPages(read: Read, path: string, id: string): Promise<Result> {
  for (let page = 1; page <= 100; page++) {
    const result = await read(`${path}?page=${page}&page_size=100`);
    if (result.error) return result;
    const rows = result.data?.results;
    if (!Array.isArray(rows)) return { error: forbidden() };
    const target = rows.find((row: any) => row.id === id);
    if (target) return { data: target };
    if (!rows.length || (typeof result.data.total_pages === 'number' && page >= result.data.total_pages) ||
      (typeof result.data.total === 'number' && page * 100 >= result.data.total)) break;
  }
  return { error: forbidden() };
}

const resourcePaths: Partial<Record<PermissionFeature, string>> = {
  article: '/articles/articles', event: '/events/events', training: '/trainings/trainings', technicopro: '/technicopro/technicopros',
};
const contentWriteEndpoints = new Set([
  'createArticle', 'updateArticle', 'deleteArticle', 'publishArticle',
  'createEvent', 'updateEvent', 'deleteEvent',
  'createTraining', 'updateTraining', 'deleteTraining',
  'createTechnicoPro', 'updateTechnicoPro', 'deleteTechnicoPro', 'publishTechnicoPro',
]);

async function forumTarget(read: Read, context: AuthorizationContext, topicId: string): Promise<Result> {
  if (!context.forumId || !topicId) return { error: forbidden() };
  return findInPages(read, `/forums/forums/${encodeURIComponent(context.forumId)}/topics`, topicId);
}

async function postingAllowed(read: Read, user: UserProfile, forumId?: string): Promise<Result> {
  if (!forumId) return { error: forbidden() };
  const forum = await findInPages(read, '/forums/forums', forumId);
  if (forum.error) return forum;
  return canCreateInResource(user, 'forum', forum.data.can_post) ? forum : { error: forbidden() };
}

export async function authorizeRequest(
  endpoint: string, request: AuthorizedFetchArgs, user: UserProfile, read: Read,
): Promise<{ request?: FetchArgs; error?: FetchBaseQueryError }> {
  const { clientAuthorization: context = {}, ...args } = request;
  if (!isActiveUser(user)) return { error: forbidden() };
  const path = '/' + args.url.replace(/^\//, '').split('?')[0];
  if (administrative.has(endpoint) || sensitiveReads.has(endpoint) || path.startsWith('/settings/admin/') || path.startsWith('/admin&modarator/')) {
    return isActiveSuperuser(user) ? { request: args } : { error: forbidden() };
  }
  if (endpoint === 'getEventRegistrations') {
    if (isActiveSuperuser(user)) return { request: args };
    const target = await read(path.replace(/\/registrations$/, ''));
    if (target.error) return { error: target.error };
    return target.data?.id === path.split('/')[3] &&
      (canModifyResource(user, 'event', target.data, 'edit') || canModifyResource(user, 'event', target.data, 'delete'))
      ? { request: args } : { error: forbidden() };
  }
  if (['GET', 'HEAD'].includes((args.method || 'GET').toUpperCase())) {
    const feature = readFeatures[endpoint];
    return !feature || hasPermission(user, feature, 'view') ? { request: args } : { error: forbidden() };
  }
  if (endpoint === 'createUser') {
    if (!hasPermission(user, 'user', 'create')) return { error: forbidden() };
    if (!isActiveSuperuser(user)) {
      if (!(args.body instanceof FormData)) return { error: forbidden() };
      const body = new FormData();
      for (const key of ORDINARY_ACCOUNT_FIELDS) for (const value of args.body.getAll(key)) body.append(key, value);
      return { request: { ...args, body } };
    }
    return { request: args };
  }
  if (endpoint === 'uploadUserPhoto') {
    return path === `/user/users/${encodeURIComponent(user.id)}/photo_upload` || isActiveSuperuser(user)
      ? { request: args } : { error: forbidden() };
  }
  if (['updateUsersMe', 'resetPassword', 'updateNotificationPreference'].includes(endpoint)) return { request: args };
  if (['registerForEvent', 'unregisterFromEvent'].includes(endpoint)) {
    return hasPermission(user, 'event', 'view') ? { request: args } : { error: forbidden() };
  }
  if (endpoint === 'createFolder') {
    if (!hasPermission(user, 'document', 'create')) return { error: forbidden() };
    const parentId = args.body?.parent_id;
    if (!parentId || isActiveSuperuser(user)) return { request: args };
    const folder = await read(`/documents/documents?folder_id=${encodeURIComponent(parentId)}`);
    if (folder.error) return { error: folder.error };
    return folder.data?.folder?.id === parentId && canCreateInResource(user, 'document', folder.data.folder.can_upload)
      ? { request: args } : { error: forbidden() };
  }
  if (endpoint === 'uploadDocument') {
    if (!hasPermission(user, 'document', 'create')) return { error: forbidden() };
    const id = args.body instanceof FormData ? args.body.get('folder_id') : undefined;
    if (typeof id !== 'string' || !id) return { error: forbidden() };
    if (isActiveSuperuser(user)) return { request: args };
    const folder = await read(`/documents/documents?folder_id=${encodeURIComponent(id)}`);
    if (folder.error) return { error: folder.error };
    return folder.data?.folder?.id === id && canCreateInResource(user, 'document', folder.data.folder.can_upload)
      ? { request: args } : { error: forbidden() };
  }
  if (endpoint === 'createForumTopic') {
    if (!hasPermission(user, 'forum', 'create')) return { error: forbidden() };
    if (!isActiveSuperuser(user)) {
      const allowed = await postingAllowed(read, user, path.split('/')[3]);
      if (allowed.error) return { error: allowed.error };
    }
    return { request: args };
  }
  if (['createTopicPost', 'updateTopic', 'deleteTopic', 'updatePost', 'deletePost'].includes(endpoint)) {
    const action = endpoint.startsWith('create') ? 'create' : endpoint.startsWith('delete') ? 'delete' : 'edit';
    if (!hasPermission(user, 'forum', action)) return { error: forbidden() };
    if (isActiveSuperuser(user)) return { request: args };
    const topicId = endpoint === 'createTopicPost' || endpoint.endsWith('Topic') ? path.split('/')[3] : context.topicId;
    if (!topicId) return { error: forbidden() };
    const topic = await forumTarget(read, context, topicId);
    if (topic.error) return { error: topic.error };
    if (endpoint === 'createTopicPost') {
      const forum = await postingAllowed(read, user, context.forumId);
      if (forum.error) return { error: forum.error };
      return canReplyToTopic(user, forum.data.can_post, topic.data.is_locked) ? { request: args } : { error: forbidden() };
    }
    let target = topic.data;
    if (endpoint.endsWith('Post')) {
      const post = await findInPages(read, `/forums/topics/${encodeURIComponent(topicId)}/posts`, path.split('/')[3]);
      if (post.error) return { error: post.error };
      target = post.data;
    }
    // Without cascade authorization metadata, only empty topics can be deleted by ordinary owners.
    const safeDelete = endpoint !== 'deleteTopic' || topic.data.reply_count === 0;
    return canModifyResource(user, 'forum', target, action === 'delete' ? 'delete' : 'edit', safeDelete) ? { request: args } : { error: forbidden() };
  }
  if (['renameDocument', 'deleteDocument'].includes(endpoint)) {
    const action = endpoint === 'renameDocument' ? 'edit' : 'delete';
    if (!hasPermission(user, 'document', action)) return { error: forbidden() };
    if (isActiveSuperuser(user)) return { request: args };
    if (!context.folderId) return { error: forbidden() };
    const result = await read(`/documents/documents?folder_id=${encodeURIComponent(context.folderId)}`);
    if (result.error) return { error: result.error };
    const id = path.split('/').at(-1);
    const target = result.data?.folder?.id === context.folderId && result.data?.documents?.find((item: any) => item.id === id && item.folder_id === context.folderId);
    return canModifyResource(user, 'document', target, action) ? { request: args } : { error: forbidden() };
  }
  if (endpoint === 'uploadFile') {
    if (isActiveSuperuser(user)) return { request: args };
    // Shared uploader needs the editor's feature/target locator. File ownership is not inferred from URLs.
    const feature = context.feature;
    if (!feature || !['article', 'event', 'training', 'technicopro', 'forum'].includes(feature)) return { error: forbidden() };
    if (!context.resourceId) {
      if (!hasPermission(user, feature, 'create')) return { error: forbidden() };
      if (feature === 'forum' && !isActiveSuperuser(user)) {
        const forum = await postingAllowed(read, user, context.forumId);
        if (forum.error) return { error: forum.error };
        if (context.topicId) {
          const topic = await forumTarget(read, context, context.topicId);
          if (topic.error) return { error: topic.error };
          if (!canReplyToTopic(user, forum.data.can_post, topic.data.is_locked)) return { error: forbidden() };
        }
      }
      return { request: args };
    }
    if (feature === 'forum') {
      if (context.topicId) {
        const post = await findInPages(read, `/forums/topics/${encodeURIComponent(context.topicId)}/posts`, context.resourceId);
        if (post.error) return { error: post.error };
        return canModifyResource(user, feature, post.data, 'edit') ? { request: args } : { error: forbidden() };
      }
      const topic = await forumTarget(read, context, context.resourceId);
      if (topic.error) return { error: topic.error };
      return canModifyResource(user, feature, topic.data, 'edit') ? { request: args } : { error: forbidden() };
    }
    const target = await read(`${resourcePaths[feature]}/${encodeURIComponent(context.resourceId)}`);
    if (target.error) return { error: target.error };
    return target.data?.id === context.resourceId && canModifyResource(user, feature, target.data, 'edit') ? { request: args } : { error: forbidden() };
  }
  if (!contentWriteEndpoints.has(endpoint)) return { error: forbidden() };
  for (const [feature, base] of Object.entries(resourcePaths) as Array<[PermissionFeature, string]>) {
    if (path !== base && !path.startsWith(base + '/')) continue;
    if (path === base && args.method === 'POST') return hasPermission(user, feature, 'create') ? { request: args } : { error: forbidden() };
    const action = args.method === 'DELETE' ? 'delete' : 'edit';
    if (!hasPermission(user, feature, action)) return { error: forbidden() };
    if (isActiveSuperuser(user)) return { request: args };
    const id = path.slice(base.length + 1).split('/')[0];
    if (!id) return { error: forbidden() };
    const target = await read(`${base}/${encodeURIComponent(id)}`);
    if (target.error) return { error: target.error };
    return target.data?.id === id && canModifyResource(user, feature, target.data, action) ? { request: args } : { error: forbidden() };
  }
  // New write endpoints must choose an explicit policy; no permissive fallback.
  return { error: forbidden() };
}
