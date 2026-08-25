export interface UserShort {
  id: string;
  first_name: string;
  last_name: string;
}

export interface ModeratedPostShort {
  id: string;
  content: string;
  author: UserShort;
  author_name: string | null;
}

export interface ModerationLog {
  id: string;
  action: string;
  reason: string | null;
  acted_at: string;
  moderator: UserShort;
  post: ModeratedPostShort;
}

export interface ModerationLogsResponse {
  total: number;
  page: number;
  page_size?: number;
  total_pages?: number;
  results: ModerationLog[];
}

export interface ModerationTopicShort {
  id: string;
  title: string;
  forum: string;
}

export interface ModerationQueueItem {
  id: string;
  content: string;
  moderation_status: string;
  created_at: string;
  author: UserShort;
  author_name: string | null;
  topic: ModerationTopicShort;
  attachment?: string[];
  attachments?: string[];
}

export interface ModerationQueueResponse {
  total: number;
  page: number;
  page_size?: number;
  total_pages?: number;
  results: ModerationQueueItem[];
}

export interface ModeratePostRequest {
  action: 'flag' | 'approve' | 'reject' | 'forward';
}

export interface ModeratePostResponse {
  post_id: string;
  status: string;
  action: string;
}
