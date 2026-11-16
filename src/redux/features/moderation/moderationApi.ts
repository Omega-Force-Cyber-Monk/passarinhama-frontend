import { projectionTags, mutationChanged } from '../api/cacheTags';
import { apiSlice } from '../api/apiSlice';
import {
  ModerationLogsResponse,
  ModerationQueueResponse,
  ModeratePostRequest,
  ModeratePostResponse,
} from './moderationTypes';

export const moderationApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getModerationLogs: builder.query<ModerationLogsResponse, { page?: number; pageSize?: number }>({
      query: ({ page = 1, pageSize = 20 }) =>
        `/admin&modarator/moderation/logs?page=${page}&page_size=${pageSize}`,
      providesTags: [{type:'Post',id:'MODERATION'}],
    }),
    getModerationQueue: builder.query<ModerationQueueResponse, { page?: number; pageSize?: number }>({
      query: ({ page = 1, pageSize = 20 }) =>
        `/admin&modarator/moderation/queue?page=${page}&page_size=${pageSize}`,
      providesTags: [{type:'Post',id:'MODERATION'}],
    }),
    moderatePost: builder.mutation<ModeratePostResponse, { postId: string; body: ModeratePostRequest }>({
      query: ({ postId, body }) => ({
        url: `/forums/posts/${postId}/moderate`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (result,error,{postId}) => mutationChanged(error) ? ([{type:'Post',id:postId},{type:'Post',id:'MODERATION'},'Topic','Forum',...projectionTags]) : [],
    }),
  }),
});

export const {
  useGetModerationLogsQuery,
  useGetModerationQueueQuery,
  useModeratePostMutation,
} = moderationApi;
