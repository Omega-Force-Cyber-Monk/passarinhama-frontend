import { mutationChanged } from '../api/cacheTags';
import { apiSlice } from '../api/apiSlice';
import { NotificationPreference, UpdateNotificationPreferenceRequest } from './notificationTypes';

export const notificationsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getNotificationPreferences: builder.query<NotificationPreference[], void>({
      query: () => '/settings/notifications/preferences',
      providesTags: [{type:'NotificationPreference',id:'SELF'}],
    }),
    updateNotificationPreference: builder.mutation<NotificationPreference, UpdateNotificationPreferenceRequest>({
      query: (body) => ({
        url: '/settings/notifications/preferences',
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (result,error) => mutationChanged(error) ? [{type:'NotificationPreference',id:'SELF'}] : [],
    }),
  }),
});

export const { 
  useGetNotificationPreferencesQuery,
  useUpdateNotificationPreferenceMutation,
} = notificationsApi;
