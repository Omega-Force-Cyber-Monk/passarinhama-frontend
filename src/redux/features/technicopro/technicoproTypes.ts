import type { DynamicCategory, PaginatedResponse } from "../api/apiTypes";

export type TechnicoProStatus = "draft" | "pending" | "published";

export interface TechnicoProCategory extends DynamicCategory {}

export interface TechnicoProStructuredFields {
  file_urls?: Array<string | TechnicoProAttachment>;
  tags?: string[];
  author?: string;
  difficulty?: string;
  estimated_read_time_minutes?: number;
}

export interface TechnicoProAttachment {
  url: string;
  original_name?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
}

export interface TechnicoProAuthor {
  id: string;
  name: string;
  email: string;
}

export interface TechnicoPro {
  id: string;
  title: string;
  excerpt: string;
  body: string;
  category_id?: string | null;
  category: TechnicoProCategory | null;
  status: TechnicoProStatus;
  thumbnail_url?: string | null;
  author?: TechnicoProAuthor | null;
  author_id?: string | null;
  published_at?: string | null;
  created_at: string;
  updated_at?: string | null;
  structured_fields?: TechnicoProStructuredFields | null;
}

export interface TechnicoProPermission {
  id: string;
  technicopro_id: string;
  technicopro_title?: string;
  role_id: string;
  role_name?: string;
  can_read: boolean;
  can_write: boolean;
}

export interface SetTechnicoProPermissionRequest {
  technicopro_id: string[];
  role_id: string[];
  can_read: boolean;
  can_write: boolean;
}

export interface BulkTechnicoProPermissionResponse {
  updated: number;
  permissions: TechnicoProPermission[];
}

export type PaginatedTechnicoPros = PaginatedResponse<TechnicoPro>;

export interface GetTechnicoProsQueryParams {
  page?: number;
  pageSize?: number;
  status?: TechnicoProStatus;
  category_id?: string;
  search?: string;
  details?: boolean;
}

export interface TechnicoProRequest {
  title: string;
  category_id: string;
  excerpt: string;
  body: string;
  status?: TechnicoProStatus;
  thumbnail?: File | null;
  structured_fields?: TechnicoProStructuredFields | string;
  files?: File[];
  remove_file_urls?: string;
}

export interface CreateTechnicoProCategoryRequest {
  name: string;
  description?: string | null;
}

export interface UpdateTechnicoProCategoryRequest {
  id: string;
  name: string;
  description?: string | null;
}

export interface PublishTechnicoProResponse {
  status: TechnicoProStatus;
}
