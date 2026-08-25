import React, { useEffect, useState } from "react";
import {
  Search,
  Filter,
  MapPin,
  Mail,
  Phone,
  Trash2,
  Edit2,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download,
  RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useSelector } from "react-redux";
import { RootState } from "../redux/store";
import { usePermissions } from "../hooks/usePermissions";
import Modal from "../components/ui/Modal";
import ConfirmModal from "../components/ui/ConfirmModal";
import {
  FilePreviewCard,
  FileUploadDropzone,
} from "../components/ui/FileUploadPreview";
import FeedbackToast, {
  type FeedbackToastState,
} from "../components/ui/FeedbackToast";
import { useI18n } from "../i18n";
import {
  useCreateUserMutation,
  useDeleteUserMutation,
  useExportUsersCsvMutation,
  useGetUserRolesQuery,
  useGetUsersQuery,
  useRestoreUserMutation,
  useUpdateUserMutation,
} from "../redux/features/members/membersApi";
import { ROLE_SLUGS } from "../redux/features/auth/authTypes";
import type {
  CreateUserRequest,
  UpdateUserRequest,
  User as ApiUser,
  UserRoleDetails,
} from "../redux/features/members/membersTypes";
import { getApiErrorDisplayMessage } from "../utils/apiErrorMessages";

const PAGE_SIZE = 21;

const roleLabelKeys: Record<string, string> = {
  [ROLE_SLUGS.ADMIN]: "memberDirectory.roleAdmin",
  [ROLE_SLUGS.MODERATOR]: "memberDirectory.roleModerator",
  [ROLE_SLUGS.MEMBER]: "memberDirectory.roleMember",
};

type MemberFormData = {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  phone: string;
  mobile: string;
  city: string;
  society: string;
  department: string;
  address: string;
  role_id: string;
  status: "active" | "pending" | "suspended";
  is_payment_validated: boolean;
  is_superuser: boolean;
  avatar: File | null;
};

const emptyMemberForm: MemberFormData = {
  first_name: "",
  last_name: "",
  email: "",
  password: "",
  phone: "",
  mobile: "",
  city: "",
  society: "",
  department: "",
  address: "",
  role_id: "",
  status: "active",
  is_payment_validated: true,
  is_superuser: false,
  avatar: null,
};

const formatRole = (
  role: string | null | undefined,
  translate: (key: string, params?: Record<string, string | number>) => string,
) => {
  if (!role) return translate("memberDirectory.roleMember");
  return roleLabelKeys[role] ? translate(roleLabelKeys[role]) : role.replace(/_/g, " ");
};

const formatStatus = (
  status: string | null | undefined,
  translate: (key: string, params?: Record<string, string | number>) => string,
) => {
  if (!status) return translate("memberDirectory.unknownStatus");

  const statusKey = `memberDirectory.${status}`;
  const translatedStatus = translate(statusKey);
  return translatedStatus === statusKey ? status.replace(/_/g, " ") : translatedStatus;
};

const getDisplayName = (
  member: ApiUser,
  translate: (key: string, params?: Record<string, string | number>) => string,
) => {
  const fullName = [member.first_name, member.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return fullName || member.email || translate("memberDirectory.unnamedMember");
};

const getInitials = (member: ApiUser) => {
  if (member.initials) return member.initials;

  const initials = [member.first_name, member.last_name]
    .map((part) => part?.[0])
    .filter(Boolean)
    .join("")
    .toUpperCase();

  return initials || member.email?.[0]?.toUpperCase() || "U";
};

const getStatusClassName = (status?: string | null) => {
  if (status === "active") return "bg-emerald-100 text-emerald-700";
  if (status === "pending") return "bg-amber-100 text-amber-700";
  if (status === "suspended") return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-600";
};

const MEMBER_SKELETON_COUNT = 6;
const MEMBER_STATUSES = ["active", "pending", "suspended"] as const;
type MemberStatus = (typeof MEMBER_STATUSES)[number];

const trimOrUndefined = (value: string) => {
  const trimmed = value.trim();
  return trimmed || undefined;
};

const isMemberStatus = (value: string): value is MemberStatus =>
  MEMBER_STATUSES.includes(value as MemberStatus);

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

const getRoleDisplayName = (
  role: UserRoleDetails,
  translate: (key: string, params?: Record<string, string | number>) => string,
) => {
  return roleLabelKeys[role.slug]
    ? translate(roleLabelKeys[role.slug])
    : role.name;
};

const buildFormData = (
  member?: ApiUser,
  defaultRoleId?: string,
): MemberFormData => {
  if (!member) {
    return {
      ...emptyMemberForm,
      role_id: defaultRoleId || "",
    };
  }

  return {
    first_name: member.first_name || "",
    last_name: member.last_name || "",
    email: member.email || "",
    password: "",
    phone: member.phone || "",
    mobile: member.mobile || "",
    city: member.city || "",
    society: member.society || "",
    department: member.department || "",
    address: member.address || "",
    role_id: member.role_details?.id || defaultRoleId || "",
    status: isMemberStatus(member.status || "")
      ? (member.status as MemberStatus)
      : "active",
    is_payment_validated: member.is_payment_validated,
    is_superuser: member.is_superuser,
    avatar: null,
  };
};

export default function MemberDirectory() {
  const { user } = useSelector((state: RootState) => state.auth);
  const { translate } = useI18n();
  const { hasPermission } = usePermissions();
  const canViewUsers = hasPermission("user", "view");
  const canCreateUser = hasPermission("user", "create");
  const canEditUser = hasPermission("user", "edit");
  const canDeleteUser = hasPermission("user", "delete");
  const showMemberActions = canEditUser || canDeleteUser;

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [memberActionTarget, setMemberActionTarget] = useState<ApiUser | null>(null);
  const [editingMember, setEditingMember] = useState<ApiUser | null>(null);
  const [formData, setFormData] = useState<MemberFormData>(emptyMemberForm);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<FeedbackToastState | null>(null);

  const {
    data: usersData,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useGetUsersQuery({
    archived: false,
    page,
    pageSize: PAGE_SIZE,
    search: search.trim() || undefined,
    role_id: roleFilter !== "all" ? roleFilter : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });
  const { data: userRoles = [] } = useGetUserRolesQuery();

  const [createUser, { isLoading: isCreatingMember }] = useCreateUserMutation();
  const [updateUser, { isLoading: isUpdatingMember }] = useUpdateUserMutation();
  const [deleteUser, { isLoading: isDeletingMember }] = useDeleteUserMutation();
  const [restoreUser, { isLoading: isRestoringMember }] = useRestoreUserMutation();
  const [exportUsersCsv, { isLoading: isExportingUsers }] =
    useExportUsersCsvMutation();

  const defaultMemberRoleId =
    userRoles.find((role) => role.slug === ROLE_SLUGS.MEMBER)?.id || userRoles[0]?.id || "";

  useEffect(() => {
    if (!isModalOpen || editingMember || formData.role_id || !defaultMemberRoleId) return;

    setFormData((current) => ({
      ...current,
      role_id: defaultMemberRoleId,
    }));
  }, [defaultMemberRoleId, editingMember, formData.role_id, isModalOpen]);

  useEffect(() => {
    if (formData.avatar) {
      const objectUrl = URL.createObjectURL(formData.avatar);
      setAvatarPreviewUrl(objectUrl);

      return () => {
        URL.revokeObjectURL(objectUrl);
      };
    }

    setAvatarPreviewUrl(editingMember?.avatar_url || null);
  }, [editingMember?.avatar_url, formData.avatar]);

  const members = usersData?.results || [];
  const totalMembers = usersData?.total || members.length;
  const totalPages = usersData
    ? Math.max(
        1,
        usersData.total_pages ||
          Math.ceil(usersData.total / (usersData.page_size || PAGE_SIZE)),
      )
    : 1;
  const isSaving = isCreatingMember || isUpdatingMember;

  const notify = (
    message: string,
    type: FeedbackToastState["type"] = "success",
  ) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const notifyRequiredField = (fieldLabel: string) => {
    notify(
      translate("common.requiredField", {
        field: fieldLabel,
      }),
      "error",
    );
  };

  const handleOpenModal = (member?: ApiUser) => {
    if ((member && !canEditUser) || (!member && !canCreateUser)) return;
    setEditingMember(member || null);
    setFormData(buildFormData(member, defaultMemberRoleId));
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if ((editingMember && !canEditUser) || (!editingMember && !canCreateUser)) {
      notify(translate("memberDirectory.loadError"), "error");
      return;
    }

    if (!formData.first_name.trim()) {
      notifyRequiredField(translate("memberDirectory.firstName"));
      return;
    }

    if (!formData.last_name.trim()) {
      notifyRequiredField(translate("memberDirectory.lastName"));
      return;
    }

    if (!formData.email.trim()) {
      notifyRequiredField(translate("memberDirectory.email"));
      return;
    }

    if (!editingMember && !formData.password.trim()) {
      notifyRequiredField(translate("memberDirectory.password"));
      return;
    }

    if (!formData.role_id) {
      notifyRequiredField(translate("memberDirectory.role"));
      return;
    }

    if (!editingMember && formData.password.trim().length < 8) {
      notify(translate("memberDirectory.passwordMinError"), "error");
      return;
    }

    try {
      if (editingMember) {
        const body: UpdateUserRequest = {
          first_name: trimOrUndefined(formData.first_name),
          last_name: trimOrUndefined(formData.last_name),
          phone: trimOrUndefined(formData.phone),
          mobile: trimOrUndefined(formData.mobile),
          city: trimOrUndefined(formData.city),
          society: trimOrUndefined(formData.society),
          department: trimOrUndefined(formData.department),
          address: trimOrUndefined(formData.address),
          role_id: formData.role_id || undefined,
          status: formData.status,
          payment_validated: formData.is_payment_validated,
          is_payment_validated: formData.is_payment_validated,
          is_superuser: formData.is_superuser,
          avatar: formData.avatar,
        };

        await updateUser({ id: editingMember.id, body }).unwrap();
      } else {
        const body: CreateUserRequest &
          Pick<UpdateUserRequest, "city"> =
          {
            email: formData.email.trim(),
            password: formData.password,
            first_name: trimOrUndefined(formData.first_name),
            last_name: trimOrUndefined(formData.last_name),
            phone: trimOrUndefined(formData.phone),
            mobile: trimOrUndefined(formData.mobile),
            city: trimOrUndefined(formData.city),
            society: trimOrUndefined(formData.society),
            department: trimOrUndefined(formData.department),
            address: trimOrUndefined(formData.address),
            role_id: formData.role_id,
            status: formData.status,
            payment_validated: formData.is_payment_validated,
            is_superuser: formData.is_superuser,
            avatar: formData.avatar,
          };

        await createUser(body).unwrap();
      }

      setIsModalOpen(false);
      setEditingMember(null);
      setFormData({ ...emptyMemberForm, role_id: defaultMemberRoleId });
      notify(
        editingMember
          ? translate("memberDirectory.memberUpdated")
          : translate("memberDirectory.memberCreated"),
      );
    } catch (err) {
      notify(getApiErrorDisplayMessage(err, translate), "error");
    }
  };

  const confirmMemberAction = (member: ApiUser) => {
    if (!canDeleteUser) return;
    setMemberActionTarget(member);
    setIsConfirmOpen(true);
  };

  const handleMemberAction = async () => {
    if (!memberActionTarget) return;

    try {
      if (memberActionTarget.status === "suspended") {
        await restoreUser(memberActionTarget.id).unwrap();
        notify(translate("memberDirectory.memberRestored"));
      } else {
        await deleteUser(memberActionTarget.id).unwrap();
        notify(translate("memberDirectory.memberDeleted"));
      }

      setMemberActionTarget(null);
      setIsConfirmOpen(false);
    } catch (err) {
      notify(getApiErrorDisplayMessage(err, translate), "error");
    }
  };

  const handleExportUsers = async () => {
    if (!canViewUsers) return;

    try {
      const response = await exportUsersCsv().unwrap();
      downloadFile(response.file, response.filename);
      notify(translate("memberDirectory.membersExported"));
    } catch (err) {
      notify(getApiErrorDisplayMessage(err, translate), "error");
    }
  };

  return (
    <div className="p-8 space-y-8">
      <FeedbackToast toast={toast} />

      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 underline decoration-primary decoration-4 underline-offset-8">
            {translate("memberDirectory.title")}
          </h2>
        </div>
        {(canCreateUser || canViewUsers) && (
          <div className="flex flex-col sm:flex-row gap-3">
            {canViewUsers && (
              <button
                onClick={handleExportUsers}
                disabled={isExportingUsers}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-white text-slate-900 border border-slate-200 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all shadow-sm active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer "
              >
                {isExportingUsers ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Download className="w-5 h-5" />
                )}
                {translate("memberDirectory.exportCsv")}
              </button>
            )}
            {canCreateUser && (
              <button
                onClick={() => handleOpenModal()}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-lg active:scale-95 cursor-pointer "
              >
                <UserPlus className="w-5 h-5" />
                {translate("memberDirectory.addMember")}
              </button>
            )}
          </div>
        )}
      </header>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder={translate("memberDirectory.searchPlaceholder")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
          />
        </div>
        <div className="grid w-full grid-cols-2 gap-2 md:flex md:w-auto">
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-sm font-medium cursor-pointer md:w-auto"
          >
            <option value="all" className="cursor-pointer ">{translate("memberDirectory.allRoles")}</option>
            {userRoles.map((role) => (
              <option key={role.id} value={role.id} className="cursor-pointer">
                {getRoleDisplayName(role, translate)}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-full cursor-pointer px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-sm font-medium md:w-auto"
          >
            <option className="cursor-pointer " value="all">{translate("memberDirectory.allStatuses")}</option>
            <option className="cursor-pointer " value="active">{translate("memberDirectory.active")}</option>
            <option className="cursor-pointer " value="pending">{translate("memberDirectory.pending")}</option>
            <option className="cursor-pointer " value="suspended">{translate("memberDirectory.suspended")}</option>
          </select>
        </div>
      </div>

      {isError && (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-red-200">
          <AlertCircle className="w-10 h-10 mx-auto text-red-500 mb-3" />
          <p className="text-slate-600 font-medium">{translate("memberDirectory.loadError")}</p>
          <button
            onClick={() => refetch()}
            className="mt-4 px-5 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {translate("memberDirectory.retry")}
          </button>
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: MEMBER_SKELETON_COUNT }).map((_, index) => (
            <div
              key={index}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-pulse"
            >
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-2xl bg-slate-200 shrink-0" />
                <div className="flex-1 min-w-0 space-y-3">
                  <div className="h-5 w-3/5 rounded bg-slate-200" />
                  <div className="h-4 w-2/5 rounded bg-slate-100" />
                  <div className="flex flex-wrap gap-2 pt-1">
                    <div className="h-5 w-20 rounded bg-slate-200" />
                    <div className="h-5 w-16 rounded bg-slate-100" />
                    <div className="h-5 w-24 rounded bg-slate-100" />
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <div className="h-4 w-4/5 rounded bg-slate-100" />
                <div className="h-4 w-2/3 rounded bg-slate-100" />
              </div>

              {showMemberActions && (
                <div className="mt-6 pt-6 border-t border-slate-100 flex gap-2">
                  <div className="h-9 flex-1 rounded-lg bg-slate-100" />
                  <div className="h-9 flex-1 rounded-lg bg-slate-100" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!isLoading && !isError && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {members.map((member) => {
                const category =
                  member.membership_category?.name || formatRole(member.role, translate);
                const city =
                  member.city || member.country || translate("memberDirectory.locationNotSet");
                const phone =
                  member.phone || member.mobile || translate("memberDirectory.noPhoneProvided");

                return (
                  <motion.div
                    layout
                    key={member.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group relative overflow-hidden"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-xl font-bold text-slate-900 border-2 border-white shadow-sm ring-1 ring-slate-100 overflow-hidden">
                        {member.avatar_url ? (
                          <img
                            src={member.avatar_url}
                            alt={getDisplayName(member, translate)}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          getInitials(member)
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold group-hover:text-primary-dark transition-colors truncate">
                          {getDisplayName(member, translate)}
                        </h3>
                        <p className="text-slate-500 text-sm flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{city}</span>
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700">
                            {category}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${getStatusClassName(member.status)}`}
                          >
                            {formatStatus(member.status, translate)}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              member.is_payment_validated
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {member.is_payment_validated
                              ? translate("memberDirectory.paymentOk")
                              : translate("memberDirectory.paymentPending")}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 space-y-3">
                      <div className="flex items-center gap-3 text-sm text-slate-600">
                        <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="truncate">{member.email}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-slate-600">
                        <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="truncate">{phone}</span>
                      </div>
                    </div>

                    {showMemberActions && (
                      <div className="mt-6 pt-6 border-t border-slate-100 flex gap-2">
                        {canEditUser && (
                          <button
                            onClick={() => handleOpenModal(member)}
                            className="flex-1 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Edit2 className="w-3 h-3" />
                            {translate("memberDirectory.edit")}
                          </button>
                        )}
                        {canDeleteUser && (
                          <button
                            onClick={() => confirmMemberAction(member)}
                            className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                              member.status === "suspended"
                                ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-600"
                                : "bg-red-50 hover:bg-red-100 text-red-600"
                            }`}
                          >
                            {member.status === "suspended" ? (
                              <RefreshCw className="w-3 h-3" />
                            ) : (
                              <Trash2 className="w-3 h-3" />
                            )}
                            {member.status === "suspended"
                              ? translate("memberDirectory.restore")
                              : translate("memberDirectory.delete")}
                          </button>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {members.length === 0 && (
            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
              <p className="text-slate-500">{translate("memberDirectory.empty")}</p>
            </div>
          )}
        </>
      )}

      <footer className="flex items-center justify-between border-t border-slate-100 pt-6">
        <p className="text-sm text-slate-500">
          {translate("memberDirectory.showingMembers", {
            count: members.length,
            total: totalMembers,
          })}
          {isFetching && !isLoading ? translate("memberDirectory.refreshing") : ""}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() =>
              setPage((currentPage) => Math.max(1, currentPage - 1))
            }
            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-30 cursor-pointer"
            disabled={page <= 1 || isFetching}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => setPage((currentPage) => currentPage + 1)}
            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-30 cursor-pointer"
            disabled={page >= totalPages || isFetching}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </footer>

      {(canCreateUser || canEditUser) && (
        <>
          <Modal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            maxWidth="max-w-4xl"
            title={
              editingMember
                ? translate("memberDirectory.editMember")
                : translate("memberDirectory.createMember")
            }
          >
            <form noValidate onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {translate("memberDirectory.firstName")}
                  </label>
                  <input
                    required
                    type="text"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                    value={formData.first_name}
                    onChange={(e) =>
                      setFormData({ ...formData, first_name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {translate("memberDirectory.lastName")}
                  </label>
                  <input
                    required
                    type="text"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                    value={formData.last_name}
                    onChange={(e) =>
                      setFormData({ ...formData, last_name: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {translate("memberDirectory.email")}
                </label>
                <input
                  required
                  type="email"
                  disabled={Boolean(editingMember)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none disabled:bg-slate-100 disabled:text-slate-500"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
              </div>
              {!editingMember && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {translate("memberDirectory.password")}
                  </label>
                  <input
                    required
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {translate("memberDirectory.phone")}
                  </label>
                  <input
                    type="tel"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {translate("memberDirectory.mobile")}
                  </label>
                  <input
                    type="tel"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                    value={formData.mobile}
                    onChange={(e) =>
                      setFormData({ ...formData, mobile: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {translate("memberDirectory.city")}
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  value={formData.city}
                  onChange={(e) =>
                    setFormData({ ...formData, city: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {translate("memberDirectory.society")}
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                    value={formData.society}
                    onChange={(e) =>
                      setFormData({ ...formData, society: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {translate("memberDirectory.department")}
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                    value={formData.department}
                    onChange={(e) =>
                      setFormData({ ...formData, department: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {translate("memberDirectory.address")}
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {translate("memberDirectory.profilePhoto")}
                </label>
                <div className="grid items-stretch gap-4 md:grid-cols-[minmax(0,1.35fr)_280px]">
                  <FileUploadDropzone
                    inputId="member-avatar-upload"
                    accept="image/*"
                    multiple={false}
                    title={translate("memberDirectory.uploadProfilePhoto")}
                    className="h-full md:min-h-[336px]"
                    selectedLabel={
                      formData.avatar
                        ? formData.avatar.name
                        : editingMember?.avatar_url
                          ? translate("memberDirectory.replaceProfilePhoto")
                          : undefined
                    }
                    hint={
                      formData.avatar
                        ? translate("memberDirectory.profilePhotoSelectedHint")
                        : editingMember?.avatar_url
                          ? translate("memberDirectory.profilePhotoExistingHint")
                          : translate("memberDirectory.profilePhotoUploadHint")
                    }
                    onFilesSelected={(files) =>
                      setFormData({
                        ...formData,
                        avatar: files[0] || null,
                      })
                    }
                  />
                  <div className="flex h-full w-full max-w-[280px] justify-self-center md:max-w-none md:justify-self-auto">
                    {avatarPreviewUrl ? (
                      <FilePreviewCard
                        file={formData.avatar}
                        url={!formData.avatar ? avatarPreviewUrl : undefined}
                        name={
                          formData.avatar?.name ||
                          translate("memberDirectory.profilePhoto")
                        }
                        subtitle={translate("memberDirectory.profilePhotoPreview")}
                        className="h-full w-full"
                        onRemove={
                          formData.avatar
                            ? () => setFormData({ ...formData, avatar: null })
                            : undefined
                        }
                        aspectClassName="aspect-square"
                        mediaShapeClassName="rounded-full"
                      />
                    ) : (
                      <div className="flex h-full min-h-[336px] w-full items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6">
                        <div className="flex h-28 w-28 items-center justify-center rounded-full bg-white text-3xl font-bold text-slate-400 shadow-sm">
                          {(formData.first_name?.[0] || formData.email?.[0] || "U").toUpperCase()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {translate("memberDirectory.role")}
                  </label>
                  <select
                    required
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                    value={formData.role_id}
                    onChange={(e) =>
                      setFormData({ ...formData, role_id: e.target.value })
                    }
                  >
                    {userRoles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {getRoleDisplayName(role, translate)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {translate("memberDirectory.status")}
                  </label>
                  <select
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        status: isMemberStatus(e.target.value)
                          ? e.target.value
                          : "active",
                      })
                    }
                  >
                    {MEMBER_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {translate(`memberDirectory.${status}`)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-600">
                <input
                  type="checkbox"
                  checked={formData.is_payment_validated}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      is_payment_validated: e.target.checked,
                    })
                  }
                  className="w-4 h-4 accent-slate-900"
                />
                {translate("memberDirectory.paymentValidated")}
              </label>
              <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-600">
                <input
                  type="checkbox"
                  checked={formData.is_superuser}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      is_superuser: e.target.checked,
                    })
                  }
                  className="w-4 h-4 accent-slate-900"
                />
                    {translate("memberDirectory.superuser")}
              </label>
              <button
                type="submit"
                disabled={isSaving}
                className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all mt-6 shadow-xl uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingMember
                  ? translate("memberDirectory.saveChanges")
                  : translate("memberDirectory.createMemberSubmit")}
              </button>
            </form>
          </Modal>

          <ConfirmModal
            isOpen={isConfirmOpen}
            onClose={() => {
              if (!isDeletingMember && !isRestoringMember) {
                setIsConfirmOpen(false);
                setMemberActionTarget(null);
              }
            }}
            onConfirm={handleMemberAction}
            title={
              memberActionTarget?.status === "suspended"
                ? translate("memberDirectory.restoreMemberTitle")
                : translate("memberDirectory.deleteMemberTitle")
            }
            message={
              memberActionTarget?.status === "suspended"
                ? translate("memberDirectory.restoreMemberMessage")
                : translate("memberDirectory.deleteMemberMessage")
            }
            isLoading={isDeletingMember || isRestoringMember}
          />
        </>
      )}
    </div>
  );
}
