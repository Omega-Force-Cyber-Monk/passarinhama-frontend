import { mutationChanged, projectionTags } from '../api/cacheTags';
import type { RootState } from '../../store';
import { apiSlice } from '../api/apiSlice';
import {
  DocumentFoldersResponse, 
  CreateFolderRequest, 
  DocumentFolder, 
  UpdateFolderRequest,
  FolderPermission,
  BulkUpdatePermissionsRequest,
  BulkUpdatePermissionsResponse,
  Document,
  DocumentsResponse,
  UploadDocumentRequest,
  RenameDocumentRequest,
  DownloadDocumentResponse
} from './documentsTypes';

const normalizeDocumentFolder = (folder: unknown): DocumentFolder | null => {
  if (!folder || typeof folder !== 'object') {
    return null;
  }

  const value = folder as Record<string, unknown>;

  return {
    id: String(value.id ?? ''),
    name: typeof value.name === 'string' ? value.name : '',
    color_code: typeof value.color_code === 'string' ? value.color_code : '',
    document_count:
      typeof value.document_count === 'number' ? value.document_count : 0,
    commission_id:
      typeof value.commission_id === 'string' ? value.commission_id : null,
    parent_id: typeof value.parent_id === 'string' ? value.parent_id : null,
    created_at: typeof value.created_at === 'string' ? value.created_at : '',
    can_upload: Boolean(value.can_upload),
    children: Array.isArray(value.children)
      ? value.children
          .map(normalizeDocumentFolder)
          .filter((item): item is DocumentFolder => item !== null)
      : [],
  };
};

const normalizeDocumentFoldersResponse = (
  response: unknown,
): DocumentFoldersResponse => {
  const folders = Array.isArray(response)
    ? response
    : Array.isArray((response as { folders?: unknown })?.folders)
      ? ((response as { folders: unknown[] }).folders)
      : [];

  return folders
    .map(normalizeDocumentFolder)
    .filter((item): item is DocumentFolder => item !== null);
};

const normalizeDocumentsResponse = (response: unknown): DocumentsResponse => {
  const value =
    response && typeof response === 'object'
      ? (response as Record<string, unknown>)
      : {};
  const folderValue =
    value.folder && typeof value.folder === 'object'
      ? (value.folder as Record<string, unknown>)
      : {};

  return {
    folder: {
      id: typeof folderValue.id === 'string' ? folderValue.id : '',
      name: typeof folderValue.name === 'string' ? folderValue.name : '',
      can_upload: Boolean(folderValue.can_upload),
    },
    total: typeof value.total === 'number' ? value.total : 0,
    documents: Array.isArray(value.documents)
      ? (value.documents as Document[])
      : [],
  };
};

const folderIds = (folders: DocumentFolder[]): string[] => folders.flatMap(folder => [folder.id, ...folderIds(folder.children || [])]);
// Capture known descendants before the tree refetch can remove them.
const invalidateBranch = (ids: string[], { dispatch, getState, queryFulfilled }: any) => {
  const state = getState() as RootState;
  const tree = documentsApi.endpoints.getDocumentFolders.select()(state).data || [];
  const branches = (rows: DocumentFolder[]): string[] => rows.flatMap(row => ids.includes(row.id) ? [row.id, ...folderIds(row.children || [])] : branches(row.children || []));
  const affected = [...new Set([...ids, ...branches(tree)])];
  const documents = affected.flatMap(folder_id => documentsApi.endpoints.getDocuments.select({ folder_id })(state).data?.documents || []);
  const invalidate = () => dispatch(documentsApi.util.invalidateTags([
    { type: 'Folder', id: 'LIST' }, ...projectionTags,
    ...affected.flatMap(id => [{ type: 'Folder' as const, id }, { type: 'Folder' as const, id: `${id}-permissions` }]),
    ...documents.map(({ id }) => ({ type: 'Document' as const, id })),
  ]));
  void queryFulfilled.then(invalidate).catch((failure: any) => { if (mutationChanged(failure.error)) invalidate(); });
};

export const documentsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getDocumentFolders: builder.query<DocumentFoldersResponse, void>({
      query: () => '/documents/documents/folders',
      transformResponse: normalizeDocumentFoldersResponse,
      providesTags: (result) =>
        result
          ? [
              ...folderIds(result).map(id => ({ type: 'Folder' as const, id })),
              { type: 'Folder' as const, id: 'LIST' },
            ]
          : [{ type: 'Folder' as const, id: 'LIST' }],
    }),
    createFolder: builder.mutation<DocumentFolder, CreateFolderRequest>({
      query: (body) => ({
        url: '/documents/documents/folders',
        method: 'POST',
        body,
      }),
      invalidatesTags: (result,error) => mutationChanged(error) ? [{ type: 'Folder' as const, id: 'LIST' }, ...projectionTags] : [],
    }),
    updateFolder: builder.mutation<DocumentFolder, { id: string; body: UpdateFolderRequest }>({
      query: ({ id, body }) => ({
        url: `/documents/documents/folders/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (result,error,{ id }) => mutationChanged(error) ? ([
        { type: 'Folder' as const, id },
        { type: 'Folder' as const, id: 'LIST' },
        ...projectionTags,
      ]) : [],
    }),
    deleteFolder: builder.mutation<void, string>({
      onQueryStarted: (id, lifecycle) => invalidateBranch([id], lifecycle),
      query: (id) => ({
        url: `/documents/documents/folders/${id}`,
        method: 'DELETE',
      }),
    }),
    getFolderPermissions: builder.query<FolderPermission[], string>({
      query: (id) => `/documents/documents/folders/${id}/permissions`,
      providesTags: (result, error, id) => [{ type: 'Folder' as const, id: `${id}-permissions` }],
    }),
    updateFolderPermissionsBulk: builder.mutation<BulkUpdatePermissionsResponse, BulkUpdatePermissionsRequest>({
      onQueryStarted: ({folder_id}, lifecycle) => invalidateBranch(folder_id, lifecycle),
      query: (body) => ({
        url: '/documents/folder/permissions/bulk',
        method: 'PATCH',
        body,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    }),
    getDocuments: builder.query<DocumentsResponse, { folder_id: string }>({
      query: ({ folder_id }) => `/documents/documents?folder_id=${folder_id}`,
      transformResponse: normalizeDocumentsResponse,
      providesTags: (result, error, {folder_id}) =>
        result
          ? [
              ...result.documents.map(({ id }) => ({ type: 'Document' as const, id })),
              { type: 'Document' as const, id: 'LIST' },
              { type: 'Folder' as const, id: folder_id },
            ]
          : [{ type: 'Folder' as const, id: folder_id }, { type: 'Document' as const, id: 'LIST' }],
    }),
    uploadDocument: builder.mutation<Document, UploadDocumentRequest>({
      query: ({ folder_id, file }) => {
        const formData = new FormData();
        formData.append('folder_id', folder_id);
        formData.append('file', file);
        return {
          url: '/documents/documents/upload',
          method: 'POST',
          body: formData,
        };
      },
      invalidatesTags: (result,error,{folder_id}) => mutationChanged(error) ? [{ type: 'Folder' as const, id: folder_id }, { type: 'Folder' as const, id: 'LIST' }, ...projectionTags] : [],
    }),
    renameDocument: builder.mutation<Document, { id: string; body: RenameDocumentRequest; folderId?: string }>({
      query: ({ id, body, folderId }) => ({
        url: `/documents/documents/${id}`,
        clientAuthorization: { folderId },
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (result,error,{ id }) => mutationChanged(error) ? ([
        { type: 'Document' as const, id },
        ...projectionTags,
      ]) : [],
    }),
    deleteDocument: builder.mutation<void, string | { id: string; folderId: string }>({
      query: (target) => ({
        url: `/documents/documents/${typeof target === "string" ? target : target.id}`,
        clientAuthorization: { folderId: typeof target === "string" ? undefined : target.folderId },
        method: 'DELETE',
      }),
      invalidatesTags: (result,error,target) => mutationChanged(error) ? [
        { type: 'Document' as const, id: typeof target === 'string' ? target : target.id },
        ...(typeof target === 'string' ? [{ type: 'Document' as const, id: 'LIST' }] : [{ type: 'Folder' as const, id: target.folderId }]),
        { type: 'Folder' as const, id: 'LIST' }, ...projectionTags,
      ] : [],
    }),
    downloadDocument: builder.query<DownloadDocumentResponse, string>({
      query: (id) => `/documents/documents/${id}/download`,
      providesTags: (result,error,id) => [{type:'Document',id}],
    }),
  }),
});

export const { 
  useGetDocumentFoldersQuery, 
  useCreateFolderMutation,
  useUpdateFolderMutation,
  useDeleteFolderMutation,
  useGetFolderPermissionsQuery,
  useUpdateFolderPermissionsBulkMutation,
  useGetDocumentsQuery,
  useUploadDocumentMutation,
  useRenameDocumentMutation,
  useDeleteDocumentMutation,
  useDownloadDocumentQuery,
  useLazyDownloadDocumentQuery,
} = documentsApi;
