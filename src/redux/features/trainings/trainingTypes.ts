import type { DynamicCategory, PaginatedResponse } from "../api/apiTypes";

export type TrainingStatus = "draft" | "pending" | "published";

export interface TrainingCategory extends DynamicCategory {}

export interface TrainingAttachment {
  url: string;
  original_name?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
}

export interface Training {
  id: string;
  title: string;
  excerpt?: string | null;
  description: string;
  instructor_name?: string | null;
  format?: string | null;
  training_date?: string | null;
  end_date?: string | null;
  duration_hours?: number | null;
  max_attendees?: number | null;
  attendee_count?: number | null;
  spots_left?: number | null;
  is_at_capacity?: boolean | null;
  is_registered?: boolean | null;
  category_id?: string | null;
  category: TrainingCategory | null;
  status: TrainingStatus;
  thumbnail_url: string | null;
  attachments?: Array<string | TrainingAttachment> | null;
  published_at?: string | null;
  created_at: string;
  updated_at?: string | null;
  created_by?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
}

export interface TrainingRequest {
  title: string;
  excerpt?: string;
  description: string;
  category_id: string;
  instructor_name?: string;
  format?: string;
  training_date?: string;
  end_date?: string;
  duration_hours?: number;
  max_attendees?: number;
  thumbnail?: File | null;
  status?: TrainingStatus;
  attachments?: File[];
  new_attachments?: File[];
  remove_attachment_urls?: string[];
}

export interface TrainingPermission {
  id: string;
  training_id: string;
  training_name?: string;
  role_id: string;
  role_name?: string;
  can_read: boolean;
  can_write: boolean;
}

export interface SetTrainingPermissionRequest {
  training_id: string[];
  role_id: string[];
  can_read: boolean;
  can_write: boolean;
}

export interface BulkTrainingPermissionResponse {
  updated: number;
  permissions: TrainingPermission[];
}

export type PaginatedTrainings = PaginatedResponse<Training>;

export interface GetTrainingsQueryParams {
  page?: number;
  pageSize?: number;
  status?: TrainingStatus;
  category_id?: string;
  search?: string;
  details?: boolean;
}

export interface CreateTrainingCategoryRequest {
  name: string;
  description?: string | null;
}

export interface UpdateTrainingCategoryRequest {
  id: string;
  name: string;
  description?: string | null;
}
