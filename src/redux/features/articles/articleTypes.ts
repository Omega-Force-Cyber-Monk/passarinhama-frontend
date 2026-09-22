import type { DynamicCategory } from '../api/apiTypes';

export type ArticleStatus = 'pending' | 'draft' | 'published' | 'archived';

export interface ArticleAttachment {
  url: string;
  original_name?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
}

export interface ArticleStructuredFields {
  file_urls?: Array<string | ArticleAttachment>;
  tags?: string[];
  author?: string;
  difficulty?: string;
  estimated_read_time_minutes?: number;
}

export interface ArticleCategory extends DynamicCategory {}

export interface ArticleAuthor {
  id: string;
  name: string;
  email: string;
}

export interface CreateArticleCategoryRequest {
  name: string;
  description?: string | null;
}

export interface UpdateArticleCategoryRequest {
  id: string;
  name: string;
  description?: string | null;
}

export interface Article {
  id: string;
  title: string;
  excerpt: string;
  body: string;
  category_id: string;
  status: ArticleStatus;
  thumbnail_url?: string | null;
  pdf_url: string | null;
  attachments?: ArticleAttachment[] | null;
  author_id: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  structured_fields: ArticleStructuredFields;
  author?: ArticleAuthor;
  category?: ArticleCategory;
}

export interface ArticlePermission {
  id: string;
  article_id: string;
  article_title?: string;
  role_id: string;
  role_name?: string;
  can_read: boolean;
  can_write: boolean;
}

export interface SetArticlePermissionRequest {
  article_id: string[];
  role_id: string[];
  can_read: boolean;
  can_write: boolean;
}

export interface BulkArticlePermissionResponse {
  updated: number;
  permissions: ArticlePermission[];
}

export interface PaginatedArticles {
  total: number;
  page: number;
  page_size?: number;
  total_pages?: number;
  results: Article[];
}

export interface GetArticlesQueryParams {
  page?: number;
  pageSize?: number;
  status?: ArticleStatus;
  category_id?: string;
  search?: string;
  details?: boolean;
}

export interface CreateArticleRequest {
  title: string;
  category_id: string;
  excerpt: string;
  body: string;
  status?: ArticleStatus;
  thumbnail?: File | null;
  structured_fields?: ArticleStructuredFields | string;
  files?: File[];
  remove_file_urls?: string;
}

export interface PublishArticleResponse {
  status: string;
}

export interface FileUploadResponse {
  url: string;
}

export interface FileDeleteResponse {
  deleted: string[];
}
