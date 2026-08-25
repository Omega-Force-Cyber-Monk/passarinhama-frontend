export type TrainingFormat = 'online' | 'in_person' | 'hybrid';
export type TrainingStatus = 'open' | 'full' | 'completed';

export interface Training {
  id: string;
  title: string;
  description: string;
  instructor_name: string | null;
  format: TrainingFormat;
  training_date: string;
  end_date: string;
  duration_hours: number;
  thumbnail_url: string | null;
  max_attendees: number;
  attendee_count: number;
  spots_left: number;
  is_at_capacity: boolean;
  is_registered: boolean;
  status: TrainingStatus;
  attachments: string[];
  created_at: string;
  created_by: {
    id: string;
    first_name: string;
    last_name: string;
  };
}

export interface TrainingRequest {
  title: string;
  description: string;
  instructor_name?: string;
  format: TrainingFormat;
  training_date: string;
  end_date: string;
  duration_hours: number;
  max_attendees: number;
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

export interface PaginatedTrainings {
  total: number;
  page: number;
  results: Training[];
}
