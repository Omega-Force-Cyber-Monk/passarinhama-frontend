import { apiSlice } from '../api/apiSlice';
import {
  Article,
  ArticleCategory,
  ArticlePermission,
  BulkArticlePermissionResponse,
  PaginatedArticles,
  CreateArticleRequest,
  PublishArticleResponse,
  FileUploadResponse,
  FileDeleteResponse,
  GetArticlesQueryParams,
  CreateArticleCategoryRequest,
  SetArticlePermissionRequest,
  UpdateArticleCategoryRequest,
} from './articleTypes';

const appendIfDefined = (formData: FormData, key: string, value: unknown) => {
  if (value !== undefined && value !== null) {
    formData.append(key, String(value));
  }
};

const buildArticleFormData = (body: Partial<CreateArticleRequest>) => {
  const formData = new FormData();

  appendIfDefined(formData, 'title', body.title);
  appendIfDefined(formData, 'category_id', body.category_id);
  appendIfDefined(formData, 'excerpt', body.excerpt);
  appendIfDefined(formData, 'body', body.body);
  appendIfDefined(formData, 'status', body.status);
  appendIfDefined(formData, 'remove_file_urls', body.remove_file_urls);

  if (body.structured_fields !== undefined && body.structured_fields !== null) {
    formData.append(
      'structured_fields',
      typeof body.structured_fields === 'string'
        ? body.structured_fields
        : JSON.stringify(body.structured_fields),
    );
  }

  if (body.thumbnail) {
    formData.append('thumbnail', body.thumbnail);
  }

  body.files?.forEach((file) => {
    formData.append('files', file);
  });

  return formData;
};

export const articlesApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getArticles: builder.query<PaginatedArticles, GetArticlesQueryParams>({
      query: ({
        page = 1,
        pageSize = 20,
        status,
        category_id,
        search,
        details,
      }) => {
        const params = new URLSearchParams({
          page: String(page),
          page_size: String(pageSize),
        });

        if (status) {
          params.set('status', status);
        }
        if (category_id) {
          params.set('category_id', category_id);
        }
        if (search?.trim()) {
          params.set('search', search.trim());
        }
        if (details !== undefined) {
          params.set('details', String(details));
        }

        return `/articles/articles?${params.toString()}`;
      },
      providesTags: (result) =>
        result
          ? [
              ...result.results.map(({ id }) => ({ type: 'Article' as const, id })),
              { type: 'Article', id: 'LIST' },
            ]
          : [{ type: 'Article', id: 'LIST' }],
    }),
    getArticleCategories: builder.query<ArticleCategory[], void>({
      query: () => '/articles/article-categories',
      providesTags: ['Article'],
    }),
    createArticle: builder.mutation<Article, CreateArticleRequest>({
      query: (data) => ({
        url: '/articles/articles',
        method: 'POST',
        body: buildArticleFormData(data),
      }),
      invalidatesTags: [{ type: 'Article', id: 'LIST' }, { type: 'Article', id: 'MY_LIST' }],
    }),
    getMyArticles: builder.query<PaginatedArticles, { page?: number; pageSize?: number }>({
      query: ({ page = 1, pageSize = 20 }) => `/articles/my-articles?page=${page}&page_size=${pageSize}`,
      providesTags: (result) =>
        result
          ? [
              ...result.results.map(({ id }) => ({ type: 'Article' as const, id })),
              { type: 'Article', id: 'MY_LIST' },
            ]
          : [{ type: 'Article', id: 'MY_LIST' }],
    }),
    getArticleById: builder.query<Article, string>({
      query: (id) => `/articles/articles/${id}`,
      providesTags: (result, error, id) => [{ type: 'Article', id }],
    }),
    getArticlePermissions: builder.query<ArticlePermission[], string>({
      query: (id) => `/articles/articles/${id}/permissions`,
      providesTags: (_result, _error, id) => [{ type: 'Article', id }],
    }),
    setArticlePermission: builder.mutation<
      BulkArticlePermissionResponse,
      SetArticlePermissionRequest
    >({
      query: (body) => ({
        url: '/articles/article/permissions/bulk',
        method: 'PATCH',
        body,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
      invalidatesTags: (_result, _error, { article_id }) => [
        { type: 'Article', id: 'LIST' },
        { type: 'Article', id: 'MY_LIST' },
        ...article_id.map((id) => ({ type: 'Article' as const, id })),
      ],
    }),
    deleteArticle: builder.mutation<void, string>({
      query: (id) => ({
        url: `/articles/articles/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Article', id: 'LIST' }, { type: 'Article', id: 'MY_LIST' }],
    }),
    publishArticle: builder.mutation<PublishArticleResponse, string>({
      query: (id) => ({
        url: `/articles/articles/${id}/publish`,
        method: 'POST',
        body: {},
      }),
      invalidatesTags: (result, error, id) => [
        { type: 'Article', id },
        { type: 'Article', id: 'LIST' },
        { type: 'Article', id: 'MY_LIST' },
      ],
    }),
    updateArticle: builder.mutation<Article, { id: string; data: Partial<CreateArticleRequest> }>({
      query: ({ id, data }) => ({
        url: `/articles/articles/${id}`,
        method: 'PATCH',
        body: buildArticleFormData(data),
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Article', id },
        { type: 'Article', id: 'LIST' },
        { type: 'Article', id: 'MY_LIST' },
      ],
    }),
    createArticleCategory: builder.mutation<ArticleCategory, CreateArticleCategoryRequest>({
      query: (body) => ({
        url: '/articles/article-categories',
        method: 'POST',
        body,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
      invalidatesTags: ['Article'],
    }),
    updateArticleCategory: builder.mutation<ArticleCategory, UpdateArticleCategoryRequest>({
      query: ({ id, ...body }) => ({
        url: `/articles/article-categories/${id}`,
        method: 'PATCH',
        body,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
      invalidatesTags: ['Article'],
    }),
    deleteArticleCategory: builder.mutation<void, string>({
      query: (id) => ({
        url: `/articles/article-categories/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Article'],
    }),
    uploadFile: builder.mutation<FileUploadResponse, FormData>({
      query: (formData) => ({
        url: '/articles/file-upload',
        method: 'POST',
        body: formData,
      }),
    }),
    deleteFile: builder.mutation<FileDeleteResponse, string>({
      query: (file_url) => ({
        url: '/articles/file-delete',
        method: 'POST',
        body: new URLSearchParams({ file_url }).toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }),
    }),
  }),
});

export const {
  useGetArticlesQuery,
  useGetArticleCategoriesQuery,
  useCreateArticleMutation,
  useGetMyArticlesQuery,
  useGetArticleByIdQuery,
  useGetArticlePermissionsQuery,
  useDeleteArticleMutation,
  usePublishArticleMutation,
  useSetArticlePermissionMutation,
  useUpdateArticleMutation,
  useCreateArticleCategoryMutation,
  useUpdateArticleCategoryMutation,
  useDeleteArticleCategoryMutation,
  useUploadFileMutation,
  useDeleteFileMutation,
} = articlesApi;
