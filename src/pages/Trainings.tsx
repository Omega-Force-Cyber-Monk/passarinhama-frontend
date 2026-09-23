import React, { useEffect, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  Edit2,
  Grid,
  Plus,
  Trash2,
} from "lucide-react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import Modal from "../components/ui/Modal";
import ConfirmModal from "../components/ui/ConfirmModal";
import { useAppToast } from "../components/ui/AppToastProvider";
import { FilePreviewCard, SelectedFilesPreview } from "../components/ui/FileUploadPreview";
import TiptapEditor from "../components/ui/TiptapEditor";
import { useI18n } from "../i18n";
import { RootState } from "../redux/store";
import { usePermissions } from "../hooks/usePermissions";
import { useUploadFileMutation } from "../redux/features/articles/articlesApi";
import {
  useCreateTrainingCategoryMutation,
  useCreateTrainingMutation,
  useDeleteTrainingCategoryMutation,
  useDeleteTrainingMutation,
  useGetTrainingsPaginatedQuery,
  useGetTrainingByIdQuery,
  useGetTrainingCategoriesQuery,
  useUpdateTrainingCategoryMutation,
  useUpdateTrainingMutation,
} from "../redux/features/trainings/trainingsApi";
import type {
  Training,
  TrainingCategory,
  TrainingRequest,
  TrainingStatus,
} from "../redux/features/trainings/trainingTypes";
import { getApiErrorDisplayMessage } from "../utils/apiErrorMessages";

const PAGE_SIZE = 20;

type Attachment = string | { url: string; original_name?: string | null; file_name?: string | null };

type TrainingFormState = {
  title: string;
  excerpt: string;
  description: string;
  category_id: string;
  status: TrainingStatus;
  thumbnail: File | null;
  thumbnail_url: string | null;
  attachments: Attachment[];
};

const defaultFormState = (categoryId = ""): TrainingFormState => ({
  title: "",
  excerpt: "",
  description: "",
  category_id: categoryId,
  status: "draft",
  thumbnail: null,
  thumbnail_url: null,
  attachments: [],
});

const stripRichText = (value: string) =>
  value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

const getAttachmentUrl = (attachment: Attachment) =>
  typeof attachment === "string" ? attachment : attachment.url;

const getAttachmentName = (attachment: Attachment) => {
  if (typeof attachment !== "string") {
    return attachment.original_name || attachment.file_name || attachment.url.split("/").pop() || attachment.url;
  }

  try {
    return decodeURIComponent(attachment.split("/").pop() || attachment);
  } catch {
    return attachment.split("/").pop() || attachment;
  }
};

const getStatusLabel = (status: TrainingStatus) =>
  status.charAt(0).toUpperCase() + status.slice(1);

export default function Trainings() {
  const { translate, localeCode } = useI18n();
  const toast = useAppToast();
  const navigate = useNavigate();
  const { categoryId, trainingId } = useParams<{ categoryId?: string; trainingId?: string }>();
  const { user } = useSelector((state: RootState) => state.auth);
  const { hasPermission } = usePermissions();
  const isSuperuser = Boolean(user?.is_superuser);
  const canViewTraining = hasPermission("training", "view");
  const canCreateTraining = hasPermission("training", "create");
  const canEditTraining = hasPermission("training", "edit");
  const canDeleteTraining = hasPermission("training", "delete");
  const canManageCategories = canCreateTraining || canEditTraining || isSuperuser;

  const [page, setPage] = useState(1);
  const { data: categories = [] } = useGetTrainingCategoriesQuery();
  const { data: trainingsData, isLoading, isFetching } = useGetTrainingsPaginatedQuery({
    page,
    pageSize: PAGE_SIZE,
    category_id: categoryId,
    details: true,
  });
  const selectedCategory = categories.find((category) => category.id === categoryId);
  const trainings = trainingsData?.results || [];
  const totalPages = trainingsData?.total_pages || 1;

  const listTraining = trainings.find((training) => training.id === trainingId);
  const { data: fetchedTraining } = useGetTrainingByIdQuery(trainingId || "", {
    skip: !trainingId || Boolean(listTraining),
  });
  const selectedTraining = listTraining || fetchedTraining || null;

  const [createTraining, { isLoading: isCreating }] = useCreateTrainingMutation();
  const [updateTraining, { isLoading: isUpdating }] = useUpdateTrainingMutation();
  const [deleteTraining, { isLoading: isDeleting }] = useDeleteTrainingMutation();
  const [uploadFile] = useUploadFileMutation();
  const [createCategory, { isLoading: isCreatingCategory }] = useCreateTrainingCategoryMutation();
  const [updateCategory, { isLoading: isUpdatingCategory }] = useUpdateTrainingCategoryMutation();
  const [deleteCategory, { isLoading: isDeletingCategory }] = useDeleteTrainingCategoryMutation();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTraining, setEditingTraining] = useState<Training | null>(null);
  const [formData, setFormData] = useState<TrainingFormState>(defaultFormState());
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [removedAttachmentUrls, setRemovedAttachmentUrls] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<TrainingCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "" });
  const [categoryDeletingId, setCategoryDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [categoryId]);

  useEffect(() => {
    if (!categoryId || !categories.length) return;
    if (!categories.some((category) => category.id === categoryId)) {
      navigate("/trainings", { replace: true });
    }
  }, [categories, categoryId, navigate]);

  const defaultCategoryId = categoryId || categories[0]?.id || "";
  const canSubmitForm = Boolean(
    formData.title.trim() &&
      formData.category_id &&
      stripRichText(formData.description),
  );

  const openCreateForm = () => {
    setEditingTraining(null);
    setFormData(defaultFormState(defaultCategoryId));
    setSelectedFiles([]);
    setRemovedAttachmentUrls([]);
    setIsFormOpen(true);
  };

  const openEditForm = (training: Training) => {
    setEditingTraining(training);
    setFormData({
      title: training.title,
      excerpt: training.excerpt || "",
      description: training.description || "",
      category_id: training.category?.id || training.category_id || defaultCategoryId,
      status: training.status,
      thumbnail: null,
      thumbnail_url: training.thumbnail_url,
      attachments: (training.attachments || []) as Attachment[],
    });
    setSelectedFiles([]);
    setRemovedAttachmentUrls([]);
    setIsFormOpen(true);
  };

  const handleImageUpload = async (file: File): Promise<string> => {
    const data = new FormData();
    data.append("file", file);
    const response = await uploadFile(data).unwrap();
    return response.url;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!canSubmitForm) {
      toast.error(translate("common.requiredField", { field: translate("common.description") }));
      return;
    }

    const payload: TrainingRequest = {
      title: formData.title.trim(),
      excerpt: formData.excerpt.trim(),
      description: formData.description,
      category_id: formData.category_id,
      status: formData.status,
      thumbnail: formData.thumbnail,
      attachments: selectedFiles,
    };

    try {
      if (editingTraining) {
        const updatePayload: Partial<TrainingRequest> = {
          ...payload,
          new_attachments: selectedFiles,
          remove_attachment_urls: removedAttachmentUrls,
        };
        delete updatePayload.attachments;
        if (!formData.thumbnail) delete updatePayload.thumbnail;
        await updateTraining({ id: editingTraining.id, data: updatePayload }).unwrap();
      } else {
        await createTraining(payload).unwrap();
      }

      toast.success(translate("trainingsPage.success"));
      setIsFormOpen(false);
      setEditingTraining(null);
    } catch (error) {
      toast.error(getApiErrorDisplayMessage(error, translate, "apiErrors.default"));
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteTraining(deletingId).unwrap();
      toast.success(translate("trainingsPage.success"));
      setDeletingId(null);
      if (trainingId === deletingId) navigate("/trainings");
    } catch (error) {
      toast.error(getApiErrorDisplayMessage(error, translate, "apiErrors.default"));
    }
  };

  const resetCategoryForm = () => {
    setEditingCategory(null);
    setCategoryForm({ name: "", description: "" });
  };

  const handleSaveCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!categoryForm.name.trim()) {
      toast.error(translate("common.requiredField", { field: "Category" }));
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
      toast.success(translate("trainingsPage.success"));
    } catch (error) {
      toast.error(getApiErrorDisplayMessage(error, translate, "apiErrors.default"));
    }
  };

  const handleDeleteCategory = async (id: string) => {
    setCategoryDeletingId(id);
    try {
      await deleteCategory(id).unwrap();
      toast.success(translate("trainingsPage.success"));
      if (categoryId === id) navigate("/trainings");
    } catch (error) {
      toast.error(getApiErrorDisplayMessage(error, translate, "apiErrors.default"));
    } finally {
      setCategoryDeletingId(null);
    }
  };

  if (!canViewTraining) {
    return <Navigate to="/" replace state={{ accessRestricted: true }} />;
  }

  return (
    <div className="space-y-8 p-4 text-slate-900 sm:p-6 lg:p-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 underline decoration-primary decoration-4 underline-offset-8 sm:text-3xl">
            {selectedCategory?.name || translate("common.training")}
          </h2>
          {selectedCategory?.description ? (
            <p className="mt-3 max-w-2xl text-sm font-medium text-slate-500">
              {selectedCategory.description}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {canManageCategories && (
            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(true)}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold shadow-sm hover:bg-slate-50"
            >
              <Grid className="h-5 w-5 text-primary" />
              {translate("articlesPage.newCategory")}
            </button>
          )}
          {canCreateTraining && (
            <button
              type="button"
              onClick={openCreateForm}
              className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-lg hover:bg-slate-800"
            >
              <Plus className="h-5 w-5 text-primary" />
              {translate("trainingsPage.createTraining")}
            </button>
          )}
        </div>
      </header>

      {isLoading && !trainings.length ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm font-bold text-slate-500">
          {translate("common.loading")}
        </div>
      ) : trainings.length ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {trainings.map((training) => (
            <article
              key={training.id}
              className="flex min-h-[22rem] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <button
                type="button"
                onClick={() => navigate(`/trainings/${training.id}`)}
                className="aspect-video bg-slate-100 text-left"
              >
                {training.thumbnail_url ? (
                  <img
                    src={training.thumbnail_url}
                    alt={training.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-300">
                    <BookOpen className="h-14 w-14" />
                  </div>
                )}
              </button>
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-primary/15 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-900">
                    {training.category?.name || translate("common.training")}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    {getStatusLabel(training.status)}
                  </span>
                </div>
                <h3 className="mt-4 line-clamp-2 text-lg font-bold text-slate-900">
                  {training.title}
                </h3>
                <p className="mt-3 line-clamp-3 text-sm font-medium leading-6 text-slate-500">
                  {training.excerpt || stripRichText(training.description)}
                </p>
                <div className="mt-auto flex items-center justify-between pt-5">
                  <span className="text-xs font-semibold text-slate-400">
                    {new Date(training.created_at).toLocaleDateString(localeCode)}
                  </span>
                  <div className="flex items-center gap-1">
                    {canEditTraining && (
                      <button
                        type="button"
                        onClick={() => openEditForm(training)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-900"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    )}
                    {canDeleteTraining && (
                      <button
                        type="button"
                        onClick={() => setDeletingId(training.id)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm font-bold text-slate-500">
          {translate("trainingsPage.noTrainings")}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={page <= 1 || isFetching}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || isFetching}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      <Modal
        isOpen={Boolean(selectedTraining)}
        onClose={() => navigate("/trainings")}
        title={selectedTraining?.title || translate("common.training")}
        maxWidth="max-w-4xl"
      >
        {selectedTraining ? (
          <div className="space-y-6">
            {selectedTraining.thumbnail_url ? (
              <img
                src={selectedTraining.thumbnail_url}
                alt={selectedTraining.title}
                className="aspect-video w-full rounded-2xl object-cover"
              />
            ) : null}
            {selectedTraining.excerpt ? (
              <p className="border-l-4 border-primary pl-4 text-lg font-medium italic text-slate-500">
                {selectedTraining.excerpt}
              </p>
            ) : null}
            <div
              className="tiptap-content prose prose-slate max-w-none"
              dangerouslySetInnerHTML={{ __html: selectedTraining.description }}
            />
            {selectedTraining.attachments?.length ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {selectedTraining.attachments.map((attachment) => (
                  <FilePreviewCard
                    key={getAttachmentUrl(attachment as Attachment)}
                    url={getAttachmentUrl(attachment as Attachment)}
                    name={getAttachmentName(attachment as Attachment)}
                    href={getAttachmentUrl(attachment as Attachment)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingTraining ? translate("trainingsPage.editTraining") : translate("trainingsPage.createTraining")}
        maxWidth="max-w-4xl"
      >
        <form noValidate onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-left">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {translate("trainingsPage.trainingTitle")}
              </span>
              <input
                value={formData.title}
                onChange={(event) => setFormData((current) => ({ ...current, title: event.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <label className="space-y-2 text-left">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {translate("articlesPage.category")}
              </span>
              <select
                value={formData.category_id}
                onChange={(event) => setFormData((current) => ({ ...current, category_id: event.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">{translate("articlesPage.selectCategory")}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block space-y-2 text-left">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {translate("articlesPage.excerpt")}
            </span>
            <textarea
              value={formData.excerpt}
              onChange={(event) => setFormData((current) => ({ ...current, excerpt: event.target.value }))}
              className="min-h-24 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <div className="space-y-2 text-left">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {translate("trainingsPage.descriptionLabel")}
            </span>
            <TiptapEditor
              content={formData.description}
              onChange={(description) => setFormData((current) => ({ ...current, description }))}
              onImageUpload={handleImageUpload}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-left">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Status
              </span>
              <select
                value={formData.status}
                onChange={(event) => setFormData((current) => ({ ...current, status: event.target.value as TrainingStatus }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="draft">Draft</option>
                <option value="pending">Pending</option>
                <option value="published">Published</option>
              </select>
            </label>
            <label className="space-y-2 text-left">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {translate("trainingsPage.thumbnailLabel")}
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    thumbnail: event.target.files?.[0] || null,
                  }))
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold"
              />
            </label>
          </div>
          <input
            type="file"
            multiple
            onChange={(event) => setSelectedFiles(Array.from(event.target.files || []))}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold"
          />
          <SelectedFilesPreview files={selectedFiles} onRemove={(index) => setSelectedFiles((current) => current.filter((_, idx) => idx !== index))} />
          {formData.attachments.length ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {formData.attachments.map((attachment) => {
                const url = getAttachmentUrl(attachment);
                return (
                  <FilePreviewCard
                    key={url}
                    url={url}
                    name={getAttachmentName(attachment)}
                    href={url}
                    onRemove={() => {
                      setRemovedAttachmentUrls((current) => [...current, url]);
                      setFormData((current) => ({
                        ...current,
                        attachments: current.attachments.filter((item) => getAttachmentUrl(item) !== url),
                      }));
                    }}
                  />
                );
              })}
            </div>
          ) : null}
          <button
            type="submit"
            disabled={!canSubmitForm || isCreating || isUpdating}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-4 text-sm font-bold uppercase tracking-widest text-white disabled:opacity-50"
          >
            <CheckCircle2 className="h-5 w-5 text-primary" />
            {editingTraining ? translate("trainingsPage.trainingUpdated") : translate("trainingsPage.trainingProposed")}
          </button>
        </form>
      </Modal>

      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => {
          setIsCategoryModalOpen(false);
          resetCategoryForm();
        }}
        title={editingCategory ? translate("articlesPage.updateCategory") : translate("articlesPage.addNewCategory")}
      >
        <form noValidate onSubmit={handleSaveCategory} className="space-y-4">
          <input
            autoFocus
            value={categoryForm.name}
            onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))}
            placeholder={translate("articlesPage.categoryNamePlaceholder")}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none"
          />
          <textarea
            value={categoryForm.description}
            onChange={(event) => setCategoryForm((current) => ({ ...current, description: event.target.value }))}
            placeholder={translate("articlesPage.categoryDescriptionPlaceholder")}
            className="min-h-24 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none"
          />
          {categories.length ? (
            <div className="space-y-2 border-t border-slate-100 pt-4">
              {categories.map((category) => (
                <div key={category.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="min-w-0 text-left">
                    <p className="truncate text-sm font-bold text-slate-900">{category.name}</p>
                    {category.description ? (
                      <p className="line-clamp-2 text-xs text-slate-500">{category.description}</p>
                    ) : null}
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCategory(category);
                        setCategoryForm({
                          name: category.name,
                          description: category.description || "",
                        });
                      }}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-200"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={categoryDeletingId === category.id || isDeletingCategory}
                      onClick={() => handleDeleteCategory(category.id)}
                      className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          <button
            type="submit"
            disabled={!categoryForm.name.trim() || isCreatingCategory || isUpdatingCategory}
            className="w-full rounded-xl bg-slate-900 px-5 py-4 text-sm font-bold uppercase tracking-widest text-white disabled:opacity-50"
          >
            {editingCategory ? translate("articlesPage.updateCategory") : translate("articlesPage.createCategory")}
          </button>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={Boolean(deletingId)}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title={translate("trainingsPage.deleteTraining")}
        message={translate("trainingsPage.deleteConfirm")}
        isLoading={isDeleting}
        closeOnConfirm={false}
      />
    </div>
  );
}
