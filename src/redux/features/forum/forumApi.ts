import { apiSlice } from "../api/apiSlice";
import {
  CreateTopicPostRequest,
  CreateForumTopicRequest,
  CreateForumRequest,
  ForumDetails,
  ForumListItem,
  PinTopicRequest,
  TopicPostsResponse,
  ForumTopicsResponse,
  GetForumTopicsQueryParams,
  GetTopicPostsQueryParams,
  SetForumPermissionRequest,
  BulkPermissionResponse,
  ForumPermission,
  UpdateForumRequest,
  UpdateForumTopicRequest,
  UpdateTopicPostRequest,
  ForumTopic,
  PinnedTopic,
} from "../../../types";

const FORUMS_BASE_PATH = "/forums/forums";

type ListResponse<T> = T[] | { results?: T[] };

const normalizeListResponse = <T>(response: ListResponse<T>): T[] =>
  Array.isArray(response) ? response : response.results || [];

const trimOrUndefined = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const appendForumField = (
  searchParams: URLSearchParams,
  key: string,
  value: string | null | undefined,
) => {
  if (value !== undefined && value !== null) {
    searchParams.set(key, value);
  }
};

const buildForumSearchParams = (
  body: Omit<CreateForumRequest, "name"> & { name?: string | null },
) => {
  const searchParams = new URLSearchParams();

  appendForumField(searchParams, "name", trimOrUndefined(body.name));
  appendForumField(
    searchParams,
    "author_name",
    trimOrUndefined(body.author_name),
  );
  appendForumField(
    searchParams,
    "description",
    trimOrUndefined(body.description),
  );
  appendForumField(
    searchParams,
    "forum_type",
    body.forum_type === undefined || body.forum_type === null
      ? undefined
      : String(body.forum_type),
  );

  return searchParams;
};

const buildForumThumbnailFormData = (thumbnail?: File | null) => {
  const formData = new FormData();

  if (thumbnail) {
    formData.append("thumbnail", thumbnail);
  }

  return formData;
};

const buildForumUpdateSearchParams = (
  body: Omit<UpdateForumRequest, "forum_id" | "thumbnail">,
) => {
  const searchParams = new URLSearchParams();
  const name = trimOrUndefined(body.name);
  const authorName = trimOrUndefined(body.author_name);
  const description = trimOrUndefined(body.description);

  if (name !== undefined) {
    searchParams.set("name", name);
  }

  if (authorName !== undefined) {
    searchParams.set("author_name", authorName);
  }

  if (description !== undefined) {
    searchParams.set("description", description);
  }

  if (body.forum_type !== undefined && body.forum_type !== null) {
    searchParams.set("forum_type", String(body.forum_type));
  }

  return searchParams;
};

export const forumApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getForums: builder.query<ForumListItem[], void>({
      query: () => FORUMS_BASE_PATH,
      transformResponse: (response: ListResponse<ForumListItem>) =>
        normalizeListResponse(response),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Forum" as const, id })),
              { type: "Forum" as const, id: "LIST" },
            ]
          : [{ type: "Forum" as const, id: "LIST" }],
    }),
    createForum: builder.mutation<ForumDetails, CreateForumRequest>({
      query: ({ name, author_name, description, forum_type, thumbnail }) => {
        const searchParams = buildForumSearchParams({
          name,
          author_name,
          description,
          forum_type,
        });
        const querySuffix = searchParams.toString();

        return {
          url: `${FORUMS_BASE_PATH}${querySuffix ? `?${querySuffix}` : ""}`,
          method: "POST",
          body: buildForumThumbnailFormData(thumbnail),
        };
      },
      invalidatesTags: [{ type: "Forum", id: "LIST" }],
    }),
    deleteForum: builder.mutation<void, string>({
      query: (forumId) => ({
        url: `${FORUMS_BASE_PATH}/${forumId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, forumId) => [
        { type: "Forum", id: forumId },
        { type: "Forum", id: "LIST" },
        { type: "Topic", id: forumId },
      ],
    }),
    updateForum: builder.mutation<ForumDetails, UpdateForumRequest>({
      query: ({
        forum_id,
        name,
        author_name,
        description,
        forum_type,
        thumbnail,
      }) => {
        const searchParams = buildForumUpdateSearchParams({
          name,
          author_name,
          description,
          forum_type,
        });
        const querySuffix = searchParams.toString();

        return {
          url: `${FORUMS_BASE_PATH}/${forum_id}${querySuffix ? `?${querySuffix}` : ""}`,
          method: "PATCH",
          body: buildForumThumbnailFormData(thumbnail),
        };
      },
      invalidatesTags: (_result, _error, { forum_id }) => [
        { type: "Forum", id: forum_id },
        { type: "Forum", id: "LIST" },
      ],
    }),
    getForum: builder.query<ForumDetails, string>({
      query: (forumId) => `${FORUMS_BASE_PATH}/${forumId}`,
      providesTags: (_result, _error, forumId) => [
        { type: "Forum", id: forumId },
      ],
    }),
    getForumTopics: builder.query<ForumTopicsResponse, GetForumTopicsQueryParams>({
      query: ({ forumId, page = 1, pageSize = 20 }) =>
        `${FORUMS_BASE_PATH}/${forumId}/topics?page=${page}&page_size=${pageSize}`,
      providesTags: (_result, _error, { forumId }) => [
        { type: "Forum", id: forumId },
        { type: "Topic", id: forumId },
      ],
    }),
    createForumTopic: builder.mutation<ForumTopic, CreateForumTopicRequest>({
      query: ({ forum_id, title, content, files }) => {
        const formData = new FormData();
        formData.append("title", title.trim());
        formData.append("content", content);

        files?.forEach((file) => {
          if (file instanceof File) {
            formData.append("files", file);
          }
        });

        return {
          url: `${FORUMS_BASE_PATH}/${forum_id}/topics`,
          method: "POST",
          body: formData,
        };
      },
      invalidatesTags: (_result, _error, { forum_id }) => [
        { type: "Forum", id: forum_id },
        { type: "Topic", id: forum_id },
      ],
    }),
    deleteTopic: builder.mutation<
      void,
      { topic_id: string; forum_id?: string }
    >({
      query: ({ topic_id }) => ({
        url: `/forums/topics/${topic_id}/delete`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { topic_id, forum_id }) => [
        { type: "Post", id: topic_id },
        { type: "Topic", id: topic_id },
        { type: "Topic", id: "PINNED" },
        ...(forum_id ? [{ type: "Topic" as const, id: forum_id }] : []),
      ],
    }),
    updateTopic: builder.mutation<ForumTopic, UpdateForumTopicRequest>({
      query: ({ topic_id, title, content, files, delete_files }) => {
        const formData = new FormData();
        if (title !== undefined && title !== null) {
          formData.append("title", title);
        }
        if (content !== undefined && content !== null) {
          formData.append("content", content);
        }

        files?.forEach((file) => {
          formData.append("files", file);
        });

        delete_files?.forEach((fileUrl) => {
          formData.append("delete_files", fileUrl);
        });

        return {
          url: `/forums/topics/${topic_id}/update`,
          method: "PATCH",
          body: formData,
        };
      },
      invalidatesTags: (_result, _error, { topic_id, forum_id }) => [
        { type: "Post", id: topic_id },
        ...(forum_id ? [{ type: "Topic" as const, id: forum_id }] : []),
      ],
    }),
    getTopicPosts: builder.query<TopicPostsResponse, GetTopicPostsQueryParams>({
      query: ({ topicId, page = 1, pageSize = 20 }) =>
        `/forums/topics/${topicId}/posts?page=${page}&page_size=${pageSize}`,
      providesTags: (_result, _error, { topicId }) => [
        { type: "Post", id: topicId },
      ],
    }),
    createTopicPost: builder.mutation<unknown, CreateTopicPostRequest>({
      query: ({ topic_id, content, files }) => {
        const formData = new FormData();
        formData.append("content", content);
        files?.forEach((file) => {
          formData.append("files", file);
        });

        return {
          url: `/forums/topics/${topic_id}/posts`,
          method: "POST",
          body: formData,
        };
      },
      invalidatesTags: (_result, _error, { topic_id, forum_id }) => [
        { type: "Post", id: topic_id },
        ...(forum_id ? [{ type: "Topic" as const, id: forum_id }] : []),
      ],
    }),
    deletePost: builder.mutation<
      void,
      { post_id: string; topic_id: string; forum_id?: string }
    >({
      query: ({ post_id }) => ({
        url: `/forums/posts/${post_id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { topic_id, forum_id }) => [
        { type: "Post", id: topic_id },
        ...(forum_id ? [{ type: "Topic" as const, id: forum_id }] : []),
      ],
    }),
    updatePost: builder.mutation<unknown, UpdateTopicPostRequest>({
      query: ({ post_id, content, files }) => {
        const formData = new FormData();
        formData.append("content", content);
        files?.forEach((file) => {
          formData.append("files", file);
        });

        return {
          url: `/forums/posts/${post_id}`,
          method: "PATCH",
          body: formData,
        };
      },
      invalidatesTags: (_result, _error, { topic_id, forum_id }) => [
        { type: "Post", id: topic_id },
        ...(forum_id ? [{ type: "Topic" as const, id: forum_id }] : []),
      ],
    }),
    pinTopic: builder.mutation<unknown, PinTopicRequest>({
      query: ({ topic_id, pinned }) => {
        const searchParams = new URLSearchParams({
          pinned: String(pinned),
        });

        return {
          url: `/forums/topics/${topic_id}/pin?${searchParams.toString()}`,
          method: "PATCH",
        };
      },
      invalidatesTags: (_result, _error, { topic_id, forum_id }) => [
        { type: "Post", id: topic_id },
        { type: "Topic", id: "PINNED" },
        ...(forum_id ? [{ type: "Topic" as const, id: forum_id }] : []),
      ],
    }),
    setForumPermission: builder.mutation<
      BulkPermissionResponse,
      SetForumPermissionRequest
    >({
      query: (body) => ({
        url: `${FORUMS_BASE_PATH}/permissions/bulk`,
        method: "PATCH",
        body,
        headers: {
          "Content-Type": "application/json",
        },
      }),
      invalidatesTags: (_result, _error, { forum_id }) => [
        { type: "Forum", id: "LIST" },
        ...forum_id.map((id) => ({ type: "Forum" as const, id })),
      ],
    }),
    getForumPermissions: builder.query<ForumPermission[], string>({
      query: (forumId) => `${FORUMS_BASE_PATH}/${forumId}/permissions`,
      providesTags: (_result, _error, forumId) => [
        { type: "Forum", id: forumId },
      ],
    }),
    getPinnedTopics: builder.query<PinnedTopic[], void>({
      query: () => "/forums/topics/pinned",
      transformResponse: (response: ListResponse<PinnedTopic>) =>
        normalizeListResponse(response),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Topic" as const, id })),
              { type: "Topic" as const, id: "PINNED" },
            ]
          : [{ type: "Topic" as const, id: "PINNED" }],
    }),
  }),
});

export const {
  useGetForumsQuery,
  useCreateForumMutation,
  useDeleteForumMutation,
  useUpdateForumMutation,
  useCreateForumTopicMutation,
  useDeleteTopicMutation,
  useUpdateTopicMutation,
  useCreateTopicPostMutation,
  useDeletePostMutation,
  useUpdatePostMutation,
  useGetForumQuery,
  useGetForumTopicsQuery,
  useGetTopicPostsQuery,
  usePinTopicMutation,
  useSetForumPermissionMutation,
  useGetForumPermissionsQuery,
  useGetPinnedTopicsQuery,
} = forumApi;
