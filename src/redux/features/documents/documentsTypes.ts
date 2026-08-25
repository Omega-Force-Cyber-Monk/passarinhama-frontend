export interface DocumentFolder {
  id: string;
  name: string;
  color_code: string;
  document_count: number;
  commission_id: string | null;
  parent_id: string | null;
  created_at: string;
  can_upload: boolean;
  children?: DocumentFolder[];
}

export type DocumentFoldersResponse = DocumentFolder[];

export interface CreateFolderRequest {
  name: string;
  color_code?: string;
  parent_id?: string | null;
}

export interface UpdateFolderRequest {
  name?: string;
  color_code?: string;
}

export interface FolderPermission {
  id: string;
  folder_id: string;
  folder_name?: string;
  role_id: string;
  role_name?: string;
  can_read: boolean;
  can_upload: boolean;
}

export interface FolderPermissionDraft {
  can_read: boolean;
  can_upload: boolean;
}

export interface FolderPermissionsResponse {
  [role: string]: FolderPermissionDraft;
}

export interface BulkUpdatePermissionsRequest {
  folder_id: string[];
  role_id: string[];
  can_read: boolean;
  can_upload: boolean;
}

export interface BulkUpdatePermissionsResponse {
  updated: number;
  permissions: FolderPermission[];
}

export interface Document {
  id: string;
  original_name: string;
  file_type: string;
  mime_type: string;
  file_size: number;
  file_size_display: string;
  folder_id: string;
  created_at: string;
  uploaded_by: {
    id: string;
    first_name: string;
    last_name: string;
  };
}

export interface DocumentsResponse {
  folder: {
    id: string;
    name: string;
    can_upload: boolean;
  };
  total: number;
  documents: Document[];
}

export interface UploadDocumentRequest {
  folder_id: string;
  file: File;
}

export interface RenameDocumentRequest {
  original_name: string;
}

export interface DownloadDocumentResponse {
  download_url: string;
  filename: string;
  mime_type: string;
}
