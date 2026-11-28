import { readAdminCount, type AdminCount } from "./admin/adminCounts";
import { sanitizeRichContent } from "../utils/richContent";
import { ModalFieldGrid, ModalFullWidth, ModalSection, ModalMediaSplit, ModalSubmitButton } from "../components/ui/ModalLayout";
import "./MemberAdminModals.css";
import { AdminPasswordField } from "./admin/AdminPasswordField";
import { AdminPermissionsEditor } from "./admin/AdminPermissionsEditor";
import { buildAdminForumCreatePayload, isUndisplayedAdminStatus } from "./admin/adminPresentation";
import "./AdminPanel.css";
import { useArticleAuthorization } from "../hooks/useArticleAuthorization";
import React, { useState } from "react";
import { reconcileDraft, type DraftSnapshot } from '../utils/recordDraft';
import {
  Users,
  Shield,
  Activity,
  Search,
  CheckCircle2,
  Clock,
  Trash2,
  Edit2,
  FileText,
  Database,
  Calendar as CalendarIcon,
  BookOpen,
  Plus,
  MapPin,
  Eye,
  File as FileIcon,
  PlayCircle,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  X,
  Filter,
  ShieldAlert,
  History,
  MessageSquare as MessageSquareIcon,
  XCircle,
  Paperclip,
  Globe,
  Download,
  Wrench,
  Archive,
} from "lucide-react";
import TiptapEditor from "../components/ui/TiptapEditor";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  eachDayOfInterval,
  parse,
} from "date-fns";
import { useSelector } from "react-redux";
import { Navigate, useNavigate } from "react-router-dom";
import { useAppToast } from "../components/ui/AppToastProvider";
import Modal from "../components/ui/Modal";
import ConfirmModal from "../components/ui/ConfirmModal";
import {
  FilePreviewCard,
  FileUploadDropzone,
  SelectedFilesPreview,
} from "../components/ui/FileUploadPreview";
import { RootState } from "../redux/store";
import { usePermissions } from "../hooks/usePermissions";
import {
  useGetUsersQuery,
  useDeleteUserMutation,
  useSoftDeleteUserMutation,
  useRestoreUserMutation,
  useCreateUserMutation,
  useUpdateUserMutation,
  useGetUserByIdQuery,

  useExportUsersCsvMutation,
  useGetUserRolesQuery,
  useCreateUserRoleMutation,
  useUpdateUserRoleMutation,
  useDeleteUserRoleMutation,

} from "../redux/features/members/membersApi";
import {
  useGetModerationQueueQuery,
  useGetModerationLogsQuery,
  useModeratePostMutation,
} from "../redux/features/moderation/moderationApi";
import {
  useGetForumsQuery,
  useCreateForumMutation,
  useDeleteForumMutation,
  useUpdateForumMutation,
  useGetForumQuery,

} from "../redux/features/forum/forumApi";
import {
  useGetArticlesQuery,
  useDeleteArticleMutation,
  useCreateArticleMutation,
  useGetArticleCategoriesQuery,
  useGetArticleByIdQuery,
  useUpdateArticleMutation,
  usePublishArticleMutation,
  useUploadFileMutation,
  useDeleteFileMutation,
} from "../redux/features/articles/articlesApi";
import {
  useCreateTechnicoProMutation,
  useDeleteTechnicoProMutation,
  useGetTechnicoProByIdQuery,
  useGetTechnicoProCategoriesQuery,
  useGetTechnicoProsQuery,
  usePublishTechnicoProMutation,
  useUpdateTechnicoProMutation,
} from "../redux/features/technicopro/technicoproApi";
import {
  useGetEventsQuery,
  useGetCalendarStatsQuery,
  useDeleteEventMutation,
  useCreateEventMutation,
  useGetEventByIdQuery,
  useUpdateEventMutation,
  useGetEventCategoriesQuery,
} from "../redux/features/events/eventsApi";
import {
  useGetAllTrainingsQuery,
  useGetTrainingsPaginatedQuery,
  useDeleteTrainingMutation,
  useCreateTrainingMutation,
  useUpdateTrainingMutation,
  useGetTrainingByIdQuery,

  useGetTrainingCategoriesQuery,
  buildTrainingFormData,
} from "../redux/features/trainings/trainingsApi";
import { TrainingRequest } from "../redux/features/trainings/trainingTypes";
import type {
  Article,
  CreateArticleRequest,
} from "../redux/features/articles/articleTypes";
import type {
  TechnicoPro,
  TechnicoProRequest,
} from "../redux/features/technicopro/technicoproTypes";
import {
  useGetAdminSmtpSettingsQuery,
  useUpdateAdminSmtpSettingsMutation,
  useTestAdminSmtpSettingsMutation,
  useGetAdminSystemLogsQuery,
  useDownloadAdminSystemLogsMutation,
  useClearAdminSystemLogsMutation,
  useGetAdminBackupsQuery,
  useUpdateAdminBackupConfigurationMutation,
  useRunAdminBackupMutation,

  useDeleteAdminBackupMutation,
  useDownloadAdminBackupMutation,
} from "../redux/features/admin/adminApi";
import type {
  AdminBackupItem,
  UpdateAdminBackupConfigurationRequest,
  UpdateAdminSmtpSettingsRequest,
} from "../redux/features/admin/adminTypes";
import { useI18n } from "../i18n";
import { ROLE_SLUGS } from "../redux/features/auth/authTypes";
import { getApiErrorDisplayMessage } from "../utils/apiErrorMessages";
import type {
  CreateUserRequest,

  User as MemberUser,
  UpdateUserRequest,

  UserRoleDetails,
} from "../redux/features/members/membersTypes";

// --- DATA TYPES ---

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  is_superuser?: boolean;
  status: "active" | "pending" | "suspended";
  is_payment_validated: boolean;
  joinedDate: string;
}

interface ForumEntity {
  id: string;
  name: string;
  author_name: string | null;
  type: "general" | "professionnel" | "commission";
  topics: number;
  posts: number;
  status: "active" | "archived";
}

interface ArticleEntity {
  id: string;
  title: string;
  author: string;
  category: string;
  date: string;
  status: "published" | "draft";
}

interface EventEntity {
  id: string;
  title: string;
  date: string;
  end_date?: string;
  location: string;
  type: string;
  status: "upcoming" | "completed" | "cancelled";
}

interface TrainingEntity {
  id: string;
  title: string;
  category: string;
  excerpt?: string;
  status: "draft" | "pending" | "published";
}

type AdminTab =
  | "members"
  | "forums"
  | "articles"
  | "technicopro"
  | "events"
  | "trainings"
  | "moderation"
  | "rolesPermissions"
  | "settingsBackups";

const downloadFile = (file: Blob, filename: string) => {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

const formatBytes = (bytes?: number | null) => {
  if (!bytes || bytes < 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** unitIndex;

  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
};

const adminTableHeadCellClass =
  "overflow-hidden text-ellipsis whitespace-nowrap px-4 py-3 text-left align-middle text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500";
const adminTableHeadCellRightClass = `${adminTableHeadCellClass} text-right`;
const adminTableCellClass =
  "overflow-hidden text-ellipsis whitespace-nowrap p-4 align-middle";
const adminTableRowClass = "hover:bg-slate-50/70 transition-colors group";
const adminPaginationClass =
  "admin-pagination col-span-full w-full max-w-full min-w-0 border-t border-slate-100 bg-slate-50/70";
const adminPaginationButtonClass =
  "flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer";
const adminPaginationTextClass =
  "text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500";
const adminPaginationPageClass =
  "rounded-full bg-primary/15 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-slate-900";

const SkeletonBar = ({ className }: { className: string }) => (
  <span
    className={`block animate-pulse rounded-full bg-slate-100 ${className}`}
  />
);

const AdminTableSkeleton = ({
  rows = 5,
  columns,
}: {
  rows?: number;
  columns: number;
}) => (
  <>
    {Array.from({ length: rows }).map((_, index) => (
      <tr key={index} className="border-b border-slate-50 last:border-b-0">
        <td colSpan={columns} className="px-8 py-5">
          <span className="flex items-center justify-between gap-6 animate-pulse">
            <span className="block flex-1 space-y-3">
              <SkeletonBar className="h-4 w-2/5" />
              <SkeletonBar className="h-3 w-4/5" />
            </span>
            <span className="hidden flex-1 items-center justify-end gap-6 md:flex">
              <SkeletonBar className="h-4 w-20" />
              <SkeletonBar className="h-4 w-16" />
              <SkeletonBar className="h-4 w-20" />
            </span>
            <span className="flex items-center gap-2">
              <span className="h-8 w-8 rounded-lg bg-slate-100" />
              <span className="h-8 w-8 rounded-lg bg-slate-100" />
              <span className="h-8 w-8 rounded-lg bg-slate-100" />
            </span>
          </span>
        </td>
      </tr>
    ))}
  </>
);

const getLastPathSegment = (value: string) => {
  try {
    return decodeURIComponent(value.split("/").pop() || value);
  } catch {
    return value.split("/").pop() || value;
  }
};

const isImageUrl = (value: string) =>
  /\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i.test(value.split("?")[0]);

const DetailField = ({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) => (
  <div>
    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
      {label}
    </p>
    <div className="mt-1 text-sm font-bold text-slate-900">{value}</div>
  </div>
);

const RichTextPreview = ({
  content,
  className = "",
}: {
  content?: string | null;
  className?: string;
}) => {
  const previewText = content
    ?.replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return (
    <span
      className={`block min-w-0 max-w-full overflow-hidden text-ellipsis ${!previewText ? "italic" : ""} ${className}`}
    >
      {previewText || "-"}
    </span>
  );
};

export default function AdminPanel() {
  const adminFieldId = React.useId();
  const navigate = useNavigate();
  const toast = useAppToast();
  const MEMBERS_PAGE_SIZE = 10;
  const ARTICLES_PAGE_SIZE = 20;
  const TECHNICOPRO_PAGE_SIZE = 20;
  const MODERATION_QUEUE_PAGE_SIZE = 20;
  const MODERATION_LOGS_PAGE_SIZE = 20;
  const { user } = useSelector((state: RootState) => state.auth);
  const { translate, localeCode, dateLocale } = useI18n();
  const { hasPermission, canAccessAdminPanel, canAccessModeration } =
    usePermissions();

  const canModify = useArticleAuthorization();
  const canViewMembers = hasPermission("user", "view");
  const canCreateMembers = hasPermission("user", "create");
  const canEditMembers = hasPermission("user", "edit");
  const canDeleteMembers = hasPermission("user", "delete");
  const canViewForums = hasPermission("forum", "view");
  const canCreateForums = hasPermission("forum", "create");
  const canEditForums = hasPermission("forum", "edit");
  const canDeleteForums = hasPermission("forum", "delete");
  const canViewArticles = hasPermission("article", "view");
  const canCreateArticles = hasPermission("article", "create");
  const canEditArticles = hasPermission("article", "edit");
  const canDeleteArticles = hasPermission("article", "delete");
  const canViewTechnicoPro = hasPermission("technicopro", "view");
  const canCreateTechnicoPro = hasPermission("technicopro", "create");
  const canEditTechnicoPro = hasPermission("technicopro", "edit");
  const canDeleteTechnicoPro = hasPermission("technicopro", "delete");
  const canViewEvents = hasPermission("event", "view");
  const canCreateEvents = hasPermission("event", "create");
  const canEditEvents = hasPermission("event", "edit");
  const canDeleteEvents = hasPermission("event", "delete");
  const canViewTrainings = hasPermission("training", "view");
  const canCreateTrainings = hasPermission("training", "create");
  const canEditTrainings = hasPermission("training", "edit");
  const canDeleteTrainings = hasPermission("training", "delete");
  const canManageRolesPermissions = canEditMembers;
  const [permissionMember, setPermissionMember] = useState<Pick<MemberUser, "id" | "email" | "first_name" | "last_name"> | null>(null);
  const [isSavingMemberPermission, setIsSavingMemberPermission] = useState(false);


  // --- COMPONENT STATE ---
  const [activeTab, setActiveTab] = useState<AdminTab>("members");
  const [modSubTab, setModSubTab] = useState<"queue" | "logs">("queue");
  const [searchTerm, setSearchTerm] = useState("");
  const [memberStatusFilter, setMemberStatusFilter] = useState("all");
  const [memberRoleFilter, setMemberRoleFilter] = useState("all");
  const [memberPage, setMemberPage] = useState(1);
  const [articlePage, setArticlePage] = useState(1);
  const [technicoproPage, setTechnicoproPage] = useState(1);
  const [moderationQueuePage, setModerationQueuePage] = useState(1);
  const [moderationLogsPage, setModerationLogsPage] = useState(1);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isRoleDeleteConfirmOpen, setIsRoleDeleteConfirmOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<UserRoleDetails | null>(
    null,
  );
  const [editingRole, setEditingRole] = useState<UserRoleDetails | null>(null);
  const [newRoleData, setNewRoleData] = useState({
    name: "",
    description: "",
  });

  const [smtpForm, setSmtpForm] = useState<UpdateAdminSmtpSettingsRequest>({
    host: "",
    port: 587,
    username: "",
    password: "",
    from_email: "",
    from_name: "",
    use_tls: true,
    use_ssl: false,
  });
  const [smtpTestEmail, setSmtpTestEmail] = useState("");
  const [systemLogSearchTerm, setSystemLogSearchTerm] = useState("");
  const [systemLogsLimit, setSystemLogsLimit] = useState(8);
  const [backupConfigForm, setBackupConfigForm] =
    useState<UpdateAdminBackupConfigurationRequest>({
      enabled: true,
      frequency: "daily",
      execution_time: "09:00",
      retention_days: 30,
      max_backups: 30,
      backup_dir: "Backups",
    });
  const [backupToDelete, setBackupToDelete] = useState<AdminBackupItem | null>(
    null,
  );

  const getTabLabel = (tab: AdminTab) =>
    translate(tab === "rolesPermissions" ? "adminUi.roles" : `adminPanelPage.tabs.${tab}`);

  const getRoleLabel = (role?: string | null) => {
    if (!role) return translate("adminPanelPage.fallbacks.member");

    switch (role) {
      case ROLE_SLUGS.ADMIN:
        return translate("adminPanelPage.roles.admin");
      case ROLE_SLUGS.MODERATOR:
        return translate("adminPanelPage.roles.moderator");
      case ROLE_SLUGS.MEMBER:
        return translate("adminPanelPage.roles.member");
      default:
        return role.replace(/_/g, " ");
    }
  };

  const getMemberStatusLabel = (status?: string | null) => {
    if (isUndisplayedAdminStatus(status)) return translate("adminUi.neutralStatus");
    switch (status) {
      case "active":
        return translate("adminPanelPage.memberStatuses.active");
      case "suspended":
        return translate("adminPanelPage.memberStatuses.suspended");
      default:
        return status || translate("adminPanelPage.fallbacks.notAvailable");
    }
  };

  const getForumTypeLabel = (forumType?: string | null) => {
    switch (forumType) {
      case "general":
        return translate("adminPanelPage.forumTypes.general");
      case "professional":
      case "professionnel":
        return translate("adminPanelPage.forumTypes.professional");
      case "commission":
        return translate("adminPanelPage.forumTypes.commission");
      default:
        return forumType || translate("adminPanelPage.fallbacks.notAvailable");
    }
  };

  const getArticleStatusLabel = (status?: string | null) => {
    if (isUndisplayedAdminStatus(status)) return translate("adminUi.neutralStatus");
    switch (status) {
      case "published":
        return translate("adminPanelPage.articleStatuses.published");
      case "draft":
        return translate("adminPanelPage.articleStatuses.draft");
      default:
        return status || translate("adminPanelPage.fallbacks.notAvailable");
    }
  };

  const getEventTypeLabel = (eventType?: string | null) => {
    switch (eventType) {
      case "general":
        return translate("adminPanelPage.eventTypes.general");
      case "training":
        return translate("adminPanelPage.eventTypes.training");
      case "commission":
        return translate("adminPanelPage.eventTypes.commission");
      case "board":
        return translate("adminPanelPage.eventTypes.board");
      default:
        return eventType || translate("adminPanelPage.fallbacks.notAvailable");
    }
  };

  const getEventStatusLabel = (status?: string | null) => {
    switch (status) {
      case "upcoming":
        return translate("adminPanelPage.eventStatuses.upcoming");
      case "completed":
        return translate("adminPanelPage.eventStatuses.completed");
      case "cancelled":
        return translate("adminPanelPage.eventStatuses.cancelled");
      default:
        return status || translate("adminPanelPage.fallbacks.notAvailable");
    }
  };

  const getTrainingStatusLabel = (status?: string | null) => {
    if (isUndisplayedAdminStatus(status)) return translate("adminUi.neutralStatus");
    switch (status) {
      case "published":
        return translate("adminPanelPage.articleStatuses.published");
      case "draft":
        return translate("adminPanelPage.articleStatuses.draft");
      default:
        return status || translate("adminPanelPage.fallbacks.notAvailable");
    }
  };

  const getModerationStatusLabel = (status?: string | null) => {
    if (isUndisplayedAdminStatus(status)) return translate("adminUi.neutralStatus");
    switch (status) {
      case "flagged":
        return translate("adminPanelPage.moderationStatuses.flagged");
      default:
        return status || translate("adminPanelPage.fallbacks.notAvailable");
    }
  };

  const getModerationActionLabel = (action?: string | null) => {
    switch (action) {
      case "approve":
        return translate("adminPanelPage.moderationActions.approve");
      case "reject":
        return translate("adminPanelPage.moderationActions.reject");
      default:
        return action || translate("adminPanelPage.fallbacks.notAvailable");
    }
  };

  const formatLocalizedDate = (value?: string | Date | null, token = "PPP") => {
    if (!value) return translate("adminPanelPage.fallbacks.notAvailable");

    try {
      const date = value instanceof Date ? value : new Date(value);

      if (Number.isNaN(date.getTime())) {
        return String(value);
      }

      return format(date, token, { locale: dateLocale });
    } catch {
      return String(value);
    }
  };

  const formatLocalizedDateTime = (value?: string | null) => {
    if (!value) return translate("adminPanelPage.fallbacks.notAvailable");

    try {
      return new Date(value).toLocaleDateString(localeCode);
    } catch {
      return value;
    }
  };

  // Entities state
  const {
    currentData: usersData,
    isLoading: isLoadingUsers,
    isFetching: isFetchingUsers,
  } = useGetUsersQuery({
    archived: false,
    page: memberPage,
    pageSize: MEMBERS_PAGE_SIZE,
    search: searchTerm.trim() || undefined,
    role_id: memberRoleFilter !== "all" ? memberRoleFilter : undefined,
    status: memberStatusFilter !== "all" ? memberStatusFilter : undefined,
  }, {skip: !canAccessAdminPanel || activeTab !== 'members'});
  const { currentData: forumsResponse } = useGetForumsQuery({ pageSize: 100 }, {skip: !canAccessAdminPanel || activeTab !== 'forums'});
  const forumsData = forumsResponse?.results ?? [];
  const {
    currentData: articlesData,
    isLoading: isLoadingArticles,
    isFetching: isFetchingArticles,
  } = useGetArticlesQuery({
    page: articlePage,
    pageSize: ARTICLES_PAGE_SIZE,
  }, {skip: !canAccessAdminPanel || activeTab !== 'articles'});
  const {
    currentData: technicoproData,
    isLoading: isLoadingTechnicoPro,
    isFetching: isFetchingTechnicoPro,
  } = useGetTechnicoProsQuery({
    page: technicoproPage,
    pageSize: TECHNICOPRO_PAGE_SIZE,
  }, {skip: !canAccessAdminPanel || activeTab !== 'technicopro'});
  const { currentData: eventsData } = useGetEventsQuery({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  }, {skip: !canAccessAdminPanel || activeTab !== 'events'});
  const { currentData: eventCategoriesResponse } = useGetEventCategoriesQuery({
    pageSize: 100,
  }, {skip: !canAccessAdminPanel || activeTab !== 'events'});
  const eventCategories = eventCategoriesResponse?.results ?? [];
  const { currentData: trainingsData } = useGetAllTrainingsQuery(undefined, {skip: !canAccessAdminPanel || activeTab !== 'trainings'});
  const rolesCountQuery = useGetUserRolesQuery(undefined, { skip: !canAccessAdminPanel });
  const userRolesData = rolesCountQuery.currentData ?? [];

  // Stable, unfiltered metadata subscriptions keep every badge available while
  // full record/category queries remain scoped to the selected tab.
  const usersCountQuery = useGetUsersQuery({ archived: false, page: 1, pageSize: 1 }, { skip: !canAccessAdminPanel });
  const forumsCountQuery = useGetForumsQuery({ page: 1, pageSize: 1 }, { skip: !canAccessAdminPanel });
  const articlesCountQuery = useGetArticlesQuery({ page: 1, pageSize: 1 }, { skip: !canAccessAdminPanel });
  const technicoproCountQuery = useGetTechnicoProsQuery({ page: 1, pageSize: 1 }, { skip: !canAccessAdminPanel });
  const trainingsCountQuery = useGetTrainingsPaginatedQuery({ page: 1, pageSize: 1 }, { skip: !canAccessAdminPanel });
  const eventsCountQuery = useGetCalendarStatsQuery(undefined, { skip: !canAccessAdminPanel });


  const {
    currentData: moderationQueueData,
    isLoading: isLoadingModeration,
    isFetching: isFetchingModerationQueue,
  } = useGetModerationQueueQuery({
    page: moderationQueuePage,
    pageSize: MODERATION_QUEUE_PAGE_SIZE,
  }, {skip: !canAccessAdminPanel || activeTab !== 'moderation' || modSubTab !== 'queue'});
  const {
    currentData: moderationLogsData,
    isLoading: isLoadingModerationLogs,
    isFetching: isFetchingModerationLogs,
  } = useGetModerationLogsQuery({
    page: moderationLogsPage,
    pageSize: MODERATION_LOGS_PAGE_SIZE,
  }, {skip: !canAccessAdminPanel || activeTab !== 'moderation' || modSubTab !== 'logs'});

  // Moderation state

  const [pendingModAction, setPendingModAction] = useState<{
    id: string;
    type: "approve" | "reject";
  } | null>(null);
  const [isModConfirmOpen, setIsModConfirmOpen] = useState(false);

  // Mutations
  const [deleteUser, { isLoading: isDeletingUser }] = useDeleteUserMutation();
  const [softDeleteUser, { isLoading: isArchivingUser }] =
    useSoftDeleteUserMutation();
  const [restoreUser, { isLoading: isRestoringUser }] =
    useRestoreUserMutation();

  const [exportUsersCsv, { isLoading: isExportingUsers }] =
    useExportUsersCsvMutation();

  const [moderatePost, { isLoading: isModerating }] = useModeratePostMutation();

  const handleModerateAction = async (
    id: string,
    action: "approve" | "reject",
  ) => {
    if (!canAccessAdminPanel) return;
    try {
      await moderatePost({ postId: id, body: { action } }).unwrap();
      notifySuccess();
      setIsModConfirmOpen(false);
      setPendingModAction(null);
    } catch (err) {
      notifyError(err);
    }
  };

  const confirmModAction = (id: string, type: "approve" | "reject") => {
    if (!canAccessAdminPanel) return;
    if (type === "reject") {
      setPendingModAction({ id, type });
      setIsModConfirmOpen(true);
    } else {
      handleModerateAction(id, "approve");
    }
  };

  const [createUser, { isLoading: isCreatingMember }] = useCreateUserMutation();
  const [updateUser, { isLoading: isUpdatingMember }] = useUpdateUserMutation();
  const [createUserRole, { isLoading: isCreatingUserRole }] =
    useCreateUserRoleMutation();
  const [updateUserRole, { isLoading: isUpdatingUserRole }] =
    useUpdateUserRoleMutation();
  const [deleteUserRole, { isLoading: isDeletingUserRole }] =
    useDeleteUserRoleMutation();

  const [deleteArticle, { isLoading: isDeletingArticle }] =
    useDeleteArticleMutation();
  const [createArticle, { isLoading: isCreatingArticle }] =
    useCreateArticleMutation();
  const [updateArticle, { isLoading: isUpdatingArticle }] =
    useUpdateArticleMutation();
  const [publishArticle, { isLoading: isPublishingArticle }] =
    usePublishArticleMutation();
  const [uploadFile] = useUploadFileMutation();
  const [deleteFile] = useDeleteFileMutation();
  const [deleteTechnicoPro, { isLoading: isDeletingTechnicoPro }] =
    useDeleteTechnicoProMutation();
  const [createTechnicoPro, { isLoading: isCreatingTechnicoPro }] =
    useCreateTechnicoProMutation();
  const [updateTechnicoPro, { isLoading: isUpdatingTechnicoPro }] =
    useUpdateTechnicoProMutation();
  const [publishTechnicoPro, { isLoading: isPublishingTechnicoPro }] =
    usePublishTechnicoProMutation();

  const [deleteEvent, { isLoading: isDeletingEvent }] =
    useDeleteEventMutation();
  const [createEvent, { isLoading: isCreatingEvent }] =
    useCreateEventMutation();
  const [updateEvent, { isLoading: isUpdatingEvent }] =
    useUpdateEventMutation();

  const [deleteTraining, { isLoading: isDeletingTraining }] =
    useDeleteTrainingMutation();
  const [createTraining, { isLoading: isCreatingTraining }] =
    useCreateTrainingMutation();
  const [updateTraining, { isLoading: isUpdatingTraining }] =
    useUpdateTrainingMutation();

  const [createForum, { isLoading: isCreatingForum }] =
    useCreateForumMutation();
  const [updateForum, { isLoading: isUpdatingForum }] =
    useUpdateForumMutation();
  const [deleteForum, { isLoading: isDeletingForum }] =
    useDeleteForumMutation();

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showMemberPassword, setShowMemberPassword] = useState(false);

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [memberActionTarget, setMemberActionTarget] =
    useState<MemberUser | null>(null);
  const [memberDeleteMode, setMemberDeleteMode] = useState<
    "archive" | "restore" | "hard"
  >("archive");

  // Generic Form State
  const [formData, setFormData] = useState<any>({});
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [removedFileUrls, setRemovedFileUrls] = useState<string[]>([]);

  const handleImageUpload = async (file: File): Promise<string> => {
    if (!canAccessAdminPanel) throw new Error("Forbidden");
    try {
      const data = new FormData();
      data.append("file", file);
      const result = await uploadFile({ formData: data, authorization: { feature: activeTab === "trainings" ? "training" : activeTab === "technicopro" ? "technicopro" : activeTab === "events" ? "event" : activeTab === "forums" ? "forum" : "article", resourceId: editingItem?.id } }).unwrap();
      return result.url;
    } catch (error) {
      notifyError(error);
      throw error;
    }
  };

  const handleImageRemove = async (url: string) => {
    if (!canAccessAdminPanel) return;
    try {
      if (url.startsWith("blob:")) {
        URL.revokeObjectURL(url);
      } else {
        await deleteFile(url).unwrap();
      }
    } catch (error) {
      notifyError(error);
    }
  };

  const { currentData: articleCategoriesResponse } = useGetArticleCategoriesQuery({
    pageSize: 100,
  }, {skip: !canAccessAdminPanel || activeTab !== 'articles'});
  const articleCategories = articleCategoriesResponse?.results ?? [];
  const { currentData: technicoproCategoriesResponse } =
    useGetTechnicoProCategoriesQuery({ pageSize: 100 }, {skip: !canAccessAdminPanel || activeTab !== 'technicopro'});
  const technicoproCategories = technicoproCategoriesResponse?.results ?? [];
  const { currentData: trainingCategoriesResponse } = useGetTrainingCategoriesQuery({
    pageSize: 100,
  }, {skip: !canAccessAdminPanel || activeTab !== 'trainings'});
  const trainingCategories = trainingCategoriesResponse?.results ?? [];

  // Fetch specific entity data when in edit mode
  const {
    currentData: forumDetail,
    isLoading: isLoadingForum,
    isError: isErrorForum,
    refetch: refetchForum,
  } = useGetForumQuery(editingItem?.id || viewingId, {
    skip:
      (!isModalOpen && !isDetailsOpen) ||
      activeTab !== "forums" ||
      (!editingItem && !viewingId),
  });
  const {
    currentData: memberDetail,
    isLoading: isLoadingMember,
    isError: isErrorMember,
    refetch: refetchMember,
  } = useGetUserByIdQuery(editingItem?.id || viewingId, {
    skip:
      (!isModalOpen && !isDetailsOpen) ||
      activeTab !== "members" ||
      (!editingItem && !viewingId),
  });
  const {
    currentData: articleDetail,
    isFetching: isFetchingArticle,
    isLoading: isLoadingArticle,
    isError: isErrorArticle,
    refetch: refetchArticle,
  } = useGetArticleByIdQuery(editingItem?.id || viewingId, {
    skip:
      (!isModalOpen && !isDetailsOpen) ||
      activeTab !== "articles" ||
      (!editingItem && !viewingId),
  });
  const {
    currentData: technicoproDetail,
    isLoading: isLoadingTechnicoProDetail,
    isError: isErrorTechnicoPro,
    refetch: refetchTechnicoPro,
  } = useGetTechnicoProByIdQuery(editingItem?.id || viewingId, {
    skip:
      (!isModalOpen && !isDetailsOpen) ||
      activeTab !== "technicopro" ||
      (!editingItem && !viewingId),
  });
  const {
    currentData: eventDetail,
    isLoading: isLoadingEvent,
    isError: isErrorEvent,
    refetch: refetchEvent,
  } = useGetEventByIdQuery(editingItem?.id || viewingId, {
    skip:
      (!isModalOpen && !isDetailsOpen) ||
      activeTab !== "events" ||
      (!editingItem && !viewingId),
  });
  const {
    currentData: trainingDetail,
    isLoading: isLoadingTraining,
    isError: isErrorTraining,
    refetch: refetchTraining,
  } = useGetTrainingByIdQuery(editingItem?.id || viewingId, {
    skip:
      (!isModalOpen && !isDetailsOpen) ||
      activeTab !== "trainings" ||
      (!editingItem && !viewingId),
  });

  const viewingItem =
    activeTab === "forums"
      ? forumDetail
      : activeTab === "members"
        ? memberDetail
        : activeTab === "articles"
          ? articleDetail
          : activeTab === "technicopro"
            ? technicoproDetail
            : activeTab === "events"
              ? eventDetail
              : activeTab === "trainings"
                ? trainingDetail
                : null;
  const detailsItem = viewingItem as any;
  const editorDraft = React.useRef<DraftSnapshot<any> | null>(null);
  const [hasDraftConflict, setHasDraftConflict] = useState(false);
  const isCurrentDetailError = activeTab === 'members' ? isErrorMember
    : activeTab === 'forums' ? isErrorForum : activeTab === 'articles' ? isErrorArticle
    : activeTab === 'technicopro' ? isErrorTechnicoPro : activeTab === 'events' ? isErrorEvent : isErrorTraining;
  const isEditorDetailReady = viewingItem?.id === editingItem?.id && !isCurrentDetailError;

  const isDetailsLoading =
    isDetailsOpen && !isCurrentDetailError &&
    (!viewingItem || isLoadingForum ||
      isLoadingMember ||
      isLoadingArticle ||
      isLoadingTechnicoProDetail ||
      isLoadingEvent ||
      isLoadingTraining);
  const isDetailsError =
    isDetailsOpen &&
    (isErrorForum ||
      isErrorMember ||
      isErrorArticle ||
      isErrorTechnicoPro ||
      isErrorEvent ||
      isErrorTraining);

  const handleRetryDetails = () => {
    if (activeTab === "forums") refetchForum();
    else if (activeTab === "members") refetchMember();
    else if (activeTab === "articles") refetchArticle();
    else if (activeTab === "technicopro") refetchTechnicoPro();
    else if (activeTab === "events") refetchEvent();
    else if (activeTab === "trainings") refetchTraining();
  };

  const { currentData: smtpSettings, isLoading: isLoadingSmtpSettings } =
    useGetAdminSmtpSettingsQuery(undefined, {skip: !canAccessAdminPanel || activeTab !== 'settingsBackups'});
  const {
    currentData: systemLogs,
    isLoading: isLoadingSystemLogs,
    isFetching: isFetchingSystemLogs,
  } = useGetAdminSystemLogsQuery({
    limit: systemLogsLimit,
    search: systemLogSearchTerm.trim() || undefined,
  }, {skip: !canAccessAdminPanel || activeTab !== 'settingsBackups'});
  const { currentData: backupsData, isLoading: isLoadingBackups } =
    useGetAdminBackupsQuery(undefined, {skip: !canAccessAdminPanel || activeTab !== 'settingsBackups'});
  const [updateAdminSmtpSettings, { isLoading: isSavingSmtpSettings }] =
    useUpdateAdminSmtpSettingsMutation();
  const [testAdminSmtpSettings, { isLoading: isTestingSmtpSettings }] =
    useTestAdminSmtpSettingsMutation();
  const [downloadAdminSystemLogs, { isLoading: isDownloadingSystemLogs }] =
    useDownloadAdminSystemLogsMutation();
  const [clearAdminSystemLogs, { isLoading: isClearingSystemLogs }] =
    useClearAdminSystemLogsMutation();
  const [
    updateAdminBackupConfiguration,
    { isLoading: isSavingBackupConfiguration },
  ] = useUpdateAdminBackupConfigurationMutation();
  const [runAdminBackup, { isLoading: isRunningBackup }] =
    useRunAdminBackupMutation();

  const [deleteAdminBackup, { isLoading: isDeletingBackup }] =
    useDeleteAdminBackupMutation();
  const [downloadAdminBackup, { isLoading: isDownloadingBackup }] =
    useDownloadAdminBackupMutation();

  React.useEffect(() => {
    if (!smtpSettings) {
      return;
    }

    setSmtpForm({
      host: smtpSettings.host || "",
      port: smtpSettings.port || 587,
      username: smtpSettings.username || "",
      password: "",
      from_email: smtpSettings.from_email || "",
      from_name: smtpSettings.from_name || "",
      use_tls: smtpSettings.use_tls,
      use_ssl: smtpSettings.use_ssl,
    });
  }, [smtpSettings]);

  React.useEffect(() => {
    if (!backupsData?.configuration) {
      return;
    }

    setBackupConfigForm({
      enabled: backupsData.configuration.enabled,
      frequency: backupsData.configuration.frequency || "daily",
      execution_time: backupsData.configuration.execution_time || "09:00",
      retention_days: backupsData.configuration.retention_days || 30,
      max_backups: backupsData.configuration.max_backups || 30,
      backup_dir: backupsData.configuration.backup_dir || "Backups",
    });
  }, [backupsData]);

  React.useEffect(() => {
    setSystemLogsLimit(8);
  }, [systemLogSearchTerm]);

  const totalMemberPages = usersData?.total_pages
    ? Math.max(1, usersData.total_pages)
    : Math.max(
        1,
        Math.ceil(
          (usersData?.total || 0) / (usersData?.page_size || MEMBERS_PAGE_SIZE),
        ),
      );
  const totalArticlePages = articlesData?.total_pages
    ? Math.max(1, articlesData.total_pages)
    : Math.max(
        1,
        Math.ceil(
          (articlesData?.total || 0) /
            (articlesData?.page_size || ARTICLES_PAGE_SIZE),
        ),
      );
  const totalTechnicoProPages = technicoproData?.total_pages
    ? Math.max(1, technicoproData.total_pages)
    : Math.max(
        1,
        Math.ceil(
          (technicoproData?.total || 0) /
            (technicoproData?.page_size || TECHNICOPRO_PAGE_SIZE),
        ),
      );
  const totalModerationQueuePages = moderationQueueData?.total_pages
    ? Math.max(1, moderationQueueData.total_pages)
    : Math.max(
        1,
        Math.ceil(
          (moderationQueueData?.total || 0) /
            (moderationQueueData?.page_size || MODERATION_QUEUE_PAGE_SIZE),
        ),
      );
  const totalModerationLogsPages = moderationLogsData?.total_pages
    ? Math.max(1, moderationLogsData.total_pages)
    : Math.max(
        1,
        Math.ceil(
          (moderationLogsData?.total || 0) /
            (moderationLogsData?.page_size || MODERATION_LOGS_PAGE_SIZE),
        ),
      );
  const systemLogLines = systemLogs?.lines ?? [];
  const isInitialSystemLogsLoading =
    isLoadingSystemLogs && systemLogLines.length === 0;
  const isLoadingMoreSystemLogs =
    isFetchingSystemLogs && systemLogLines.length > 0;
  const canLoadMoreSystemLogs =
    systemLogLines.length > 0 &&
    (systemLogLines.length >= systemLogsLimit || isLoadingMoreSystemLogs);
  const activeTableColumnCount =
    activeTab === "members"
      ? 4
      : activeTab === "forums"
        ? 6
        : activeTab === "articles"
          ? 5
          : activeTab === "technicopro"
            ? 5
            : activeTab === "events"
              ? 5
              : activeTab === "trainings"
                ? 5
                : 5;
  const showTableSkeleton =
    (activeTab === "members" && (isLoadingUsers || (isFetchingUsers && !usersData))) ||
    (activeTab === "articles" && (isLoadingArticles || (isFetchingArticles && !articlesData))) ||
    (activeTab === "technicopro" && (isLoadingTechnicoPro || (isFetchingTechnicoPro && !technicoproData))) ||
    (activeTab === "moderation" &&
      ((modSubTab === "queue" && (isLoadingModeration || (isFetchingModerationQueue && !moderationQueueData))) ||
        (modSubTab === "logs" && (isLoadingModerationLogs || (isFetchingModerationLogs && !moderationLogsData)))));

  React.useEffect(() => {
    setMemberPage(1);
  }, [searchTerm, memberStatusFilter, memberRoleFilter]);

  React.useEffect(() => {
    setArticlePage(1);
  }, [searchTerm]);

  React.useEffect(() => {
    setTechnicoproPage(1);
  }, [searchTerm]);

  React.useEffect(() => {
    setModerationQueuePage(1);
    setModerationLogsPage(1);
  }, [modSubTab]);

  // Sync detail data to formData when it arrives
  React.useEffect(() => {
    const sync = (incoming: any) => {
      const next = reconcileDraft(editorDraft.current, `${activeTab}:${editingItem.id}`, incoming, formData, selectedFiles.length > 0 || removedFileUrls.length > 0);
      editorDraft.current = next.snapshot;
      setHasDraftConflict(next.conflict);
      if (next.value !== formData) setFormData(next.value);
    };
    if (isModalOpen && editingItem && isEditorDetailReady) {
      if (activeTab === "forums" && forumDetail?.id === editingItem.id) sync(forumDetail);
      if (activeTab === "members" && memberDetail) {
        sync({
          ...memberDetail,
          role_id: memberDetail.role_id ?? memberDetail.role_details?.id ?? "",
          is_superuser: memberDetail.is_superuser,
        });
      }
      if (activeTab === "articles" && articleDetail) {
        const normalized = { ...articleDetail };
        if (articleDetail.category?.id) {
          normalized.category_id = articleDetail.category.id;
        }
        if (!normalized.structured_fields) {
          normalized.structured_fields = { file_urls: [] };
        }
        sync(normalized);
      }
      if (activeTab === "technicopro" && technicoproDetail) {
        const normalized = { ...technicoproDetail };
        if (technicoproDetail.category?.id) {
          normalized.category_id = technicoproDetail.category.id;
        }
        if (!normalized.structured_fields) {
          normalized.structured_fields = { file_urls: [] };
        }
        sync(normalized);
      }
      if (activeTab === "events" && eventDetail) {
        sync({
          ...eventDetail,
          event_category_id:
            eventDetail.event_category?.id ||
            eventDetail.event_category_id ||
            eventCategories[0]?.id ||
            "",
          attachments: eventDetail.attachments || [],
        });
      }
      if (activeTab === "trainings" && trainingDetail) {
        sync({
          ...trainingDetail,
          category_id:
            trainingDetail.category?.id ||
            trainingDetail.category_id ||
            trainingCategories[0]?.id ||
            "",
          attachments: trainingDetail.attachments || [],
        });
      }
    }
  }, [
    forumDetail,
    memberDetail,
    articleDetail,
    technicoproDetail,
    eventDetail,
    trainingDetail,
    isModalOpen,
    editingItem,
    activeTab,
    eventCategories,
    trainingCategories,
  ]);

  // Generic Form State
  // (Moved up)

  const notifySuccess = () => {
    toast.success(translate("adminPanelPage.operationSuccessful"));
  };

  const notifyError = (error: unknown) => {
    toast.error(
      getApiErrorDisplayMessage(error, translate, "apiErrors.default"),
    );
  };

  const notifyRequiredField = (fieldLabel: string) => {
    toast.error(
      translate("common.requiredField", {
        field: fieldLabel,
      }),
    );
  };

  const hasRichTextValue = (value: string | null | undefined) =>
    Boolean(
      (value || "")
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    );

  const getPlainTextPreview = (value: string | null | undefined) =>
    (value || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  React.useEffect(() => {
    if (!userRolesData.length) {
      setSelectedRoleId(null);
      return;
    }

    if (
      !selectedRoleId ||
      !userRolesData.some((role) => role.id === selectedRoleId)
    ) {
      setSelectedRoleId(userRolesData[0].id);
    }
  }, [selectedRoleId, userRolesData]);

  const handleOpenModal = (item?: any) => {
    if (!canAccessAdminPanel) return;
    const canCreateForTab =
      activeTab === "members"
        ? canCreateMembers
        : activeTab === "forums"
          ? canCreateForums
        : activeTab === "articles"
          ? canCreateArticles
          : activeTab === "technicopro"
            ? canCreateTechnicoPro
            : activeTab === "events"
              ? canCreateEvents
              : activeTab === "trainings"
                ? canCreateTrainings
                : false;
    const canEditForTab =
      activeTab === "members"
        ? canEditMembers
        : activeTab === "forums"
          ? canEditForums
        : activeTab === "articles"
          ? canModify(item, "edit")
          : activeTab === "technicopro"
            ? canEditTechnicoPro
            : activeTab === "events"
              ? canEditEvents
              : activeTab === "trainings"
                ? canEditTrainings
                : false;

    if ((item && !canEditForTab) || (!item && !canCreateForTab)) {
      return;
    }

    editorDraft.current = null;
    setHasDraftConflict(false);

    setSelectedFiles([]);
    setRemovedFileUrls([]);
    setViewingId(null);
    if (item) {
      setEditingItem(item);
      setFormData(item);
    } else {
      setEditingItem(null);
      // Default initial states based on tab
      const defaults: Record<AdminTab, any> = {
        members: {
          first_name: "",
          last_name: "",
          email: "",
          password: "",
          phone: "",
          mobile: "",
          society: "",
          city: "",
          department: "",
          address: "",
          role_id:
            userRolesData.find((role) => role.slug === ROLE_SLUGS.MEMBER)?.id ||
            "",
          status: "pending",
          is_payment_validated: false,
          is_superuser: false,
          avatar: null,
        },
        forums: {
          name: "",
          author_name: "",
          description: "",
          thumbnail: null,
          thumbnail_url: null,
        },
        articles: {
          title: "",
          category_id: "",
          excerpt: "",
          body: "",
          status: "draft",
          structured_fields: {
            file_urls: [],
          },
          thumbnail: null,
        },
        technicopro: {
          title: "",
          category_id: technicoproCategories[0]?.id || "",
          excerpt: "",
          body: "",
          status: "draft",
          structured_fields: {
            file_urls: [],
          },
          thumbnail: null,
        },
        events: {
          title: "",
          event_category_id: eventCategories[0]?.id || "",
          event_date: new Date().toISOString().split("T")[0],
          end_date: new Date().toISOString().split("T")[0],
          event_time: "14:00",
          location: "Zoom",
          description: "",
          max_attendees: 50,
          is_public: false,
          attachments: [],
        },
        trainings: {
          title: "",
          excerpt: "",
          description: "",
          category_id: trainingCategories[0]?.id || "",
          status: "draft",
          attachments: [],
          thumbnail: null,
        },
        moderation: {},
        rolesPermissions: {},
        settingsBackups: {},
      };
      setFormData(defaults[activeTab]);
    }
    setShowMemberPassword(false);
    setIsModalOpen(true);
  };

  const handleOpenDetails = (item: any) => {
    setViewingId(item.id);
    setEditingItem(null);
    setIsDetailsOpen(true);
  };

  const handleViewItem = (item: any) => {
    if (activeTab === "forums") {
      navigate(`/forums/${item.id}`);
      return;
    }

    if (activeTab === "articles") {
      navigate(`/articles/${item.id}`);
      return;
    }

    if (activeTab === "technicopro") {
      navigate(`/technicopro/${item.id}`);
      return;
    }

    if (activeTab === "events") {
      navigate(`/agenda/${item.id}`);
      return;
    }

    if (activeTab === "trainings") {
      navigate(`/trainings/${item.id}`);
      return;
    }

    handleOpenDetails(item);
  };

  const confirmDelete = (
    id: string,
    member?: MemberUser,
    mode: "archive" | "restore" | "hard" = "archive",
  ) => {
    const canDeleteForTab =
      activeTab === "members"
        ? canDeleteMembers
        : activeTab === "forums"
          ? canDeleteForums
        : activeTab === "articles"
          ? canModify(articlesData?.results.find((article) => article.id === id), "delete")
          : activeTab === "technicopro"
            ? canDeleteTechnicoPro
            : activeTab === "events"
              ? canDeleteEvents
              : activeTab === "trainings"
                ? canDeleteTrainings
                : false;

    if (!canDeleteForTab) {
      return;
    }

    setDeletingId(id);
    setMemberActionTarget(activeTab === "members" ? member || null : null);
    setMemberDeleteMode(activeTab === "members" ? mode : "hard");
    setIsConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!canAccessAdminPanel) return;
    if (!deletingId) return;
    if (activeTab === "articles" && !canModify(articlesData?.results.find((article) => article.id === deletingId), "delete")) return;

    try {
      if (activeTab === "forums") {
        await deleteForum(deletingId).unwrap();
      } else if (activeTab === "members") {
        if (memberDeleteMode === "restore") {
          await restoreUser(deletingId).unwrap();
        } else if (memberDeleteMode === "hard") {
          await deleteUser(deletingId).unwrap();
        } else {
          await softDeleteUser(deletingId).unwrap();
        }
      } else if (activeTab === "articles") {
        await deleteArticle(deletingId).unwrap();
      } else if (activeTab === "technicopro") {
        await deleteTechnicoPro(deletingId).unwrap();
      } else if (activeTab === "events") {
        await deleteEvent(deletingId).unwrap();
      } else if (activeTab === "trainings") {
        await deleteTraining(deletingId).unwrap();
      }

      setDeletingId(null);
      setMemberActionTarget(null);
      setMemberDeleteMode("archive");
      setIsConfirmOpen(false);
      notifySuccess();
    } catch (err) {
      notifyError(err);
    }
  };

  const handlePublishArticle = async (id: string) => {
    if (!canAccessAdminPanel) return;
    try {
      await publishArticle(id).unwrap();
      notifySuccess();
    } catch (err) {
      notifyError(err);
    }
  };

  const handlePublishTechnicoPro = async (id: string) => {
    if (!canAccessAdminPanel) return;
    try {
      await publishTechnicoPro(id).unwrap();
      notifySuccess();
    } catch (err) {
      notifyError(err);
    }
  };

  const handleExportUsers = async () => {
    if (!canAccessAdminPanel) return;
    try {
      const response = await exportUsersCsv().unwrap();
      downloadFile(response.file, response.filename);
      notifySuccess();
    } catch (err) {
      notifyError(err);
    }
  };

  const handleSaveSmtpSettings = async (e: React.FormEvent) => {
    if (!canAccessAdminPanel) return;
    e.preventDefault();

    try {
      await updateAdminSmtpSettings({
        ...smtpForm,
        port: Number(smtpForm.port),
      }).unwrap();
      notifySuccess();
    } catch (err) {
      notifyError(err);
    }
  };

  const handleSendSmtpTest = async (e: React.FormEvent) => {
    if (!canAccessAdminPanel) return;
    e.preventDefault();

    try {
      await testAdminSmtpSettings({
        email: smtpTestEmail.trim(),
      }).unwrap();
      notifySuccess();
    } catch (err) {
      notifyError(err);
    }
  };

  const handleDownloadSystemLogs = async () => {
    if (!canAccessAdminPanel) return;
    try {
      const response = await downloadAdminSystemLogs().unwrap();
      downloadFile(response.file, response.filename);
      notifySuccess();
    } catch (err) {
      notifyError(err);
    }
  };

  const handleClearSystemLogs = async () => {
    if (!canAccessAdminPanel) return;
    try {
      await clearAdminSystemLogs().unwrap();
      notifySuccess();
    } catch (err) {
      notifyError(err);
    }
  };

  const handleSaveBackupConfiguration = async (e: React.FormEvent) => {
    if (!canAccessAdminPanel) return;
    e.preventDefault();

    try {
      await updateAdminBackupConfiguration({
        ...backupConfigForm,
        retention_days: Number(backupConfigForm.retention_days),
        max_backups: Number(backupConfigForm.max_backups),
      }).unwrap();
      notifySuccess();
    } catch (err) {
      notifyError(err);
    }
  };

  const handleRunBackup = async () => {
    if (!canAccessAdminPanel) return;
    try {
      await runAdminBackup().unwrap();
      notifySuccess();
    } catch (err) {
      notifyError(err);
    }
  };

  const handleDownloadBackup = async (backupId: string) => {
    if (!canAccessAdminPanel) return;
    try {
      const response = await downloadAdminBackup(backupId).unwrap();
      downloadFile(response.file, response.filename);
      notifySuccess();
    } catch (err) {
      notifyError(err);
    }
  };

  const handleDeleteBackup = async () => {
    if (!canAccessAdminPanel) return;
    if (!backupToDelete) {
      return;
    }

    try {
      await deleteAdminBackup(backupToDelete.id).unwrap();
      setBackupToDelete(null);
      notifySuccess();
    } catch (err) {
      notifyError(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    if (!canAccessAdminPanel) return;
    e.preventDefault();
    const id = editingItem ? editingItem.id : null;
    if (editingItem && !isEditorDetailReady) return;
    if (activeTab === "articles" && (editingItem
      ? isFetchingArticle || isErrorArticle || articleDetail?.id !== id || !canModify(articleDetail, "edit")
      : !canCreateArticles)) return;

    if (activeTab === "members") {
      if (!formData.first_name?.trim()) {
        notifyRequiredField(translate("adminPanelPage.form.firstName"));
        return;
      }

      if (!formData.last_name?.trim()) {
        notifyRequiredField(translate("adminPanelPage.form.lastName"));
        return;
      }

      if (!formData.email?.trim()) {
        notifyRequiredField(translate("adminPanelPage.form.email"));
        return;
      }

      if (!editingItem && !formData.password?.trim()) {
        notifyRequiredField(translate("adminPanelPage.form.password"));
        return;
      }

      if (!formData.role_id) {
        notifyRequiredField(translate("adminPanelPage.form.role"));
        return;
      }
    } else if (activeTab === "forums") {
      if (!formData.name?.trim()) {
        notifyRequiredField(translate("adminPanelPage.form.forumName"));
        return;
      }
    } else if (activeTab === "articles") {
      if (!formData.title?.trim()) {
        notifyRequiredField(translate("adminPanelPage.form.articleTitle"));
        return;
      }

      if (!formData.category_id) {
        notifyRequiredField(translate("adminPanelPage.form.category"));
        return;
      }

      if (!hasRichTextValue(formData.body)) {
        notifyRequiredField(translate("adminPanelPage.form.contentRichText"));
        return;
      }

      if (!(formData.thumbnail || formData.thumbnail_url)) {
        notifyRequiredField(translate("articlesPage.thumbnailLabel"));
        return;
      }
    } else if (activeTab === "technicopro") {
      if (!formData.title?.trim()) {
        notifyRequiredField(translate("adminPanelPage.form.articleTitle"));
        return;
      }

      if (!formData.category_id) {
        notifyRequiredField(translate("adminPanelPage.form.category"));
        return;
      }

      if (!hasRichTextValue(formData.body)) {
        notifyRequiredField(translate("adminPanelPage.form.contentRichText"));
        return;
      }

      if (!(formData.thumbnail || formData.thumbnail_url)) {
        notifyRequiredField(translate("articlesPage.thumbnailLabel"));
        return;
      }
    } else if (activeTab === "events") {
      if (!formData.title?.trim()) {
        notifyRequiredField(translate("adminPanelPage.form.eventTitle"));
        return;
      }

      if (!formData.event_date) {
        notifyRequiredField(translate("adminPanelPage.form.startDate"));
        return;
      }

      if (!formData.end_date) {
        notifyRequiredField(translate("adminPanelPage.form.endDate"));
        return;
      }

      if (!formData.event_time) {
        notifyRequiredField(translate("adminPanelPage.form.eventTime"));
        return;
      }

      if (!formData.event_category_id) {
        notifyRequiredField(translate("adminPanelPage.form.eventType"));
        return;
      }

      if (!formData.location?.trim()) {
        notifyRequiredField(translate("adminPanelPage.form.location"));
        return;
      }
    } else if (activeTab === "trainings") {
      if (!formData.title?.trim()) {
        notifyRequiredField(translate("adminPanelPage.form.trainingTitle"));
        return;
      }

      if (!formData.category_id) {
        notifyRequiredField(translate("adminPanelPage.form.category"));
        return;
      }

      if (!hasRichTextValue(formData.description)) {
        notifyRequiredField(translate("adminPanelPage.form.contentRichText"));
        return;
      }

      if (!(formData.thumbnail || formData.thumbnail_url)) {
        notifyRequiredField(translate("trainingsPage.thumbnailLabel"));
        return;
      }
    }

    if (activeTab === "trainings" && !trainingCategories.length) {
      notifyRequiredField(translate("adminPanelPage.form.category"));
      return;
    }

    try {
      if (activeTab === "members") {
        if (editingItem && id) {
          // Diffing logic for members
          const changedData: UpdateUserRequest = {};
          Object.keys(formData).forEach((key) => {
            if (
              [
                "id",
                "created_at",
                "updated_at",
                "password",
                "permissions",
                "role",
                "role_details",
                "membership_category",
                "membership_year",
                "is_email_verified",
                "is_online",
                "last_seen_at",
                "member_since",
                "last_login_at",
                "is_deleted",
                "initials",
              ].includes(key)
            )
              return;
            if (formData[key] !== editingItem[key]) {
              (changedData as any)[key] = formData[key];
            }
          });

          if (
            formData.is_payment_validated !== editingItem.is_payment_validated
          ) {
            changedData.is_payment_validated = formData.is_payment_validated;
          }

          if (formData.is_superuser !== editingItem.is_superuser) {
            changedData.is_superuser = formData.is_superuser;
          }

          if (Object.keys(changedData).length > 0) {
            await updateUser({ id, body: changedData }).unwrap();
          }
        } else {
          const createPayload: CreateUserRequest = {
            email: formData.email,
            password: formData.password,
            first_name: formData.first_name,
            last_name: formData.last_name,
            phone: formData.phone,
            mobile: formData.mobile,
            role_id: formData.role_id,
            society: formData.society,
            city: formData.city,
            department: formData.department,
            address: formData.address,
            status: formData.status,
            payment_validated: formData.is_payment_validated,
            is_superuser: formData.is_superuser,
            avatar: formData.avatar,
          };

          await createUser(createPayload).unwrap();
        }
      } else if (activeTab === "forums") {
        if (editingItem) {
          const changedData: any = {};
          const forumFields = [
            "name",
            "author_name",
            "description",
          ];
          forumFields.forEach((key) => {
            if (formData[key] !== editingItem[key]) {
              changedData[key] = formData[key];
            }
          });

          if (formData.thumbnail instanceof File) {
            changedData.thumbnail = formData.thumbnail;
          }

          if (Object.keys(changedData).length > 0) {
            await updateForum({
              forum_id: id,
              ...changedData,
            }).unwrap();
          }
        } else {
          await createForum(buildAdminForumCreatePayload({
            name: formData.name,
            author_name: formData.author_name,
            description: formData.description,
            thumbnail:
              formData.thumbnail instanceof File
                ? formData.thumbnail
                : undefined,
          })).unwrap();
        }
      } else if (activeTab === "articles") {
        const articlePayload: Partial<CreateArticleRequest> = {};
        const articleFields = [
          "title",
          "category_id",
          "body",
          "excerpt",
          "status",
        ];

        articleFields.forEach((key) => {
          if (formData[key] !== undefined && formData[key] !== null) {
            // Only append if it's a new entry OR the field has changed
            if (!editingItem || formData[key] !== editingItem[key]) {
              articlePayload[key as keyof CreateArticleRequest] = formData[key];
            }
          }
        });

        if (selectedFiles.length > 0) {
          articlePayload.files = selectedFiles;
        }

        if (editingItem && id) {
          // For articles, we need to update the file_urls inside structured_fields
          const currentFileUrls = formData.structured_fields?.file_urls || [];
          const updatedFileUrls = currentFileUrls.filter(
            (url: string) => !removedFileUrls.includes(url),
          );

          const newStructuredFields = {
            ...(formData.structured_fields || {}),
            file_urls: updatedFileUrls,
          };

          articlePayload.structured_fields = newStructuredFields;

          // Also keep the explicit removal field for backend compatibility
          if (removedFileUrls.length > 0) {
            articlePayload.remove_file_urls = removedFileUrls.join(",");
          }

          if (formData.thumbnail instanceof File) {
            articlePayload.thumbnail = formData.thumbnail;
          }

          await updateArticle({ id, data: articlePayload }).unwrap();
        } else {
          if (formData.structured_fields) {
            articlePayload.structured_fields = formData.structured_fields;
          }

          if (formData.thumbnail instanceof File) {
            articlePayload.thumbnail = formData.thumbnail;
          }

          await createArticle(articlePayload as CreateArticleRequest).unwrap();
        }
      } else if (activeTab === "technicopro") {
        const technicoProPayload: Partial<TechnicoProRequest> = {};
        const technicoProFields = [
          "title",
          "category_id",
          "body",
          "excerpt",
          "status",
        ];

        technicoProFields.forEach((key) => {
          if (formData[key] !== undefined && formData[key] !== null) {
            if (!editingItem || formData[key] !== editingItem[key]) {
              technicoProPayload[key as keyof TechnicoProRequest] =
                formData[key];
            }
          }
        });

        if (selectedFiles.length > 0) {
          technicoProPayload.files = selectedFiles;
        }

        if (editingItem && id) {
          const currentFileUrls = formData.structured_fields?.file_urls || [];
          const updatedFileUrls = currentFileUrls.filter(
            (url: string) => !removedFileUrls.includes(url),
          );

          technicoProPayload.structured_fields = {
            ...(formData.structured_fields || {}),
            file_urls: updatedFileUrls,
          };

          if (removedFileUrls.length > 0) {
            technicoProPayload.remove_file_urls = removedFileUrls.join(",");
          }

          if (formData.thumbnail instanceof File) {
            technicoProPayload.thumbnail = formData.thumbnail;
          }

          await updateTechnicoPro({ id, data: technicoProPayload }).unwrap();
        } else {
          if (formData.structured_fields) {
            technicoProPayload.structured_fields = formData.structured_fields;
          }

          if (formData.thumbnail instanceof File) {
            technicoProPayload.thumbnail = formData.thumbnail;
          }

          await createTechnicoPro(
            technicoProPayload as TechnicoProRequest,
          ).unwrap();
        }
      } else if (activeTab === "events") {
        if (editingItem && id) {
          await updateEvent({
            id,
            data: {
              title: formData.title,
              event_category_id: formData.event_category_id,
              event_date: formData.event_date,
              end_date: formData.end_date,
              event_time: formData.event_time,
              location: formData.location,
              description: formData.description,
              max_attendees: formData.max_attendees,
              is_public: formData.is_public,
              new_attachments: selectedFiles,
              remove_attachment_urls: removedFileUrls,
            },
          }).unwrap();
        } else {
          await createEvent({
            title: formData.title,
            event_category_id: formData.event_category_id,
            event_date: formData.event_date,
            end_date: formData.end_date,
            event_time: formData.event_time,
            location: formData.location,
            description: formData.description,
            max_attendees: formData.max_attendees,
            is_public: formData.is_public,
            attachments: selectedFiles,
          }).unwrap();
        }
      } else if (activeTab === "trainings") {
        const requestBody: Partial<TrainingRequest> = {
          title: formData.title,
          excerpt: formData.excerpt,
          description: formData.description,
          category_id: formData.category_id,
          status: formData.status,
          remove_attachment_urls: removedFileUrls,
          thumbnail:
            formData.thumbnail instanceof File ? formData.thumbnail : undefined,
          // Use 'attachments' for creation, 'new_attachments' for updates
          attachments: editingItem ? undefined : selectedFiles,
          new_attachments: editingItem ? selectedFiles : undefined,
        };

        const trainingFormData = buildTrainingFormData(requestBody);

        if (editingItem && id) {
          await updateTraining({ id, formData: trainingFormData }).unwrap();
        } else {
          await createTraining(trainingFormData).unwrap();
        }
      }

      setIsModalOpen(false);
      setShowMemberPassword(false);
      setFormData({});
      setSelectedFiles([]);
      setRemovedFileUrls([]);
      notifySuccess();
    } catch (err) {
      notifyError(err);
    }
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    if (!canAccessAdminPanel) return;
    e.preventDefault();

    if (!newRoleData.name.trim()) {
      notifyRequiredField(translate("adminPanelPage.rolePermissions.roleName"));
      return;
    }

    try {
      const payload = {
        name: newRoleData.name.trim(),
        description: newRoleData.description.trim() || null,
      };

      const savedRole = editingRole
        ? await updateUserRole({
            id: editingRole.id,
            ...payload,
          }).unwrap()
        : await createUserRole(payload).unwrap();

      setSelectedRoleId(savedRole.id);
      setEditingRole(null);
      setNewRoleData({ name: "", description: "" });
      setIsRoleModalOpen(false);
      notifySuccess();
    } catch (err) {
      notifyError(err);
    }
  };

  const handleEditRole = (role: UserRoleDetails) => {
    if (!canAccessAdminPanel) return;
    setEditingRole(role);
    setNewRoleData({
      name: role.name,
      description: role.description || "",
    });
    setIsRoleModalOpen(true);
  };

  const confirmDeleteRole = (role: UserRoleDetails) => {
    setRoleToDelete(role);
    setIsRoleDeleteConfirmOpen(true);
  };

  const handleDeleteRole = async () => {
    if (!canAccessAdminPanel) return;
    if (!roleToDelete) {
      return;
    }

    try {
      await deleteUserRole({ id: roleToDelete.id }).unwrap();

      if (selectedRoleId === roleToDelete.id) {
        setSelectedRoleId(null);
      }

      setRoleToDelete(null);
      setIsRoleDeleteConfirmOpen(false);
      setEditingRole((current) =>
        current?.id === roleToDelete.id ? null : current,
      );
      notifySuccess();
    } catch (err) {
      notifyError(err);
    }
  };

  const tabs: { id: AdminTab; icon: React.ComponentType<{ className?: string }>; label: string; count: AdminCount }[] = [
    canViewMembers
      ? {
          id: "members",
          icon: Users,
          label: getTabLabel("members"),
          count: readAdminCount(usersCountQuery),
        }
      : null,
    canViewForums
      ? {
          id: "forums",
          icon: Database,
          label: getTabLabel("forums"),
          count: readAdminCount(forumsCountQuery),
        }
      : null,
    canViewArticles
      ? {
          id: "articles",
          icon: FileText,
          label: getTabLabel("articles"),
          count: readAdminCount(articlesCountQuery),
        }
      : null,
    canViewTechnicoPro
      ? {
          id: "technicopro",
          icon: Wrench,
          label: getTabLabel("technicopro"),
          count: readAdminCount(technicoproCountQuery),
        }
      : null,
    canViewEvents
      ? {
          id: "events",
          icon: CalendarIcon,
          label: getTabLabel("events"),
          count: readAdminCount(eventsCountQuery, false, 'events_this_year'),
        }
      : null,
    canViewTrainings
      ? {
          id: "trainings",
          icon: BookOpen,
          label: getTabLabel("trainings"),
          count: readAdminCount(trainingsCountQuery),
        }
      : null,
    canManageRolesPermissions
      ? {
          id: "rolesPermissions",
          icon: Shield,
          label: getTabLabel("rolesPermissions"),
          count: readAdminCount(rolesCountQuery, true),
        }
      : null,
    canManageRolesPermissions
      ? {
          id: "settingsBackups",
          icon: Globe,
          label: getTabLabel("settingsBackups"),
          count: { status: "unavailable" },
        }
      : null,
  ].filter(Boolean) as {
    id: AdminTab;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    count: AdminCount;
  }[];

  React.useEffect(() => {
    if (!tabs.length) {
      return;
    }

    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(tabs[0].id);
    }
  }, [activeTab, tabs]);

  if (!canAccessAdminPanel) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="admin-page">
      <div className="admin-content">
      <header className="admin-page-header">
        <div>
          <h2 className="admin-page-title text-3xl font-bold tracking-tight text-slate-900 underline decoration-primary decoration-4 underline-offset-8 uppercase">
            {translate("adminPanelPage.title")}
          </h2>
        </div>
        <div className="admin-header-actions">
          {activeTab === "members" && canViewMembers && (
            <button
              onClick={handleExportUsers}
              disabled={isExportingUsers}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-900 shadow-sm transition-all active:scale-95 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer sm:w-auto"
            >
              <Download className="w-4 h-4 text-primary" />
              {isExportingUsers
                ? translate("adminPanelPage.submitting")
                : translate("adminPanelPage.exportCsv")}
            </button>
          )}
          {activeTab === "rolesPermissions" && canManageRolesPermissions && (
            <button
              onClick={() => setIsRoleModalOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-900 shadow-sm transition-all active:scale-95 hover:bg-slate-50 cursor-pointer sm:w-auto"
            >
              <Shield className="w-4 h-4 text-primary" />
              {translate("adminPanelPage.rolePermissions.createRole")}
            </button>
          )}
          {/* Create Entry button */}
          {activeTab !== "moderation" &&
            activeTab !== "rolesPermissions" &&
            ((activeTab === "members" && canCreateMembers) ||
              (activeTab === "forums" && canCreateForums) ||
              (activeTab === "articles" && canCreateArticles) ||
              (activeTab === "technicopro" && canCreateTechnicoPro) ||
              (activeTab === "events" && canCreateEvents) ||
              (activeTab === "trainings" && canCreateTrainings)) && (
              <button
                onClick={() => handleOpenModal()}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-white shadow-lg transition-all active:scale-95 hover:bg-slate-800 sm:w-auto"
              >
                <Plus className="w-4 h-4 text-primary" />
                {translate("adminPanelPage.createEntry", {
                  entity: getTabLabel(activeTab),
                })}
              </button>
            )}
        </div>
      </header>

      {/* Stats Quick Cards */}
      <div className="admin-stats-grid">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            aria-pressed={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`p-6 rounded-2xl border transition-all flex flex-col items-center gap-3 text-center cursor-pointer ${
              activeTab === tab.id
                ? "bg-slate-900 text-white border-slate-900 shadow-xl"
                : "bg-white text-slate-400 border-slate-200 hover:border-primary/50 grayscale hover:grayscale-0"
            }`}
          >
            <tab.icon
              className={`w-6 h-6 ${activeTab === tab.id ? "text-primary" : ""}`}
            />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1">
                {getTabLabel(tab.id)}
              </p>
              <p
                className={`text-xl font-black ${activeTab === tab.id ? "text-white" : "text-slate-900"}`}
              >
                <span title={[tab.id === "events" ? translate("adminPanelPage.counts.eventsThisYear") : null, tab.count.status === "ready" ? null : translate(`adminPanelPage.counts.${tab.count.status}`)].filter(Boolean).join(" ") || undefined} aria-describedby={tab.id === "events" ? `${adminFieldId}-events-count-period` : undefined} aria-label={tab.count.status === "ready" ? undefined : translate(`adminPanelPage.counts.${tab.count.status}`)}>
                  {tab.count.value ?? (tab.count.status === "loading" ? "…" : "—")}
                </span>
                {tab.id === "events" && <span id={`${adminFieldId}-events-count-period`} className="sr-only">{translate("adminPanelPage.counts.eventsThisYear")}</span>}
              </p>
            </div>
          </button>
        ))}
      </div>

      {[usersCountQuery, forumsCountQuery, articlesCountQuery, technicoproCountQuery, trainingsCountQuery, rolesCountQuery, eventsCountQuery].some(query => query.isError) && <div role="alert" className="mb-4 flex items-center gap-3 text-sm text-slate-600">
        <span>{translate("adminPanelPage.counts.error")}</span>
        <button type="button" className="rounded-xl border px-3 py-2" onClick={() => {
          [usersCountQuery, forumsCountQuery, articlesCountQuery, technicoproCountQuery, trainingsCountQuery, rolesCountQuery, eventsCountQuery].forEach(query => { if (query.isError && !query.isFetching) void query.refetch(); });
        }}>{translate("adminPanelPage.retryFetch")}</button>
      </div>}

      {/* Main Admin Section */}
      <div className="admin-main-panel w-full max-w-full min-w-0 bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden text-slate-900">
        <div className="admin-section-header border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 text-primary-dark rounded-2xl">
              {tabs.find((t) => t.id === activeTab)?.icon &&
                React.createElement(
                  tabs.find((t) => t.id === activeTab)!.icon,
                  { className: "w-6 h-6" },
                )}
            </div>
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight">
                {translate("adminPanelPage.managementTitle", {
                  entity: getTabLabel(activeTab),
                })}
              </h3>
            </div>
          </div>

          {activeTab === "moderation" && (
            <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setModSubTab("queue")}
                className={`flex items-center gap-2 px-4 py-2 text-[10px] font-extrabold uppercase tracking-widest rounded-lg transition-all cursor-pointer ${
                  modSubTab === "queue"
                    ? "bg-slate-900 text-white shadow-lg"
                    : "text-slate-400 hover:text-slate-900"
                }`}
              >
                <MessageSquareIcon className="w-3 h-3" />
                {translate("adminPanelPage.queueTab", {
                  count: moderationQueueData?.total || 0,
                })}
              </button>
              <button
                onClick={() => setModSubTab("logs")}
                className={`flex items-center gap-2 px-4 py-2 text-[10px] font-extrabold uppercase tracking-widest rounded-lg transition-all cursor-pointer ${
                  modSubTab === "logs"
                    ? "bg-slate-900 text-white shadow-lg"
                    : "text-slate-400 hover:text-slate-900"
                }`}
              >
                <History className="w-3 h-3" />
                {translate("adminPanelPage.logs")}
              </button>
            </div>
          )}

          {activeTab !== "settingsBackups" && (
            <div className="admin-search relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                aria-label={translate("adminUi.search")}
                placeholder={translate("adminPanelPage.searchPlaceholder", {
                  entity: getTabLabel(activeTab).toLowerCase(),
                })}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-4 focus:ring-primary/10 uppercase tracking-widest"
              />
            </div>
          )}
        </div>

        {activeTab === "settingsBackups" ? (
          <div className="space-y-8 p-8">
            <div className="admin-settings-panel rounded-[32px] border border-slate-200 bg-white shadow-sm">
              <div className="admin-panel-heading">
                <div>
                  <h3 className="flex items-center gap-2 text-xl font-black uppercase text-slate-900">
                    <Globe className="h-5 w-5 text-primary-dark" />
                    {translate("adminPanelPage.smtpSettings")}
                  </h3>
                </div>
                {smtpSettings?.source ? (
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                    {translate("adminPanelPage.smtpSource", {
                      source: smtpSettings.source,
                    })}
                  </span>
                ) : null}
              </div>

              <form onSubmit={handleSaveSmtpSettings} className="space-y-4">
                <div className="admin-fluid-grid gap-4">
                  <FormField
                    label={translate("adminPanelPage.smtpHost")}
                    value={smtpForm.host}
                    onChange={(val) =>
                      setSmtpForm((prev) => ({ ...prev, host: val }))
                    }
                  />
                  <FormField
                    label={translate("adminPanelPage.smtpPort")}
                    type="number"
                    value={smtpForm.port}
                    onChange={(val) =>
                      setSmtpForm((prev) => ({ ...prev, port: Number(val) }))
                    }
                  />
                  <FormField
                    label={translate("adminPanelPage.smtpUsername")}
                    value={smtpForm.username}
                    onChange={(val) =>
                      setSmtpForm((prev) => ({ ...prev, username: val }))
                    }
                  />
                  <FormField
                    label={translate("adminPanelPage.smtpPassword")}
                    type="password"
                    value={smtpForm.password}
                    required={false}
                    onChange={(val) =>
                      setSmtpForm((prev) => ({ ...prev, password: val }))
                    }
                  />
                  <FormField
                    label={translate("adminPanelPage.smtpFromEmail")}
                    type="email"
                    value={smtpForm.from_email}
                    onChange={(val) =>
                      setSmtpForm((prev) => ({ ...prev, from_email: val }))
                    }
                  />
                  <FormField
                    label={translate("adminPanelPage.smtpFromName")}
                    value={smtpForm.from_name}
                    onChange={(val) =>
                      setSmtpForm((prev) => ({ ...prev, from_name: val }))
                    }
                  />
                </div>

                <div className="admin-fluid-grid gap-4">
                  <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <span className="text-sm font-bold text-slate-700">
                      {translate("adminPanelPage.smtpUseTls")}
                    </span>
                    <input
                      type="checkbox"
                      checked={smtpForm.use_tls}
                      onChange={(e) =>
                        setSmtpForm((prev) => ({
                          ...prev,
                          use_tls: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                  </label>
                  <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <span className="text-sm font-bold text-slate-700">
                      {translate("adminPanelPage.smtpUseSsl")}
                    </span>
                    <input
                      type="checkbox"
                      checked={smtpForm.use_ssl}
                      onChange={(e) =>
                        setSmtpForm((prev) => ({
                          ...prev,
                          use_ssl: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                  </label>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="submit"
                    disabled={isSavingSmtpSettings || isLoadingSmtpSettings}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RefreshCw className="h-4 w-4 text-primary" />
                    {isSavingSmtpSettings
                      ? translate("adminPanelPage.saving")
                      : translate("adminPanelPage.saveSmtp")}
                  </button>
                  <span className="self-center text-xs font-medium text-slate-500">
                    {translate("adminPanelPage.updatedAtLabel", {
                      value: formatLocalizedDate(
                        smtpSettings?.updated_at,
                        "PPp",
                      ),
                    })}
                  </span>
                </div>
              </form>

              <form
                onSubmit={handleSendSmtpTest}
                className="admin-smtp-test mt-6 rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex-1">
                  <label htmlFor={`${adminFieldId}-smtp-recipient`} className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {translate("adminPanelPage.smtpTestRecipient")}
                  </label>
                  <input id={`${adminFieldId}-smtp-recipient`}
                    type="email"
                    required
                    value={smtpTestEmail}
                    onChange={(e) => setSmtpTestEmail(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none transition-all focus:ring-4 focus:ring-primary/10"
                    placeholder={translate(
                      "adminPanelPage.smtpTestPlaceholder",
                    )}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isTestingSmtpSettings || !smtpTestEmail.trim()}
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 transition-all hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isTestingSmtpSettings
                    ? translate("adminPanelPage.sending")
                    : translate("adminPanelPage.sendTestEmail")}
                </button>
              </form>
            </div>

            <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h3 className="flex items-center gap-2 text-xl font-black uppercase text-slate-900">
                    <Database className="h-5 w-5 text-primary-dark" />
                    {translate("adminPanelPage.backups")}
                  </h3>
                </div>
                <div className="text-right text-xs font-medium text-slate-500">
                  <p>
                    {translate("adminPanelPage.totalBackupsLabel", {
                      count: backupsData?.total_backups || 0,
                    })}
                  </p>
                  <p>{formatBytes(backupsData?.total_size_bytes)}</p>
                </div>
              </div>

              <form
                onSubmit={handleSaveBackupConfiguration}
                className="space-y-4"
              >
                <div className="admin-fluid-grid gap-4">
                  <SelectField
                    label={translate("adminPanelPage.backupFrequency")}
                    options={[
                      {
                        label: translate(
                          "adminPanelPage.backupFrequencies.daily",
                        ),
                        value: "daily",
                      },
                      {
                        label: translate(
                          "adminPanelPage.backupFrequencies.weekly",
                        ),
                        value: "weekly",
                      },
                      {
                        label: translate(
                          "adminPanelPage.backupFrequencies.monthly",
                        ),
                        value: "monthly",
                      },
                    ]}
                    value={backupConfigForm.frequency}
                    onChange={(val) =>
                      setBackupConfigForm((prev) => ({
                        ...prev,
                        frequency: val,
                      }))
                    }
                  />
                  <FormField
                    label={translate("adminPanelPage.backupExecutionTime")}
                    type="time"
                    value={backupConfigForm.execution_time}
                    onChange={(val) =>
                      setBackupConfigForm((prev) => ({
                        ...prev,
                        execution_time: val,
                      }))
                    }
                  />
                  <FormField
                    label={translate("adminPanelPage.backupRetentionDays")}
                    type="number"
                    value={backupConfigForm.retention_days}
                    onChange={(val) =>
                      setBackupConfigForm((prev) => ({
                        ...prev,
                        retention_days: Number(val),
                      }))
                    }
                  />
                  <FormField
                    label={translate("adminPanelPage.backupMaxBackups")}
                    type="number"
                    value={backupConfigForm.max_backups}
                    onChange={(val) =>
                      setBackupConfigForm((prev) => ({
                        ...prev,
                        max_backups: Number(val),
                      }))
                    }
                  />
                </div>

                <FormField
                  label={translate("adminPanelPage.backupDirectory")}
                  value={backupConfigForm.backup_dir}
                  onChange={(val) =>
                    setBackupConfigForm((prev) => ({
                      ...prev,
                      backup_dir: val,
                    }))
                  }
                />

                <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <span className="text-sm font-bold text-slate-700">
                    {translate("adminPanelPage.backupAutomaticEnabled")}
                  </span>
                  <input
                    type="checkbox"
                    checked={backupConfigForm.enabled}
                    onChange={(e) =>
                      setBackupConfigForm((prev) => ({
                        ...prev,
                        enabled: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                </label>

                <div className="admin-fluid-grid admin-fluid-grid-three gap-3">
                  <button
                    type="submit"
                    disabled={isSavingBackupConfiguration || isLoadingBackups}
                    className="rounded-2xl bg-slate-900 px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-white transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingBackupConfiguration
                      ? translate("adminPanelPage.saving")
                      : translate("adminPanelPage.saveBackupConfig")}
                  </button>
                  <button
                    type="button"
                    onClick={handleRunBackup}
                    disabled={isRunningBackup}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-slate-900 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isRunningBackup
                      ? translate("adminPanelPage.running")
                      : translate("adminPanelPage.runBackupNow")}
                  </button>

                </div>
              </form>

              <div className="mt-6 rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black uppercase tracking-widest text-slate-900">
                      {translate("adminPanelPage.backupFiles")}
                    </p>
                    <p className="text-xs text-slate-500">
                      {translate("adminPanelPage.backupDirectoryLabel", {
                        value: backupsData?.directory.path || "-",
                      })}
                    </p>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <p>
                      {translate("adminPanelPage.backupExistsLabel", {
                        value: backupsData?.directory.exists
                          ? translate("adminPanelPage.yes")
                          : translate("adminPanelPage.no"),
                      })}
                    </p>
                    <p>
                      {translate("adminPanelPage.backupWritableLabel", {
                        value: backupsData?.directory.writable
                          ? translate("adminPanelPage.yes")
                          : translate("adminPanelPage.no"),
                      })}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {backupsData?.backups?.length ? (
                    backupsData.backups.map((backup) => (
                      <div
                        key={backup.id}
                        className="admin-backup-row rounded-2xl border border-slate-200 bg-white p-4"
                      >
                        <div>
                          <p className="text-sm font-bold text-slate-900">
                            {backup.filename}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatBytes(backup.size_bytes)} •{" "}
                            {formatLocalizedDate(backup.created_at, "PPp")}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleDownloadBackup(backup.id)}
                            disabled={isDownloadingBackup || isDeletingBackup}
                            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 transition-all hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {translate("adminPanelPage.download")}
                          </button>
                          <button
                            type="button"
                            onClick={() => setBackupToDelete(backup)}
                            disabled={isDeletingBackup}
                            className="rounded-xl border border-red-200 bg-red-50 p-2 text-red-600 transition-all hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                            title={translate("adminPanelPage.delete")}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm font-medium text-slate-500">
                      {translate("adminPanelPage.noBackupsYet")}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === "rolesPermissions" ? (
          <div className="admin-role-directory grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="space-y-4">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <h4 className="text-sm font-black uppercase tracking-widest text-slate-900">
                  {translate("adminPanelPage.rolePermissions.rolesDirectory")}
                </h4>
                <p className="mt-2 text-xs font-medium text-slate-500">
                  {translate("adminUi.rolesDescription")}
                </p>
              </div>

              <div className="space-y-3">
                {userRolesData
                  .filter((role) => {
                    const query = searchTerm.trim().toLowerCase();
                    if (!query) return true;
                    return (
                      role.name.toLowerCase().includes(query) ||
                      role.slug.toLowerCase().includes(query) ||
                      (role.description || "").toLowerCase().includes(query)
                    );
                  })
                  .map((role) => (
                    <div
                      key={role.id}
                      onClick={() => setSelectedRoleId(role.id)}
                      className={`w-full rounded-3xl border p-5 text-left transition-all cursor-pointer ${
                        selectedRoleId === role.id
                          ? "border-slate-900 bg-slate-900 text-white shadow-xl"
                          : "border-slate-200 bg-white hover:border-primary/40 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <button type="button" aria-pressed={selectedRoleId === role.id} onClick={(event) => { event.stopPropagation(); setSelectedRoleId(role.id); }} className="text-left text-sm font-black uppercase tracking-wide focus-visible:ring-2 focus-visible:ring-primary">
                            {role.name}
                          </button>
                          <p
                            className={`mt-1 text-[10px] font-black uppercase tracking-widest ${
                              selectedRoleId === role.id
                                ? "text-primary"
                                : "text-slate-400"
                            }`}
                          >
                            {role.slug}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleEditRole(role);
                            }}
                            className={`rounded-xl p-2 transition-all cursor-pointer ${
                              selectedRoleId === role.id
                                ? "text-slate-300 hover:bg-white/10 hover:text-white"
                                : "text-slate-300 hover:bg-slate-100 hover:text-slate-700"
                            }`}
                            title={translate(
                              "adminPanelPage.rolePermissions.updateRole",
                            )}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              confirmDeleteRole(role);
                            }}
                            className={`rounded-xl p-2 transition-all cursor-pointer ${
                              selectedRoleId === role.id
                                ? "text-slate-300 hover:bg-white/10 hover:text-white"
                                : "text-slate-300 hover:bg-red-50 hover:text-red-500"
                            }`}
                            title={translate("adminPanelPage.delete")}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <p
                        className={`mt-3 text-xs leading-relaxed ${
                          selectedRoleId === role.id
                            ? "text-slate-300"
                            : "text-slate-500"
                        }`}
                      >
                        {role.description ||
                          translate("adminPanelPage.fallbacks.notAvailable")}
                      </p>
                    </div>
                  ))}
              </div>
            </div>

            {canManageRolesPermissions && selectedRoleId ? (
              <section className="min-w-0 space-y-4" aria-label={translate("adminPanelPage.rolePermissions.permissionsFor")}>
                <h4 className="text-sm font-bold">{translate("adminPanelPage.rolePermissions.permissionsFor")}: {userRolesData.find((role) => role.id === selectedRoleId)?.name}</h4>
                <AdminPermissionsEditor key={selectedRoleId} kind="role" targetId={selectedRoleId} canManage={canManageRolesPermissions} />
              </section>
            ) : <p>{translate("adminPanelPage.rolePermissions.selectRolePrompt")}</p>}
          </div>
        ) : (
          <div className="grid min-w-0 grid-cols-1 lg:grid-cols-1 xl:grid-cols-4">
            <div className="h-full w-full min-w-0 xl:col-span-4">
              <div className="h-full w-full max-w-full min-w-0 overflow-hidden border-y border-slate-100 bg-white [contain:layout_paint]">
                <div className="admin-table-scroll archi-scrollbar w-full max-w-full min-w-0 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]" tabIndex={0} role="region" aria-label={translate("adminUi.tableScroll")}>
                  <div className="min-w-[900px]">
                    <table className="admin-management-table w-full table-fixed text-left">
                  <thead className="border-b border-slate-100 bg-slate-50/80">
                    <tr>
                      {/* DYNAMIC HEADERS */}
                      {activeTab === "members" && (
                        <>
                          <th className={adminTableHeadCellClass}>
                            {translate("adminPanelPage.table.nameEmail")}
                          </th>
                          <th className={adminTableHeadCellClass}>
                            <div className="flex min-w-0 max-w-full flex-col gap-1 overflow-hidden">
                              <div className="group flex min-w-0 max-w-full items-center gap-2 overflow-hidden">
                                <Filter
                                  className={`h-3 w-3 shrink-0 transition-colors ${memberRoleFilter !== "all" ? "text-primary-dark" : "text-slate-300"}`}
                                />
                                <span className="truncate">
                                  {translate("adminPanelPage.table.role")}
                                </span>
                              </div>
                              <select
                                aria-label={translate("adminPanelPage.table.role")}
                                value={memberRoleFilter}
                                onChange={(e) =>
                                  setMemberRoleFilter(e.target.value)
                                }
                                className="max-w-full truncate border-none bg-transparent p-0 text-[9px] font-black uppercase tracking-[0.12em] text-slate-400 transition-colors hover:text-slate-700 focus:ring-0 cursor-pointer appearance-none"
                              >
                                <option value="all">
                                  {translate("adminPanelPage.filters.allRoles")}
                                </option>
                                {userRolesData.map((role) => (
                                  <option key={role.id} value={role.id}>
                                    {role.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </th>
                          <th className={adminTableHeadCellClass}>
                            <div className="flex min-w-0 max-w-full flex-col gap-1 overflow-hidden">
                              <div className="group flex min-w-0 max-w-full items-center gap-2 overflow-hidden">
                                <Filter
                                  className={`h-3 w-3 shrink-0 transition-colors ${memberStatusFilter !== "all" ? "text-primary-dark" : "text-slate-300"}`}
                                />
                                <span className="truncate">
                                  {translate("adminPanelPage.table.status")}
                                </span>
                              </div>
                              <select
                                aria-label={translate("adminPanelPage.table.status")}
                                value={memberStatusFilter}
                                onChange={(e) =>
                                  setMemberStatusFilter(e.target.value)
                                }
                                className="max-w-full truncate border-none bg-transparent p-0 text-[9px] font-black uppercase tracking-[0.12em] text-slate-400 transition-colors hover:text-slate-700 focus:ring-0 cursor-pointer appearance-none"
                              >
                                <option value="all">
                                  {translate(
                                    "adminPanelPage.filters.allCount",
                                    {
                                      count: usersData?.counts.all || 0,
                                    },
                                  )}
                                </option>
                                <option value="active">
                                  {translate(
                                    "adminPanelPage.filters.activeCount",
                                    {
                                      count: usersData?.counts.active || 0,
                                    },
                                  )}
                                </option>
                                <option value="suspended">
                                  {translate(
                                    "adminPanelPage.filters.suspendedCount",
                                    {
                                      count: usersData?.counts.suspended || 0,
                                    },
                                  )}
                                </option>
                              </select>
                            </div>
                          </th>
                        </>
                      )}
                      {activeTab === "forums" && (
                        <>
                          <th className={adminTableHeadCellClass}>
                            {translate("adminPanelPage.table.forumName")}
                          </th>
                          <th className={adminTableHeadCellClass}>
                            {translate("adminPanelPage.table.type")}
                          </th>
                          <th className={adminTableHeadCellClass}>
                            {translate("adminPanelPage.table.responsible")}
                          </th>
                          <th className={adminTableHeadCellClass}>
                            {translate("adminPanelPage.table.stats")}
                          </th>
                          <th className={adminTableHeadCellClass}>
                            {translate("adminPanelPage.table.status")}
                          </th>
                        </>
                      )}
                      {activeTab === "articles" && (
                        <>
                          <th className={adminTableHeadCellClass}>
                            {translate("adminPanelPage.table.articleTitle")}
                          </th>
                          <th className={adminTableHeadCellClass}>
                            {translate("adminPanelPage.table.author")}
                          </th>
                          <th className={adminTableHeadCellClass}>
                            {translate("adminPanelPage.table.category")}
                          </th>
                          <th className={adminTableHeadCellClass}>
                            {translate("adminPanelPage.table.status")}
                          </th>
                        </>
                      )}
                      {activeTab === "technicopro" && (
                        <>
                          <th className={adminTableHeadCellClass}>
                            {translate("common.technicopro")}
                          </th>
                          <th className={adminTableHeadCellClass}>
                            {translate("adminPanelPage.table.author")}
                          </th>
                          <th className={adminTableHeadCellClass}>
                            {translate("adminPanelPage.table.category")}
                          </th>
                          <th className={adminTableHeadCellClass}>
                            {translate("adminPanelPage.table.status")}
                          </th>
                        </>
                      )}
                      {activeTab === "events" && (
                        <>
                          <th className={adminTableHeadCellClass}>
                            {translate("adminPanelPage.table.event")}
                          </th>
                          <th className={adminTableHeadCellClass}>
                            {translate("adminPanelPage.table.date")}
                          </th>
                          <th className={adminTableHeadCellClass}>
                            {translate("adminPanelPage.table.location")}
                          </th>
                          <th className={adminTableHeadCellClass}>
                            {translate("adminPanelPage.table.type")}
                          </th>
                        </>
                      )}
                      {activeTab === "trainings" && (
                        <>
                          <th className={adminTableHeadCellClass}>
                            {translate("adminPanelPage.table.training")}
                          </th>
                          <th className={adminTableHeadCellClass}>
                            {translate("adminPanelPage.table.category")}
                          </th>
                          <th className={adminTableHeadCellClass}>
                            {translate("adminPanelPage.form.excerpt")}
                          </th>
                          <th className={adminTableHeadCellClass}>
                            {translate("adminPanelPage.table.status")}
                          </th>
                        </>
                      )}
                      {activeTab === "moderation" && modSubTab === "queue" && (
                        <>
                          <th className={adminTableHeadCellClass}>
                            {translate("adminPanelPage.table.contentPost")}
                          </th>
                          <th className={adminTableHeadCellClass}>
                            {translate("adminPanelPage.table.author")}
                          </th>
                          <th className={adminTableHeadCellClass}>
                            {translate("adminPanelPage.table.reason")}
                          </th>
                          <th className={adminTableHeadCellClass}>
                            {translate("adminPanelPage.table.submitted")}
                          </th>
                        </>
                      )}
                      {activeTab === "moderation" && modSubTab === "logs" && (
                        <>
                          <th className={adminTableHeadCellClass}>
                            {translate("adminPanelPage.table.action")}
                          </th>
                          <th className={adminTableHeadCellClass}>
                            {translate("adminPanelPage.table.targetContent")}
                          </th>
                          <th className={adminTableHeadCellClass}>
                            {translate("adminPanelPage.table.moderator")}
                          </th>
                          <th className={adminTableHeadCellClass}>
                            {translate("adminPanelPage.table.date")}
                          </th>
                        </>
                      )}
                      <th className={adminTableHeadCellRightClass}>
                        {translate("adminPanelPage.table.actions")}
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">
                    {showTableSkeleton && (
                      <AdminTableSkeleton columns={activeTableColumnCount} />
                    )}
                    {/* RENDER MEMBERS */}
                    {!showTableSkeleton &&
                      activeTab === "members" &&
                      (usersData?.results || []).map((member) => (
                        <tr key={member.id} className={adminTableRowClass}>
                          <td className={adminTableCellClass}>
                            <span className="flex min-w-0 items-center gap-4">
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-xs font-black uppercase text-slate-900">
                                {member.avatar_url ? (
                                  <img
                                    src={member.avatar_url}
                                    alt={translate("adminPanelPage.avatarAlt")}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  member.initials ||
                                  (
                                    member.first_name?.[0] ||
                                    "" + member.last_name?.[0] ||
                                    ""
                                  ).toUpperCase() ||
                                  translate(
                                    "adminPanelPage.fallbacks.userInitial",
                                  )
                                )}
                              </span>
                              <span className="block min-w-0">
                                <span className="block truncate text-sm font-bold text-gray-700">
                                  {member.first_name?.toUpperCase()}{" "}
                                  {member.last_name?.toUpperCase()}
                                </span>
                                <span className="block truncate text-[10px] font-bold tracking-widest text-gray-400">
                                  {member.email}
                                </span>
                              </span>
                            </span>
                          </td>
                          <td className={adminTableCellClass}>
                            <span className="text-xs font-black uppercase text-slate-500">
                              {getRoleLabel(member.role)}
                            </span>
                          </td>
                          <td
                            className={`${adminTableCellClass} text-[10px] font-black uppercase`}
                          >
                            <span className="flex items-center gap-3">
                              <span
                                className={
                                  member.status === "active"
                                    ? "text-emerald-600"
                                    : member.status === "suspended"
                                      ? "text-red-500"
                                      : "text-slate-400"
                                }
                              >
                                {getMemberStatusLabel(member.status)}
                              </span>
                            </span>
                          </td>
                          <td className={`${adminTableCellClass} text-right`}>
                            {canEditMembers && <button type="button" onClick={() => setPermissionMember(member)} aria-label={`${translate("adminPanelPage.memberPermissions.title")}: ${member.email}`} title={translate("adminPanelPage.memberPermissions.title")} className="mb-2 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold focus-visible:ring-2 focus-visible:ring-primary">
                              <Shield className="h-4 w-4" aria-hidden="true" />
                              {translate("adminPanelPage.memberPermissions.title")}
                            </button>}
                            <Actions
                              onView={() => handleOpenDetails(member)}
                              onEdit={() => handleOpenModal(member)}
                              onDelete={() =>
                                confirmDelete(
                                  member.id,
                                  member,
                                  member.status === "suspended"
                                    ? "restore"
                                    : "archive",
                                )
                              }
                              onPermanentDelete={() =>
                                confirmDelete(member.id, member, "hard")
                              }
                              deleteLabel={
                                member.status === "suspended"
                                  ? translate("adminPanelPage.restore")
                                  : translate("adminPanelPage.archive")
                              }
                              deleteTitle={
                                member.status === "suspended"
                                  ? translate("adminPanelPage.restore")
                                  : translate("adminPanelPage.archive")
                              }
                              deleteVariant={
                                member.status === "suspended"
                                  ? "restore"
                                  : "archive"
                              }
                            />
                          </td>
                        </tr>
                      ))}

                    {/* RENDER FORUMS */}
                    {!showTableSkeleton &&
                      activeTab === "forums" &&
                      (forumsData || [])
                        .filter((f) =>
                          f.name
                            .toLowerCase()
                            .includes(searchTerm.toLowerCase()),
                        )
                        .map((forum) => (
                          <tr key={forum.id} className={adminTableRowClass}>
                            <td className={`${adminTableCellClass} font-bold`}>
                              {forum.name}
                            </td>
                            <td
                              className={`${adminTableCellClass} text-[10px] font-black uppercase`}
                            >
                              {getForumTypeLabel(forum.forum_type)}
                            </td>
                            <td
                              className={`${adminTableCellClass} text-xs font-bold text-gray-500`}
                            >
                              {forum.author_name ||
                                translate(
                                  "adminPanelPage.fallbacks.notAvailable",
                                )}
                            </td>
                            <td
                              className={`${adminTableCellClass} text-[10px] uppercase text-gray-400`}
                            >
                              {translate("adminPanelPage.forumStats", {
                                topics: forum.topic_count,
                                posts: forum.post_count,
                              })}
                            </td>
                            <td
                              className={`${adminTableCellClass} text-[10px] font-black uppercase text-blue-600`}
                            >
                              {translate(
                                "adminPanelPage.memberStatuses.active",
                              )}
                            </td>
                            <td className={`${adminTableCellClass} text-right`}>
                              <Actions
                                onView={() => handleViewItem(forum)}
                                onEdit={() => handleOpenModal(forum)}
                                onDelete={() => confirmDelete(forum.id)}
                              />
                            </td>
                          </tr>
                        ))}

                    {/* RENDER ARTICLES */}
                    {!showTableSkeleton &&
                      activeTab === "articles" &&
                      (articlesData?.results || [])
                        .filter((a) =>
                          a.title
                            .toLowerCase()
                            .includes(searchTerm.toLowerCase()),
                        )
                        .map((article) => (
                          <tr key={article.id} className={adminTableRowClass}>
                            <td
                              className={`${adminTableCellClass} max-w-xs truncate font-bold`}
                            >
                              {article.title}
                            </td>
                            <td
                              className={`${adminTableCellClass} text-xs text-gray-500`}
                            >
                              {article.structured_fields?.author ||
                                translate(
                                  "adminPanelPage.fallbacks.defaultAuthor",
                                )}
                            </td>
                            <td
                              className={`${adminTableCellClass} text-[10px] font-black uppercase text-primary-dark`}
                            >
                              {article.category?.name ||
                                translate(
                                  "adminPanelPage.fallbacks.articleCategory",
                                )}
                            </td>
                            <td
                              className={`${adminTableCellClass} text-[10px] font-black uppercase`}
                            >
                              {article.status === "published" ? (
                                <span className="text-emerald-600">
                                  {getArticleStatusLabel(article.status)}
                                </span>
                              ) : (
                                <span className="text-amber-600">
                                  {getArticleStatusLabel(article.status)}
                                </span>
                              )}
                            </td>
                            <td className={`${adminTableCellClass} text-right`}>
                              <Actions
                                onView={() => handleViewItem(article)}
                                onEdit={canModify(article, "edit") ? () => handleOpenModal(article) : undefined}
                                onDelete={canModify(article, "delete") ? () => confirmDelete(article.id) : undefined}
                                onPublish={
                                  article.status !== "published"
                                    ? () => handlePublishArticle(article.id)
                                    : undefined
                                }
                              />
                            </td>
                          </tr>
                        ))}

                    {/* RENDER TECHNICOPRO */}
                    {!showTableSkeleton &&
                      activeTab === "technicopro" &&
                      (technicoproData?.results || [])
                        .filter((item) =>
                          item.title
                            .toLowerCase()
                            .includes(searchTerm.toLowerCase()),
                        )
                        .map((item) => (
                          <tr key={item.id} className={adminTableRowClass}>
                            <td
                              className={`${adminTableCellClass} max-w-xs truncate font-bold`}
                            >
                              {item.title}
                            </td>
                            <td
                              className={`${adminTableCellClass} text-xs text-gray-500`}
                            >
                              {item.structured_fields?.author ||
                                translate(
                                  "adminPanelPage.fallbacks.defaultAuthor",
                                )}
                            </td>
                            <td
                              className={`${adminTableCellClass} text-[10px] font-black uppercase text-primary-dark`}
                            >
                              {item.category?.name ||
                                translate(
                                  "adminPanelPage.fallbacks.articleCategory",
                                )}
                            </td>
                            <td
                              className={`${adminTableCellClass} text-[10px] font-black uppercase`}
                            >
                              {item.status === "published" ? (
                                <span className="text-emerald-600">
                                  {getArticleStatusLabel(item.status)}
                                </span>
                              ) : (
                                <span className="text-amber-600">
                                  {getArticleStatusLabel(item.status)}
                                </span>
                              )}
                            </td>
                            <td className={`${adminTableCellClass} text-right`}>
                              <Actions
                                onView={() => handleViewItem(item)}
                                onEdit={() => handleOpenModal(item)}
                                onDelete={() => confirmDelete(item.id)}
                                onPublish={
                                  item.status !== "published"
                                    ? () => handlePublishTechnicoPro(item.id)
                                    : undefined
                                }
                              />
                            </td>
                          </tr>
                        ))}

                    {/* RENDER EVENTS */}
                    {!showTableSkeleton &&
                      activeTab === "events" &&
                      (eventsData || [])
                        .filter((e) =>
                          e.title
                            .toLowerCase()
                            .includes(searchTerm.toLowerCase()),
                        )
                        .map((event) => (
                          <tr key={event.id} className={adminTableRowClass}>
                            <td className={`${adminTableCellClass} font-bold`}>
                              {event.title}
                            </td>
                            <td
                              className={`${adminTableCellClass} text-xs text-gray-500`}
                            >
                              {event.end_date &&
                              event.end_date !== event.event_date
                                ? `${formatLocalizedDate(event.event_date)} - ${formatLocalizedDate(event.end_date)}`
                                : formatLocalizedDate(event.event_date)}
                            </td>
                            <td
                              className={`${adminTableCellClass} text-xs text-gray-400`}
                            >
                              <MapPin className="w-3 h-3 inline mr-1" />{" "}
                              {event.location}
                            </td>
                            <td
                              className={`${adminTableCellClass} text-[10px] font-black uppercase text-amber-600`}
                            >
                              {event.event_category?.name ||
                                getEventTypeLabel(event.event_type || "")}
                            </td>
                            <td className={`${adminTableCellClass} text-right`}>
                              <Actions
                                onView={() => handleViewItem(event)}
                                onEdit={() => handleOpenModal(event)}
                                onDelete={() => confirmDelete(event.id)}
                              />
                            </td>
                          </tr>
                        ))}

                    {/* RENDER TRAININGS */}
                    {!showTableSkeleton &&
                      activeTab === "trainings" &&
                      (trainingsData || [])
                        .filter((t) =>
                          t.title
                            .toLowerCase()
                            .includes(searchTerm.toLowerCase()),
                        )
                        .map((training) => (
                          <tr key={training.id} className={adminTableRowClass}>
                            <td className={`${adminTableCellClass} font-bold`}>
                              {training.title}
                            </td>
                            <td
                              className={`${adminTableCellClass} text-xs text-gray-500`}
                            >
                              {training.category?.name ||
                                translate(
                                  "adminPanelPage.fallbacks.notAvailable",
                                )}
                            </td>
                            <td
                              className={`${adminTableCellClass} max-w-xs truncate text-xs text-gray-500`}
                              title={
                                training.excerpt ||
                                getPlainTextPreview(training.description)
                              }
                            >
                              {training.excerpt ||
                                getPlainTextPreview(training.description) ||
                                translate(
                                  "adminPanelPage.fallbacks.notAvailable",
                                )}
                            </td>
                            <td
                              className={`${adminTableCellClass} text-[10px] font-black uppercase text-emerald-600`}
                            >
                              {getTrainingStatusLabel(training.status)}
                            </td>
                            <td className={`${adminTableCellClass} text-right`}>
                              <Actions
                                onView={() => handleViewItem(training)}
                                onEdit={() => handleOpenModal(training)}
                                onDelete={() => confirmDelete(training.id)}
                              />
                            </td>
                          </tr>
                        ))}

                    {/* RENDER MODERATION QUEUE */}
                    {!showTableSkeleton &&
                      activeTab === "moderation" &&
                      modSubTab === "queue" &&
                      (moderationQueueData?.results || []).map((item) => (
                        <tr key={item.id} className={adminTableRowClass}>
                          <td className={adminTableCellClass}>
                          <span className="flex max-w-full flex-col gap-1">
                            <span className="block text-sm font-bold text-gray-700">
                                {item.topic?.title ||
                                  translate(
                                    "adminPanelPage.fallbacks.forumPost",
                                  )}
                              </span>
                              <RichTextPreview
                                content={item.content}
                                className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed"
                              />
                              {(item.attachment?.length > 0 ||
                                item.attachments?.length > 0) && (
                                <span className="mt-2 flex flex-wrap gap-1">
                                  {(item.attachment || item.attachments).map(
                                    (url: string, idx: number) => (
                                      <span
                                        key={idx}
                                        className="flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[8px] font-bold text-slate-500"
                                      >
                                        <Paperclip className="w-2.5 h-2.5 text-primary" />
                                        {translate(
                                          "adminPanelPage.attachment",
                                          {
                                            count: idx + 1,
                                          },
                                        )}
                                      </span>
                                    ),
                                  )}
                                </span>
                              )}
                            </span>
                          </td>
                          <td className={adminTableCellClass}>
                            <span className="text-xs font-bold text-gray-700">
                              {item.author?.first_name} {item.author?.last_name}
                            </span>
                          </td>
                          <td className={adminTableCellClass}>
                            <span
                              className={`text-[10px] font-black uppercase ${item.moderation_status === "flagged" ? "text-red-500" : "text-amber-500"}`}
                            >
                              {getModerationStatusLabel(item.moderation_status)}
                            </span>
                          </td>
                          <td className={adminTableCellClass}>
                            <span className="text-xs font-bold text-gray-400">
                              {formatLocalizedDateTime(item.created_at)}
                            </span>
                          </td>
                          <td className={`${adminTableCellClass} text-right`}>
                            <span className="flex justify-end gap-2">
                              <button
                                onClick={() =>
                                  confirmModAction(item.id, "approve")
                                }
                                className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all shadow-sm cursor-pointer"
                                title={translate(
                                  "adminPanelPage.moderationActions.approve",
                                )}
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() =>
                                  confirmModAction(item.id, "reject")
                                }
                                className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all shadow-sm cursor-pointer"
                                title={translate(
                                  "adminPanelPage.moderationActions.reject",
                                )}
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </span>
                          </td>
                        </tr>
                      ))}

                    {/* RENDER MODERATION LOGS */}
                    {!showTableSkeleton &&
                      activeTab === "moderation" &&
                      modSubTab === "logs" &&
                      (moderationLogsData?.results || []).map((log) => (
                        <tr key={log.id} className={adminTableRowClass}>
                          <td className={adminTableCellClass}>
                            <span
                              className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest ${log.action === "approve" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}
                            >
                              {getModerationActionLabel(log.action)}
                            </span>
                          </td>
                          <td className={adminTableCellClass}>
                            <RichTextPreview
                              content={log.post?.content}
                              className="text-xs text-slate-600 line-clamp-1 max-w-xs"
                            />
                          </td>
                          <td className={adminTableCellClass}>
                            <span className="text-xs font-bold text-gray-700">
                              {log.moderator?.first_name}{" "}
                              {log.moderator?.last_name}
                            </span>
                          </td>
                          <td className={adminTableCellClass}>
                            <span className="text-xs font-bold text-gray-400">
                              {formatLocalizedDateTime(log.acted_at)}
                            </span>
                          </td>
                          <td className={`${adminTableCellClass} text-right`}>
                            {/* No actions for logs */}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
            {activeTab === "members" && (
              <div className={adminPaginationClass}>
                <p className={adminPaginationTextClass}>
                  {translate("adminPanelPage.pagination.showingMembers", {
                    count: usersData?.results.length || 0,
                    total: usersData?.total || 0,
                  })}
                  {isFetchingUsers && !isLoadingUsers
                    ? translate("adminPanelPage.pagination.refreshing")
                    : ""}
                </p>
                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <span className={adminPaginationPageClass}>
                    {translate("adminPanelPage.pagination.pageOf", {
                      current: memberPage,
                      total: totalMemberPages,
                    })}
                  </span>
                  <button
                    onClick={() =>
                      setMemberPage((currentPage) =>
                        Math.max(1, currentPage - 1),
                      )
                    }
                    className={adminPaginationButtonClass}
                    disabled={memberPage <= 1 || isFetchingUsers}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() =>
                      setMemberPage((currentPage) =>
                        Math.min(totalMemberPages, currentPage + 1),
                      )
                    }
                    className={adminPaginationButtonClass}
                    disabled={memberPage >= totalMemberPages || isFetchingUsers}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {activeTab === "articles" && (
              <div className={adminPaginationClass}>
                <p className={adminPaginationTextClass}>
                  {translate("adminPanelPage.pagination.showingArticles", {
                    count: articlesData?.results.length || 0,
                    total: articlesData?.total || 0,
                  })}
                  {isFetchingArticles && !isLoadingArticles
                    ? translate("adminPanelPage.pagination.refreshing")
                    : ""}
                </p>
                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <span className={adminPaginationPageClass}>
                    {translate("adminPanelPage.pagination.pageOf", {
                      current: articlePage,
                      total: totalArticlePages,
                    })}
                  </span>
                  <button
                    onClick={() =>
                      setArticlePage((currentPage) =>
                        Math.max(1, currentPage - 1),
                      )
                    }
                    className={adminPaginationButtonClass}
                    disabled={articlePage <= 1 || isFetchingArticles}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() =>
                      setArticlePage((currentPage) =>
                        Math.min(totalArticlePages, currentPage + 1),
                      )
                    }
                    className={adminPaginationButtonClass}
                    disabled={
                      articlePage >= totalArticlePages || isFetchingArticles
                    }
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {activeTab === "technicopro" && (
              <div className={adminPaginationClass}>
                <p className={adminPaginationTextClass}>
                  {translate("adminPanelPage.pagination.showingTechnicoPro", {
                    count: technicoproData?.results.length || 0,
                    total: technicoproData?.total || 0,
                  })}
                  {isFetchingTechnicoPro && !isLoadingTechnicoPro
                    ? translate("adminPanelPage.pagination.refreshing")
                    : ""}
                </p>
                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <span className={adminPaginationPageClass}>
                    {translate("adminPanelPage.pagination.pageOf", {
                      current: technicoproPage,
                      total: totalTechnicoProPages,
                    })}
                  </span>
                  <button
                    onClick={() =>
                      setTechnicoproPage((currentPage) =>
                        Math.max(1, currentPage - 1),
                      )
                    }
                    className={adminPaginationButtonClass}
                    disabled={technicoproPage <= 1 || isFetchingTechnicoPro}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() =>
                      setTechnicoproPage((currentPage) =>
                        Math.min(totalTechnicoProPages, currentPage + 1),
                      )
                    }
                    className={adminPaginationButtonClass}
                    disabled={
                      technicoproPage >= totalTechnicoProPages ||
                      isFetchingTechnicoPro
                    }
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {activeTab === "moderation" && modSubTab === "queue" && (
              <div className={adminPaginationClass}>
                <p className={adminPaginationTextClass}>
                  {translate("adminPanelPage.pagination.showingQueue", {
                    count: moderationQueueData?.results.length || 0,
                    total: moderationQueueData?.total || 0,
                  })}
                  {isFetchingModerationQueue && !isLoadingModeration
                    ? translate("adminPanelPage.pagination.refreshing")
                    : ""}
                </p>
                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <span className={adminPaginationPageClass}>
                    {translate("adminPanelPage.pagination.pageOf", {
                      current: moderationQueuePage,
                      total: totalModerationQueuePages,
                    })}
                  </span>
                  <button
                    onClick={() =>
                      setModerationQueuePage((currentPage) =>
                        Math.max(1, currentPage - 1),
                      )
                    }
                    className={adminPaginationButtonClass}
                    disabled={
                      moderationQueuePage <= 1 || isFetchingModerationQueue
                    }
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() =>
                      setModerationQueuePage((currentPage) =>
                        Math.min(totalModerationQueuePages, currentPage + 1),
                      )
                    }
                    className={adminPaginationButtonClass}
                    disabled={
                      moderationQueuePage >= totalModerationQueuePages ||
                      isFetchingModerationQueue
                    }
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {activeTab === "moderation" && modSubTab === "logs" && (
              <div className={adminPaginationClass}>
                <p className={adminPaginationTextClass}>
                  {translate("adminPanelPage.pagination.showingLogs", {
                    count: moderationLogsData?.results.length || 0,
                    total: moderationLogsData?.total || 0,
                  })}
                  {isFetchingModerationLogs && !isLoadingModerationLogs
                    ? translate("adminPanelPage.pagination.refreshing")
                    : ""}
                </p>
                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <span className={adminPaginationPageClass}>
                    {translate("adminPanelPage.pagination.pageOf", {
                      current: moderationLogsPage,
                      total: totalModerationLogsPages,
                    })}
                  </span>
                  <button
                    onClick={() =>
                      setModerationLogsPage((currentPage) =>
                        Math.max(1, currentPage - 1),
                      )
                    }
                    className={adminPaginationButtonClass}
                    disabled={
                      moderationLogsPage <= 1 || isFetchingModerationLogs
                    }
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() =>
                      setModerationLogsPage((currentPage) =>
                        Math.min(totalModerationLogsPages, currentPage + 1),
                      )
                    }
                    className={adminPaginationButtonClass}
                    disabled={
                      moderationLogsPage >= totalModerationLogsPages ||
                      isFetchingModerationLogs
                    }
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {((activeTab === "moderation" &&
              modSubTab === "queue" &&
              (!moderationQueueData?.results ||
                moderationQueueData.results.length === 0)) ||
              (activeTab === "moderation" &&
                modSubTab === "logs" &&
                (!moderationLogsData?.results ||
                  moderationLogsData.results.length === 0))) && (
              <div className="py-20 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-slate-200" />
                </div>
                <h4 className="text-lg font-bold text-slate-900 uppercase tracking-tight">
                  {translate("adminPanelPage.allCaughtUp")}
                </h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest max-w-xs mt-2">
                  {modSubTab === "queue"
                    ? translate("adminPanelPage.emptyQueue")
                    : translate("adminPanelPage.emptyLogs")}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      </div>

      <Modal
        isOpen={isRoleModalOpen}
        onClose={() => {
          setIsRoleModalOpen(false);
          setEditingRole(null);
          setNewRoleData({ name: "", description: "" });
        }}
        title={
          editingRole
            ? translate("adminPanelPage.rolePermissions.updateRole")
            : translate("adminPanelPage.rolePermissions.createRole")
        }
        className="batch-four-modal"
        layout={"compact"}
        maxWidth="max-w-md"
        footer={(<ModalSubmitButton
          formId="admin-role-form"
          disabled={isCreatingUserRole || isUpdatingUserRole}
          className="w-full py-3 bg-slate-900 text-white rounded-2xl font-black text-xs hover:bg-slate-800 disabled:bg-slate-400 disabled:cursor-not-allowed transition-all shadow-xl uppercase tracking-[0.2em] flex items-center justify-center gap-3 cursor-pointer"
        >
          {isCreatingUserRole || isUpdatingUserRole
            ? translate("adminPanelPage.submitting")
            : editingRole
              ? translate("adminPanelPage.rolePermissions.updateRole")
              : translate("adminPanelPage.rolePermissions.createRole")}
        </ModalSubmitButton>)}>
        <form
          id="admin-role-form"
          noValidate
          onSubmit={handleSaveRole}
          className="space-y-5 text-left"
        >
          <FormField
            label={translate("adminPanelPage.rolePermissions.roleName")}
            value={newRoleData.name}
            onChange={(val) =>
              setNewRoleData((prev) => ({ ...prev, name: val }))
            }
          />
          <div className="space-y-2">
            <label htmlFor={`${adminFieldId}-role-description`} className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              {translate("adminPanelPage.rolePermissions.roleDescription")}
            </label>
            <textarea id={`${adminFieldId}-role-description`}
              value={newRoleData.description}
              onChange={(e) =>
                setNewRoleData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              rows={5}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition-all focus:ring-4 focus:ring-primary/10"
            />
          </div>
        </form>
      </Modal>

      <div className="admin-log-panel rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <div className="admin-log-heading">
          <div>
            <h3 className="flex items-center gap-2 text-xl font-black uppercase text-slate-900">
              <FileIcon className="h-5 w-5 text-primary-dark" />
              {translate("adminPanelPage.systemLogs")}
            </h3>
          </div>
          <div className="text-right text-xs font-medium text-slate-500">
            <p>{formatBytes(systemLogs?.size_bytes)}</p>
            <p>{formatLocalizedDate(systemLogs?.updated_at, "PPp")}</p>
          </div>
        </div>

        <div className="admin-log-toolbar">
          <input
            type="text"
            value={systemLogSearchTerm}
            onChange={(e) => setSystemLogSearchTerm(e.target.value)}
            aria-label={translate("adminPanelPage.filterLogs")}
            placeholder={translate("adminPanelPage.filterLogs")}
            className="h-10 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 outline-none transition-all focus:ring-4 focus:ring-primary/10 sm:min-w-0 sm:flex-1"
          />
          <button
            type="button"
            onClick={handleDownloadSystemLogs}
            disabled={isDownloadingSystemLogs || !systemLogs?.downloadable}
            className="h-10 min-w-[140px] rounded-2xl border border-slate-200 bg-white px-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
          >
            {isDownloadingSystemLogs
              ? translate("adminPanelPage.downloading")
              : translate("adminPanelPage.download")}
          </button>
          <button
            type="button"
            onClick={handleClearSystemLogs}
            disabled={isClearingSystemLogs}
            className="h-10 min-w-[140px] rounded-2xl border border-rose-200 bg-rose-50 px-5 text-[10px] font-black uppercase tracking-[0.2em] text-rose-700 transition-all hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
          >
            {isClearingSystemLogs
              ? translate("adminPanelPage.clearing")
              : translate("adminPanelPage.clearLogs")}
          </button>
        </div>

        <div className="admin-log-output min-h-[260px] rounded-[28px] bg-slate-950 p-5 font-mono text-[11px] text-slate-200 shadow-inner" tabIndex={0} role="region" aria-label={translate("adminPanelPage.systemLogs")}>
          {isInitialSystemLogsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((item) => (
                <div
                  key={item}
                  className="h-4 rounded bg-white/10 animate-pulse"
                />
              ))}
            </div>
          ) : systemLogLines.length ? (
            <div className="space-y-2">
              {systemLogLines.map((line, index) => (
                <p
                  key={`${line}-${index}`}
                  className="admin-log-line text-slate-300"
                >
                  {line}
                </p>
              ))}
            </div>
          ) : (
            <div className="flex h-full min-h-[220px] flex-col items-center justify-center text-center text-slate-500">
              <AlertCircle className="mb-3 h-8 w-8 opacity-50" />
              <p className="text-sm font-bold uppercase tracking-widest">
                {translate("adminPanelPage.noLogLinesFound")}
              </p>
            </div>
          )}
        </div>

        {canLoadMoreSystemLogs && (
          <button
            type="button"
            onClick={() => setSystemLogsLimit((current) => current + 8)}
            disabled={isLoadingMoreSystemLogs}
            className="mt-6 w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 transition-all hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoadingMoreSystemLogs
              ? translate("common.loading")
              : translate("adminPanelPage.loadMore")}
          </button>
        )}
      </div>

      {/* COMPREHENSIVE MODAL FOR ALL ENTITIES */}
      <Modal
        isOpen={isModalOpen && (activeTab !== "articles" || (editingItem ? canModify(articleDetail ?? editingItem, "edit") && !isErrorArticle : canCreateArticles))}
        onClose={() => {
          setIsModalOpen(false);
          setShowMemberPassword(false);
          setFormData((current: any) => ({ ...current, password: "" }));
          setEditingItem(null);
          setSelectedFiles([]);
          setRemovedFileUrls([]);
        }}
        title={
          editingItem
            ? translate("adminPanelPage.modal.editTitle", {
              entity: getTabLabel(activeTab),
            })
            : translate("adminPanelPage.modal.createTitle", {
              entity: getTabLabel(activeTab),
            })
        }
        className="batch-four-modal"
        layout={["articles", "technicopro", "trainings"].includes(activeTab) ? "sectioned" : "compact"}
        footer={(<ModalSubmitButton
          formId="admin-entity-form"
          disabled={
            Boolean(editingItem && !isEditorDetailReady) || isCreatingMember ||
            isUpdatingMember ||
            isCreatingForum ||
            isUpdatingForum ||
            isCreatingArticle ||
            isUpdatingArticle ||
            isCreatingTechnicoPro ||
            isUpdatingTechnicoPro ||
            isCreatingEvent ||
            isUpdatingEvent ||
            isCreatingTraining ||
            isUpdatingTraining
          }
          className="w-full py-3 bg-slate-900 text-white rounded-2xl font-black text-xs hover:bg-slate-800 disabled:bg-slate-400 disabled:cursor-not-allowed transition-all shadow-xl uppercase tracking-[0.2em] flex items-center justify-center gap-3 group cursor-pointer"
        >
          {isCreatingMember ||
            isUpdatingMember ||
            isCreatingForum ||
            isUpdatingForum ||
            isCreatingArticle ||
            isUpdatingArticle ||
            isCreatingTechnicoPro ||
            isUpdatingTechnicoPro ||
            isCreatingEvent ||
            isUpdatingEvent ||
            isCreatingTraining ||
            isUpdatingTraining ? (
            editingItem ? (
              <Edit2 className="w-4 h-4 text-primary" />
            ) : (
              <Plus className="w-4 h-4 text-primary" />
            )
          ) : editingItem ? (
            <Edit2 className="w-4 h-4 text-primary" />
          ) : (
            <Plus className="w-4 h-4 text-primary" />
          )}
          {isCreatingMember ||
            isUpdatingMember ||
            isCreatingForum ||
            isUpdatingForum ||
            isCreatingArticle ||
            isUpdatingArticle ||
            isCreatingTechnicoPro ||
            isUpdatingTechnicoPro ||
            isCreatingEvent ||
            isUpdatingEvent ||
            isCreatingTraining ||
            isUpdatingTraining
            ? translate("adminPanelPage.submitting")
            : editingItem
              ? translate("adminPanelPage.submitEdit")
              : translate("adminPanelPage.submitCreate")}
        </ModalSubmitButton>)}>
        {hasDraftConflict && <p role="status">{translate('common.draftConflict')}</p>}
        {editingItem && !isEditorDetailReady && <p role="status">{translate(isCurrentDetailError ? 'common.error' : 'common.loading')}</p>}
        <form
          id="admin-entity-form"
          noValidate
          onSubmit={handleSubmit}
          className="space-y-5 text-left"
        >
          <fieldset disabled={Boolean(editingItem && !isEditorDetailReady)} className="contents">
          {/* MEMBER FORM */}
          {activeTab === "members" && (
            <>
              <ModalSection title={translate("modalBatchFour.personalInformation")}>
                <ModalFieldGrid>
                  <FormField
                    label={translate("adminPanelPage.form.firstName")}
                    value={formData.first_name || ""}
                    onChange={(val) =>
                      setFormData({ ...formData, first_name: val })
                    }
                  />
                  <FormField
                    label={translate("adminPanelPage.form.lastName")}
                    value={formData.last_name || ""}
                    onChange={(val) =>
                      setFormData({ ...formData, last_name: val })
                    }
                  />
                  <FormField
                    label={translate("adminPanelPage.form.email")}
                    type="email"
                    autoComplete="off"
                    value={formData.email || ""}
                    onChange={(val) => setFormData({ ...formData, email: val })}
                  />
                  {!editingItem && (
                    <AdminPasswordField
                    id={`${adminFieldId}-member-password`}
                      label={translate("adminPanelPage.form.password")}
                      value={formData.password || ""}
                      onChange={(val) =>
                        setFormData({ ...formData, password: val })
                      }
                      visible={showMemberPassword}
                      onToggle={() => setShowMemberPassword((visible) => !visible)}
                      showLabel={translate("memberDirectory.showPassword")}
                      hideLabel={translate("memberDirectory.hidePassword")}
                    />
                  )}
                  <FormField
                    label={translate("adminPanelPage.form.phoneOptional")}
                    value={formData.phone || ""}
                    onChange={(val) => setFormData({ ...formData, phone: val })}
                    required={false}
                  />
                  <FormField
                    label={translate("adminPanelPage.form.mobileOptional")}
                    value={formData.mobile || ""}
                    onChange={(val) => setFormData({ ...formData, mobile: val })}
                    required={false}
                  />
                </ModalFieldGrid>
              </ModalSection>
              <ModalSection title={translate("modalBatchFour.organizationLocation")}>
                <ModalFieldGrid>
                  <FormField
                    label={translate("adminPanelPage.form.city")}
                    value={formData.city || ""}
                    onChange={(val) => setFormData({ ...formData, city: val })}
                    required={false}
                  />
                  <FormField
                    label={translate("adminPanelPage.form.society")}
                    value={formData.society || ""}
                    onChange={(val) => setFormData({ ...formData, society: val })}
                    required={false}
                  />
                  <FormField
                    label={translate("adminPanelPage.form.department")}
                    value={formData.department || ""}
                    onChange={(val) =>
                      setFormData({ ...formData, department: val })
                    }
                    required={false}
                  />
                  <ModalFullWidth>
                    <FormField
                      label={translate("adminPanelPage.form.address")}
                      value={formData.address || ""}
                      onChange={(val) => setFormData({ ...formData, address: val })}
                      required={false}
                    />
                  </ModalFullWidth>
                </ModalFieldGrid>
              </ModalSection>
              <ModalSection title={translate("modalBatchFour.accountInformation")}>
                <ModalFieldGrid>
                  <SelectField
                    label={translate("adminPanelPage.form.role")}
                    options={userRolesData.map((role) => ({
                      label: role.name,
                      value: role.id,
                    }))}
                    value={formData.role_id || ""}
                    onChange={(val) => setFormData({ ...formData, role_id: val })}
                  />
                  <SelectField
                    label={translate("adminPanelPage.form.status")}
                    options={[
                      {
                        label: translate("adminPanelPage.memberStatuses.active"),
                        value: "active",
                      },
                      {
                        label: translate(
                          "adminPanelPage.memberStatuses.suspended",
                        ),
                        value: "suspended",
                      },
                    ]}
                    value={formData.status}
                    onChange={(val) => setFormData({ ...formData, status: val })}
                  />
                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <input
                      type="checkbox"
                      id={`${adminFieldId}-is_payment_validated`}
                      className="w-4 h-4 text-primary border-slate-300 rounded focus:ring-primary"
                      checked={formData.is_payment_validated || false}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          is_payment_validated: e.target.checked,
                        })
                      }
                    />
                    <label
                      htmlFor={`${adminFieldId}-is_payment_validated`}
                      className="text-xs font-bold text-slate-700 uppercase tracking-widest cursor-pointer"
                    >
                      {translate("adminPanelPage.form.paymentValidated")}
                    </label>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <input
                      type="checkbox"
                      id={`${adminFieldId}-is_superuser`}
                      className="w-4 h-4 text-primary border-slate-300 rounded focus:ring-primary"
                      checked={formData.is_superuser || false}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          is_superuser: e.target.checked,
                        })
                      }
                    />
                    <label
                      htmlFor={`${adminFieldId}-is_superuser`}
                      className="text-xs font-bold text-slate-700 uppercase tracking-widest cursor-pointer"
                    >
                      {translate("adminPanelPage.memberDetails.superuser")}
                    </label>
                  </div>
                </ModalFieldGrid>
              </ModalSection>
              <ModalSection title={translate("memberDirectory.profilePhoto")}>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    {translate("adminPanelPage.form.profilePhoto")}
                  </label>
                  <ModalMediaSplit preview={<>
                    {formData.avatar_url || formData.avatar ? (
                      <FilePreviewCard
                        presentation="compact"
                        file={formData.avatar}
                        url={formData.avatar_url}
                        name={
                          formData.avatar?.name ||
                          translate("adminPanelPage.form.profilePhoto")
                        }
                        subtitle={translate("adminPanelPage.form.profilePhoto")}
                        onRemove={
                          formData.avatar
                            ? () => setFormData({ ...formData, avatar: null })
                            : undefined
                        }

                      />
                    ) : (
                      <div className="batch-four-empty">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-bold text-slate-400 shadow-sm">
                          {(
                            formData.first_name?.[0] ||
                            formData.email?.[0] ||
                            "U"
                          ).toUpperCase()}
                        </div>
                      </div>
                    )}
                  </>}>
                    <FileUploadDropzone
                      presentation="compact"
                      inputId="admin-member-avatar"
                      accept="image/*"
                      multiple={false}
                      title={translate("adminPanelPage.form.profilePhoto")}
                      selectedLabel={
                        formData.avatar
                          ? formData.avatar.name
                          : formData.avatar_url
                            ? translate("memberDirectory.replaceProfilePhoto")
                            : undefined
                      }
                      hint="PNG, JPG, WEBP"
                      onFilesSelected={(files) =>
                        setFormData({
                          ...formData,
                          avatar: files[0] || null,
                        })
                      }
                    />
                  </ModalMediaSplit>
                </div>
              </ModalSection>
            </>
          )}
          {/* FORUM FORM */}
          {activeTab === "forums" && (
            <>
              <ModalFieldGrid>
                <FormField
                  label={translate("adminPanelPage.form.forumName")}
                  value={formData.name || ""}
                  onChange={(val) => setFormData({ ...formData, name: val })}
                />
                <FormField
                  label={translate("adminPanelPage.form.responsibleAuthor")}
                  value={formData.author_name || ""}
                  onChange={(val) =>
                    setFormData({ ...formData, author_name: val })
                  }
                  required={false}
                />
                <ModalFullWidth>
                  <div className="space-y-2">
                    <label id={`${adminFieldId}-forum-content`} className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      {translate("adminPanelPage.form.descriptionOptional")}
                    </label>
                    <TiptapEditor
                      ariaLabelledBy={`${adminFieldId}-forum-content`}
                      content={formData.description || ""}
                      onChange={(content) =>
                        setFormData({ ...formData, description: content })
                      }
                      placeholder={translate(
                        "adminPanelPage.placeholders.forumDescription",
                      )}
                      onImageUpload={handleImageUpload}
                    />
                  </div>
                </ModalFullWidth>
                <ModalFullWidth>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      {translate("articlesPage.thumbnailLabel")}
                    </label>
                    <ModalMediaSplit preview={<>
                      {formData.thumbnail_url || formData.thumbnail ? (
                        <FilePreviewCard
                          presentation="compact"
                          file={formData.thumbnail}
                          url={formData.thumbnail_url}
                          name={
                            formData.thumbnail?.name ||
                            getLastPathSegment(formData.thumbnail_url || "") ||
                            translate("forumsPage.forumThumbnail")
                          }
                          subtitle={
                            formData.thumbnail
                              ? null
                              : translate("forumsPage.openFile")
                          }
                          onRemove={
                            formData.thumbnail
                              ? () =>
                                setFormData({
                                  ...formData,
                                  thumbnail: null,
                                })
                              : undefined
                          }
                        />
                      ) : (
                        <div className="batch-four-empty">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-center text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 shadow-sm">
                            {translate("articlesPage.thumbnailLabel")}
                          </div>
                        </div>
                      )}
                    </>}>
                      <FileUploadDropzone
                        presentation="compact"
                        inputId="admin-forum-thumbnail"
                        accept="image/*"
                        multiple={false}
                        title={translate("forumsPage.uploadThumbnail")}
                        selectedLabel={
                          formData.thumbnail
                            ? formData.thumbnail.name
                            : formData.thumbnail_url
                              ? translate("forumsPage.replaceThumbnail")
                              : undefined
                        }
                        hint={translate("articlesPage.thumbnailHelp")}
                        onFilesSelected={(files) =>
                          setFormData({
                            ...formData,
                            thumbnail: files[0] || null,
                          })
                        }
                      />
                    </ModalMediaSplit>
                  </div>
                </ModalFullWidth>
              </ModalFieldGrid>
            </>
          )}
          {/* ARTICLE / TECHNICOPRO FORM */}
          {(activeTab === "articles" || activeTab === "technicopro") && (
            <>
              <ModalSection title={translate("modalBatchOne.basicInformation")}>
                <FormField
                  label={translate("adminPanelPage.form.articleTitle")}
                  value={formData.title || ""}
                  onChange={(val) => setFormData({ ...formData, title: val })}
                />
                <ModalFieldGrid>
                  <SelectField
                    label={translate("adminPanelPage.form.category")}
                    options={
                      (activeTab === "technicopro"
                        ? technicoproCategories
                        : articleCategories || []
                      ).map((c) => ({
                        label: c.name,
                        value: c.id,
                      }))
                    }
                    value={formData.category_id}
                    onChange={(val) =>
                      setFormData({ ...formData, category_id: val })
                    }
                  />
                </ModalFieldGrid>
                <FormField
                  label={translate("adminPanelPage.form.excerpt")}
                  value={formData.excerpt || ""}
                  onChange={(val) => setFormData({ ...formData, excerpt: val })}
                />
              </ModalSection>
              <ModalSection title={translate("adminPanelPage.form.contentRichText")}>
                <div className="space-y-2">
                  <label id={`${adminFieldId}-article-content`} className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    {translate("adminPanelPage.form.contentRichText")}
                  </label>
                  <TiptapEditor
                    ariaLabelledBy={`${adminFieldId}-article-content`}
                    content={formData.body || ""}
                    onChange={(content) =>
                      setFormData({ ...formData, body: content })
                    }
                    placeholder={translate(
                      "adminPanelPage.placeholders.articleContent",
                    )}
                    onImageUpload={handleImageUpload}
                  />
                </div>
              </ModalSection>
              <ModalSection title={translate("modalBatchOne.mediaAttachments")}>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    {translate("articlesPage.thumbnailLabel")}
                  </label>
                  <ModalMediaSplit preview={<>
                    {formData.thumbnail_url || formData.thumbnail ? (
                      <FilePreviewCard
                        presentation="compact"
                        file={formData.thumbnail}
                        url={formData.thumbnail_url}
                        name={
                          formData.thumbnail?.name ||
                          getLastPathSegment(formData.thumbnail_url || "") ||
                          translate("articlesPage.thumbnailLabel")
                        }
                        subtitle={
                          formData.thumbnail
                            ? null
                            : translate("articlesPage.viewDocument")
                        }
                        onRemove={
                          formData.thumbnail
                            ? () =>
                              setFormData({ ...formData, thumbnail: null })
                            : undefined
                        }
                      />
                    ) : (
                      <div className="batch-four-empty">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-center text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 shadow-sm">
                          {translate("articlesPage.thumbnailLabel")}
                        </div>
                      </div>
                    )}
                  </>}>
                    <FileUploadDropzone
                      presentation="compact"
                      inputId="admin-article-thumbnail"
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
                      onFilesSelected={(files) =>
                        setFormData({
                          ...formData,
                          thumbnail: files[0] || null,
                        })
                      }
                    />
                  </ModalMediaSplit>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    {translate("adminPanelPage.form.attachmentsArticle")}
                  </label>
                  {editingItem &&
                    formData.structured_fields?.file_urls?.length > 0 && (
                      <ModalFieldGrid>
                        {formData.structured_fields.file_urls.map(
                          (url: string, idx: number) => {
                            const isRemoved = removedFileUrls.includes(url);
                            const name = url.split("/").pop();
                            return (
                              <div
                                key={idx}
                                className={`${isRemoved ? "opacity-60" : ""}`}
                              >
                                <div
                                  className={`overflow-hidden rounded-2xl border transition-all ${isRemoved
                                      ? "border-red-100 bg-red-50"
                                      : "border-slate-200 bg-white"
                                    }`}
                                >
                                  <FilePreviewCard
                                    presentation="compact"
                                    url={url}
                                    href={url}
                                    name={name}
                                    subtitle={translate(
                                      "adminPanelPage.actions.viewFile",
                                    )}
                                  />
                                  <div className="flex items-center justify-end border-t border-slate-100 px-4 py-3">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if(isRemoved)
                                          setRemovedFileUrls(
                                            removedFileUrls.filter(
                                              (u) => u !== url,
                                            ),
                                          );
                                        else
                                          setRemovedFileUrls([
                                            ...removedFileUrls,
                                            url,
                                          ]);
                                      }}
                                      className={`rounded-full p-2 transition-all cursor-pointer ${isRemoved
                                          ? "bg-emerald-100 text-emerald-600"
                                          : "bg-red-100 text-red-600 hover:bg-red-200"
                                        }`}
                                      title={
                                        isRemoved
                                          ? translate(
                                            "adminPanelPage.actions.restoreFile",
                                          )
                                          : translate(
                                            "adminPanelPage.actions.removeFile",
                                          )
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
                          },
                        )}
                      </ModalFieldGrid>
                    )}
                  <FileDropzone
                    files={selectedFiles}
                    onFilesChange={setSelectedFiles}
                    inputId={
                      activeTab === "technicopro"
                        ? "admin-technicopro-attachments-upload"
                        : "admin-article-attachments-upload"
                    }
                    title={translate("articlesPage.uploadPrompt")}
                    hint={translate("articlesPage.uploadHelp")}
                    emptyLabel={translate("articlesPage.attachmentsOptional")}
                  />
                </div>
              </ModalSection>
            </>
          )}
          {/* EVENT FORM (AGENDA) */}
          {activeTab === "events" && (
            <>
              <ModalFieldGrid>
                <ModalFullWidth>
                  <FormField
                    label={translate("adminPanelPage.form.eventTitle")}
                    value={formData.title || ""}
                    onChange={(val) => setFormData({ ...formData, title: val })}
                  />
                </ModalFullWidth>
                <BeautifulDateTimePicker
                  label={translate("adminPanelPage.form.startDate")}
                  type="date"
                  value={formData.event_date || ""}
                  onChange={(val) =>
                    setFormData({ ...formData, event_date: val })
                  }
                  icon={<CalendarIcon className="w-4 h-4 text-primary" />}
                />
                <BeautifulDateTimePicker
                  label={translate("adminPanelPage.form.endDate")}
                  type="date"
                  value={formData.end_date || ""}
                  onChange={(val) =>
                    setFormData({ ...formData, end_date: val })
                  }
                  icon={<CalendarIcon className="w-4 h-4 text-primary" />}
                />
                <BeautifulDateTimePicker
                  label={translate("adminPanelPage.form.eventTime")}
                  type="time"
                  value={formData.event_time || ""}
                  onChange={(val) =>
                    setFormData({ ...formData, event_time: val })
                  }
                  icon={<Clock className="w-4 h-4 text-primary" />}
                />
                <SelectField
                  label={translate("adminPanelPage.form.eventType")}
                  options={eventCategories.map((category) => ({
                    label: category.name,
                    value: category.id,
                  }))}
                  value={formData.event_category_id || ""}
                  onChange={(val) =>
                    setFormData({ ...formData, event_category_id: val })
                  }
                />
                <FormField
                  label={translate("adminPanelPage.form.maxAttendees")}
                  type="number"
                  value={formData.max_attendees || 0}
                  onChange={(val) =>
                    setFormData({
                      ...formData,
                      max_attendees: Number.parseInt(val, 10) || 0,
                    })
                  }
                />
                <ModalFullWidth>
                  <div className="space-y-2">
                    <FormField
                      label={translate("adminPanelPage.form.location")}
                      value={formData.location || ""}
                      onChange={(val) =>
                        setFormData({ ...formData, location: val })
                      }
                    />
                  </div>
                </ModalFullWidth>
                <ModalFullWidth>
                  <div className="space-y-2">
                    <label id={`${adminFieldId}-event-content`} className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      {translate("adminPanelPage.form.description")}
                    </label>
                    <TiptapEditor
                      ariaLabelledBy={`${adminFieldId}-event-content`}
                      content={formData.description || ""}
                      onChange={(content) =>
                        setFormData({ ...formData, description: content })
                      }
                      onImageUpload={handleImageUpload}
                    />
                  </div>
                </ModalFullWidth>
                <ModalFullWidth>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      {translate("adminPanelPage.form.attachmentsTraining")}
                    </label>
                    {editingItem && formData.attachments?.length > 0 && (
                      <ModalFieldGrid>
                        {formData.attachments.map((url: string, idx: number) => {
                          const isRemoved = removedFileUrls.includes(url);
                          return (
                            <div
                              key={idx}
                              className={`${isRemoved ? "opacity-60" : ""}`}
                            >
                              <div
                                className={`overflow-hidden rounded-2xl border transition-all ${isRemoved
                                    ? "border-red-100 bg-red-50"
                                    : "border-slate-200 bg-white"
                                  }`}
                              >
                                <FilePreviewCard
                                  presentation="compact"
                                  url={url}
                                  href={url}
                                  name={getLastPathSegment(url)}
                                  subtitle={translate(
                                    "adminPanelPage.actions.viewFile",
                                  )}
                                />
                                <div className="flex items-center justify-end border-t border-slate-100 px-4 py-3">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if(isRemoved)
                                        setRemovedFileUrls(
                                          removedFileUrls.filter((u) => u !== url),
                                        );
                                      else
                                        setRemovedFileUrls([
                                          ...removedFileUrls,
                                          url,
                                        ]);
                                    }}
                                    className={`rounded-full p-2 transition-all cursor-pointer ${isRemoved
                                        ? "bg-emerald-100 text-emerald-600"
                                        : "bg-red-100 text-red-600 hover:bg-red-200"
                                      }`}
                                    title={
                                      isRemoved
                                        ? translate(
                                          "adminPanelPage.actions.restoreFile",
                                        )
                                        : translate(
                                          "adminPanelPage.actions.removeFile",
                                        )
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
                      </ModalFieldGrid>
                    )}
                    <FileDropzone
                      files={selectedFiles}
                      onFilesChange={setSelectedFiles}
                      inputId={`admin-event-attachments-${editingItem ? "edit" : "create"}`}
                      title={translate("agendaPage.addFiles")}
                      hint={
                        editingItem
                          ? translate("agendaPage.uploadNewFilesForThisEvent")
                          : translate("agendaPage.uploadFilesForThisEvent")
                      }
                      emptyLabel={translate("agendaPage.attachmentsPreview")}
                    />
                  </div>
                </ModalFullWidth>
                <ModalFullWidth>
                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <input
                      type="checkbox"
                      id={`${adminFieldId}-is_public`}
                      className="w-4 h-4 text-primary border-slate-300 rounded focus:ring-primary"
                      checked={formData.is_public || false}
                      onChange={(e) =>
                        setFormData({ ...formData, is_public: e.target.checked })
                      }
                    />
                    <label
                      htmlFor={`${adminFieldId}-is_public`}
                      className="text-xs font-bold text-slate-700 uppercase tracking-widest cursor-pointer"
                    >
                      {translate("adminPanelPage.form.publicEvent")}
                    </label>
                  </div>
                </ModalFullWidth>
              </ModalFieldGrid>
            </>
          )}
          {/* TRAINING FORM */}
          {activeTab === "trainings" && (
            <>
              <ModalSection title={translate("modalBatchOne.basicInformation")}>
                <ModalFieldGrid>
                  <ModalFullWidth>
                    <FormField
                      label={translate("adminPanelPage.form.trainingTitle")}
                      value={formData.title || ""}
                      onChange={(val) => setFormData({ ...formData, title: val })}
                    />
                  </ModalFullWidth>
                  <SelectField
                    label={translate("adminPanelPage.form.category")}
                    options={trainingCategories.map((category) => ({
                      label: category.name,
                      value: category.id,
                    }))}
                    value={formData.category_id || ""}
                    onChange={(val) =>
                      setFormData({ ...formData, category_id: val })
                    }
                  />
                  <SelectField
                    label={translate("adminPanelPage.form.statusOptional")}
                    options={[
                      {
                        label: translate("adminPanelPage.articleStatuses.draft"),
                        value: "draft",
                      },
                      {
                        label: translate(
                          "adminPanelPage.articleStatuses.published",
                        ),
                        value: "published",
                      },
                    ]}
                    value={formData.status || "draft"}
                    onChange={(val) => setFormData({ ...formData, status: val })}
                  />
                  <ModalFullWidth>
                    <FormField
                      label={translate("adminPanelPage.form.excerpt")}
                      value={formData.excerpt || ""}
                      onChange={(val) => setFormData({ ...formData, excerpt: val })}
                      required={false}
                    />
                  </ModalFullWidth>
                </ModalFieldGrid>
              </ModalSection>
              <ModalSection title={translate("modalBatchTwo.trainingContent")}>
                <div className="space-y-2">
                  <label id={`${adminFieldId}-training-content`} className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    {translate("adminPanelPage.form.contentRichText")}
                  </label>
                  <TiptapEditor
                    ariaLabelledBy={`${adminFieldId}-training-content`}
                    content={formData.description || ""}
                    onChange={(content) =>
                      setFormData({ ...formData, description: content })
                    }
                    placeholder={translate("adminPanelPage.form.description")}
                    onImageUpload={handleImageUpload}
                  />
                </div>
              </ModalSection>
              <ModalSection title={translate("modalBatchOne.mediaAttachments")}>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    {translate("articlesPage.thumbnailLabel")}
                  </label>
                  <ModalMediaSplit preview={<>
                    {formData.thumbnail_url || formData.thumbnail ? (
                      <FilePreviewCard
                        presentation="compact"
                        file={formData.thumbnail}
                        url={formData.thumbnail_url}
                        name={
                          formData.thumbnail?.name ||
                          getLastPathSegment(formData.thumbnail_url || "") ||
                          translate("trainingsPage.thumbnailLabel")
                        }
                        onRemove={
                          formData.thumbnail
                            ? () =>
                              setFormData({
                                ...formData,
                                thumbnail: null,
                              })
                            : undefined
                        }
                      />
                    ) : (
                      <div className="batch-four-empty">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-center text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 shadow-sm">
                          {translate("articlesPage.thumbnailLabel")}
                        </div>
                      </div>
                    )}
                  </>}>
                    <FileUploadDropzone
                      presentation="compact"
                      inputId="admin-training-thumbnail"
                      accept="image/*"
                      multiple={false}
                      title={translate("trainingsPage.uploadThumbnail")}
                      selectedLabel={
                        formData.thumbnail
                          ? formData.thumbnail.name
                          : formData.thumbnail_url
                            ? translate("trainingsPage.replaceThumbnail")
                            : undefined
                      }
                      hint="PNG, JPG, WEBP"
                      onFilesSelected={(files) =>
                        setFormData({
                          ...formData,
                          thumbnail: files[0] || null,
                        })
                      }
                    />
                  </ModalMediaSplit>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    {translate("adminPanelPage.form.attachmentsTraining")}
                  </label>
                  {editingItem && formData.attachments?.length > 0 && (
                    <ModalFieldGrid>
                      {formData.attachments.map((attachment: any, idx: number) => {
                        const url =
                          typeof attachment === "string"
                            ? attachment
                            : attachment.url || attachment.file_url || "";
                        const name =
                          typeof attachment === "string"
                            ? getLastPathSegment(attachment)
                            : attachment.original_name ||
                            attachment.file_name ||
                            getLastPathSegment(url);
                        const isRemoved = removedFileUrls.includes(url);
                        return (
                          <div
                            key={idx}
                            className={`${isRemoved ? "opacity-60" : ""}`}
                          >
                            <div
                              className={`overflow-hidden rounded-2xl border transition-all ${isRemoved
                                  ? "border-red-100 bg-red-50"
                                  : "border-slate-200 bg-white"
                                }`}
                            >
                              <FilePreviewCard
                                presentation="compact"
                                url={url}
                                href={url}
                                name={name}
                                subtitle={translate(
                                  "adminPanelPage.actions.viewFile",
                                )}
                              />
                              <div className="flex items-center justify-end border-t border-slate-100 px-4 py-3">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if(isRemoved)
                                      setRemovedFileUrls(
                                        removedFileUrls.filter((u) => u !== url),
                                      );
                                    else
                                      setRemovedFileUrls([
                                        ...removedFileUrls,
                                        url,
                                      ]);
                                  }}
                                  className={`rounded-full p-2 transition-all cursor-pointer ${isRemoved
                                      ? "bg-emerald-100 text-emerald-600"
                                      : "bg-red-100 text-red-600 hover:bg-red-200"
                                    }`}
                                  title={
                                    isRemoved
                                      ? translate(
                                        "adminPanelPage.actions.restoreFile",
                                      )
                                      : translate(
                                        "adminPanelPage.actions.removeFile",
                                      )
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
                    </ModalFieldGrid>
                  )}
                  <FileDropzone
                    files={selectedFiles}
                    onFilesChange={setSelectedFiles}
                    inputId="admin-training-attachments-upload"
                    title={translate("trainingsPage.clickOrDragDrop")}
                    hint={translate("trainingsPage.attachmentsHint")}
                    emptyLabel={translate("trainingsPage.attachmentsLabel")}
                  />
                </div>
              </ModalSection>
            </>
          )}

        </fieldset>
        </form>
      </Modal>
      <ConfirmModal presentation="compact"

        isOpen={isConfirmOpen && (activeTab !== "articles" || canModify(articlesData?.results.find((article) => article.id === deletingId), "delete"))}
        onClose={() => {
          if (
            !isDeletingForum &&
            !isDeletingUser &&
            !isArchivingUser &&
            !isRestoringUser &&
            !isDeletingArticle &&
            !isDeletingTechnicoPro &&
            !isDeletingEvent &&
            !isDeletingTraining
          ) {
            setIsConfirmOpen(false);
            setDeletingId(null);
            setMemberActionTarget(null);
            setMemberDeleteMode("archive");
          }
        }}
        onConfirm={handleDelete}
        title={
          activeTab === "members" && memberDeleteMode === "restore"
            ? translate("adminPanelPage.confirmRestoreTitle", {
                entity: getTabLabel(activeTab).toLowerCase(),
              })
            : activeTab === "members" && memberDeleteMode === "archive"
              ? translate("adminPanelPage.confirmArchiveTitle")
            : translate("adminPanelPage.confirmDeleteTitle", {
                entity: getTabLabel(activeTab).toLowerCase(),
              })
        }
        message={
          activeTab === "members" && memberDeleteMode === "restore"
            ? translate("adminPanelPage.confirmRestoreMessage", {
                entity:
                  memberActionTarget?.email ||
                  memberActionTarget?.first_name ||
                  getTabLabel(activeTab).toLowerCase(),
              })
            : activeTab === "members" && memberDeleteMode === "archive"
              ? translate("adminPanelPage.confirmArchiveMessage", {
                  entity:
                    memberActionTarget?.email ||
                    memberActionTarget?.first_name ||
                    getTabLabel(activeTab).toLowerCase(),
                })
            : translate("adminPanelPage.confirmDeleteMessage", {
                entity: getTabLabel(activeTab).toLowerCase(),
              })
        }
        isLoading={
          isDeletingForum ||
          isDeletingUser ||
          isArchivingUser ||
          isRestoringUser ||
          isDeletingArticle ||
          isDeletingTechnicoPro ||
          isDeletingEvent ||
          isDeletingTraining
        }
      />

      <ConfirmModal presentation="compact"

        isOpen={isModConfirmOpen}
        onClose={() => setIsModConfirmOpen(false)}
        onConfirm={() =>
          pendingModAction &&
          handleModerateAction(pendingModAction.id, "reject")
        }
        title={translate("adminPanelPage.confirmRejectionTitle")}
        message={translate("adminPanelPage.confirmRejectionMessage")}
        isLoading={isModerating}
      />

      <ConfirmModal presentation="compact"

        isOpen={isRoleDeleteConfirmOpen}
        onClose={() => {
          if (!isDeletingUserRole) {
            setIsRoleDeleteConfirmOpen(false);
            setRoleToDelete(null);
          }
        }}
        onConfirm={handleDeleteRole}
        title={translate("adminPanelPage.confirmDeleteTitle", {
          entity: getTabLabel("rolesPermissions").toLowerCase(),
        })}
        message={translate("adminPanelPage.confirmDeleteMessage", {
          entity:
            roleToDelete?.name || getTabLabel("rolesPermissions").toLowerCase(),
        })}
        isLoading={isDeletingUserRole}
      />

      <ConfirmModal presentation="compact"

        isOpen={Boolean(backupToDelete)}
        onClose={() => {
          if (!isDeletingBackup) {
            setBackupToDelete(null);
          }
        }}
        onConfirm={handleDeleteBackup}
        title={translate("adminPanelPage.confirmDeleteTitle", {
          entity: translate("adminPanelPage.backupFiles").toLowerCase(),
        })}
        message={translate("adminPanelPage.confirmDeleteMessage", {
          entity:
            backupToDelete?.filename || translate("adminPanelPage.backupFiles"),
        })}
        isLoading={isDeletingBackup}
      />

      <Modal
        className="batch-four-modal admin-details-drawer"
        layout="drawer"
        footer={isDetailsLoading ? undefined : isDetailsError ? (<div className="flex gap-3 pt-4">
          <button
            onClick={() => setIsDetailsOpen(false)}
            className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase hover:bg-slate-200 transition-all cursor-pointer"
          >
            {translate("adminPanelPage.close")}
          </button>
          <button
            onClick={handleRetryDetails}
            className="flex-1 py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase hover:bg-primary-dark shadow-xl shadow-primary/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            {translate("adminPanelPage.retryFetch")}
          </button>
        </div>) : viewingItem ? (<button
          onClick={() => setIsDetailsOpen(false)}
          className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase hover:bg-slate-800 transition-colors shadow-lg cursor-pointer"
        >
          {translate("adminPanelPage.close")}
        </button>) : undefined}
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        title={translate("adminPanelPage.detailsTitle", {
          entity: getTabLabel(activeTab),
        })}
      >
        {isDetailsLoading ? (
          <div className="space-y-4">
            <ModalFieldGrid>
              {[...Array(6)].map((_, i) => (
                <div key={i} className="animate-pulse space-y-2">
                  <div className="h-2 w-12 bg-slate-200 rounded" />
                  <div className="h-4 w-full bg-slate-200 rounded" />
                </div>
              ))}
            </ModalFieldGrid>
            <div className="h-24 w-full bg-slate-50 rounded-3xl animate-pulse" />
            <div className="h-14 w-full bg-slate-900/10 rounded-2xl animate-pulse" />
          </div>
        ) : isDetailsError ? (
          <div className="py-12 text-center space-y-4">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                {translate("adminPanelPage.detailsErrorTitle")}
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                {translate("adminPanelPage.detailsErrorMessage")}
              </p>
            </div>
          </div>
        ) : viewingItem ? (
          <div className="space-y-4 overflow-hidden text-left">
            {activeTab === "members" ? (
              <div className="space-y-4">
                <div className="flex flex-col gap-5 rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl bg-slate-900 text-xl font-black uppercase text-primary">
                      {detailsItem?.avatar_url ? (
                        <img
                          src={detailsItem.avatar_url}
                          alt={translate("adminPanelPage.avatarAlt")}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        detailsItem?.initials ||
                        `${detailsItem?.first_name?.[0] || ""}${detailsItem?.last_name?.[0] || ""}`.toUpperCase() ||
                        translate("adminPanelPage.fallbacks.userInitial")
                      )}
                    </div>
                    <div className="min-w-0 space-y-2">
                      <div>
                        <p className="break-words text-2xl font-black tracking-tight text-slate-900">
                          {`${detailsItem?.first_name || ""} ${detailsItem?.last_name || ""}`.trim() ||
                            translate("adminPanelPage.fallbacks.member")}
                        </p>
                        <p className="break-all text-sm font-medium text-slate-500">
                          {detailsItem?.email ||
                            translate("adminPanelPage.fallbacks.notAvailable")}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-700">
                          {getRoleLabel(
                            detailsItem?.role_details?.slug ||
                            detailsItem?.role,
                          )}
                        </span>
                        <span
                          className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${detailsItem?.status === "active"
                              ? "bg-emerald-100 text-emerald-700"
                              : detailsItem?.status === "suspended"
                                ? "bg-red-100 text-red-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                        >
                          {getMemberStatusLabel(detailsItem?.status)}
                        </span>
                        <span
                          className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${detailsItem?.is_superuser
                              ? "bg-slate-900 text-white"
                              : "bg-slate-200 text-slate-700"
                            }`}
                        >
                          {detailsItem?.is_superuser
                            ? translate(
                              "adminPanelPage.memberDetails.superuser",
                            )
                            : translate(
                              "adminPanelPage.memberDetails.standardUser",
                            )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <ModalFieldGrid>
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <h4 className="mb-4 text-xs font-black uppercase tracking-widest text-slate-400">
                      {translate(
                        "adminPanelPage.memberDetails.registryDetails",
                      )}
                    </h4>
                    <ModalFieldGrid>
                      <DetailField
                        label={translate("adminPanelPage.form.firstName")}
                        value={
                          detailsItem?.first_name ||
                          translate("adminPanelPage.fallbacks.notAvailable")
                        }
                      />
                      <DetailField
                        label={translate("adminPanelPage.form.lastName")}
                        value={
                          detailsItem?.last_name ||
                          translate("adminPanelPage.fallbacks.notAvailable")
                        }
                      />
                      <DetailField
                        label={translate("adminPanelPage.form.email")}
                        value={
                          detailsItem?.email ||
                          translate("adminPanelPage.fallbacks.notAvailable")
                        }
                      />
                      <DetailField
                        label={translate("adminPanelPage.form.role")}
                        value={getRoleLabel(
                          detailsItem?.role_details?.slug || detailsItem?.role,
                        )}
                      />
                      <DetailField
                        label={translate("adminPanelPage.form.status")}
                        value={getMemberStatusLabel(detailsItem?.status)}
                      />
                      <DetailField
                        label={translate(
                          "adminPanelPage.memberDetails.memberSince",
                        )}
                        value={formatLocalizedDate(detailsItem?.member_since)}
                      />
                      <DetailField
                        label={translate(
                          "adminPanelPage.memberDetails.membershipCategory",
                        )}
                        value={
                          detailsItem?.membership_category?.name ||
                          translate("adminPanelPage.fallbacks.notAvailable")
                        }
                      />
                      <DetailField
                        label={translate(
                          "adminPanelPage.memberDetails.createdAt",
                        )}
                        value={formatLocalizedDateTime(detailsItem?.created_at)}
                      />
                      <DetailField
                        label={translate(
                          "adminPanelPage.memberDetails.lastSeen",
                        )}
                        value={formatLocalizedDateTime(
                          detailsItem?.last_seen_at,
                        )}
                      />
                      <DetailField
                        label={translate(
                          "adminPanelPage.memberDetails.lastLogin",
                        )}
                        value={formatLocalizedDateTime(
                          detailsItem?.last_login_at,
                        )}
                      />
                    </ModalFieldGrid>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <h4 className="mb-4 text-xs font-black uppercase tracking-widest text-slate-400">
                      {translate(
                        "adminPanelPage.memberDetails.contactLocation",
                      )}
                    </h4>
                    <ModalFieldGrid>
                      <DetailField
                        label={translate("adminPanelPage.memberDetails.phone")}
                        value={
                          detailsItem?.phone ||
                          translate("adminPanelPage.fallbacks.notAvailable")
                        }
                      />
                      <DetailField
                        label={translate("adminPanelPage.memberDetails.mobile")}
                        value={
                          detailsItem?.mobile ||
                          translate("adminPanelPage.fallbacks.notAvailable")
                        }
                      />
                      <DetailField
                        label={translate("adminPanelPage.form.address")}
                        value={
                          detailsItem?.address ||
                          detailsItem?.street_address ||
                          translate("adminPanelPage.fallbacks.notAvailable")
                        }
                      />
                      <DetailField
                        label={translate("adminPanelPage.form.city")}
                        value={
                          detailsItem?.city ||
                          translate("adminPanelPage.fallbacks.notAvailable")
                        }
                      />
                      <DetailField
                        label={translate(
                          "adminPanelPage.memberDetails.postalCode",
                        )}
                        value={
                          detailsItem?.postal_code ||
                          translate("adminPanelPage.fallbacks.notAvailable")
                        }
                      />
                      <DetailField
                        label={translate(
                          "adminPanelPage.memberDetails.country",
                        )}
                        value={
                          detailsItem?.country ||
                          translate("adminPanelPage.fallbacks.notAvailable")
                        }
                      />
                      <DetailField
                        label={translate("adminPanelPage.form.society")}
                        value={
                          detailsItem?.society ||
                          translate("adminPanelPage.fallbacks.notAvailable")
                        }
                      />
                      <DetailField
                        label={translate("adminPanelPage.form.department")}
                        value={
                          detailsItem?.department ||
                          translate("adminPanelPage.fallbacks.notAvailable")
                        }
                      />
                    </ModalFieldGrid>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 shared-modal-full-width">
                    <h4 className="mb-4 text-xs font-black uppercase tracking-widest text-slate-400">
                      {translate("adminPanelPage.memberDetails.companyDetails")}
                    </h4>
                    <ModalFieldGrid>
                      <DetailField
                        label={translate(
                          "adminPanelPage.memberDetails.companyName",
                        )}
                        value={
                          detailsItem?.company_name ||
                          translate("adminPanelPage.fallbacks.notAvailable")
                        }
                      />
                      <DetailField
                        label={translate(
                          "adminPanelPage.memberDetails.companyRole",
                        )}
                        value={
                          detailsItem?.company_role ||
                          translate("adminPanelPage.fallbacks.notAvailable")
                        }
                      />
                      <DetailField
                        label={translate(
                          "adminPanelPage.memberDetails.companyWebsite",
                        )}
                        value={
                          detailsItem?.company_website ? (
                            <a
                              href={detailsItem.company_website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="break-all text-primary hover:underline"
                            >
                              {detailsItem.company_website}
                            </a>
                          ) : (
                            translate("adminPanelPage.fallbacks.notAvailable")
                          )
                        }
                      />
                      <DetailField
                        label={translate(
                          "adminPanelPage.memberDetails.companySiret",
                        )}
                        value={
                          detailsItem?.company_siret ||
                          translate("adminPanelPage.fallbacks.notAvailable")
                        }
                      />
                    </ModalFieldGrid>
                  </div>
                </ModalFieldGrid>
              </div>
            ) : (
              /* BASIC INFO GRID */
              <ModalFieldGrid>
                {Object.entries(viewingItem)
                  .filter(([key, value]) => {
                    const internalFields = [
                      "id",
                      "attachments",
                      "created_at",
                      "is_deleted",
                      "body",
                      "description",
                      "updated_at",
                      "password",
                    ];
                    if(internalFields.includes(key)) return false;
                    if(value === null || value === undefined || value === "")
                      return false;
                    if(
                      typeof value === "object" &&
                      !Array.isArray(value) &&
                      Object.keys(value).length === 0
                    )
                      return false;
                    return true;
                  })
                  .flatMap(([key, value]) => {
                    if(key === "structured_fields" && value) {
                      const fields =
                        typeof value === "string" ? JSON.parse(value) : value;
                      return Object.entries(fields)
                        .filter(
                          ([_, subVal]) =>
                            subVal !== null &&
                            subVal !== undefined &&
                            subVal !== "" &&
                            (Array.isArray(subVal) ? subVal.length > 0 : true),
                        )
                        .map(([subKey, subVal]) => {
                          let cleanSubKey = subKey;
                          if(subKey === "file_urls")
                            cleanSubKey = translate(
                              "adminPanelPage.mediaAssets",
                            );
                          return [cleanSubKey, subVal];
                        });
                    }
                    let cleanKey = key;
                    if(
                      key === "pdf_url" ||
                      key === "youtube_url" ||
                      key === "file_url"
                    )
                      cleanKey = translate("adminPanelPage.resourceLink");
                    return [[cleanKey, value]];
                  })
                  .map(([key, value]) => {
                    let displayKey = key.replace(/_/g, " ");
                    let displayValue: React.ReactNode = String(value);
                    if(
                      (key === "created_by" || key === "author") &&
                      typeof value === "object" &&
                      value !== null
                    ) {
                      displayKey =
                        key === "created_by"
                          ? translate("adminPanelPage.originator")
                          : translate("adminPanelPage.table.author");
                      displayValue =
                        `${(value as any).first_name || ""} ${(value as any).last_name || ""}`.trim() ||
                        (value as any).name ||
                        (value as any).email ||
                        translate("adminPanelPage.fallbacks.nexusAdmin");
                    } else if(
                      key === "category" &&
                      typeof value === "object" &&
                      value !== null
                    ) {
                      displayValue =
                        (value as any).name ||
                        translate("adminPanelPage.fallbacks.uncategorized");
                    } else if(key === "tags" && Array.isArray(value)) {
                      displayValue = (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {value.map((tag: string) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 bg-primary/10 text-primary-dark rounded text-[8px] font-black uppercase tracking-tighter"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      );
                    } else if(["status", "moderation_status"].includes(key) && isUndisplayedAdminStatus(String(value))) {
                      displayValue = translate("adminUi.neutralStatus");
                    } else if(typeof value === "boolean") {
                      displayValue = value
                        ? translate("adminPanelPage.yes")
                        : translate("adminPanelPage.no");
                    } else if(
                      typeof value === "string" &&
                      /^\d{4}-\d{2}-\d{2}/.test(value)
                    ) {
                      try {
                        displayValue = format(new Date(value), "PPP", {
                          locale: dateLocale,
                        });
                      } catch {
                        displayValue = value;
                      }
                    } else if(
                      Array.isArray(value) ||
                      (typeof value === "string" && value.includes("http"))
                    ) {
                      const urls = Array.isArray(value) ? value : [value];
                      displayValue = (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {urls.map((url, idx) => {
                            if(
                              typeof url !== "string" ||
                              !url.includes("http")
                            )
                              return null;
                            const isImage =
                              url.match(/\.(jpeg|jpg|gif|png)$/) != null;
                            const isVideo =
                              url.includes("youtube.com") ||
                              url.includes("vimeo.com") ||
                              url.match(/\.(mp4|webm)$/) != null;
                            return isImage ? (
                              <div
                                key={idx}
                                className="w-20 h-20 rounded-xl overflow-hidden border border-slate-200 group relative"
                              >
                                <img
                                  src={url}
                                  alt={translate(
                                    "adminPanelPage.fallbacks.asset",
                                  )}
                                  className="w-full h-full object-cover"
                                />
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                                >
                                  <Eye className="w-4 h-4 text-white" />
                                </a>
                              </div>
                            ) : (
                              <a
                                key={idx}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-xl hover:border-primary transition-all"
                              >
                                {isVideo ? (
                                  <PlayCircle className="w-4 h-4 text-emerald-500" />
                                ) : (
                                  <FileIcon className="w-4 h-4 text-blue-500" />
                                )}
                                <span className="text-[8px] font-black uppercase text-slate-400">
                                  {translate("adminPanelPage.openMediaType", {
                                    type: isVideo
                                      ? translate("adminPanelPage.video")
                                      : translate("adminPanelPage.document"),
                                  })}
                                </span>
                              </a>
                            );
                          })}
                        </div>
                      );
                    }
                    return (
                      <div key={key}>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          {displayKey}
                        </p>
                        <div className="text-sm font-bold text-slate-900 mt-1">
                          {displayValue}
                        </div>
                      </div>
                    );
                  })}
              </ModalFieldGrid>
            )}
            {/* FULL WIDTH TEXT BLOCKS */}
            {(detailsItem?.description || detailsItem?.body) && (
              <div className="space-y-4">
                {detailsItem?.description && (
                  <div className="bg-slate-50 p-4 rounded-3xl border border-slate-200">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      {translate("adminPanelPage.descriptionSummary")}
                    </p>
                    <p className="text-sm text-slate-700 leading-relaxed font-medium">
                      {detailsItem.description}
                    </p>
                  </div>
                )}
                {detailsItem?.body && (
                  <div className="bg-slate-50 p-4 rounded-3xl border border-slate-200">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      {translate("adminPanelPage.fullNarrativeContent")}
                    </p>
                    <div
                      className="text-sm text-slate-700 leading-relaxed font-medium prose prose-slate max-w-none"
                      dangerouslySetInnerHTML={{ __html: sanitizeRichContent(detailsItem.body) }}
                    />
                  </div>
                )}
              </div>
            )}
            {/* ATTACHMENTS */}
            {(activeTab === "forums" ||
              activeTab === "articles" ||
              activeTab === "technicopro" ||
              activeTab === "trainings" ||
              activeTab === "events") && (
                <div className="space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <Database className="w-4 h-4 text-primary" />
                    {translate("adminPanelPage.secureAttachmentsRepository")}
                  </h4>
                  {(() => {
                    const attachmentUrls =
                      activeTab === "articles" || activeTab === "technicopro"
                        ? detailsItem?.structured_fields?.file_urls || []
                        : detailsItem?.attachments || [];
                    return attachmentUrls.length > 0 ? (
                      <div className="flex flex-wrap gap-3">
                        {attachmentUrls.map((file: any) => {
                          const url =
                            typeof file === "string" ? file : file.url || "";
                          const name =
                            typeof file === "string"
                              ? getLastPathSegment(file)
                              : file.file_name ||
                              getLastPathSegment(file.url || "");
                          const isImage =
                            typeof file === "string"
                              ? isImageUrl(file)
                              : file.file_type?.includes("image");
                          const isVideo =
                            typeof file === "string"
                              ? /\.(mp4|webm)$/i.test(url)
                              : file.file_type?.includes("video") ||
                              file.url?.match(/\.(mp4|webm)$/) != null;
                          return isImage ? (
                            <div
                              key={url}
                              className="w-24 h-24 rounded-2xl overflow-hidden border border-slate-200 group relative shadow-sm"
                            >
                              <img
                                src={url}
                                alt={name}
                                className="w-full h-full object-cover"
                              />
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-white text-[8px] font-black uppercase"
                              >
                                <Eye className="w-5 h-5 mb-1" />
                                {translate("adminPanelPage.view")}
                              </a>
                            </div>
                          ) : (
                            <a
                              key={url}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex flex-col items-center justify-center w-24 h-24 bg-white border border-slate-200 rounded-2xl hover:border-primary hover:bg-slate-50 transition-all group shadow-sm text-center p-2"
                            >
                              {isVideo ? (
                                <PlayCircle className="w-6 h-6 text-emerald-500 mb-2" />
                              ) : (
                                <FileIcon className="w-6 h-6 text-blue-500 mb-2" />
                              )}
                              <p className="text-[8px] font-bold text-slate-900 truncate w-full px-1">
                                {name ||
                                  translate("adminPanelPage.fallbacks.asset")}
                              </p>
                              <span className="text-[6px] font-black uppercase text-slate-400 mt-1">
                                {isVideo
                                  ? translate("adminPanelPage.playMedia")
                                  : translate("adminPanelPage.download")}
                              </span>
                            </a>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-8 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                        <p className="text-[10px] text-slate-300 uppercase tracking-widest">
                          {translate("adminPanelPage.noActiveAttachments")}
                        </p>
                      </div>
                    );
                  })()}
                </div>
              )}
            {/* CLOSE BUTTON */}
          </div>
        ) : (
          <div className="py-20 text-center">
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest animate-pulse">
              {translate("adminPanelPage.initializingDataStream")}
            </p>
          </div>
        )}
      </Modal>
      <Modal layout="sectioned" className="batch-four-modal" isOpen={Boolean(permissionMember && canEditMembers)} closeDisabled={isSavingMemberPermission} onClose={() => { if (!isSavingMemberPermission) setPermissionMember(null); }} title={translate("adminPanelPage.memberPermissions.title")}>
        {permissionMember && canEditMembers ? <div className="space-y-4">
          <p className="break-words font-bold">{[permissionMember.first_name, permissionMember.last_name].filter(Boolean).join(" ") || permissionMember.email}</p>
          <AdminPermissionsEditor key={permissionMember.id} kind="member" targetId={permissionMember.id} canManage={canEditMembers} onBusyChange={setIsSavingMemberPermission} />
        </div> : null}
      </Modal>
    </div>
  );
}

// --- HELPER COMPONENTS ---

const Actions = ({
  onEdit,
  onDelete,
  onView,
  onPublish,
  onPermanentDelete,
  deleteLabel,
  deleteTitle,
  deleteVariant = "delete",
}: {
  onEdit: () => void;
  onDelete: () => void;
  onView: () => void;
  onPublish?: () => void;
  onPermanentDelete?: () => void;
  deleteLabel?: string;
  deleteTitle?: string;
  deleteVariant?: "archive" | "delete" | "restore";
}) => {
  const { translate } = useI18n();

  return (
    <span className="admin-actions flex max-w-full flex-wrap justify-end gap-1">
      <button
        onClick={onView}
        aria-label={translate("adminPanelPage.view")}
        title={translate("adminPanelPage.view")}
        className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-900 transition-colors cursor-pointer"
      >
        <Eye className="w-4 h-4" />
      </button>

      <button
        onClick={onEdit}
        aria-label={translate("adminPanelPage.edit")}
        title={translate("adminPanelPage.edit")}
        className="p-2 hover:bg-primary/20 rounded-lg text-slate-400 hover:text-slate-900 transition-colors cursor-pointer"
      >
        <Edit2 className="w-4 h-4" />
      </button>

      <button
        onClick={onDelete}
        title={deleteTitle || translate("adminPanelPage.delete")}
        className={`p-2 rounded-lg text-slate-400 transition-colors cursor-pointer ${
          deleteVariant === "restore"
            ? "hover:bg-emerald-50 hover:text-emerald-600"
            : deleteVariant === "archive"
              ? "hover:bg-amber-50 hover:text-amber-600"
            : "hover:bg-red-50 hover:text-red-600"
        }`}
      >
        {deleteVariant === "restore" ? (
          <RefreshCw className="w-4 h-4" />
        ) : deleteVariant === "archive" ? (
          <Archive className="w-4 h-4" />
        ) : (
          <Trash2 className="w-4 h-4" />
        )}
        <span className="sr-only">
          {deleteLabel ||
            (deleteVariant === "restore"
              ? translate("adminPanelPage.restore")
              : translate("adminPanelPage.delete"))}
        </span>
      </button>

      {onPermanentDelete && (
        <button
          onClick={onPermanentDelete}
          title={translate("adminPanelPage.permanentDelete")}
          className="p-2 rounded-lg text-slate-400 transition-colors cursor-pointer hover:bg-red-100 hover:text-red-700"
        >
          <Trash2 className="w-4 h-4" />
          <span className="sr-only">
            {translate("adminPanelPage.permanentDelete")}
          </span>
        </button>
      )}

      {onPublish && (
        <button
          onClick={onPublish}
          title={translate("adminPanelPage.publish")}
          className="p-2 hover:bg-emerald-50 rounded-lg text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer"
        >
          <Globe className="w-4 h-4" />
        </button>
      )}
    </span>
  );
};

const BeautifulDateTimePicker = ({
  label,
  value,
  onChange,
  type,
  icon,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  type: "date" | "time";
  icon: React.ReactNode;
}) => {
  const controlId = React.useId();
  const { dateLocale, translate } = useI18n();
  const [isOpen, setIsOpen] = React.useState(false);
  const [viewDate, setViewDate] = React.useState(new Date());
  const pickerRef = React.useRef<HTMLDivElement>(null);

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
      <div className="p-4 w-72 bg-white rounded-3xl shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
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
          {[
            translate("adminPanelPage.weekdays.su"),
            translate("adminPanelPage.weekdays.mo"),
            translate("adminPanelPage.weekdays.tu"),
            translate("adminPanelPage.weekdays.we"),
            translate("adminPanelPage.weekdays.th"),
            translate("adminPanelPage.weekdays.fr"),
            translate("adminPanelPage.weekdays.sa"),
          ].map((day) => (
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
            return (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(format(day, "yyyy-MM-dd"));
                  setIsOpen(false);
                }}
                className={`
                  h-8 w-8 rounded-xl text-[10px] font-bold transition-all cursor-pointer
                  ${isSelected ? "bg-primary text-slate-900 shadow-lg scale-110" : "hover:bg-slate-50 text-slate-600"}
                  ${!isCurrentMonth && !isSelected ? "opacity-20" : ""}
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
      <div className="p-4 w-64 bg-white rounded-3xl shadow-2xl border border-slate-100 flex gap-4 max-h-72 overflow-hidden">
        <div className="flex-1 overflow-y-auto pr-2 space-y-1 custom-scrollbar">
          <div className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-2 px-2">
            {translate("adminPanelPage.hour")}
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
            {translate("adminPanelPage.minute")}
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
      <label htmlFor={controlId} className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
        {label}
      </label>
      <button
        type="button"
        id={controlId}
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        className="relative group cursor-pointer block w-full text-left"
      >
        <span className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none group-hover:scale-110 transition-transform">
          {icon}
        </span>
        <span className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm transition-all hover:bg-white flex items-center min-h-[46px]">
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
              {translate("adminPanelPage.selectLabel", { label })}
            </span>
          )}
        </span>
        <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">
          <Plus className="w-3 h-3 rotate-45" />
        </span>
      </button>

      {isOpen && (
        <div className="absolute left-0 z-[100] mt-2 origin-top-left">
          {type === "date" ? renderCalendar() : renderTimePicker()}
        </div>
      )}
    </div>
  );
};

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
}) => {
  const controlId = React.useId();
  return (
    <div className="space-y-2">
      <label htmlFor={controlId} className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
        {label}
      </label>
      <input
        id={controlId}
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
};

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
  const controlId = React.useId();
  const { translate } = useI18n();

  return (
    <div className="space-y-2">
      <label htmlFor={controlId} className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
        {label}
      </label>
      <select
        id={controlId}
        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 outline-none font-bold text-sm uppercase tracking-widest cursor-pointer"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">
          {translate("adminPanelPage.selectLabel", { label })}
        </option>
        {value && !options.some((opt) => (typeof opt === "string" ? opt : opt.value) === value) ? <option value={value} disabled>{translate("adminUi.neutralStatus")}</option> : null}
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

const FileDropzone = ({
  files,
  onFilesChange,
  inputId = "admin-panel-attachments-upload",
  title,
  hint,
  emptyLabel,
}: {
  files: File[];
  onFilesChange: (files: File[]) => void;
  inputId?: string;
  title?: string;
  hint?: string;
  emptyLabel?: string;
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
          presentation="compact"
          inputId={inputId}
          title={title || translate("adminPanelPage.dropzone.clickOrDrag")}
          hint={hint || translate("adminPanelPage.dropzone.attachmentsHint")}
          selectedLabel={
            files.length
              ? translate("adminPanelPage.dropzone.filesSelected", {
                count: files.length,
              })
              : undefined
          }
          onFilesSelected={(newFiles) => onFilesChange([...files, ...newFiles])}
          preview={
            files.length ? (
              <SelectedFilesPreview
                presentation="compact"
                files={files}
                onRemove={removeFile}
              />
            ) : undefined
          }
        />
      </div>
    </div>
  );
};
