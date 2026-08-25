import React, { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  GraduationCap,
  Clock,
  MapPin,
  ChevronRight,
  Award,
  Plus,
  Trash2,
  Calendar as CalendarIcon,
  User as UserIcon,
  Edit2,
  X,
  File as FileIcon,
  Eye,
  ChevronLeft,
  Shield,
  CheckCircle2,
} from "lucide-react";
import TiptapEditor from "../components/ui/TiptapEditor";
import { motion, AnimatePresence } from "motion/react";
import Modal from "../components/ui/Modal";
import ConfirmModal from "../components/ui/ConfirmModal";
import FeedbackToast from "../components/ui/FeedbackToast";
import {
  FilePreviewCard,
  FileUploadDropzone,
  getPreviewKind,
  SelectedFilesPreview,
} from "../components/ui/FileUploadPreview";

import { useSelector } from "react-redux";
import { RootState } from "../redux/store";
import { useDirectUserPermissions } from "../hooks/useDirectUserPermissions";
import { ROLE_SLUGS } from "../redux/features/auth/authTypes";
import {
  useCreateTrainingMutation,
  useDeleteTrainingMutation,
  useGetAllTrainingsQuery,
  useGetTrainingPermissionsQuery,
  useRegisterForTrainingMutation,
  useSetTrainingPermissionMutation,
  useUnregisterFromTrainingMutation,
  useUpdateTrainingMutation,
} from "../redux/features/trainings/trainingsApi";
import { useGetUserRolesQuery } from "../redux/features/members/membersApi";
import { useUploadFileMutation } from "../redux/features/articles/articlesApi";
import {
  Training as ApiTraining,
  TrainingFormat,
  TrainingStatus,
  TrainingRequest,
} from "../redux/features/trainings/trainingTypes";
import {
  format,
  parse,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
  setMonth,
  setYear,
  startOfWeek,
  endOfWeek,
  isSameDay,
  parseISO,
  isBefore,
} from "date-fns";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useI18n } from "../i18n";
import { getApiErrorDisplayMessage } from "../utils/apiErrorMessages";

interface TrainingCard {
  id: string;
  title: string;
  category: string;
  duration_hours: number;
  attendees: number;
  max_attendees: number;
  status: string;
  apiStatus: TrainingStatus;
  training_date: string;
  rawTrainingDate: string;
  rawEndDate: string;
  location: string;
  instructor: string;
  format: TrainingFormat;
  thumbnailUrl?: string | null;
  isJoined?: boolean;
  description: string;
}

type ExistingTrainingAttachment = string | { url: string; file_name?: string };

const getIsoDate = () => new Date().toISOString().slice(0, 10);

const isEndDateBeforeStartDate = (startDate: string, endDate: string) =>
  isBefore(
    parse(endDate, "yyyy-MM-dd", new Date()),
    parse(startDate, "yyyy-MM-dd", new Date()),
  );

const formatTrainingDate = (value: string, localeCode: string) => {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(localeCode, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const getCreatorName = (training: ApiTraining, fallback: string) => {
  if (training.instructor_name?.trim()) {
    return training.instructor_name.trim();
  }

  return fallback;
};

const getTrainingStatusLabel = (
  status: TrainingStatus,
  translate: (key: string, params?: Record<string, string | number>) => string,
) => {
  switch (status) {
    case "open":
      return translate("trainingsPage.statusOpen");
    case "full":
      return translate("trainingsPage.statusFull");
    case "completed":
      return translate("trainingsPage.statusCompleted");
    default:
      return status;
  }
};

const getAttachmentPreviewType = (url: string) => {
  const cleanUrl = url.split("?")[0].toLowerCase();

  if (/\.(png|jpe?g|gif|webp|svg|avif)$/.test(cleanUrl)) {
    return "image" as const;
  }

  if (/\.(mp4|webm|ogg|mov|m4v)$/.test(cleanUrl)) {
    return "video" as const;
  }

  if (/\.pdf$/.test(cleanUrl)) {
    return "pdf" as const;
  }

  if (/\.(doc|docx|ppt|pptx|xls|xlsx)$/.test(cleanUrl)) {
    return "document" as const;
  }

  return "file" as const;
};

const getOfficePreviewUrl = (url: string) =>
  `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;

const mapTrainingToCard = (
  training: ApiTraining,
  joinedOverrides: Record<string, boolean>,
  localeCode: string,
  translate: (key: string, params?: Record<string, string | number>) => string,
): TrainingCard => {
  const isJoined = joinedOverrides[training.id] ?? training.is_registered;
  const attendees = Math.max(
    0,
    training.attendee_count +
      (isJoined && !training.is_registered ? 1 : 0) -
      (!isJoined && training.is_registered ? 1 : 0),
  );

  return {
    id: training.id,
    title: training.title,
    category:
      training.status === "completed"
        ? translate("trainingsPage.completed")
        : translate("trainingsPage.training"),
    duration_hours: training.duration_hours,
    attendees,
    max_attendees: training.max_attendees,
    status: training.is_at_capacity ? "full" : training.status,
    apiStatus: training.status,
    training_date: formatTrainingDate(training.training_date, localeCode),
    rawTrainingDate: training.training_date,
    rawEndDate: training.end_date,
    location:
      training.format === "online"
        ? translate("trainingsPage.videoconference")
        : translate("trainingsPage.onsite"),
    instructor: getCreatorName(training, "n/a"),
    format: training.format,
    thumbnailUrl: training.thumbnail_url,
    isJoined,
    description: training.description,
  };
};

type TrainingFormData = {
  title: string;
  description: string;
  instructor_name: string;
  format: TrainingFormat;
  training_date: string;
  end_date: string;
  duration_hours: number;
  max_attendees: number;
  status: TrainingStatus;
  thumbnail: File | null;
  thumbnail_url?: string | null;
  attachments?: ExistingTrainingAttachment[];
};

const getDefaultFormData = (): TrainingFormData => ({
  title: "",
  description: "",
  instructor_name: "",
  format: "online",
  training_date: getIsoDate(),
  end_date: getIsoDate(),
  duration_hours: 7,
  max_attendees: 20,
  status: "open",
  thumbnail: null,
  thumbnail_url: null,
  attachments: [],
});

const getAttachmentUrl = (attachment: ExistingTrainingAttachment) =>
  typeof attachment === "string" ? attachment : attachment.url;

const getAttachmentName = (attachment: ExistingTrainingAttachment) => {
  if (typeof attachment !== "string" && attachment.file_name) {
    return attachment.file_name;
  }

  const url = getAttachmentUrl(attachment);
  const fileName = url.split("/").pop() || url;

  return decodeURIComponent(fileName);
};

const SkeletonBar = ({ className }: { className: string }) => (
  <div className={`animate-pulse rounded-full bg-slate-100 ${className}`} />
);

const TrainingCardSkeleton = () => (
  <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 flex flex-col md:flex-row gap-8 relative overflow-hidden animate-pulse">
    <div className="w-full md:w-48 h-48 bg-slate-100 rounded-2xl flex-shrink-0" />
    <div className="flex-1 flex flex-col space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <SkeletonBar className="h-3 w-24" />
          <SkeletonBar className="h-5 w-16 rounded-full" />
        </div>
        <SkeletonBar className="h-3 w-20" />
      </div>
      <SkeletonBar className="h-7 w-3/5" />
      <SkeletonBar className="h-4 w-2/5" />
      <div className="pt-4 grid grid-cols-2 gap-4">
        <SkeletonBar className="h-4 w-32" />
        <SkeletonBar className="h-4 w-28" />
      </div>
    </div>
  </div>
);

const TrainingsPageSkeleton = ({ showAdminAction }: { showAdminAction: boolean }) => (
  <div className="space-y-8 p-4 text-slate-900 sm:p-6 lg:p-8">
    <header className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
      <div className="space-y-4">
        <SkeletonBar className="h-6 w-36 rounded-full" />
        <SkeletonBar className="h-11 w-64" />
      </div>
      {showAdminAction && <SkeletonBar className="h-12 w-44 rounded-xl" />}
    </header>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {Array.from({ length: 4 }).map((_, index) => (
        <TrainingCardSkeleton key={index} />
      ))}
    </div>
  </div>
);

export default function Trainings() {
  const { dateLocale, localeCode, translate } = useI18n();
  const { user } = useSelector((state: RootState) => state.auth);
  const { hasDirectPermission } = useDirectUserPermissions();
  const isSuperuser = Boolean(user?.is_superuser);
  const canViewTraining =
    isSuperuser || hasDirectPermission("training", "view");
  const canCreateTraining = hasDirectPermission("training", "create");
  const canEditTraining = hasDirectPermission("training", "edit");
  const canDeleteTraining = hasDirectPermission("training", "delete");
  const canManageTrainingPermissions = canEditTraining;
  const canSeeTrainingPermissionsButton = isSuperuser;
  const showTrainingManagement =
    canCreateTraining ||
    canEditTraining ||
    canDeleteTraining ||
    canManageTrainingPermissions;
  const navigate = useNavigate();
  const { trainingId } = useParams<{ trainingId?: string }>();

  const {
    data: trainingData = [],
    isLoading: isTrainingsLoading,
    isFetching: isTrainingsFetching,
  } = useGetAllTrainingsQuery();
  const [unregisterFromTraining, { isLoading: isUnregistering }] =
    useUnregisterFromTrainingMutation();
  const [uploadFile] = useUploadFileMutation();

  const handleImageUpload = async (file: File): Promise<string> => {
    try {
      const data = new FormData();
      data.append("file", file);
      const response = await uploadFile(data).unwrap();
      return response.url;
    } catch (error) {
      showErrorMessage(
        getApiErrorDisplayMessage(error, translate, "apiErrors.default"),
      );
      throw error;
    }
  };
  const [createTraining, { isLoading: isCreatingTraining }] =
    useCreateTrainingMutation();
  const [updateTraining, { isLoading: isUpdatingTraining }] =
    useUpdateTrainingMutation();
  const [deleteTraining, { isLoading: isDeletingTraining }] =
    useDeleteTrainingMutation();
  const [registerForTraining] = useRegisterForTrainingMutation();
  const [setTrainingPermission, { isLoading: isSettingTrainingPermission }] =
    useSetTrainingPermissionMutation();
  const { data: userRolesData = [] } = useGetUserRolesQuery();

  const [joinedOverrides, setJoinedOverrides] = useState<
    Record<string, boolean>
  >({});
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [selectedTraining, setSelectedTraining] = useState<TrainingCard | null>(
    null,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState<{
    show: boolean;
    msg: string;
  }>({ show: false, msg: "" });
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [showError, setShowError] = useState<{
    show: boolean;
    msg: string;
  }>({ show: false, msg: "" });
  const [editingTrainingId, setEditingTrainingId] = useState<string | null>(
    null,
  );
  const [formData, setFormData] = useState<TrainingFormData>(getDefaultFormData);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [removedFileUrls, setRemovedFileUrls] = useState<string[]>([]);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string | null>(
    null,
  );
  const [selectedTrainingPermissionId, setSelectedTrainingPermissionId] =
    useState<string | null>(null);
  const [permissionTab, setPermissionTab] = useState<"view" | "edit">("view");
  const [permissionData, setPermissionData] = useState<{
    trainingIds: string[];
    roleIds: string[];
    canRead: boolean;
    canWrite: boolean;
  }>({
    trainingIds: [],
    roleIds: [],
    canRead: true,
    canWrite: true,
  });

  const trainings = useMemo(
    () =>
      trainingData.map((training) =>
        mapTrainingToCard(training, joinedOverrides, localeCode, translate),
      ),
    [trainingData, joinedOverrides, localeCode, translate],
  );
  const {
    data: currentPermissions,
    isLoading: isLoadingCurrentPermissions,
  } = useGetTrainingPermissionsQuery(selectedTrainingPermissionId || "", {
    skip: !selectedTrainingPermissionId || !isPermissionModalOpen,
  });

  const selectedTrainingData = useMemo(
    () =>
      trainingId
        ? trainingData.find((training) => training.id === trainingId) || null
        : null,
    [trainingData, trainingId],
  );

  useEffect(() => {
    if (!trainingData.length) {
      return;
    }

    const defaultTrainingPermissionId =
      trainingId && trainingData.some((training) => training.id === trainingId)
        ? trainingId
        : trainingData[0].id;

    if (
      !selectedTrainingPermissionId ||
      !trainingData.some((training) => training.id === selectedTrainingPermissionId)
    ) {
      setSelectedTrainingPermissionId(defaultTrainingPermissionId);
    }
  }, [selectedTrainingPermissionId, trainingData, trainingId]);

  useEffect(() => {
    if (permissionData.trainingIds.length > 0 || !trainingData.length) {
      return;
    }

    const defaultTrainingId = trainingId || trainingData[0]?.id;
    if (!defaultTrainingId) {
      return;
    }

    setPermissionData((prev) => ({
      ...prev,
      trainingIds: [defaultTrainingId],
    }));
  }, [permissionData.trainingIds.length, trainingData, trainingId]);

  useEffect(() => {
    if (permissionData.roleIds.length > 0 || !userRolesData.length) {
      return;
    }

    const defaultRoleId =
      userRolesData.find((role) => role.slug === ROLE_SLUGS.MEMBER)?.id ||
      userRolesData[0]?.id;

    if (!defaultRoleId) {
      return;
    }

    setPermissionData((prev) => ({
      ...prev,
      roleIds: [defaultRoleId],
    }));
  }, [permissionData.roleIds.length, userRolesData]);

  useEffect(() => {
    if (!formData.thumbnail) {
      setThumbnailPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(formData.thumbnail);
    setThumbnailPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [formData.thumbnail]);

  useEffect(() => {
    if (!trainingId) {
      setSelectedTraining(null);
      return;
    }

    const matchedTraining = trainings.find((training) => training.id === trainingId);

    if (matchedTraining) {
      setSelectedTraining(matchedTraining);
      return;
    }

    if (!isTrainingsLoading && !isTrainingsFetching) {
      navigate("/trainings", { replace: true });
    }
  }, [trainingId, trainings, isTrainingsLoading, isTrainingsFetching, navigate]);

  const showMessage = (msg: string) => {
    setShowSuccess({ show: true, msg });
    setTimeout(() => setShowSuccess({ show: false, msg: "" }), 3000);
  };

  const showErrorMessage = (msg: string) => {
    setShowError({ show: true, msg });
    setTimeout(() => setShowError({ show: false, msg: "" }), 3000);
  };

  const showInitialTrainingsSkeleton =
    (isTrainingsLoading || isTrainingsFetching) && !trainings.length;

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

  const permissionRoleOptions = useMemo(
    () =>
      userRolesData.map((role) => ({
        id: role.id,
        label: translatePermissionRole(role.slug || role.name),
      })),
    [userRolesData],
  );

  const permissionRoleLabelsById = useMemo(
    () =>
      Object.fromEntries(
        userRolesData.map((role) => [
          role.id,
          translatePermissionRole(role.slug || role.name),
        ]),
      ),
    [userRolesData],
  );

  if (!canViewTraining) {
    return <Navigate to="/" replace state={{ accessRestricted: true }} />;
  }

  if (showInitialTrainingsSkeleton) {
    return <TrainingsPageSkeleton showAdminAction={showTrainingManagement} />;
  }


  const handleOpenModal = () => {
    if (!canCreateTraining) return;

    setEditingTrainingId(null);
    setFormData(getDefaultFormData());
    setSelectedFiles([]);
    setRemovedFileUrls([]);
    setIsModalOpen(true);
  };

  const handleOpenDetails = (training: TrainingCard) => {
    navigate(`/trainings/${training.id}`);
  };

  const handleCloseDetails = () => {
    navigate("/trainings");
  };

  const handleOpenEdit = (
    training: ApiTraining,
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    if (!canEditTraining) return;

    event.stopPropagation();
    setEditingTrainingId(training.id);
    setFormData({
      title: training.title,
      description: training.description,
      instructor_name: training.instructor_name?.trim() || "",
      format: training.format,
      training_date: training.training_date,
      end_date: training.end_date,
      duration_hours: training.duration_hours,
      max_attendees: training.max_attendees,
      status: training.status,
      thumbnail: null,
      thumbnail_url: training.thumbnail_url,
      attachments: training.attachments || [],
    });
    setSelectedFiles([]);
    setRemovedFileUrls([]);
    setIsModalOpen(true);
  };

  const handleJoin = async (id: string) => {
    const training = trainings.find((t) => t.id === id);

    if (!training) {
      return;
    }

    const isJoining = !training.isJoined;

    try {
      setJoiningId(id);

      if (isJoining) {
        await registerForTraining(id).unwrap();
      } else {
        await unregisterFromTraining(id).unwrap();
      }

      setJoinedOverrides((prev) => ({
        ...prev,
        [id]: isJoining,
      }));
      showMessage(
        isJoining
          ? translate("trainingsPage.registrationValidated")
          : translate("trainingsPage.registrationCancelled"),
      );
    } catch (error) {
      showErrorMessage(
        getApiErrorDisplayMessage(
          error,
          translate,
          "trainingsPage.registrationUpdateError",
        ),
      );
    } finally {
      setJoiningId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasThumbnail = Boolean(formData.thumbnail || formData.thumbnail_url);

    const requireField = (fieldLabel: string) => {
      const message = translate("common.requiredField", { field: fieldLabel });
      showErrorMessage(message);
    };

    if (!formData.title.trim()) {
      requireField(translate("trainingsPage.trainingTitle"));
      return;
    }

    if (!formData.instructor_name.trim()) {
      requireField(translate("trainingsPage.instructor"));
      return;
    }

    if (!formData.training_date) {
      requireField(translate("trainingsPage.trainingDate"));
      return;
    }

    if (!formData.end_date) {
      requireField(translate("agendaPage.endDate"));
      return;
    }

    if (!formData.format) {
      requireField(translate("trainingsPage.format"));
      return;
    }

    if (!formData.duration_hours) {
      requireField(translate("trainingsPage.durationHoursLabel"));
      return;
    }

    if (!formData.max_attendees) {
      requireField(translate("trainingsPage.maxAttendees"));
      return;
    }

    if (!(formData.description || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim()) {
      requireField(translate("trainingsPage.descriptionLabel"));
      return;
    }

    if (isEndDateBeforeStartDate(formData.training_date, formData.end_date)) {
      const message = translate("agendaPage.invalidDateRange");
      showErrorMessage(message);
      return;
    }

    if (!hasThumbnail) {
      const message = translate("trainingsPage.thumbnailRequired");
      showErrorMessage(message);
      return;
    }

    const createRequestBody: TrainingRequest = {
      title: formData.title,
      description: formData.description,
      instructor_name: formData.instructor_name.trim() || "",
      format: formData.format,
      training_date: formData.training_date,
      end_date: formData.end_date,
      duration_hours: formData.duration_hours,
      max_attendees: formData.max_attendees,
      status: formData.status,
      thumbnail: formData.thumbnail,
      attachments: selectedFiles,
    };

    try {
      if (editingTrainingId) {
        const updateRequestBody: Partial<TrainingRequest> = {
          title: formData.title,
          description: formData.description,
          instructor_name: formData.instructor_name.trim() || "",
          format: formData.format,
          training_date: formData.training_date,
          end_date: formData.end_date,
          duration_hours: formData.duration_hours,
          max_attendees: formData.max_attendees,
          status: formData.status,
        };

        if (formData.thumbnail) {
          updateRequestBody.thumbnail = formData.thumbnail;
        }
        if (selectedFiles.length > 0) {
          updateRequestBody.new_attachments = selectedFiles;
        }
        if (removedFileUrls.length > 0) {
          updateRequestBody.remove_attachment_urls = removedFileUrls;
        }

        await updateTraining({
          id: editingTrainingId,
          data: updateRequestBody,
        }).unwrap();
        showMessage(translate("trainingsPage.trainingUpdated"));
      } else {
        await createTraining(createRequestBody).unwrap();
        showMessage(translate("trainingsPage.trainingProposed"));
      }

      setIsModalOpen(false);
      setEditingTrainingId(null);
      setFormData(getDefaultFormData());
      setSelectedFiles([]);
      setRemovedFileUrls([]);
    } catch (error) {
      showErrorMessage(
        getApiErrorDisplayMessage(
          error,
          translate,
          "trainingsPage.trainingSaveError",
        ),
      );
    }
  };

  const confirmDelete = (
    id: string,
    event?: React.MouseEvent<HTMLButtonElement>,
  ) => {
    if (!canDeleteTraining) return;

    event?.stopPropagation();
    setDeletingId(id);
    setIsConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId) {
      return;
    }

    try {
      await deleteTraining(deletingId).unwrap();
      if (selectedTraining?.id === deletingId) {
        setSelectedTraining(null);
        navigate("/trainings");
      }
      setDeletingId(null);
      setIsConfirmOpen(false);
      showMessage(translate("trainingsPage.trainingDeleted"));
    } catch (error) {
      showErrorMessage(
        getApiErrorDisplayMessage(
          error,
          translate,
          "trainingsPage.trainingDeleteError",
        ),
      );
    }
  };

  const handleSetTrainingPermission = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canManageTrainingPermissions) return;

    if (!permissionData.trainingIds.length) {
      showErrorMessage(
        translate("common.selectAtLeastOne", {
          field: translate("common.training"),
        }),
      );
      return;
    }

    if (!permissionData.roleIds.length) {
      showErrorMessage(
        translate("common.selectAtLeastOne", {
          field: translate("forumsPage.role"),
        }),
      );
      return;
    }

    try {
      await setTrainingPermission({
        training_id: permissionData.trainingIds,
        role_id: permissionData.roleIds,
        can_read: permissionData.canRead,
        can_write: permissionData.canWrite,
      }).unwrap();

      setIsPermissionModalOpen(false);
      setPermissionTab("view");
      showMessage(translate("trainingsPage.trainingPermissionsUpdated"));
    } catch (error) {
      showErrorMessage(
        getApiErrorDisplayMessage(
          error,
          translate,
          "apiErrors.default",
        ),
      );
    }
  };

  return (
    <div className="space-y-8 p-4 text-slate-900 sm:p-6 lg:p-8">
      <FeedbackToast
        toast={
          showError.show
            ? { type: "error", message: showError.msg }
            : showSuccess.show
              ? { type: "success", message: showSuccess.msg }
              : null
        }
      />

      <header className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div className="space-y-4">
          {/* <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/20 text-primary-dark rounded-full text-[10px] font-bold uppercase tracking-widest">
            <GraduationCap className="w-3.5 h-3.5" />
            {translate("trainingsPage.catalogBadge")}
          </div> */}
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 underline decoration-primary decoration-4 underline-offset-8 sm:text-4xl">
            {translate("trainingsPage.title")}
          </h2>
        </div>
        {showTrainingManagement && (
          <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:flex-wrap md:items-center">
            {canSeeTrainingPermissionsButton && (
              <button
                onClick={() => {
                  setPermissionTab("view");
                  setSelectedTrainingPermissionId(trainingId || trainingData[0]?.id || null);
                  setIsPermissionModalOpen(true);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-900 shadow-sm transition-all active:scale-95 hover:bg-slate-50 cursor-pointer md:w-auto"
              >
                <Shield className="w-5 h-5 text-primary" />
                Permission
              </button>
            )}
            {canCreateTraining && (
              <button
                onClick={handleOpenModal}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white shadow-lg transition-all active:scale-95 hover:bg-slate-800 cursor-pointer md:w-auto"
              >
                <Plus className="w-5 h-5" />
                {translate("trainingsPage.proposeTraining")}
              </button>
            )}
          </div>
        )}
      </header>


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 xl:gap-8">
        <AnimatePresence mode="popLayout">
          {trainings.length ? (
            trainings.map((training) => (
              <motion.div
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={training.id}
                whileHover={{ scale: 1.01 }}
                className={`group relative flex flex-col gap-6 overflow-hidden rounded-3xl border bg-white p-5 shadow-sm cursor-pointer ${training.status === "full" ? "border-slate-100 opacity-80" : "border-slate-200"} lg:flex-row xl:gap-8 xl:p-8`}
                onClick={() => handleOpenDetails(training)}
              >
                {training.status === "full" && !training.isJoined && (
                  <div className="absolute top-0 right-0 p-4">
                    <span className="px-3 py-1 bg-red-50 text-red-600 text-[10px] font-bold uppercase rounded-lg border border-red-100">
                      {translate("trainingsPage.full")}
                    </span>
                  </div>
                )}

                {(canEditTraining || canDeleteTraining) && (
                  <div className="absolute right-4 top-4 z-20 flex gap-2 opacity-100 transition-all md:opacity-0 md:group-hover:opacity-100">
                    {canEditTraining && (
                      <button
                        onClick={(event) => {
                          const original = trainingData.find(t => t.id === training.id);
                          if (original) handleOpenEdit(original, event);
                        }}
                        className="p-2 bg-slate-50 text-slate-300 hover:text-primary-dark rounded-xl transition-all cursor-pointer"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    {canDeleteTraining && (
                      <button
                        onClick={(event) => confirmDelete(training.id, event)}
                        className="p-2 bg-slate-50 text-slate-300 hover:text-red-500 rounded-xl transition-all cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}

                <div className="w-full lg:w-36 xl:w-44 h-40 lg:h-36 xl:h-44 bg-primary rounded-2xl flex-shrink-0 flex items-center justify-center relative overflow-hidden group-hover:scale-105 transition-transform duration-500 shadow-inner">
                  {training.thumbnailUrl ? (
                    <img
                      src={training.thumbnailUrl}
                      alt={training.title}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <div className="relative z-10 bg-white/90 backdrop-blur p-4 rounded-xl shadow-lg border border-white">
                      <BookOpen className="w-10 h-10 text-primary-dark" />
                    </div>
                  )}
                </div>

                <div className="flex-1 flex flex-col">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-bold text-primary-dark uppercase tracking-widest">
                        {training.category}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase ${training.format === "online" ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"}`}
                      >
                        {training.format === "in_person"
                          ? translate("trainingsPage.onsite")
                          : training.format === "online"
                            ? translate("trainingsPage.formatOnline")
                            : translate("trainingsPage.formatHybrid")}
                      </span>
                    </div>
                    <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                      <Clock className="w-3.5 h-3.5" />{" "}
                      {translate("trainingsPage.hours", {
                        count: training.duration_hours,
                      })}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold leading-tight group-hover:text-primary-dark transition-colors">
                    {training.title}
                  </h3>
                  <p className="text-slate-500 text-sm mt-4 flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-slate-400" />{" "}
                    {translate("trainingsPage.instructorLabel")}{" "}
                    <span className="font-semibold text-slate-900">
                      {training.instructor}
                    </span>
                  </p>
                  <div className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-tighter">
                      <CalendarIcon className="w-4 h-4 text-primary" />{" "}
                      {training.training_date}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-tighter">
                      <MapPin className="w-4 h-4 text-primary" />{" "}
                      {training.location}
                    </div>
                  </div>

                  {/* <div className="mt-auto pt-6 flex items-center justify-between gap-4 border-t border-slate-50">
                   <div className="flex-1">
                      <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2">
                         <div 
                           className={`h-1.5 rounded-full transition-all duration-1000 ${ (training.status === 'full' && !training.isJoined) ? 'bg-red-500' : 'bg-primary'}`} 
                           style={{ width: `${training.max_attendees ? Math.min((training.attendees / training.max_attendees) * 100, 100) : 100}%` }}
                         />
                      </div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                        {training.attendees} / {training.max_attendees} registered
                      </p>
                   </div>
                   <button 
                     onClick={(event) => {
                       event.stopPropagation();
                       handleJoin(training.id);
                     }}
                     disabled={(training.status === 'full' && !training.isJoined) || joiningId === training.id}
                     className={`px-5 py-2 rounded-xl text-[10px] font-extrabold uppercase tracking-widest flex items-center gap-2 transition-all shadow-sm ${
                       (training.status === 'full' && !training.isJoined) || joiningId === training.id
                         ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                         : training.isJoined 
                         ? 'bg-emerald-600 text-white' 
                         : 'bg-primary text-slate-900 hover:bg-slate-900 hover:text-white'
                   }`}
                   >
                     {joiningId === training.id ? 'Saving' : training.status === 'full' && !training.isJoined ? 'Full' : training.isJoined ? 'Withdraw' : 'Register'}
                     <ChevronRight className="w-4 h-4" />
                   </button>
                </div> */}
                </div>
              </motion.div>
            ))
          ) : (
            <div className="lg:col-span-2 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center">
              <p className="text-slate-400 font-medium">
                {translate("trainingsPage.noTrainings")}
              </p>
            </div>
          )}
        </AnimatePresence>
      </div>

      <Modal
        isOpen={Boolean(trainingId && selectedTraining && selectedTrainingData)}
        onClose={handleCloseDetails}
        title={translate("trainingsPage.detailsTitle")}
        maxWidth="max-w-5xl"
      >
        {selectedTraining && selectedTrainingData && (
          <div className="space-y-6 text-slate-900 text-left">
            <div className="flex items-center justify-between border-b border-slate-100 mb-6">
              <div className="pb-3 text-sm font-bold uppercase tracking-widest relative text-primary-dark">
                {translate("trainingsPage.context")}
                <motion.div
                  layoutId="cert-tab-underline"
                  className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full"
                />
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="flex items-start gap-4">
                <div className="w-24 h-24 bg-slate-50 rounded-2xl flex items-center justify-center shrink-0 border border-slate-100 shadow-sm overflow-hidden">
                  {selectedTrainingData.thumbnail_url ? (
                    <img
                      src={selectedTrainingData.thumbnail_url}
                      alt={selectedTraining.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Award className="w-8 h-8 text-primary-dark" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold text-primary-dark uppercase tracking-widest block">
                      {selectedTraining.category}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[8px] font-bold uppercase bg-slate-100 text-slate-600">
                      {getTrainingStatusLabel(
                        selectedTrainingData.status,
                        translate,
                      )}
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold leading-tight">
                    {selectedTraining.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-2">
                    {selectedTrainingData.created_at
                      ? `Created ${format(
                          parseISO(selectedTrainingData.created_at),
                          "PPP",
                          { locale: dateLocale },
                        )}`
                      : ""}
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <div className="markdown-body prose prose-slate max-w-none prose-headings:font-bold prose-headings:text-slate-900 prose-p:text-slate-600 prose-p:leading-relaxed prose-a:text-primary prose-blockquote:border-l-primary prose-blockquote:bg-slate-50 prose-blockquote:px-6 prose-blockquote:py-2 prose-blockquote:rounded-r-xl text-left">
                  <div
                    className="tiptap-content"
                    dangerouslySetInnerHTML={{
                      __html: selectedTraining.description,
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary-dark">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">
                      {translate("trainingsPage.duration")}
                    </p>
                    <p className="text-sm font-bold">
                      {translate("trainingsPage.durationHours", {
                        count: selectedTraining.duration_hours,
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl relative overflow-hidden">
                  <div
                    className={`absolute top-0 right-0 px-2 py-0.5 text-[8px] font-bold uppercase rounded-bl-lg ${selectedTraining.format === "online" ? "bg-blue-500 text-white" : "bg-amber-500 text-white"}`}
                  >
                    {selectedTraining.format === "in_person"
                      ? translate("trainingsPage.onsite")
                      : selectedTraining.format === "online"
                        ? translate("trainingsPage.formatOnline")
                        : translate("trainingsPage.formatHybrid")}
                  </div>
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary-dark">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">
                      {translate("trainingsPage.format")}
                    </p>
                    <p className="text-sm font-bold">
                      {selectedTraining.format === "in_person"
                        ? translate("trainingsPage.formatInPerson")
                        : selectedTraining.format === "online"
                          ? translate("trainingsPage.formatOnline")
                          : translate("trainingsPage.formatHybrid")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary-dark">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">
                      {translate("trainingsPage.instructor")}
                    </p>
                    <p className="text-sm font-bold">
                      {selectedTraining.instructor}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary-dark">
                    <CalendarIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">
                      {translate("trainingsPage.session")}
                    </p>
                    <p className="text-sm font-bold">
                      {selectedTraining.rawEndDate !==
                      selectedTraining.rawTrainingDate
                        ? `${selectedTraining.training_date} - ${formatTrainingDate(selectedTraining.rawEndDate, localeCode)}`
                        : selectedTraining.training_date}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary-dark">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">
                      {translate("trainingsPage.location")}
                    </p>
                    <p className="text-sm font-bold">
                      {selectedTraining.location}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary-dark">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">
                      Status
                    </p>
                    <p className="text-sm font-bold">
                      {getTrainingStatusLabel(
                        selectedTrainingData.status,
                        translate,
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-slate-100 bg-white p-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">
                    {translate("trainingsPage.maxAttendees")}
                  </p>
                  <p className="text-xl font-black text-slate-900 mt-2">
                    {selectedTrainingData.max_attendees}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-white p-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">
                    {translate("trainingsPage.registered")}
                  </p>
                  <p className="text-xl font-black text-slate-900 mt-2">
                    {selectedTrainingData.attendee_count}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-white p-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">
                    {translate("trainingsPage.spotsLeft")}
                  </p>
                  <p className="text-xl font-black text-slate-900 mt-2">
                    {selectedTrainingData.spots_left}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-white p-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">
                    {translate("trainingsPage.capacity")}
                  </p>
                  <p className="text-sm font-black text-slate-900 mt-3 uppercase">
                    {selectedTrainingData.is_at_capacity ? "At Capacity" : "Open"}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase">
                  {translate("trainingsPage.registrationState")}
                </p>
                <p className="text-sm font-bold text-slate-900 mt-2 uppercase">
                  {selectedTrainingData.is_registered
                    ? "Registered"
                    : "Not Registered"}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-4 space-y-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase">
                  {translate("trainingsPage.attachments")}
                </p>
                {selectedTrainingData.attachments.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedTrainingData.attachments.map((attachmentUrl) => {
                      const previewType = getAttachmentPreviewType(attachmentUrl);
                      const fileLabel = decodeURIComponent(
                        attachmentUrl.split("/").pop() || attachmentUrl,
                      );

                      return (
                        <div
                          key={attachmentUrl}
                          className="rounded-2xl border border-slate-100 bg-slate-50 overflow-hidden"
                        >
                          {previewType === "image" ? (
                            <a
                              href={attachmentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block"
                            >
                              <img
                                src={attachmentUrl}
                                alt={fileLabel}
                                className="w-full h-48 object-cover"
                              />
                            </a>
                          ) : previewType === "video" ? (
                            <video
                              src={attachmentUrl}
                              controls
                              className="w-full h-48 bg-black"
                            />
                          ) : previewType === "pdf" ? (
                            <iframe
                              src={attachmentUrl}
                              title={fileLabel}
                              className="w-full h-64 bg-white"
                            />
                          ) : previewType === "document" ? (
                            <iframe
                              src={getOfficePreviewUrl(attachmentUrl)}
                              title={fileLabel}
                              className="w-full h-64 bg-white"
                            />
                          ) : (
                            <div className="h-48 flex items-center justify-center bg-white">
                              <FileIcon className="w-10 h-10 text-slate-300" />
                            </div>
                          )}

                          <a
                            href={attachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 px-4 py-3 hover:bg-white transition-colors"
                          >
                            <FileIcon className="w-4 h-4 text-primary shrink-0" />
                            <span className="text-sm font-medium text-slate-700 break-all">
                              {fileLabel}
                            </span>
                          </a>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    {translate("trainingsPage.noAttachments")}
                  </p>
                )}
              </div>
            </motion.div>

            <div className="pt-8 mt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-4">
              <button
                onClick={handleCloseDetails}
                className="flex-1 py-4 border border-slate-200 rounded-2xl font-bold text-sm text-slate-500 hover:bg-slate-50 transition-all uppercase tracking-widest cursor-pointer"
              >
                {translate("trainingsPage.close")}
              </button>
              <button
                onClick={() => {
                  handleCloseDetails();
                  handleJoin(selectedTraining.id);
                }}
                disabled={
                  (selectedTraining.status === "full" &&
                    !selectedTraining.isJoined) ||
                  joiningId === selectedTraining.id
                }
                className={`flex-[2] py-4 rounded-2xl font-bold text-sm transition-all shadow-xl uppercase tracking-widest cursor-pointer ${
                  selectedTraining.isJoined
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-900 text-white hover:bg-slate-800"
                }`}
              >
                {joiningId === selectedTraining.id
                  ? translate("trainingsPage.savingEllipsis")
                  : selectedTraining.isJoined
                    ? translate("trainingsPage.withdrawFromCourse")
                    : translate("trainingsPage.joinTrainingSession")}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTrainingId(null);
        }}
        title={
          editingTrainingId
            ? translate("trainingsPage.editTraining")
            : translate("trainingsPage.proposeNewTraining")
        }
        maxWidth="max-w-4xl"
      >
        <form noValidate onSubmit={handleSubmit} className="space-y-4">
          <FormField
            label={translate("trainingsPage.trainingTitle")}
            value={formData.title || ""}
            onChange={(val) => setFormData({ ...formData, title: val })}
          />
          <FormField
            label={translate("trainingsPage.instructor")}
            value={formData.instructor_name || ""}
            onChange={(val) =>
              setFormData({ ...formData, instructor_name: val })
            }
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <BeautifulDateTimePicker
              label={translate("trainingsPage.trainingDate")}
              type="date"
              value={formData.training_date || ""}
              onChange={(val) =>
                setFormData((prev) => ({
                  ...prev,
                  training_date: val,
                  end_date: isEndDateBeforeStartDate(val, prev.end_date)
                    ? val
                    : prev.end_date,
                }))
              }
              icon={<CalendarIcon className="w-4 h-4 text-primary" />}
            />
            <BeautifulDateTimePicker
              label={translate("agendaPage.endDate")}
              type="date"
              value={formData.end_date || ""}
              onChange={(val) => {
                setFormData({ ...formData, end_date: val });
              }}
              icon={<CalendarIcon className="w-4 h-4 text-primary" />}
              minDate={formData.training_date}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SelectField
              label={translate("trainingsPage.format")}
              options={[
                {
                  label: translate("trainingsPage.formatOnline"),
                  value: "online",
                },
                {
                  label: translate("trainingsPage.formatInPerson"),
                  value: "in_person",
                },
                {
                  label: translate("trainingsPage.formatHybrid"),
                  value: "hybrid",
                },
              ]}
              value={formData.format}
              onChange={(val) =>
                setFormData({ ...formData, format: val as TrainingFormat })
              }
            />
            <FormField
              label={translate("trainingsPage.durationHoursLabel")}
              type="number"
              value={formData.duration_hours || 0}
              onChange={(val) =>
                setFormData({ ...formData, duration_hours: parseInt(val) })
              }
            />
            <FormField
              label={translate("trainingsPage.maxAttendees")}
              type="number"
              value={formData.max_attendees || 20}
              onChange={(val) =>
                setFormData({ ...formData, max_attendees: parseInt(val) })
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              {translate("trainingsPage.thumbnailLabel")}
            </label>
            <div className="grid items-stretch gap-4 md:grid-cols-[minmax(0,1.35fr)_280px]">
              <FileUploadDropzone
                inputId="training-thumbnail-upload"
                accept="image/*"
                multiple={false}
                title={translate("trainingsPage.uploadThumbnail")}
                className="h-full md:min-h-[336px]"
                selectedLabel={
                  formData.thumbnail
                    ? formData.thumbnail.name
                    : formData.thumbnail_url
                      ? translate("trainingsPage.replaceThumbnail")
                      : undefined
                }
                hint="PNG, JPG, WEBP"
                onFilesSelected={(files) => {
                  setFormData({
                    ...formData,
                    thumbnail: files[0] || null,
                  });
                }}
              />
              <div className="flex h-full w-full max-w-[280px] justify-self-center md:max-w-none md:justify-self-auto">
                {(formData.thumbnail || formData.thumbnail_url) ? (
                  <FilePreviewCard
                    file={formData.thumbnail}
                    url={thumbnailPreviewUrl || formData.thumbnail_url || undefined}
                    name={
                      formData.thumbnail?.name ||
                      formData.thumbnail_url?.split("/").pop() ||
                      translate("trainingsPage.thumbnailLabel")
                    }
                    className="h-full w-full"
                    onRemove={() => {
                      setFormData({
                        ...formData,
                        thumbnail: null,
                        thumbnail_url: null,
                      });
                    }}
                    aspectClassName="aspect-square"
                  />
                ) : (
                  <div className="flex h-full min-h-[336px] w-full items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6">
                    <div className="flex h-28 w-28 items-center justify-center rounded-full bg-white text-center text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 shadow-sm">
                      {translate("trainingsPage.thumbnailLabel")}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SelectField
              label={translate("trainingsPage.statusOptional")}
              options={[
                { label: translate("trainingsPage.statusOpen"), value: "open" },
                { label: translate("trainingsPage.statusFull"), value: "full" },
                {
                  label: translate("trainingsPage.statusCompleted"),
                  value: "completed",
                },
              ]}
              value={formData.status}
              onChange={(val) =>
                setFormData({ ...formData, status: val as TrainingStatus })
              }
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              {translate("trainingsPage.attachmentsLabel")}
            </label>
            <FileDropzone
              files={selectedFiles}
              onFilesChange={setSelectedFiles}
            />
            {editingTrainingId &&
              formData.attachments &&
              formData.attachments.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  {formData.attachments.map((file: any, idx: number) => {
                    const fileUrl = getAttachmentUrl(file);
                    const isRemoved = removedFileUrls.includes(fileUrl);
                    const previewKind = getPreviewKind({
                      url: fileUrl,
                      name: getAttachmentName(file),
                    });
                    return (
                      <div
                        key={idx}
                        className={`${isRemoved ? "opacity-60" : ""}`}
                      >
                        <div
                          className={`overflow-hidden rounded-2xl border transition-all ${
                            isRemoved
                              ? "border-red-100 bg-red-50"
                              : "border-slate-200 bg-white"
                          }`}
                        >
                          <FilePreviewCard
                            url={fileUrl}
                            href={fileUrl}
                            name={getAttachmentName(file)}
                            subtitle={
                              isRemoved
                                ? translate("trainingsPage.restoreFile")
                                : translate("trainingsPage.viewFile")
                            }
                          />
                          <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-3">
                            <span className="mr-auto text-[10px] font-bold uppercase tracking-widest text-slate-400">
                              {previewKind === "image"
                                ? translate("trainingsPage.imagePreview")
                                : translate("trainingsPage.filePreview")}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                if (isRemoved)
                                  setRemovedFileUrls(
                                    removedFileUrls.filter((u) => u !== fileUrl),
                                  );
                                else
                                  setRemovedFileUrls([...removedFileUrls, fileUrl]);
                              }}
                              className={`rounded-full p-2 transition-all cursor-pointer ${
                                isRemoved
                                  ? "bg-emerald-100 text-emerald-600"
                                  : "bg-red-100 text-red-600 hover:bg-red-200"
                              }`}
                              title={
                                isRemoved
                                  ? translate("trainingsPage.restoreFile")
                                  : translate("trainingsPage.removeFile")
                              }
                            >
                              {isRemoved ? (
                                <Plus className="w-3 h-3" />
                              ) : (
                                <X className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              {translate("trainingsPage.descriptionLabel")}
            </label>
            <TiptapEditor
              content={formData.description || ""}
              onChange={(content) =>
                setFormData({ ...formData, description: content })
              }
              onImageUpload={handleImageUpload}
            />
          </div>

          <button
            type="submit"
            disabled={
              isCreatingTraining || isUpdatingTraining
            }
            className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all mt-4 font-bold uppercase tracking-widest shadow-lg disabled:opacity-50 cursor-pointer"
          >
            {editingTrainingId ? (
              isUpdatingTraining ? (
                translate("trainingsPage.savingEllipsis")
              ) : (
                translate("trainingsPage.saveTraining")
              )
            ) : isCreatingTraining ? (
              translate("trainingsPage.publishing")
            ) : (
              translate("trainingsPage.publishTraining")
            )}
          </button>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => {
          if (!isDeletingTraining) {
            setIsConfirmOpen(false);
            setDeletingId(null);
          }
        }}
        onConfirm={handleDelete}
        title={translate("trainingsPage.deleteTraining")}
        message={translate("trainingsPage.deleteTrainingMessage")}
        confirmText={translate("common.confirm")}
        loadingText={translate("common.confirm")}
        isLoading={isDeletingTraining}
        closeOnConfirm={false}
      />

      <Modal
        isOpen={isPermissionModalOpen}
        onClose={() => setIsPermissionModalOpen(false)}
        title={translate("trainingsPage.trainingPermissions")}
        maxWidth="max-w-5xl"
      >
        <div className="flex gap-6 border-b border-slate-100 mb-6">
          <button
            onClick={() => setPermissionTab("view")}
            className={`pb-2 text-xs font-black uppercase tracking-widest transition-all relative cursor-pointer ${
              permissionTab === "view"
                ? "text-primary"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            {translate("trainingsPage.currentPermissions")}
            {permissionTab === "view" && (
              <motion.div
                layoutId="trainingPermissionTab"
                className="absolute -bottom-[1px] left-0 right-0 h-0.5 bg-primary"
              />
            )}
          </button>
          <button
            onClick={() => setPermissionTab("edit")}
            className={`pb-2 text-xs font-black uppercase tracking-widest transition-all relative cursor-pointer ${
              permissionTab === "edit"
                ? "text-primary"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            {translate("trainingsPage.managePermissions")}
            {permissionTab === "edit" && (
              <motion.div
                layoutId="trainingPermissionTab"
                className="absolute -bottom-[1px] left-0 right-0 h-0.5 bg-primary"
              />
            )}
          </button>
        </div>

        {permissionTab === "view" ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {translate("trainingsPage.selectTrainingToView")}
              </label>
              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-lg">
                {trainingData.map((training) => (
                  <label
                    key={training.id}
                    className="flex items-center gap-2 p-2 hover:bg-white rounded-md cursor-pointer transition-colors"
                  >
                    <input
                      type="radio"
                      name="training-permission"
                      checked={selectedTrainingPermissionId === training.id}
                      onChange={() => setSelectedTrainingPermissionId(training.id)}
                      className="h-4 w-4 border-slate-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-medium text-slate-700">
                      {training.title}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {selectedTrainingPermissionId ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    {translate("trainingsPage.currentPermissionsFor")}{" "}
                    {currentPermissions?.[0]?.training_name ||
                      trainingData.find(
                        (training) => training.id === selectedTrainingPermissionId,
                      )?.title ||
                      ""}
                  </label>
                  <button
                    onClick={() => {
                      setPermissionData((prev) => ({
                        ...prev,
                        trainingIds: [selectedTrainingPermissionId],
                      }));
                      setPermissionTab("edit");
                    }}
                    className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline cursor-pointer"
                  >
                    {translate("trainingsPage.editThese")}
                  </button>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                  {isLoadingCurrentPermissions ? (
                    <div className="p-4 space-y-3 animate-pulse">
                      <div className="grid grid-cols-[2fr,1fr,1fr] gap-3">
                        <div className="h-4 rounded bg-slate-100" />
                        <div className="h-4 rounded bg-slate-100" />
                        <div className="h-4 rounded bg-slate-100" />
                      </div>
                      {Array.from({ length: 4 }).map((_, index) => (
                        <div
                          key={index}
                          className="grid grid-cols-[2fr,1fr,1fr] gap-3 items-center"
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
                        <tr className="bg-slate-100/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                          <th className="px-4 py-3 text-left">
                            {translate("trainingsPage.role")}
                          </th>
                          <th className="px-4 py-3 text-center">
                            {translate("trainingsPage.read")}
                          </th>
                          <th className="px-4 py-3 text-center">
                            {translate("trainingsPage.write")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(currentPermissions || []).map((permission) => (
                          <tr
                            key={permission.id}
                            className="hover:bg-white transition-colors"
                          >
                            <td className="px-4 py-3 font-bold text-slate-700 capitalize">
                              {permission.role_name
                                ? translatePermissionRole(permission.role_name)
                                : permissionRoleLabelsById[permission.role_id] || ""}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {permission.can_read ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                              ) : (
                                <div className="w-2 h-2 rounded-full bg-slate-300 mx-auto" />
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {permission.can_write ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                              ) : (
                                <div className="w-2 h-2 rounded-full bg-slate-300 mx-auto" />
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
          <form onSubmit={handleSetTrainingPermission} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {translate("trainingsPage.selectTrainingsToUpdate")}
              </label>
              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-lg">
                {trainingData.map((training) => (
                  <label
                    key={training.id}
                    className="flex items-center gap-2 p-2 hover:bg-white rounded-md cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={permissionData.trainingIds.includes(training.id)}
                      onChange={(e) => {
                        const nextTrainingIds = e.target.checked
                          ? [...permissionData.trainingIds, training.id]
                          : permissionData.trainingIds.filter((id) => id !== training.id);
                        setPermissionData({
                          ...permissionData,
                          trainingIds: nextTrainingIds,
                        });
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-medium text-slate-700">
                      {training.title}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {translate("trainingsPage.rolesToUpdate")}
              </label>
              <div className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 sm:grid-cols-2">
                {permissionRoleOptions.map((role) => (
                  <label
                    key={role.id}
                    className="flex items-center gap-2 p-2 hover:bg-white rounded-md cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={permissionData.roleIds.includes(role.id)}
                      onChange={(e) => {
                        const nextRoleIds = e.target.checked
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

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {translate("trainingsPage.accessSettings")}
              </label>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex items-center justify-between gap-4 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-white transition-colors">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    {translate("trainingsPage.canRead")}
                  </span>
                  <input
                    type="checkbox"
                    checked={permissionData.canRead}
                    onChange={(e) =>
                      setPermissionData({
                        ...permissionData,
                        canRead: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                </label>
                <label className="flex items-center justify-between gap-4 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-white transition-colors">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    {translate("trainingsPage.canWrite")}
                  </span>
                  <input
                    type="checkbox"
                    checked={permissionData.canWrite}
                    onChange={(e) =>
                      setPermissionData({
                        ...permissionData,
                        canWrite: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSettingTrainingPermission}
              className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition-all mt-4 uppercase tracking-[0.2em] shadow-xl cursor-pointer"
            >
              {isSettingTrainingPermission
                ? "Saving"
                : "Apply Bulk Permissions"}
            </button>
          </form>
        )}
      </Modal>
    </div>
  );
}

const FormField = ({
  label,
  value,
  onChange,
  type = "text",
  required = true,
  autoComplete,
  minLength,
}: {
  label: string;
  value: any;
  onChange: (val: string) => void;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  minLength?: number;
}) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
      {label}
    </label>
    <input
      required={required}
      type={type}
      autoComplete={autoComplete}
      minLength={minLength}
      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 outline-none font-bold text-sm transition-all"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

const SelectField = ({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: (string | { label: string; value: string })[];
  value: any;
  onChange: (val: string) => void;
}) => {
  const { translate } = useI18n();

  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
        {label}
      </label>
      <select
        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 outline-none font-bold text-sm uppercase tracking-widest cursor-pointer"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">
          {translate("trainingsPage.selectLabel", { label })}
        </option>
        {options.map((opt) => {
          const labelText = typeof opt === "string" ? opt : opt.label;
          const valueVal = typeof opt === "string" ? opt : opt.value;
          return (
            <option key={valueVal} value={valueVal}>
              {labelText}
            </option>
          );
        })}
      </select>
    </div>
  );
};

const BeautifulDateTimePicker = ({
  label,
  value,
  onChange,
  type,
  icon,
  minDate,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  type: "date" | "time";
  icon: React.ReactNode;
  minDate?: string;
}) => {
  const { dateLocale, translate } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());
  const pickerRef = React.useRef<HTMLDivElement>(null);
  const weekdayLabels = eachDayOfInterval({
    start: startOfWeek(new Date()),
    end: endOfWeek(new Date()),
  }).map((day) => format(day, "EEE", { locale: dateLocale }));

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const renderCalendar = () => {
    const start = startOfWeek(startOfMonth(viewDate));
    const end = endOfWeek(endOfMonth(viewDate));
    const days = eachDayOfInterval({ start, end });

    return (
      <div className="p-4 w-72 bg-white rounded-3xl shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 relative">
        <div className="flex items-center justify-between mb-4 px-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setViewDate(subMonths(viewDate, 1));
            }}
            className="p-2 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-900">
            {format(viewDate, "MMMM yyyy", { locale: dateLocale })}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setViewDate(addMonths(viewDate, 1));
            }}
            className="p-2 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {weekdayLabels.map((day) => (
            <div
              key={day}
              className="text-[8px] font-black text-slate-300 uppercase tracking-widest text-center py-2"
            >
              {day}
            </div>
          ))}
          {days.map((day, idx) => {
            const isSelected =
              value && isSameDay(day, parse(value, "yyyy-MM-dd", new Date()));
            const isCurrentMonth = isSameMonth(day, viewDate);
            const isDisabled =
              type === "date" &&
              minDate &&
              isBefore(day, parse(minDate, "yyyy-MM-dd", new Date())) &&
              !isSameDay(day, parse(minDate, "yyyy-MM-dd", new Date()));
            return (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isDisabled) {
                    return;
                  }
                  onChange(format(day, "yyyy-MM-dd"));
                  setIsOpen(false);
                }}
                disabled={Boolean(isDisabled)}
                className={`
                    h-8 w-8 rounded-xl text-[10px] font-bold transition-all cursor-pointer
                    ${isSelected ? "bg-primary text-slate-900 shadow-lg scale-110" : "hover:bg-slate-50 text-slate-600"}
                    ${!isCurrentMonth && !isSelected ? "opacity-20" : ""}
                    ${isDisabled ? "cursor-not-allowed opacity-20 hover:bg-transparent" : ""}
                  `}
              >
                {format(day, "d")}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderTimePicker = () => {
    const hours = Array.from({ length: 24 }, (_, i) =>
      i.toString().padStart(2, "0"),
    );
    const minutes = ["00", "15", "30", "45"];

    return (
      <div className="p-4 w-64 bg-white rounded-3xl shadow-2xl border border-slate-100 flex gap-4 max-h-72 overflow-hidden relative">
        <div className="flex-1 overflow-y-auto pr-2 space-y-1 custom-scrollbar">
          <div className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-2 px-2">
            {translate("trainingsPage.hour")}
          </div>
          {hours.map((h) => (
            <button
              key={h}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const [_, m = "00"] = value.split(":");
                onChange(`${h}:${m}`);
              }}
              className={`w-full text-left px-3 py-2 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                value.startsWith(h + ":")
                  ? "bg-primary text-slate-900"
                  : "hover:bg-slate-50 text-slate-600"
              }`}
            >
              {h}:00
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
          <div className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-2 px-2">
            {translate("trainingsPage.minute")}
          </div>
          {minutes.map((m) => (
            <button
              key={m}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const [h = "00"] = value.split(":");
                onChange(`${h}:${m}`);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                value.endsWith(":" + m)
                  ? "bg-primary text-slate-900"
                  : "hover:bg-slate-50 text-slate-600"
              }`}
            >
              :{m}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-2 relative" ref={pickerRef}>
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
        {label}
      </label>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="relative group cursor-pointer"
      >
        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none group-hover:scale-110 transition-transform">
          {icon}
        </div>
        <div className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm transition-all hover:bg-white flex items-center min-h-[46px]">
          {value ? (
            type === "date" ? (
              format(parse(value, "yyyy-MM-dd", new Date()), "PPP", {
                locale: dateLocale,
              })
            ) : (
              value
            )
          ) : (
            <span className="text-slate-300">
              {translate("trainingsPage.selectLabel", { label })}
            </span>
          )}
        </div>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">
          <Plus className="w-3 h-3 rotate-45" />
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute z-[100] mt-2 left-0 origin-top-left"
          >
            {type === "date" ? renderCalendar() : renderTimePicker()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const FileDropzone = ({
  files,
  onFilesChange,
}: {
  files: File[];
  onFilesChange: (files: File[]) => void;
}) => {
  const { translate } = useI18n();
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    onFilesChange([...files, ...droppedFiles]);
  };

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
        <FileUploadDropzone
          inputId="training-attachments-upload"
          title={translate("trainingsPage.clickOrDragDrop")}
          hint={translate("trainingsPage.attachmentsHint")}
          selectedLabel={
            files.length
              ? translate("trainingsPage.filesSelected", {
                  count: files.length,
                })
              : undefined
          }
          onFilesSelected={(newFiles) => onFilesChange([...files, ...newFiles])}
          preview={
            files.length ? (
              <SelectedFilesPreview
                files={files}
                onRemove={removeFile}
                className="h-full w-full"
              />
            ) : undefined
          }
          emptyPreview={
            <div className="flex h-full min-h-[336px] w-full items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6">
              <div className="flex h-28 w-28 items-center justify-center rounded-full bg-white px-3 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 shadow-sm">
                {translate("trainingsPage.attachmentsLabel")}
              </div>
            </div>
          }
        />
      </div>
    </div>
  );
};
