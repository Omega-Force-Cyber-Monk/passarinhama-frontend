import React, { useState, useEffect } from "react";
import {
  FileText,
  Trash2,
  Edit2,
  Newspaper,
  CheckCircle2,
  Grid,
  Globe,
  Shield,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import Modal from "../components/ui/Modal";
import ConfirmModal from "../components/ui/ConfirmModal";
import { useAppToast } from "../components/ui/AppToastProvider";
import {
  FilePreviewCard,
  FileUploadDropzone,
  SelectedFilesPreview,
} from "../components/ui/FileUploadPreview";
import TiptapEditor from "../components/ui/TiptapEditor";
import { useI18n } from "../i18n";
import { useSelector } from "react-redux";
import { RootState } from "../redux/store";
import { usePermissions } from "../hooks/usePermissions";
import { useGetUserRolesQuery } from "../redux/features/members/membersApi";
import type {
  Article as ApiArticle,
  ArticleCategory,
  ArticlePermission,
  ArticleStatus,
  ArticleStructuredFields,
  CreateArticleRequest,
} from "../redux/features/articles/articleTypes";
import {
  useGetArticlesQuery,
  useGetArticleCategoriesQuery,
  useCreateArticleMutation,
  useUpdateArticleMutation,
  useCreateArticleCategoryMutation,
  useUpdateArticleCategoryMutation,
  useDeleteArticleCategoryMutation,
  useGetArticleByIdQuery,
  useGetArticlePermissionsQuery,
  useDeleteArticleMutation,
  usePublishArticleMutation,
  useSetArticlePermissionMutation,
  useUploadFileMutation,
} from "../redux/features/articles/articlesApi";
import { getApiErrorDisplayMessage } from "../utils/apiErrorMessages";

const ARTICLES_PAGE_SIZE = 20;
const DEFAULT_ARTICLE_STATUS: ArticleStatus = "draft";

type ArticleFormState = {
  title: string;
  category_id: string;
  excerpt: string;
  body: string;
  status: ArticleStatus;
  thumbnail: File | null;
  thumbnail_url: string | null;
  structured_fields: ArticleStructuredFields;
};

const getDefaultStructuredFields = (author: string): ArticleStructuredFields => ({
  author,
  tags: [],
  difficulty: "beginner",
  estimated_read_time_minutes: 5,
});

const normalizeStructuredFields = (
  structuredFields: ArticleStructuredFields | undefined,
  fallbackAuthor: string,
): ArticleStructuredFields => ({
  ...getDefaultStructuredFields(fallbackAuthor),
  ...structuredFields,
  file_urls: structuredFields?.file_urls || [],
  tags: structuredFields?.tags || [],
});

const getDefaultArticleFormData = (
  author: string,
  categoryId = "",
): ArticleFormState => ({
  title: "",
  category_id: categoryId,
  excerpt: "",
  body: "",
  status: DEFAULT_ARTICLE_STATUS,
  thumbnail: null,
  thumbnail_url: null,
  structured_fields: getDefaultStructuredFields(author),
});

const getArticleCategoryId = (
  article: Pick<ApiArticle, "category_id" | "category">,
  categories: ArticleCategory[] = [],
) => {
  if (article.category_id) {
    return article.category_id;
  }

  const categoryName =
    typeof article.category === "string"
      ? article.category
      : article.category?.name || "";

  return (
    categories.find((category) => category.name === categoryName)?.id || ""
  );
};

const getAssetName = (value: string) => {
  try {
    return decodeURIComponent(value.split("/").pop() || value);
  } catch {
    return value.split("/").pop() || value;
  }
};

const isImageUrl = (value: string) =>
  /\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i.test(value.split("?")[0]);

const translatePermissionRole = (role: string) => {
  const normalizedRole = role.trim().toLowerCase().replace(/\s+/g, "_");

  if (normalizedRole === "admin" || normalizedRole === "administrator") {
    return "Administrator";
  }

  if (normalizedRole === "moderator") {
    return "Moderator";
  }

  if (
    normalizedRole === "membre" ||
    normalizedRole === "member" ||
    normalizedRole === "editor" ||
    normalizedRole === "manager"
  ) {
    return role;
  }

  if (normalizedRole === "auditeur") {
    return "Auditeur";
  }

  if (normalizedRole === "comite_coproprietaire") {
    return "Comite coproprietaire";
  }

  if (normalizedRole === "partenaires_technicopro") {
    return "Partenaires Technicopro";
  }

  return role;
};

const SkeletonBar = ({ className }: { className: string }) => (
  <div className={`animate-pulse rounded-full bg-slate-100 ${className}`} />
);

const ArticleCardSkeleton = () => (
  <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden animate-pulse">
    <div className="h-40 bg-slate-100 relative">
      <div className="absolute top-2 right-2 flex gap-1">
        <div className="h-8 w-8 rounded-lg bg-white/80" />
        <div className="h-8 w-8 rounded-lg bg-white/80" />
        <div className="h-8 w-8 rounded-lg bg-white/80" />
      </div>
    </div>
    <div className="p-5 flex-1 flex flex-col text-left space-y-3">
      <div className="flex items-center justify-between">
        <SkeletonBar className="h-3 w-20" />
        <SkeletonBar className="h-3 w-24" />
      </div>
      <SkeletonBar className="h-4 w-4/5" />
      <SkeletonBar className="h-4 w-3/5" />
    </div>
  </div>
);

const ArticlesSectionSkeleton = ({
  count,
}: {
  count: number;
}) => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 lg:gap-8">
    {Array.from({ length: count }).map((_, index) => (
      <ArticleCardSkeleton key={index} />
    ))}
  </div>
);

const ArticlesPageSkeleton = ({
  showDraftsSection,
}: {
  showDraftsSection: boolean;
}) => (
  <div className="space-y-8 p-4 text-slate-900 sm:p-6 lg:p-8">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div className="space-y-4">
        <SkeletonBar className="h-10 w-52" />
        <SkeletonBar className="h-4 w-full max-w-[20rem]" />
      </div>
      <div className="flex flex-wrap gap-2">
        {showDraftsSection && <SkeletonBar className="h-12 w-40 rounded-xl" />}
        {showDraftsSection && <SkeletonBar className="h-12 w-40 rounded-xl" />}
      </div>
    </header>

    {showDraftsSection && (
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1 bg-slate-100 rounded-full animate-pulse" />
          <SkeletonBar className="h-7 w-32" />
          <SkeletonBar className="h-5 w-8 rounded-full" />
        </div>
        <ArticlesSectionSkeleton count={4} />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <SkeletonBar className="h-4 w-48" />
          <div className="flex items-center gap-3">
            <SkeletonBar className="h-4 w-20" />
            <SkeletonBar className="h-10 w-10 rounded-lg" />
            <SkeletonBar className="h-10 w-10 rounded-lg" />
          </div>
        </div>
      </section>
    )}

    <section className="space-y-6">
      {showDraftsSection && (
        <div className="flex items-center gap-3">
          <div className="h-8 w-1 bg-slate-100 rounded-full animate-pulse" />
          <SkeletonBar className="h-7 w-36" />
        </div>
      )}
      <ArticlesSectionSkeleton count={4} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SkeletonBar className="h-4 w-56" />
        <div className="flex items-center gap-3">
          <SkeletonBar className="h-4 w-20" />
          <SkeletonBar className="h-10 w-10 rounded-lg" />
          <SkeletonBar className="h-10 w-10 rounded-lg" />
        </div>
      </div>
    </section>
  </div>
);

const ArticleModalSkeleton = () => (
  <div className="space-y-6 max-h-[70vh] overflow-y-auto px-1 custom-scrollbar">
    <div className="space-y-2">
      <SkeletonBar className="h-3 w-24" />
      <div className="h-10 rounded-lg bg-slate-100 animate-pulse" />
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <SkeletonBar className="h-3 w-20" />
        <div className="h-10 rounded-lg bg-slate-100 animate-pulse" />
      </div>
      <div className="space-y-2">
        <SkeletonBar className="h-3 w-28" />
        <div className="h-10 rounded-lg bg-slate-100 animate-pulse" />
      </div>
    </div>

    <div className="space-y-2">
      <SkeletonBar className="h-3 w-24" />
      <div className="h-20 rounded-lg bg-slate-100 animate-pulse" />
    </div>

    <div className="space-y-2">
      <SkeletonBar className="h-3 w-28" />
      <div className="h-48 rounded-2xl bg-slate-100 animate-pulse" />
    </div>

    <div className="space-y-2">
      <SkeletonBar className="h-3 w-32" />
      <div className="h-36 rounded-2xl bg-slate-100 animate-pulse" />
    </div>

    <div className="h-14 rounded-xl bg-slate-100 animate-pulse" />
  </div>
);

const ArticleCard = ({ 
  article, 
  canPublishArticle,
  canEditArticle,
  canDeleteArticle,
  handlePublish, 
  handleOpenModal, 
  confirmDelete, 
  navigate,
}: { 
  article: any, 
  canPublishArticle: boolean,
  canEditArticle: boolean,
  canDeleteArticle: boolean,
  handlePublish: (id: string) => void, 
  handleOpenModal: (article: any) => void, 
  confirmDelete: (id: string) => void,
  navigate: (path: string) => void,
}) => {
  const { translate } = useI18n();
  const [imgError, setImgError] = useState(false);
  const canManage = canPublishArticle || canEditArticle || canDeleteArticle;
  const imageUrl =
    article.thumbnail_url ||
    article.structured_fields?.file_urls?.find((url: string) =>
      url.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i),
    );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={() => navigate(`/articles/${article.id}`)}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition-shadow hover:shadow-md cursor-pointer"
    >
      <div className="relative h-40 overflow-hidden bg-slate-100">
        {!imgError && imageUrl ? (
          <img 
            src={imageUrl} 
            alt={article.title}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-primary flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
            <span className="text-2xl font-black text-slate-900 tracking-tighter select-none">
              ARCHICOPRO
            </span>
          </div>
        )}
        <div className="absolute right-2 top-2 flex flex-wrap justify-end gap-1">
          {canManage && (
            <>
              {canPublishArticle && article.status !== 'published' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePublish(article.id);
                  }}
                  title={translate("articlesPage.publishArticle")}
                  className="p-2 bg-white/90 backdrop-blur rounded-lg text-slate-600 hover:text-emerald-600 shadow-sm transition-colors cursor-pointer"
                >
                  <Globe className="w-3 h-3" />
                </button>
              )}
              {canEditArticle && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenModal(article);
                  }}
                  title={translate("articlesPage.editArticle")}
                  className="p-2 bg-white/90 backdrop-blur rounded-lg text-slate-600 hover:text-primary-dark shadow-sm transition-colors cursor-pointer"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              )}
              {canDeleteArticle && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    confirmDelete(article.id);
                  }}
                  title={translate("articlesPage.deleteArticle")}
                  className="p-2 bg-white/90 backdrop-blur rounded-lg text-slate-600 hover:text-red-600 shadow-sm transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4 text-left sm:p-5">
        <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-[10px] font-bold text-primary-dark uppercase tracking-widest">
            {article.category}
          </span>
          <span className="text-[10px] text-slate-400 font-medium">
            {article.date}
          </span>
        </div>
        <h3 className="text-sm font-bold leading-snug group-hover:text-primary-dark transition-colors line-clamp-2">
          {article.title}
        </h3>
      </div>
    </motion.div>
  );
};

const stripRichText = (value: string | null | undefined) =>
  (value || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

export default function Articles() {
  const { localeCode, translate } = useI18n();
  const toast = useAppToast();
  const { user } = useSelector((state: RootState) => state.auth);
  const { hasPermission } = usePermissions();
  const isSuperuser = Boolean(user?.is_superuser);
  const canCreateArticle = hasPermission("article", "create");
  const canEditArticle = hasPermission("article", "edit");
  const canDeleteArticle = hasPermission("article", "delete");
  const canViewArticle = hasPermission("article", "view");
  const canManageCategories = isSuperuser;
  const canPublishArticle = canEditArticle;
  const canManageArticlePermissions = canEditArticle;
  const canSeeArticlePermissionsButton = isSuperuser;
  const canManageArticleContent =
    canCreateArticle || canEditArticle || canDeleteArticle;
  const defaultArticleAuthor = user?.firstName
    ? `${user.firstName} ${user.lastName}`
    : translate("articlesPage.defaultAuthor");

  const navigate = useNavigate();
  const { categoryId } = useParams<{ categoryId?: string }>();
  const [statusFilter, setStatusFilter] = useState<Extract<ArticleStatus, "published" | "pending" | "draft">>("published");
  const [publishedPage, setPublishedPage] = useState(1);
  const [pendingPage, setPendingPage] = useState(1);
  const [draftPage, setDraftPage] = useState(1);

  const {
    data: publishedArticlesData,
    isLoading: isLoadingPublished,
    isFetching: isFetchingPublished,
    isError: isPublishedError,
  } = useGetArticlesQuery({
    page: publishedPage,
    pageSize: ARTICLES_PAGE_SIZE,
    status: "published",
    category_id: categoryId,
  });
  const {
    data: pendingArticlesData,
    isLoading: isLoadingPending,
    isFetching: isFetchingPending,
    isError: isPendingError,
  } = useGetArticlesQuery(
    {
      page: pendingPage,
      pageSize: ARTICLES_PAGE_SIZE,
      status: "pending",
      category_id: categoryId,
    },
    {
      skip: !isSuperuser,
    } as any,
  );
  const {
    data: draftArticlesData,
    isLoading: isLoadingDrafts,
    isFetching: isFetchingDrafts,
    isError: isDraftsError,
  } = useGetArticlesQuery(
    {
      page: draftPage,
      pageSize: ARTICLES_PAGE_SIZE,
      status: "draft",
      category_id: categoryId,
    },
    {
      skip: !canManageArticleContent,
    } as any,
  );
  const { data: categoriesData } = useGetArticleCategoriesQuery();
  const { data: userRolesData = [] } = useGetUserRolesQuery();

  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(
    null,
  );
  const { data: articleDetail, isFetching: isFetchingDetail } =
    useGetArticleByIdQuery(selectedArticleId!, {
      skip: !selectedArticleId,
    });

  // Mutations
  const [createArticle, { isLoading: isCreating }] = useCreateArticleMutation();
  const [updateArticle, { isLoading: isUpdating }] = useUpdateArticleMutation();
  const [createCategory, { isLoading: isCreatingCategory }] =
    useCreateArticleCategoryMutation();
  const [updateCategory, { isLoading: isUpdatingCategory }] =
    useUpdateArticleCategoryMutation();
  const [deleteCategory, { isLoading: isDeletingCategory }] =
    useDeleteArticleCategoryMutation();
  const [deleteArticle, { isLoading: isDeleting }] = useDeleteArticleMutation();
  const [publishArticle] = usePublishArticleMutation();
  const [setArticlePermission, { isLoading: isSettingArticlePermission }] =
    useSetArticlePermissionMutation();
  const [uploadFile] = useUploadFileMutation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingArticle, setEditingArticle] = useState<any | null>(null);
  const [formData, setFormData] = useState<ArticleFormState>(
    getDefaultArticleFormData(defaultArticleAuthor),
  );
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string | null>(
    null,
  );
  const [editingCategory, setEditingCategory] = useState<ArticleCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    description: "",
  });
  const [categoryDeletingId, setCategoryDeletingId] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedArticlePermissionId, setSelectedArticlePermissionId] =
    useState<string | null>(null);
  const [permissionTab, setPermissionTab] = useState<"view" | "edit">("view");
  const [permissionData, setPermissionData] = useState<{
    articleIds: string[];
    roleIds: string[];
    canRead: boolean;
    canWrite: boolean;
  }>({
    articleIds: [],
    roleIds: [],
    canRead: true,
    canWrite: true,
  });

  const { data: currentPermissions, isLoading: isLoadingCurrentPermissions } =
    useGetArticlePermissionsQuery(selectedArticlePermissionId || "", {
      skip: !selectedArticlePermissionId || !isPermissionModalOpen,
    });

  const mapArticlesForUi = (articles: ApiArticle[] = []) =>
    articles.map((article) => ({
      ...article,
      category: article.category?.name ?? "",
      date: new Date(article.created_at).toLocaleDateString(localeCode, {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      author:
        article.structured_fields?.author ||
        translate("articlesPage.defaultAuthor"),
      slug: article.id,
    }));

  const publishedArticles = mapArticlesForUi(publishedArticlesData?.results || []);
  const pendingArticles = mapArticlesForUi(pendingArticlesData?.results || []);
  const draftArticles = mapArticlesForUi(draftArticlesData?.results || []);
  const selectedCategory = categoriesData?.find((category) => category.id === categoryId);
  const permissionArticles = React.useMemo(
    () =>
      Array.from(
        new Map(
          [...pendingArticles, ...draftArticles, ...publishedArticles].map((article) => [
            article.id,
            article,
          ]),
        ).values(),
      ),
    [draftArticles, pendingArticles, publishedArticles],
  );
  const permissionRoleOptions = React.useMemo(
    () =>
      userRolesData.map((role) => ({
        id: role.id,
        label: translatePermissionRole(role.slug || role.name),
      })),
    [userRolesData],
  );
  const permissionRoleLabelsById = React.useMemo(
    () =>
      Object.fromEntries(
        userRolesData.map((role) => [
          role.id,
          translatePermissionRole(role.slug || role.name),
        ]),
      ),
    [userRolesData],
  );

  useEffect(() => {
    if (!formData.thumbnail) {
      setThumbnailPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(formData.thumbnail);
    setThumbnailPreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [formData.thumbnail]);

  // Sync article detail to form when fetched
  useEffect(() => {
    if (articleDetail && selectedArticleId) {
      setFormData({
        title: articleDetail.title,
        category_id: getArticleCategoryId(articleDetail, categoriesData),
        excerpt: articleDetail.excerpt || "",
        body: articleDetail.body || "",
        status: articleDetail.status || DEFAULT_ARTICLE_STATUS,
        thumbnail: null,
        thumbnail_url: articleDetail.thumbnail_url || null,
        structured_fields: normalizeStructuredFields(
          articleDetail.structured_fields,
          defaultArticleAuthor,
        ),
      });
      setEditingArticle(articleDetail);
      setSelectedFiles([]);
    }
  }, [articleDetail, selectedArticleId, defaultArticleAuthor, categoriesData]);

  useEffect(() => {
    if (!permissionArticles.length) {
      return;
    }

    const defaultArticlePermissionId = permissionArticles[0].id;

    if (
      !selectedArticlePermissionId ||
      !permissionArticles.some((article) => article.id === selectedArticlePermissionId)
    ) {
      setSelectedArticlePermissionId(defaultArticlePermissionId);
    }
  }, [permissionArticles, selectedArticlePermissionId]);

  useEffect(() => {
    if (permissionData.articleIds.length > 0 || !permissionArticles.length) {
      return;
    }

    setPermissionData((prev) => ({
      ...prev,
      articleIds: [permissionArticles[0].id],
    }));
  }, [permissionArticles, permissionData.articleIds.length]);

  useEffect(() => {
    if (permissionData.roleIds.length > 0 || !userRolesData.length) {
      return;
    }

    setPermissionData((prev) => ({
      ...prev,
      roleIds: [userRolesData[0].id],
    }));
  }, [permissionData.roleIds.length, userRolesData]);

  useEffect(() => {
    setPublishedPage(1);
    setPendingPage(1);
    setDraftPage(1);
  }, [categoryId, statusFilter]);

  const handleOpenModal = (article?: ApiArticle) => {
    if ((article && !canEditArticle) || (!article && !canCreateArticle)) {
      return;
    }

    if (article) {
      setSelectedArticleId(article.id);
      // Initial partial set from list data while detail fetches
      setEditingArticle(article);
      setFormData({
        title: article.title,
        category_id: getArticleCategoryId(article, categoriesData),
        excerpt: article.excerpt || "",
        body: article.body || "",
        status: article.status || DEFAULT_ARTICLE_STATUS,
        thumbnail: null,
        thumbnail_url: article.thumbnail_url || null,
        structured_fields: normalizeStructuredFields(
          article.structured_fields,
          defaultArticleAuthor,
        ),
      });
      setSelectedFiles([]);
    } else {
      setSelectedArticleId(null);
      setEditingArticle(null);
      setFormData(
        getDefaultArticleFormData(
          defaultArticleAuthor,
          categoriesData?.[0]?.id || "",
        ),
      );
      setSelectedFiles([]);
    }
    setIsModalOpen(true);
  };

  const showRequiredFieldError = (fieldLabel: string) => {
    const message = translate("common.requiredField", {
      field: fieldLabel,
    });
    toast.error(message);
  };

  const showSelectAtLeastOneError = (fieldLabel: string) => {
    toast.error(
      translate("common.selectAtLeastOne", {
        field: fieldLabel,
      }),
    );
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if ((editingArticle && !canEditArticle) || (!editingArticle && !canCreateArticle)) {
      return;
    }

    const hasThumbnail = Boolean(formData.thumbnail || formData.thumbnail_url);

    if (!formData.title.trim()) {
      showRequiredFieldError(translate("articlesPage.articleTitle"));
      return;
    }

    if (!formData.category_id) {
      showRequiredFieldError(translate("articlesPage.category"));
      return;
    }

    if (!stripRichText(formData.body)) {
      showRequiredFieldError(translate("articlesPage.contentEditor"));
      return;
    }

    if (!hasThumbnail) {
      showRequiredFieldError(translate("articlesPage.thumbnailLabel"));
      return;
    }

    const payload: CreateArticleRequest = {
      title: formData.title,
      category_id: formData.category_id,
      excerpt: formData.excerpt,
      body: formData.body,
      status: formData.status,
      thumbnail: formData.thumbnail,
      structured_fields: formData.structured_fields,
      files: selectedFiles,
    };

    try {
      if (editingArticle) {
        await updateArticle({ id: editingArticle.id, data: payload }).unwrap();
      } else {
        await createArticle(payload).unwrap();
      }

      toast.success(translate("articlesPage.success"));
      setIsModalOpen(false);
      setSelectedArticleId(null);
      setSelectedFiles([]);
      setFormData(
        getDefaultArticleFormData(
          defaultArticleAuthor,
          categoriesData?.[0]?.id || "",
        ),
      );
    } catch (err: any) {
      const message = getApiErrorDisplayMessage(
        err,
        translate,
        "apiErrors.default",
      );
      toast.error(message);
    }
  };

  const handleImageUpload = async (file: File): Promise<string> => {
    try {
      const data = new FormData();
      data.append("file", file);
      const result = await uploadFile(data).unwrap();
      return result.url;
    } catch (error) {
      toast.error(getApiErrorDisplayMessage(error, translate, "apiErrors.default"));
      throw error;
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const handleThumbnailChange = (file: File | null) => {
    setFormData((prev) => ({
      ...prev,
      thumbnail: file,
    }));
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const resetCategoryForm = () => {
    setEditingCategory(null);
    setCategoryForm({
      name: "",
      description: "",
    });
  };

  const handleAddCategory = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!categoryForm.name.trim()) {
      const message = translate("common.requiredField", {
        field: translate("articlesPage.categoryName"),
      });
      toast.error(message);
      return;
    }

    try {
      if (editingCategory) {
        await updateCategory({
          id: editingCategory.id,
          name: categoryForm.name.trim(),
          description: categoryForm.description.trim() || null,
        }).unwrap();
      } else {
        await createCategory({
          name: categoryForm.name.trim(),
          description: categoryForm.description.trim() || null,
        }).unwrap();
      }

      resetCategoryForm();
      setIsCategoryModalOpen(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err: any) {
      const message = getApiErrorDisplayMessage(
        err,
        translate,
        "apiErrors.default",
      );
      toast.error(message);
    }
  };

  const handleEditCategory = (category: ArticleCategory) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      description: category.description || "",
    });
  };

  const handleDeleteCategory = async (categoryId: string) => {
    setCategoryDeletingId(categoryId);
    try {
      await deleteCategory(categoryId).unwrap();
      if (editingCategory?.id === categoryId) {
        resetCategoryForm();
      }
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err: any) {
      const message = getApiErrorDisplayMessage(
        err,
        translate,
        "apiErrors.default",
      );
      toast.error(message);
    } finally {
      setCategoryDeletingId(null);
    }
  };

  const confirmDelete = (id: string) => {
    if (!canDeleteArticle) return;
    setDeletingId(id);
    setIsConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (deletingId) {
      try {
        await deleteArticle(deletingId).unwrap();
        setIsConfirmOpen(false);
        setDeletingId(null);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      } catch (err: any) {
        toast.error(getApiErrorDisplayMessage(err, translate, "apiErrors.default"));
      }
    }
  };

  const handlePublish = async (id: string) => {
    if (!canPublishArticle) return;

    try {
      await publishArticle(id).unwrap();
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err: any) {
      toast.error(getApiErrorDisplayMessage(err, translate, "apiErrors.default"));
    }
  };

  const handleSetArticlePermission = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canManageArticlePermissions) return;

    if (!permissionData.articleIds.length) {
      showSelectAtLeastOneError(translate("common.articles"));
      return;
    }

    if (!permissionData.roleIds.length) {
      showSelectAtLeastOneError(translate("articlesPage.role"));
      return;
    }

    try {
      await setArticlePermission({
        article_id: permissionData.articleIds,
        role_id: permissionData.roleIds,
        can_read: permissionData.canRead,
        can_write: permissionData.canWrite,
      }).unwrap();

      setIsPermissionModalOpen(false);
      setPermissionTab("view");
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err: any) {
      toast.error(getApiErrorDisplayMessage(err, translate, "apiErrors.default"));
    }
  };

  const publishedTotalPages = publishedArticlesData
    ? Math.max(
        1,
        publishedArticlesData.total_pages ||
          Math.ceil(
            publishedArticlesData.total /
              (publishedArticlesData.page_size || ARTICLES_PAGE_SIZE),
          ),
      )
    : 1;
  const pendingTotalPages = pendingArticlesData
    ? Math.max(
        1,
        pendingArticlesData.total_pages ||
          Math.ceil(
            pendingArticlesData.total /
              (pendingArticlesData.page_size || ARTICLES_PAGE_SIZE),
          ),
      )
    : 1;
  const draftTotalPages = draftArticlesData
    ? Math.max(
        1,
        draftArticlesData.total_pages ||
          Math.ceil(
            draftArticlesData.total /
              (draftArticlesData.page_size || ARTICLES_PAGE_SIZE),
          ),
      )
    : 1;
  const activeArticles =
    statusFilter === "published"
      ? publishedArticles
      : statusFilter === "pending"
        ? pendingArticles
        : draftArticles;
  const activeIsLoading =
    statusFilter === "published"
      ? isLoadingPublished
      : statusFilter === "pending"
        ? isLoadingPending
        : isLoadingDrafts;
  const activeIsFetching =
    statusFilter === "published"
      ? isFetchingPublished
      : statusFilter === "pending"
        ? isFetchingPending
        : isFetchingDrafts;
  const activeIsError =
    statusFilter === "published"
      ? isPublishedError
      : statusFilter === "pending"
        ? isPendingError
        : isDraftsError;
  const activePage =
    statusFilter === "published"
      ? publishedPage
      : statusFilter === "pending"
        ? pendingPage
        : draftPage;
  const activeTotalPages =
    statusFilter === "published"
      ? publishedTotalPages
      : statusFilter === "pending"
        ? pendingTotalPages
        : draftTotalPages;
  const activeTotal =
    statusFilter === "published"
      ? publishedArticlesData?.total || 0
      : statusFilter === "pending"
        ? pendingArticlesData?.total || 0
        : draftArticlesData?.total || 0;
  const setActivePage =
    statusFilter === "published"
      ? setPublishedPage
      : statusFilter === "pending"
        ? setPendingPage
        : setDraftPage;
  const activeEmptyMessage =
    statusFilter === "published"
      ? translate("articlesPage.noPublished")
      : statusFilter === "pending"
        ? translate("articlesPage.noPending")
        : translate("articlesPage.noDrafts");
  const activeErrorMessage =
    statusFilter === "published"
      ? translate("articlesPage.articlesLoadError")
      : statusFilter === "pending"
        ? translate("articlesPage.pendingLoadError")
        : translate("articlesPage.draftsLoadError");
  const activeShowingMessage =
    statusFilter === "published"
      ? translate("articlesPage.showingPublished", {
          count: activeArticles.length,
          total: activeTotal,
        })
      : statusFilter === "pending"
        ? translate("articlesPage.showingPending", {
            count: activeArticles.length,
            total: activeTotal,
          })
        : translate("articlesPage.showingDrafts", {
            count: activeArticles.length,
            total: activeTotal,
          });
  const showInitialPageSkeleton =
    isLoadingPublished &&
    publishedArticles.length === 0 &&
    (!canManageArticleContent ||
      ((isLoadingPending && pendingArticles.length === 0) &&
        (isLoadingDrafts && draftArticles.length === 0)));

  if (!canViewArticle) {
    return <Navigate to="/" replace state={{ accessRestricted: true }} />;
  }

  if (showInitialPageSkeleton) {
    return <ArticlesPageSkeleton showDraftsSection={canManageArticleContent} />;
  }

  return (
    <div className="space-y-8 p-4 text-slate-900 sm:p-6 lg:p-8">
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 font-bold"
          >
            <CheckCircle2 className="w-5 h-5" />
            {translate("articlesPage.success")}
          </motion.div>
        )}
      </AnimatePresence>

      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 underline decoration-primary decoration-4 underline-offset-8 sm:text-3xl">
            {selectedCategory?.name || translate("articlesPage.title")}
          </h2>
          {selectedCategory?.description ? (
            <p className="mt-3 max-w-2xl text-sm font-medium text-slate-500">
              {selectedCategory.description}
            </p>
          ) : null}
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          {canSeeArticlePermissionsButton && (
            <button
              onClick={() => {
                setPermissionTab("view");
                setSelectedArticlePermissionId(
                  selectedArticlePermissionId || permissionArticles[0]?.id || null,
                );
                setIsPermissionModalOpen(true);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-900 shadow-sm transition-all hover:bg-slate-50 cursor-pointer sm:w-auto"
            >
              <Shield className="w-5 h-5 text-primary" />
              Permission
            </button>
          )}
          {canManageCategories && (
            <button
              onClick={() => setIsCategoryModalOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-900 shadow-sm transition-all hover:bg-slate-50 cursor-pointer sm:w-auto"
            >
              <Grid className="w-5 h-5 text-primary" />
              {translate("articlesPage.newCategory")}
            </button>
          )}

          {canCreateArticle && (
            <button
              onClick={() => handleOpenModal()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white shadow-lg transition-all hover:bg-slate-800 cursor-pointer sm:w-auto"
            >
              <Newspaper className="w-5 h-5 text-primary" />
              {translate("articlesPage.writeArticle")}
            </button>
          )}
        </div>
      </header>

      {canManageArticleContent ? (
        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          {(["published", "pending", "draft"] as const)
            .filter((status) => status !== "pending" || isSuperuser)
            .map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest transition-colors ${
                  statusFilter === status
                    ? "bg-slate-900 text-white"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {translate(`articlesPage.status${status.charAt(0).toUpperCase()}${status.slice(1)}`)}
              </button>
            ))}
        </div>
      ) : null}

      <section className="space-y-6">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {activeIsLoading ? (
              <div className="col-span-full">
                <ArticlesSectionSkeleton count={4} />
              </div>
            ) : activeIsError ? (
              <div className="col-span-full rounded-3xl border border-red-100 bg-red-50 p-12 text-center">
                <p className="font-bold text-red-600">{activeErrorMessage}</p>
              </div>
            ) : activeArticles.length === 0 ? (
              <div className="col-span-full rounded-3xl border border-slate-100 bg-slate-50 p-12 text-center">
                <p className="font-bold text-slate-500">{activeEmptyMessage}</p>
              </div>
            ) : (
              activeArticles.map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  canPublishArticle={canPublishArticle}
                  canEditArticle={canEditArticle}
                  canDeleteArticle={canDeleteArticle}
                  handlePublish={handlePublish}
                  handleOpenModal={handleOpenModal}
                  confirmDelete={confirmDelete}
                  navigate={navigate}
                />
              ))
            )}
          </AnimatePresence>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            {activeShowingMessage}
            {activeIsFetching && !activeIsLoading
              ? translate("articlesPage.refreshing")
              : ""}
          </p>
          <div className="flex flex-wrap items-center gap-3 sm:justify-end">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
              {translate("articlesPage.pageOf", {
                current: activePage,
                total: activeTotalPages,
              })}
            </span>
            <button
              type="button"
              onClick={() => setActivePage((currentPage) => Math.max(1, currentPage - 1))}
              className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50 disabled:opacity-30"
              disabled={activePage <= 1 || activeIsFetching}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                setActivePage((currentPage) => Math.min(activeTotalPages, currentPage + 1))
              }
              className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50 disabled:opacity-30"
              disabled={activePage >= activeTotalPages || activeIsFetching}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>


      {/* <div className="bg-slate-100/50 p-12 rounded-3xl flex flex-col items-center text-center marker-class">
        <Tag className="w-12 h-12 text-primary-dark mb-4" />
        <h3 className="text-2xl font-bold">
          {translate("articlesPage.exploreByCategories")}
        </h3>
        <div className="flex flex-wrap justify-center gap-3 mt-6">
          {categories.map(cat => (
            <button key={cat} className="px-6 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold shadow-sm hover:border-primary hover:text-primary-dark transition-all">
              {cat}
            </button>
          ))}
        </div>
      </div> */}

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedArticleId(null);
        }}
        title={
          editingArticle
            ? translate("articlesPage.editArticle")
            : translate("articlesPage.writeNewArticle")
        }
        maxWidth="max-w-4xl"
      >
        {isFetchingDetail ? (
          <ArticleModalSkeleton />
        ) : (
          <form
            noValidate
            onSubmit={handleSubmit}
            className="space-y-6 max-h-[70vh] overflow-y-auto px-1 custom-scrollbar"
          >
            <div className="space-y-2 text-left">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {translate("articlesPage.articleTitle")}
                </label>
              <input
                required
                type="text"
                placeholder={translate("articlesPage.articleTitlePlaceholder")}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                value={formData.title || ""}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 text-left">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {translate("articlesPage.category")}
                </label>
                <select
                  required
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  value={formData.category_id || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, category_id: e.target.value })
                  }
                >
                  <option value="" disabled>
                    {translate("articlesPage.selectCategory")}
                  </option>
                  {categoriesData?.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 text-left">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {translate("articlesPage.status")}
                </label>
                <select
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      status: e.target.value as ArticleStatus,
                    })
                  }
                >
                  <option value="pending">
                    {translate("articlesPage.statusPending")}
                  </option>
                  <option value="draft">
                    {translate("articlesPage.statusDraft")}
                  </option>
                  <option value="published">
                    {translate("articlesPage.statusPublished")}
                  </option>
                </select>
              </div>
            </div>

            <div className="space-y-2 text-left">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {translate("articlesPage.excerptOptional")}
              </label>
              <textarea
                rows={2}
                placeholder={translate("articlesPage.excerptPlaceholder")}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none resize-none"
                value={formData.excerpt || ""}
                onChange={(e) =>
                  setFormData({ ...formData, excerpt: e.target.value })
                }
              />
            </div>

            <div className="space-y-2 text-left">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {translate("articlesPage.contentEditor")}
              </label>
              <TiptapEditor
                content={formData.body || ""}
                onChange={(content) =>
                  setFormData({ ...formData, body: content })
                }
                placeholder={translate("articlesPage.contentPlaceholder")}
                onImageUpload={handleImageUpload}
              />
            </div>

            <div className="space-y-2 text-left">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {translate("articlesPage.thumbnailLabel")}
              </label>
              <div className="grid items-stretch gap-4 md:grid-cols-[minmax(0,1.35fr)_280px]">
                <FileUploadDropzone
                  inputId="article-thumbnail-upload"
                  accept="image/*"
                  multiple={false}
                  title={translate("articlesPage.uploadThumbnail")}
                  className="h-full md:min-h-[336px]"
                  selectedLabel={
                    formData.thumbnail
                      ? formData.thumbnail.name
                      : formData.thumbnail_url
                        ? translate("articlesPage.replaceThumbnail")
                        : undefined
                  }
                  hint={translate("articlesPage.thumbnailHelp")}
                  onFilesSelected={(files) => handleThumbnailChange(files[0] || null)}
                />
                <div className="flex h-full w-full max-w-[280px] justify-self-center md:max-w-none md:justify-self-auto">
                  {formData.thumbnail || formData.thumbnail_url ? (
                    <FilePreviewCard
                      file={formData.thumbnail}
                      url={thumbnailPreviewUrl || formData.thumbnail_url || undefined}
                      name={
                        formData.thumbnail?.name ||
                        getAssetName(formData.thumbnail_url || "") ||
                        translate("articlesPage.thumbnailLabel")
                      }
                      subtitle={
                        formData.thumbnail
                          ? null
                          : translate("articlesPage.viewDocument")
                      }
                      className="h-full w-full"
                      onRemove={
                        formData.thumbnail ? () => handleThumbnailChange(null) : undefined
                      }
                      aspectClassName="aspect-square"
                    />
                  ) : (
                    <div className="flex h-full min-h-[336px] w-full items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6">
                      <div className="flex h-28 w-28 items-center justify-center rounded-full bg-white text-center text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 shadow-sm">
                        {translate("articlesPage.thumbnailLabel")}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2 text-left">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {translate("articlesPage.attachmentsOptional")}
              </label>
              <FileUploadDropzone
                inputId="article-attachments-upload"
                title={translate("articlesPage.uploadPrompt")}
                hint={translate("articlesPage.uploadHelp")}
                selectedLabel={
                  selectedFiles.length
                    ? translate("articlesPage.filesSelected", {
                        count: selectedFiles.length,
                      })
                    : undefined
                }
                onFilesSelected={(files) =>
                  setSelectedFiles((prev) => [...prev, ...files])
                }
                preview={
                  selectedFiles.length ? (
                    <SelectedFilesPreview
                      files={selectedFiles}
                      onRemove={removeFile}
                      className="h-full w-full"
                    />
                  ) : undefined
                }
                emptyPreview={
                  <div className="flex h-full min-h-[336px] w-full items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6">
                    <div className="flex h-28 w-28 items-center justify-center rounded-full bg-white px-3 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 shadow-sm">
                      {translate("articlesPage.attachmentsOptional")}
                    </div>
                  </div>
                }
              />

              {/* Existing Attachments */}
              {formData.structured_fields?.file_urls &&
                formData.structured_fields.file_urls.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {translate("articlesPage.existingAttachments")}
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {formData.structured_fields.file_urls.map(
                      (url: string, idx: number) => {
                        const fileName =
                          getAssetName(url) ||
                          translate("articlesPage.attachmentFallback", {
                            count: idx + 1,
                          });
                        return (
                          <FilePreviewCard
                            key={`existing-${idx}`}
                            url={url}
                            href={url}
                            name={fileName}
                            subtitle={translate("articlesPage.viewDocument")}
                            onRemove={() => {
                              const updatedUrls =
                                formData.structured_fields.file_urls.filter(
                                  (u: string) => u !== url,
                                );
                              setFormData({
                                ...formData,
                                structured_fields: {
                                  ...formData.structured_fields,
                                  file_urls: updatedUrls,
                                },
                              });
                            }}
                          />
                        );
                      },
                    )}
                    </div>
                  </div>
                )}
            </div>

            <button
              type="submit"
              disabled={isCreating || isUpdating}
              className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all mt-6 shadow-xl uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isCreating || isUpdating ? (
                <span>
                  {editingArticle
                    ? translate("articlesPage.updatingArticle")
                    : translate("articlesPage.creatingArticle")}
                </span>
              ) : (
                <span>
                  {editingArticle
                    ? translate("articlesPage.updateArticle")
                    : translate("articlesPage.createArticle")}
                </span>
              )}
            </button>
          </form>
        )}
      </Modal>

      <Modal
        isOpen={isPermissionModalOpen}
        onClose={() => setIsPermissionModalOpen(false)}
        title={translate("articlesPage.articlePermissions")}
        maxWidth="max-w-5xl"
      >
        <div className="mb-6 flex gap-6 border-b border-slate-100">
          <button
            onClick={() => setPermissionTab("view")}
            className={`relative pb-2 text-xs font-black uppercase tracking-widest transition-all cursor-pointer ${
              permissionTab === "view"
                ? "text-primary"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            {translate("articlesPage.currentPermissions")}
            {permissionTab === "view" && (
              <motion.div
                layoutId="articlePermissionTab"
                className="absolute -bottom-[1px] left-0 right-0 h-0.5 bg-primary"
              />
            )}
          </button>
          <button
            onClick={() => setPermissionTab("edit")}
            className={`relative pb-2 text-xs font-black uppercase tracking-widest transition-all cursor-pointer ${
              permissionTab === "edit"
                ? "text-primary"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            {translate("articlesPage.managePermissions")}
            {permissionTab === "edit" && (
              <motion.div
                layoutId="articlePermissionTab"
                className="absolute -bottom-[1px] left-0 right-0 h-0.5 bg-primary"
              />
            )}
          </button>
        </div>

        {permissionTab === "view" ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {translate("articlesPage.selectArticleToView")}
              </label>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
                <div className="grid grid-cols-1 gap-2">
                  {permissionArticles.map((article) => (
                    <label
                      key={article.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md p-2 transition-colors hover:bg-white"
                    >
                      <input
                        type="radio"
                        name="article-permission"
                        checked={selectedArticlePermissionId === article.id}
                        onChange={() => setSelectedArticlePermissionId(article.id)}
                        className="h-4 w-4 border-slate-300 text-primary focus:ring-primary"
                      />
                      <span className="text-sm font-medium text-slate-700">
                        {article.title}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {selectedArticlePermissionId ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {translate("articlesPage.currentPermissionsFor")}{" "}
                    {currentPermissions?.[0]?.article_title ||
                      permissionArticles.find(
                        (article) => article.id === selectedArticlePermissionId,
                      )?.title ||
                      ""}
                  </label>
                  <button
                    onClick={() => {
                      setPermissionData((prev) => ({
                        ...prev,
                        articleIds: [selectedArticlePermissionId],
                      }));
                      setPermissionTab("edit");
                    }}
                    className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline cursor-pointer"
                  >
                    {translate("articlesPage.editThese")}
                  </button>
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  {isLoadingCurrentPermissions ? (
                    <div className="animate-pulse space-y-3 p-4">
                      <div className="grid grid-cols-[2fr,1fr,1fr] gap-3">
                        <div className="h-4 rounded bg-slate-100" />
                        <div className="h-4 rounded bg-slate-100" />
                        <div className="h-4 rounded bg-slate-100" />
                      </div>
                      {Array.from({ length: 4 }).map((_, index) => (
                        <div
                          key={index}
                          className="grid grid-cols-[2fr,1fr,1fr] items-center gap-3"
                        >
                          <div className="h-4 rounded bg-slate-100" />
                          <div className="mx-auto h-5 w-5 rounded-full bg-slate-100" />
                          <div className="mx-auto h-5 w-5 rounded-full bg-slate-100" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <table className="min-w-[420px] w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-100/50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                          <th className="px-4 py-3 text-left">
                            {translate("articlesPage.role")}
                          </th>
                          <th className="px-4 py-3 text-center">
                            {translate("articlesPage.read")}
                          </th>
                          <th className="px-4 py-3 text-center">
                            {translate("articlesPage.write")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(currentPermissions || []).map((permission: ArticlePermission) => (
                          <tr
                            key={permission.id}
                            className="transition-colors hover:bg-white"
                          >
                            <td className="px-4 py-3 font-bold capitalize text-slate-700">
                              {permission.role_name
                                ? translatePermissionRole(permission.role_name)
                                : permissionRoleLabelsById[permission.role_id] || ""}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {permission.can_read ? (
                                <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-500" />
                              ) : (
                                <div className="mx-auto h-2 w-2 rounded-full bg-slate-300" />
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {permission.can_write ? (
                                <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-500" />
                              ) : (
                                <div className="mx-auto h-2 w-2 rounded-full bg-slate-300" />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <form onSubmit={handleSetArticlePermission} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {translate("articlesPage.selectArticlesToUpdate")}
              </label>
              <div className="grid max-h-40 grid-cols-1 gap-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
                {permissionArticles.map((article) => (
                  <label
                    key={article.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md p-2 transition-colors hover:bg-white"
                  >
                    <input
                      type="checkbox"
                      checked={permissionData.articleIds.includes(article.id)}
                      onChange={(event) => {
                        const nextArticleIds = event.target.checked
                          ? [...permissionData.articleIds, article.id]
                          : permissionData.articleIds.filter((id) => id !== article.id);
                        setPermissionData({
                          ...permissionData,
                          articleIds: nextArticleIds,
                        });
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-medium text-slate-700">
                      {article.title}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {translate("articlesPage.rolesToUpdate")}
              </label>
              <div className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 sm:grid-cols-2">
                {permissionRoleOptions.map((role) => (
                  <label
                    key={role.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md p-2 transition-colors hover:bg-white"
                  >
                    <input
                      type="checkbox"
                      checked={permissionData.roleIds.includes(role.id)}
                      onChange={(event) => {
                        const nextRoleIds = event.target.checked
                          ? [...permissionData.roleIds, role.id]
                          : permissionData.roleIds.filter((id) => id !== role.id);
                        setPermissionData({
                          ...permissionData,
                          roleIds: nextRoleIds,
                        });
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-medium text-slate-700">
                      {role.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {translate("articlesPage.accessSettings")}
              </label>
              <div className="space-y-3">
                <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 transition-colors hover:bg-white">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    {translate("articlesPage.canRead")}
                  </span>
                  <input
                    type="checkbox"
                    checked={permissionData.canRead}
                    onChange={(event) =>
                      setPermissionData({
                        ...permissionData,
                        canRead: event.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                </label>
                <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 transition-colors hover:bg-white">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    {translate("articlesPage.canWrite")}
                  </span>
                  <input
                    type="checkbox"
                    checked={permissionData.canWrite}
                    onChange={(event) =>
                      setPermissionData({
                        ...permissionData,
                        canWrite: event.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSettingArticlePermission}
              className="mt-4 w-full cursor-pointer rounded-xl bg-slate-900 py-4 text-xs font-bold uppercase tracking-[0.2em] text-white shadow-xl transition-all hover:bg-slate-800 disabled:opacity-50"
            >
              {isSettingArticlePermission
                ? "Saving"
                : "Apply Bulk Permissions"}
            </button>
          </form>
        )}
      </Modal>

      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => {
          setIsCategoryModalOpen(false);
          resetCategoryForm();
        }}
        title={
          editingCategory
            ? translate("articlesPage.updateCategory")
            : translate("articlesPage.addNewCategory")
        }
      >
        <form noValidate onSubmit={handleAddCategory} className="space-y-4">
          <div className="space-y-2 text-left">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {translate("articlesPage.categoryName")}
            </label>
            <input
              required
              autoFocus
              disabled={isCreatingCategory || isUpdatingCategory}
              type="text"
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none disabled:opacity-50"
              value={categoryForm.name}
              onChange={(e) =>
                setCategoryForm((current) => ({ ...current, name: e.target.value }))
              }
              placeholder={translate("articlesPage.categoryNamePlaceholder")}
            />
          </div>

          <div className="space-y-2 text-left">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {translate("common.description")}
            </label>
            <textarea
              disabled={isCreatingCategory || isUpdatingCategory}
              className="min-h-24 w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none disabled:opacity-50"
              value={categoryForm.description}
              onChange={(e) =>
                setCategoryForm((current) => ({
                  ...current,
                  description: e.target.value,
                }))
              }
              placeholder={translate("articlesPage.categoryDescriptionPlaceholder")}
            />
          </div>

          {categoriesData?.length ? (
            <div className="space-y-3 border-t border-slate-100 pt-4 text-left">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {translate("articlesPage.existingCategories")}
              </p>
              <div className="space-y-2">
                {categoriesData.map((category) => (
                  <div
                    key={category.id}
                    className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {category.name}
                      </p>
                      {category.description ? (
                        <p className="mt-1 line-clamp-2 text-xs font-medium text-slate-500">
                          {category.description}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => handleEditCategory(category)}
                        className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900 cursor-pointer"
                        title={translate("articlesPage.updateCategory")}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(category.id)}
                        disabled={categoryDeletingId === category.id || isDeletingCategory}
                        className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 cursor-pointer"
                        title={translate("articlesPage.deleteCategory")}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={
              isCreatingCategory || isUpdatingCategory || !categoryForm.name.trim()
            }
            className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all mt-6 shadow-xl uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isCreatingCategory || isUpdatingCategory ? (
              <span>{translate("articlesPage.creating")}</span>
            ) : (
              <span>
                {editingCategory
                  ? translate("articlesPage.updateCategory")
                  : translate("articlesPage.createCategory")}
              </span>
            )}
          </button>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleDelete}
        title={translate("articlesPage.deleteArticle")}
        message={translate("articlesPage.deleteArticleMessage")}
        confirmText={translate("articlesPage.deleteArticleConfirm")}
        cancelText={translate("common.cancel")}
        isLoading={isDeleting}
      />
    </div>
  );
}
