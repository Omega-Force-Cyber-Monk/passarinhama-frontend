export type ForumType =
  | 'general'
  | 'professionnel'
  | 'professional'
  | 'commission'
  | string;

export type ForumPermissionRole =
  | 'admin'
  | 'moderator'
  | 'membre'
  | 'auditeur'
  | 'comite_coproprietaire'
  | 'partenaires_technicopro';

export interface Forum {
  id: string;
  slug?: string;
  name: string;
  description: string | null;
  type?: ForumType;
  forum_type: ForumType;
  author_name: string | null;
  created_at?: string;
  is_active?: boolean;
  thumbnail_url: string | null;
  readRoles: string[];
  writeRoles: string[];
}

export interface ForumListItem {
  id: string;
  name: string;
  slug: string;
  author_name: string | null;
  description: string | null;
  forum_type: ForumType;
  thumbnail_url: string | null;
  topic_count: number;
  post_count: number;
  last_activity_at: string | null;
  can_post: boolean;
}

export interface ForumDetails {
  id: string;
  slug: string;
  name: string;
  author_name: string | null;
  description: string | null;
  created_at: string;
  forum_type: ForumType;
  is_active: boolean;
  thumbnail_url: string | null;
}

export interface CreateForumRequest {
  name: string;
  author_name?: string | null;
  description?: string | null;
  forum_type?: ForumType | null;
  thumbnail?: File | null;
}

export interface UpdateForumRequest {
  forum_id: string;
  name?: string | null;
  author_name?: string | null;
  description?: string | null;
  forum_type?: ForumType | null;
  thumbnail?: File | null;
}

export interface SetForumPermissionRequest {
  forum_id: string[];
  role_id: string[];
  can_read: boolean;
  can_post: boolean;
}

export interface ForumPermission {
  id: string;
  forum_id: string;
  forum_name?: string;
  role_id: string;
  role_name?: string;
  can_read: boolean;
  can_post: boolean;
}

export interface BulkPermissionResponse {
  updated: number;
  permissions: ForumPermission[];
}

export interface ForumTopicAuthor {
  id: string;
  first_name: string;
  last_name: string;
}

export interface ForumTopicLastPost {
  id: string;
  content_preview: string;
  created_at: string;
  author: ForumTopicAuthor;
}

export interface ForumTopicListItem {
  id: string;
  title: string;
  content: string;
  attachment: string[];
  is_pinned: boolean;
  is_locked: boolean;
  view_count: number;
  reply_count: number;
  last_activity_at: string;
  created_at: string;
  author: ForumTopicAuthor;
  last_post: ForumTopicLastPost | null;
}

export interface PinnedTopic {
  id: string;
  title: string;
  content: string | null;
  attachment: string[] | null;
  is_pinned: boolean;
  is_locked: boolean;
  view_count: number;
  reply_count: number;
  last_activity_at: string;
  created_at: string;
  author: ForumTopicAuthor;
  forum: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface ForumTopicsResponse {
  total: number;
  page: number;
  page_size?: number;
  total_pages?: number;
  results: ForumTopicListItem[];
}

export interface GetForumTopicsQueryParams {
  forumId: string;
  page?: number;
  pageSize?: number;
}

export interface CreateForumTopicRequest {
  forum_id: string;
  title: string;
  content: string;
  files?: File[];
}

export interface ForumTopic {
  id: string;
  forum_id: string;
  title: string;
  content: string;
  author_id: string;
  attachment: string[] | null;
  reply_count: number;
  view_count: number;
  is_pinned: boolean;
  is_locked: boolean;
  last_activity_at: string;
  created_at: string;
}

export interface UpdateForumTopicRequest {
  topic_id: string;
  title?: string | null;
  content?: string | null;
  files?: File[];
  delete_files?: string[];
  forum_id?: string;
}

export interface PinTopicRequest {
  topic_id: string;
  pinned: boolean;
  forum_id?: string;
}

export interface TopicPostListItem {
  id: string;
  content: string;
  attachment: string[] | null;
  moderation_status: 'pending' | 'approved' | 'rejected' | 'flagged';
  created_at: string;
  updated_at: string;
  author: ForumTopicAuthor;
}

export interface TopicPostsResponse {
  total: number;
  page: number;
  page_size?: number;
  total_pages?: number;
  results: TopicPostListItem[];
}

export interface GetTopicPostsQueryParams {
  topicId: string;
  page?: number;
  pageSize?: number;
}

export interface CreateTopicPostRequest {
  topic_id: string;
  content: string;
  files?: File[];
  forum_id?: string;
}

export interface UpdateTopicPostRequest {
  post_id: string;
  topic_id: string;
  content: string;
  files?: File[];
  forum_id?: string;
}

export interface Topic {
  id: string;
  forumId: string;
  title: string;
  content: string;
  authorId: string;
  authorUserId?: string;
  createdAt: string;
  replyCount: number;
  viewCount: number;
  lastActivity: string;
  isPinned: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'flagged';
  attachments?: string[] | null;
}

export interface Post {
  id: string;
  topicId: string;
  authorId: string;
  authorUserId?: string;
  content: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'flagged';
  attachments?: string[] | null;
}

export interface Commission {
  id: string;
  name: string;
  description: string;
  presidentId: string;
  forumId: string;
}
