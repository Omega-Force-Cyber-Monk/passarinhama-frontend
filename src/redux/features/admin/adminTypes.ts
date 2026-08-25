export interface ActivityLogActor {
  id: string;
  first_name: string;
  last_name: string;
}

export interface ActivityLog {
  id: string;
  action_type: string;
  target_type: string;
  target_id: string;
  description: string | null;
  created_at: string;
  actor: ActivityLogActor;
}

export interface ActivityLogsResponse {
  total: number;
  page: number;
  page_size?: number;
  total_pages?: number;
  results: ActivityLog[];
}

export interface ActivityLogsParams {
  page?: number;
  page_size?: number;
}

export interface AdminSmtpSettings {
  id: string;
  host: string;
  port: number;
  username: string;
  password: string;
  from_email: string;
  from_name: string;
  use_tls: boolean;
  use_ssl: boolean;
  source: string;
  updated_at: string;
}

export interface UpdateAdminSmtpSettingsRequest {
  host: string;
  port: number;
  username: string;
  password: string;
  from_email: string;
  from_name: string;
  use_tls: boolean;
  use_ssl: boolean;
}

export interface TestAdminSmtpRequest {
  email: string;
}

export interface TestAdminSmtpResponse {
  status: string;
  email: string;
}

export interface AdminSystemLogsParams {
  limit?: number;
  search?: string;
}

export interface AdminSystemLogsResponse {
  title: string;
  lines: string[];
  size_bytes: number;
  updated_at: string;
  downloadable: boolean;
}

export interface ClearAdminSystemLogsResponse {
  status: string;
  title: string;
}

export interface AdminBackupConfiguration {
  enabled: boolean;
  frequency: string;
  execution_time: string;
  retention_days: number;
  max_backups: number;
  backup_dir: string;
  last_backup_at: string | null;
  last_error: string | null;
}

export interface AdminBackupDirectory {
  path: string;
  exists: boolean;
  writable: boolean;
  backend?: string;
  api_access?: string;
}

export interface AdminBackupItem {
  id: string;
  filename: string;
  size_bytes: number;
  created_at: string;
}

export interface AdminBackupsResponse {
  configuration: AdminBackupConfiguration;
  directory: AdminBackupDirectory;
  total_backups: number;
  total_size_bytes: number;
  backups: AdminBackupItem[];
}

export interface UpdateAdminBackupConfigurationRequest {
  enabled: boolean;
  frequency: string;
  execution_time: string;
  retention_days: number;
  max_backups: number;
  backup_dir: string;
}

export interface DeleteAdminBackupResponse {
  status: string;
  message?: string;
}

export interface AdminBackupDirectoryActionResponse extends AdminBackupDirectory {
  status: string;
  detail?: string;
}

export interface AdminFileDownloadResponse {
  file: Blob;
  filename: string;
}
