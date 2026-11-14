import { ModalFieldGrid, ModalSection, ModalMediaSplit, ModalSubmitButton } from "../components/ui/ModalLayout";
import "./ArticleForumModals.css";
import { ContentCard, ContentCardSkeleton, ContentPageHeader, ContentStatusField, ContentStatusTabs, useListingStatus } from "../components/ui/ContentListing";
import CategoryManagerDialog, { type CategoryValues } from "../components/ui/CategoryManagerDialog";
import React, { useState, useEffect } from "react";
import {
  FileText,
  Trash2,
  Edit2,
  CheckCircle2,
  Globe,
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
import { useArticleAuthorization } from "../hooks/useArticleAuthorization";
import { usePermissions } from "../hooks/usePermissions";
import type {
  Article as ApiArticle,
  ArticleCategory,
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
  useDeleteArticleMutation,
  usePublishArticleMutation,
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

const SkeletonBar = ({ className }: { className: string }) => (
  <div className={`animate-pulse rounded-full bg-slate-100 ${className}`} />
);

const ArticlesSectionSkeleton = ({ count }: { count: number }) => (
  <div className="content-list-grid">
    {Array.from({ length: count }).map((_, index) => <ContentCardSkeleton key={index} />)}
  </div>
);

const ArticleModalSkeleton = () => (
  <div className="space-y-4">
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

const stripRichText = (value: string | null | undefined) =>
  (value || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

export default function Articles() {
  const { localeCode, translate } = useI18n();
  const toast = useAppToast();
  const { user } = useSelector((state: RootState) => state.auth);
  const { hasPermission, canAccessAdminPanel: isSuperuser } = usePermissions();
  const canModify = useArticleAuthorization();
  const canCreateArticle = hasPermission("article", "create");
  const canEditArticle = hasPermission("article", "edit");
  const canDeleteArticle = hasPermission("article", "delete");
  const canViewArticle = hasPermission("article", "view");
  const canManageCategories = isSuperuser;
  const canManageArticleContent =
    canCreateArticle || canEditArticle || canDeleteArticle;
  const defaultArticleAuthor = user?.firstName
    ? `${user.firstName} ${user.lastName}`
    : translate("articlesPage.defaultAuthor");

  const navigate = useNavigate();
  const { categoryId } = useParams<{ categoryId?: string }>();
  const [statusFilter, setStatusFilter] = useListingStatus(canManageArticleContent);
  const [publishedPage, setPublishedPage] = useState(1);
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
  const { data: categoriesResponse, isLoading: isLoadingCategories, error: categoriesError, refetch: refetchCategories } = useGetArticleCategoriesQuery({
    pageSize: 100,
  });
  const categoriesData = categoriesResponse?.results ?? [];

  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(
    null,
  );
  const { currentData: articleDetail, isFetching: isFetchingDetail, isError: isDetailError } =
    useGetArticleByIdQuery(selectedArticleId!, {
      skip: !selectedArticleId,
    });

  // Mutations
  const [createArticle, { isLoading: isCreating }] = useCreateArticleMutation();
  const [updateArticle, { isLoading: isUpdating }] = useUpdateArticleMutation();
  const [createCategory] =
    useCreateArticleCategoryMutation();
  const [updateCategory] =
    useUpdateArticleCategoryMutation();
  const [deleteCategory] =
    useDeleteArticleCategoryMutation();
  const [deleteArticle, { isLoading: isDeleting }] = useDeleteArticleMutation();
  const [publishArticle] = usePublishArticleMutation();
  const [uploadFile] = useUploadFileMutation();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingArticle, setEditingArticle] = useState<ApiArticle | null>(null);
  const [formData, setFormData] = useState<ArticleFormState>(
    getDefaultArticleFormData(defaultArticleAuthor),
  );
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string | null>(
    null,
  );
  const [showSuccess, setShowSuccess] = useState(false);
  const publishedArticles = (publishedArticlesData?.results || []).filter((article) => article.status === "published");
  const draftArticles = (draftArticlesData?.results || []).filter((article) => article.status === "draft");
  const selectedCategory = categoriesData?.find((category) => category.id === categoryId);
  const availableArticles = [...draftArticles, ...publishedArticles];

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
    if (articleDetail && articleDetail.id === selectedArticleId && canModify(articleDetail, "edit")) {
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
  }, [articleDetail, selectedArticleId, defaultArticleAuthor, categoriesData, canModify]);

  useEffect(() => {
    setPublishedPage(1);
    setDraftPage(1);
  }, [categoryId, statusFilter]);

  const handleOpenModal = (article?: ApiArticle) => {
    if ((article && !canModify(article, "edit")) || (!article && !canCreateArticle)) {
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

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if ((editingArticle && (isFetchingDetail || isDetailError || articleDetail?.id !== editingArticle.id || !canModify(articleDetail, "edit"))) || (!editingArticle && !canCreateArticle)) {
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
    if (editingArticle ? !canModify(articleDetail, "edit") : !canCreateArticle) throw new Error("Forbidden");
    try {
      const data = new FormData();
      data.append("file", file);
      const result = await uploadFile({ formData: data, authorization: { feature: "article", resourceId: editingArticle?.id } }).unwrap();
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

  const handleCreateCategory = async (values: CategoryValues) => {
    if (!isSuperuser) return;
    await createCategory({ name: values.name, description: values.description }).unwrap();
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleUpdateCategory = async (id: string, values: CategoryValues) => {
    if (!isSuperuser) return;
    await updateCategory({ id, name: values.name, description: values.description }).unwrap();
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleDeleteCategory = async (id: string) => {
    if (!isSuperuser) return;
    await deleteCategory(id).unwrap();
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const confirmDelete = (id: string) => {
    if (!canModify(availableArticles.find((article) => article.id === id), "delete")) return;
    setDeletingId(id);
    setIsConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (deletingId && canModify(availableArticles.find((article) => article.id === deletingId), "delete")) {
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
    if (!canModify(availableArticles.find((article) => article.id === id), "edit")) return;

    try {
      await publishArticle(id).unwrap();
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
  const activeArticles = statusFilter === "published" ? publishedArticles : draftArticles;
  const activeIsLoading = statusFilter === "published" ? isLoadingPublished : isLoadingDrafts;
  const activeIsFetching = statusFilter === "published" ? isFetchingPublished : isFetchingDrafts;
  const activeIsError = statusFilter === "published" ? isPublishedError : isDraftsError;
  const activePage = statusFilter === "published" ? publishedPage : draftPage;
  const activeTotalPages = statusFilter === "published" ? publishedTotalPages : draftTotalPages;
  const activeTotal = (statusFilter === "published" ? publishedArticlesData?.total : draftArticlesData?.total) || 0;
  const setActivePage = statusFilter === "published" ? setPublishedPage : setDraftPage;
  const activeEmptyMessage = translate(statusFilter === "published" ? "articlesPage.noPublished" : "articlesPage.noDrafts");
  const activeErrorMessage = translate(statusFilter === "published" ? "articlesPage.articlesLoadError" : "articlesPage.draftsLoadError");
  const activeShowingMessage = translate(statusFilter === "published" ? "articlesPage.showingPublished" : "articlesPage.showingDrafts", { count: activeArticles.length, total: activeTotal });

  if (!canViewArticle) {
    return <Navigate to="/" replace state={{ accessRestricted: true }} />;
  }

  return (
    <div className="content-page">
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

      <ContentPageHeader
        title={selectedCategory?.name || translate("articlesPage.title")}
        description={selectedCategory?.description}
        canManageCategories={canManageCategories}
        onCategories={() => setIsCategoryModalOpen(true)}
        canCreate={canCreateArticle}
        onCreate={() => handleOpenModal()}
        createLabel={translate("articlesPage.writeArticle")}
      />
      {canManageArticleContent ? <ContentStatusTabs value={statusFilter} onChange={setStatusFilter} /> : null}

      <section className="space-y-6">
        <div className="content-list-grid">
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
                <ContentCard
                  key={article.id}
                  image={article.thumbnail_url || article.structured_fields?.file_urls?.map((attachment) => typeof attachment === "string" ? attachment : attachment.url).find(isImageUrl)}
                  fallbackIcon={<FileText className="h-8 w-8" />}
                  category={article.category?.name}
                  status={translate(article.status === "published" ? "articlesPage.statusPublished" : "articlesPage.statusDraft")}
                  title={article.title}
                  description={article.excerpt || stripRichText(article.body)}
                  metadata={[article.author?.name, new Date(article.created_at).toLocaleDateString(localeCode)].filter(Boolean).join(" / ")}
                  onNavigate={() => navigate(`/articles/${article.id}`)}
                  actions={[
                    ...(canModify(article, "edit") && article.status !== "published" ? [{ label: translate("articlesPage.publishArticle"), icon: <Globe className="h-4 w-4" />, onClick: () => { void handlePublish(article.id); } }] : []),
                    ...(canModify(article, "edit") ? [{ label: translate("articlesPage.editArticle"), icon: <Edit2 className="h-4 w-4" />, onClick: () => handleOpenModal(article) }] : []),
                    ...(canModify(article, "delete") ? [{ label: translate("articlesPage.deleteArticle"), icon: <Trash2 className="h-4 w-4" />, onClick: () => confirmDelete(article.id) }] : []),
                  ]}
                />
              ))
            )}
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
        isOpen={isModalOpen && (editingArticle ? canModify(articleDetail ?? editingArticle, "edit") && !isDetailError : canCreateArticle)}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedArticleId(null);
        }}
        title={
          editingArticle
            ? translate("articlesPage.editArticle")
            : translate("articlesPage.writeNewArticle")
        }
        layout="sectioned"
        className="article-forum-modal"
        footer={!isFetchingDetail ? (<ModalSubmitButton formId="article-editor-form"
          disabled={isCreating || isUpdating}
          className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-xl uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
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
        </ModalSubmitButton>) : undefined}
      >
        {isFetchingDetail ? (
          <ArticleModalSkeleton />
        ) : (
          <form id="article-editor-form"
            noValidate
            onSubmit={handleSubmit}
            className="article-forum-modal-form"
          >
            <ModalSection title={translate("modalBatchOne.basicInformation")}>
              <div className="space-y-2 text-left">
                <label htmlFor="article-editor-form-field-1" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {translate("articlesPage.articleTitle")}
                </label>
                <input id="article-editor-form-field-1"
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
              <ModalFieldGrid>
                <div className="space-y-2 text-left">
                  <label htmlFor="article-editor-form-field-2" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {translate("articlesPage.category")}
                  </label>
                  <select id="article-editor-form-field-2"
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
                <ContentStatusField existing={Boolean(editingArticle)} value={formData.status} onChange={(status) => setFormData((current) => ({ ...current, status }))} />
              </ModalFieldGrid>
            </ModalSection>
            <ModalSection title={translate("modalBatchOne.articleContent")}>
              <div className="space-y-2 text-left">
                <label htmlFor="article-editor-form-field-3" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {translate("articlesPage.excerptOptional")}
                </label>
                <textarea id="article-editor-form-field-3"
                  rows={2}
                  placeholder={translate("articlesPage.excerptPlaceholder")}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none resize-none"
                  value={formData.excerpt || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, excerpt: e.target.value })
                  }
                />
              </div>
              <div role="group" aria-labelledby="article-editor-form-field-4-label" className="space-y-2 text-left">
                <label id="article-editor-form-field-4-label" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
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
            </ModalSection>
            <ModalSection title={translate("modalBatchOne.mediaAttachments")}>
              <div className="space-y-2 text-left">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {translate("articlesPage.thumbnailLabel")}
                </label>
                <ModalMediaSplit preview={<>
                  {formData.thumbnail || formData.thumbnail_url ? (
                    <FilePreviewCard
                      presentation="compact"
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
                      onRemove={
                        formData.thumbnail ? () => handleThumbnailChange(null) : undefined
                      }
                    />
                  ) : (
                    <div className="article-forum-modal-empty">{translate("articlesPage.thumbnailLabel")}</div>
                  )}
                </>}>
                  <FileUploadDropzone
                    presentation="compact"
                    inputId="article-thumbnail-upload"
                    accept="image/*"
                    multiple={false}
                    title={translate("articlesPage.uploadThumbnail")}
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
                </ModalMediaSplit>
              </div>
              <div className="space-y-2 text-left">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {translate("articlesPage.attachmentsOptional")}
                </label>
                <FileUploadDropzone
                  presentation="compact"
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
                        presentation="compact"
                        files={selectedFiles}
                        onRemove={removeFile}
                      />
                    ) : undefined
                  }
                />
                {/* Existing Attachments */}
                {formData.structured_fields?.file_urls &&
                  formData.structured_fields.file_urls.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {translate("articlesPage.existingAttachments")}
                      </p>
                      <ModalFieldGrid>
                        {formData.structured_fields.file_urls.map(
                          (url: string, idx: number) => {
                            const fileName =
                              getAssetName(url) ||
                              translate("articlesPage.attachmentFallback", {
                                count: idx + 1,
                              });
                            return (
                              <FilePreviewCard
                                presentation="compact"
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
                      </ModalFieldGrid>
                    </div>
                  )}
              </div>
            </ModalSection>
          </form>
        )}
      </Modal>



      <CategoryManagerDialog
        isOpen={isCategoryModalOpen && canManageCategories}
        onClose={() => setIsCategoryModalOpen(false)}
        categories={categoriesData}
        isLoading={isLoadingCategories}
        error={categoriesError}
        onRetry={() => { void refetchCategories(); }}
        canCreate={canManageCategories}
        canEdit={canManageCategories}
        canDelete={canManageCategories}
        onCreate={handleCreateCategory}
        onUpdate={handleUpdateCategory}
        onDelete={handleDeleteCategory}
      />

      <ConfirmModal
        presentation="compact"
        isOpen={isConfirmOpen && canModify(availableArticles.find((article) => article.id === deletingId), "delete")}
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
