import { projectionTags, mutationChanged } from '../api/cacheTags';
import { apiSlice } from '../api/apiSlice';
import type { AuthorizationContext } from '../api/mutationAuthorization';
import type { CategoryQueryParams, PaginatedResponse } from '../api/apiTypes';
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
      providesTags: (result) => [{type:'Article',id:'LIST'}, ...(result ? result.results.flatMap(item => [{type:'Article' as const,id:item.id}, ...(item.category?.id ? [{type:'ArticleCategory' as const,id:item.category.id}] : [])]) : [])],
    }),
    getArticleCategories: builder.query<
      PaginatedResponse<ArticleCategory>,
      CategoryQueryParams | void
    >({
      query: (arg) => {
        const params = arg && typeof arg === 'object' ? arg : undefined;
        const searchParams = new URLSearchParams();
        if (params?.page) {
          searchParams.set('page', String(params.page));
        }
        const pageSize = params?.pageSize ?? params?.page_size ?? params?.limit;
        if (pageSize) {
          searchParams.set('page_size', String(pageSize));
        }
        if (params?.search?.trim()) {
          searchParams.set('search', params.search.trim());
        }
        const queryString = searchParams.toString();
        return `/articles/article-categories${queryString ? `?${queryString}` : ''}`;
      },
      providesTags: (result) => [{type:'ArticleCategory',id:'LIST'}, ...(result?.results.map(item => ({type:'ArticleCategory' as const,id:item.id})) || [])],
    }),
    createArticle: builder.mutation<Article, CreateArticleRequest>({
      query: (data) => ({
        url: '/articles/articles',
        method: 'POST',
        body: buildArticleFormData(data),
      }),
      invalidatesTags: (result,error) => mutationChanged(error) ? [{ type: 'Article', id: 'LIST' }, { type: 'Article', id: 'MY_LIST' },...projectionTags] : [],
    }),
    getMyArticles: builder.query<PaginatedArticles, { page?: number; pageSize?: number }>({
      query: ({ page = 1, pageSize = 20 }) => `/articles/my-articles?page=${page}&page_size=${pageSize}`,
      providesTags: (result) => [{type:'Article',id:'MY_LIST'}, ...(result ? result.results.flatMap(item => [{type:'Article' as const,id:item.id}, ...(item.category?.id ? [{type:'ArticleCategory' as const,id:item.category.id}] : [])]) : [])],
    }),
    getArticleById: builder.query<Article, string>({
      query: (id) => `/articles/articles/${id}`,
      providesTags: (result, error, id) => [{type:'Article',id}, ...(result?.category?.id ? [{type:'ArticleCategory' as const,id:result.category.id}] : [])],
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
      invalidatesTags: (_result, _error, { article_id }) => mutationChanged(_error) ? ([
        { type: 'Article', id: 'LIST' },
        { type: 'Article', id: 'MY_LIST' },
        ...article_id.map((id) => ({ type: 'Article' as const, id })),
      ...projectionTags,]) : [],
    }),
    deleteArticle: builder.mutation<void, string>({
      async queryFn(id, _api, _options, baseQuery) {
        const result = await baseQuery({ url: '/articles/articles/' + id, method: 'DELETE' });
        return result.error ? { error: result.error } : { data: undefined };
      },
      invalidatesTags: (result,error,id) => mutationChanged(error) ? ([{type:'Article',id},{type:'Article',id:'LIST'},{type:'Article',id:'MY_LIST'},...projectionTags]) : [],
    }),
    publishArticle: builder.mutation<PublishArticleResponse, string>({
      query: (id) => ({
        url: `/articles/articles/${id}/publish`,
        method: 'POST',
        body: {},
      }),
      invalidatesTags: (result, error, id) => mutationChanged(error) ? ([
        { type: 'Article', id },
        { type: 'Article', id: 'LIST' },
        { type: 'Article', id: 'MY_LIST' },
        ...projectionTags]) : [],
    }),
    updateArticle: builder.mutation<Article, { id: string; data: Partial<CreateArticleRequest> }>({
      async queryFn({ id, data }, _api, _options, baseQuery) {
        const result = await baseQuery({
          url: '/articles/articles/' + id, method: 'PATCH', body: buildArticleFormData(data),
        });
        return result.error ? { error: result.error } : { data: result.data as Article };
      },
      invalidatesTags: (result, error, { id }) => mutationChanged(error) ? ([
        { type: 'Article', id },
        { type: 'Article', id: 'LIST' },
        { type: 'Article', id: 'MY_LIST' },
        ...projectionTags]) : [],
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
      invalidatesTags: (result,error) => mutationChanged(error) ? [{type:'ArticleCategory',id:'LIST'}] : [],
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
      invalidatesTags: (result,error,arg) => mutationChanged(error) ? ([{type:'ArticleCategory',id:typeof arg==='string'?arg:arg.id},{type:'ArticleCategory',id:'LIST'},...projectionTags]) : [],
    }),
    deleteArticleCategory: builder.mutation<void, string>({
      query: (id) => ({
        url: `/articles/article-categories/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result,error,arg) => mutationChanged(error) ? ([{type:'ArticleCategory',id:arg},{type:'ArticleCategory',id:'LIST'},...projectionTags,{type:'Article',id:'LIST'},{type:'Article',id:'MY_LIST'}]) : [],
    }),
    uploadFile: builder.mutation<FileUploadResponse, FormData | { formData: FormData; authorization: AuthorizationContext }>({
      query: (input) => ({
        url: '/articles/file-upload',
        method: 'POST',
        body: input instanceof FormData ? input : input.formData,
        clientAuthorization: input instanceof FormData ? undefined : input.authorization,
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
  useLazyGetArticleCategoriesQuery,
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
