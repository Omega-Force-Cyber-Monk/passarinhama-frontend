import type { FetchBaseQueryMeta } from '@reduxjs/toolkit/query';
import { apiSlice } from '../api/apiSlice';
import {
  ActivityLogsResponse,
  ActivityLogsParams,
  AdminBackupsResponse,
  AdminBackupDirectoryActionResponse,
  AdminFileDownloadResponse,
  AdminSmtpSettings,
  AdminSystemLogsParams,
  AdminSystemLogsResponse,
  ClearAdminSystemLogsResponse,
  DeleteAdminBackupResponse,
  TestAdminSmtpRequest,
  TestAdminSmtpResponse,
  UpdateAdminBackupConfigurationRequest,
  UpdateAdminSmtpSettingsRequest,
} from './adminTypes';

const getDownloadFilename = (
  contentDisposition?: string | null,
  fallback = 'download.bin',
) => {
  if (!contentDisposition) return fallback;

  const utf8Match = contentDisposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const standardMatch = contentDisposition.match(/filename\s*=\s*"?([^";]+)"?/i);
  if (standardMatch?.[1]) {
    return standardMatch[1];
  }

  return fallback;
};

export const adminApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getActivityLogs: builder.query<ActivityLogsResponse, ActivityLogsParams>({
      query: ({ page = 1, page_size = 20 }) => ({
        url: 'admin&modarator/admin/activity-log',
        params: { page, page_size },
      }),
      // Tagging for automated re-fetching if needed
      providesTags: (result) =>
        result
          ? [
              ...result.results.map(({ id }) => ({ type: 'Admin' as const, id })),
              { type: 'Admin', id: 'LOGS_LIST' },
            ]
          : [{ type: 'Admin', id: 'LOGS_LIST' }],
    }),
    getAdminSmtpSettings: builder.query<AdminSmtpSettings, void>({
      query: () => ({
        url: '/settings/admin/smtp',
      }),
      providesTags: [{ type: 'Admin', id: 'SMTP_SETTINGS' }],
    }),
    updateAdminSmtpSettings: builder.mutation<
      AdminSmtpSettings,
      UpdateAdminSmtpSettingsRequest
    >({
      query: (body) => ({
        url: '/settings/admin/smtp',
        method: 'PUT',
        body,
      }),
      invalidatesTags: [{ type: 'Admin', id: 'SMTP_SETTINGS' }],
    }),
    testAdminSmtpSettings: builder.mutation<
      TestAdminSmtpResponse,
      TestAdminSmtpRequest
    >({
      query: (body) => ({
        url: '/settings/admin/smtp/test',
        method: 'POST',
        body,
      }),
    }),
    getAdminSystemLogs: builder.query<AdminSystemLogsResponse, AdminSystemLogsParams>({
      query: (params) => ({
        url: '/settings/admin/logs',
        params,
      }),
      providesTags: [{ type: 'Admin', id: 'SYSTEM_LOGS' }],
    }),
    downloadAdminSystemLogs: builder.mutation<AdminFileDownloadResponse, void>({
      query: () => ({
        url: '/settings/admin/logs/download',
        method: 'GET',
        responseHandler: (response) => response.blob(),
      }),
      transformResponse: (response: Blob, meta?: FetchBaseQueryMeta) => ({
        file: response,
        filename: getDownloadFilename(
          meta?.response?.headers.get('content-disposition'),
          'system-logs.log',
        ),
      }),
    }),
    clearAdminSystemLogs: builder.mutation<ClearAdminSystemLogsResponse, void>({
      query: () => ({
        url: '/settings/admin/logs',
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Admin', id: 'SYSTEM_LOGS' }],
    }),
    getAdminBackups: builder.query<AdminBackupsResponse, void>({
      query: () => ({
        url: '/settings/admin/backups',
      }),
      providesTags: [{ type: 'Admin', id: 'BACKUPS' }],
    }),
    updateAdminBackupConfiguration: builder.mutation<
      AdminBackupsResponse['configuration'],
      UpdateAdminBackupConfigurationRequest
    >({
      query: (body) => ({
        url: '/settings/admin/backups/config',
        method: 'PUT',
        body,
      }),
      invalidatesTags: [{ type: 'Admin', id: 'BACKUPS' }],
    }),
    runAdminBackup: builder.mutation<AdminBackupsResponse['backups'][number], void>({
      query: () => ({
        url: '/settings/admin/backups/run',
        method: 'POST',
      }),
      invalidatesTags: [{ type: 'Admin', id: 'BACKUPS' }],
    }),
    testAdminBackupPermissions: builder.mutation<
      AdminBackupDirectoryActionResponse,
      void
    >({
      query: () => ({
        url: '/settings/admin/backups/test-permissions',
        method: 'POST',
      }),
      invalidatesTags: [{ type: 'Admin', id: 'BACKUPS' }],
    }),
    deleteAdminBackup: builder.mutation<DeleteAdminBackupResponse, string>({
      query: (id) => ({
        url: `/settings/admin/backups/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Admin', id: 'BACKUPS' }],
    }),
    downloadAdminBackup: builder.mutation<AdminFileDownloadResponse, string>({
      query: (id) => ({
        url: `/settings/admin/backups/${id}/download`,
        method: 'GET',
        responseHandler: (response) => response.blob(),
      }),
      transformResponse: (
        response: Blob,
        meta: FetchBaseQueryMeta | undefined,
        id: string,
      ) => ({
        file: response,
        filename: getDownloadFilename(
          meta?.response?.headers.get('content-disposition'),
          `backup-${id}.zip`,
        ),
      }),
    }),
  }),
});

export const {
  useGetActivityLogsQuery,
  useGetAdminSmtpSettingsQuery,
  useUpdateAdminSmtpSettingsMutation,
  useTestAdminSmtpSettingsMutation,
  useGetAdminSystemLogsQuery,
  useDownloadAdminSystemLogsMutation,
  useClearAdminSystemLogsMutation,
  useGetAdminBackupsQuery,
  useUpdateAdminBackupConfigurationMutation,
  useRunAdminBackupMutation,
  useTestAdminBackupPermissionsMutation,
  useDeleteAdminBackupMutation,
  useDownloadAdminBackupMutation,
} = adminApi;
