export interface DocumentFolder {
  id: string;
  name: string;
  parentId: string | null;
  commissionId?: string;
  allowedRoles: string[];
}

export interface DocumentFile {
  id: string;
  folderId: string;
  name: string;
  size: number;
  type: string;
  uploadedBy: string;
  createdAt: string;
}
