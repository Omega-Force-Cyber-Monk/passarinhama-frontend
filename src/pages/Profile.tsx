import React, { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import {
  User,
  Shield,
  Bell,
  CheckCircle2,
  Camera,
  Save,
  Lock,
  XCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  useGetUsersMeQuery,
  useUpdateUsersMeMutation,
  useUploadUserPhotoMutation,
} from "../redux/features/members/membersApi";
import { useResetPasswordMutation } from "../redux/features/auth/authApi";
import { setUser } from "../redux/features/auth/authSlice";
import {
  useGetNotificationPreferencesQuery,
  useUpdateNotificationPreferenceMutation,
} from "../redux/features/notifications/notificationsApi";
import { getNotificationLabelKey } from "../redux/features/notifications/notificationTypes";
import { useI18n } from "../i18n";
import type { AppDispatch } from "../redux/store";
import { getApiErrorDisplayMessage } from "../utils/apiErrorMessages";
import type { UpdateUsersMeRequest } from "../redux/features/members/membersTypes";

const SkeletonBar = ({ className }: { className: string }) => (
  <div className={`animate-pulse rounded-full bg-slate-100 ${className}`} />
);

const formatNotificationTypeFallback = (value: string) =>
  value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const ProfilePageSkeleton = () => (
  <div className="relative space-y-8 p-4 text-slate-900 sm:p-6 lg:p-8">
    <header className="space-y-4">
      <SkeletonBar className="h-10 w-40" />
      <SkeletonBar className="h-4 w-80" />
    </header>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div className="md:col-span-1 space-y-6">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center text-center animate-pulse">
          <div className="w-32 h-32 rounded-full bg-slate-100" />
          <SkeletonBar className="h-6 w-40 mt-4" />
          <SkeletonBar className="h-3 w-24 mt-2" />
          <div className="w-full mt-6 pt-6 border-t border-slate-50 space-y-3">
            <SkeletonBar className="h-3 w-32" />
            <SkeletonBar className="h-3 w-36" />
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <SkeletonBar className="h-6 w-44" />
          <SkeletonBar className="h-4 w-full" />
          <div className="space-y-3 pt-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-2xl animate-pulse"
              >
                <SkeletonBar className="h-3 w-32" />
                <div className="h-6 w-11 rounded-full bg-slate-100" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="md:col-span-2 space-y-6">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <SkeletonBar className="h-6 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <SkeletonBar className="h-3 w-24" />
                <div className="h-10 rounded-xl bg-slate-100 animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <div className="h-12 w-40 rounded-xl bg-slate-100 animate-pulse" />
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <SkeletonBar className="h-6 w-32" />
          <div className="space-y-4">
            <div className="space-y-2">
              <SkeletonBar className="h-3 w-32" />
              <div className="h-10 rounded-xl bg-slate-100 animate-pulse" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <SkeletonBar className="h-3 w-32" />
                  <div className="h-10 rounded-xl bg-slate-100 animate-pulse" />
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-2">
              <div className="h-10 w-40 rounded-xl bg-slate-100 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default function Profile() {
  const { translate } = useI18n();
  const dispatch = useDispatch<AppDispatch>();
  // API Hooks
  const { data: apiUser, isLoading: isLoadingUser } = useGetUsersMeQuery();
  const [updateProfile, { isLoading: isUpdating }] = useUpdateUsersMeMutation();
  const [resetPassword, { isLoading: isResettingPassword }] =
    useResetPasswordMutation();
  const [uploadPhoto, { isLoading: isUploadingPhoto }] =
    useUploadUserPhotoMutation();

  // Notification Preferences
  const { data: preferences, isLoading: isLoadingPrefs } =
    useGetNotificationPreferencesQuery();
  const [updatePreference] = useUpdateNotificationPreferenceMutation();

  const [formData, setFormData] = useState<UpdateUsersMeRequest>({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    mobile: "",
    city: "",
    society: "",
    department: "",
    address: "",
  });

  useEffect(() => {
    if (apiUser) {
      setFormData({
        first_name: apiUser.first_name || "",
        last_name: apiUser.last_name || "",
        email: apiUser.email || "",
        phone: apiUser.phone || "",
        mobile: apiUser.mobile || "",
        city: apiUser.city || "",
        society: apiUser.society || "",
        department: apiUser.department || "",
        address: apiUser.address || "",
      });
    }
  }, [apiUser]);

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const translateRole = (role?: string) => {
    if (role === "admin") return translate("profilePage.roleAdmin");
    if (role === "moderator") return translate("profilePage.roleModerator");
    if (role === "auditeur") return translate("profilePage.roleAuditeur");
    if (role === "partenaires_technicopro") {
      return translate("profilePage.rolePartners");
    }
    if (role === "comite_coproprietaire") {
      return translate("profilePage.roleCommittee");
    }
    return translate("profilePage.roleMember");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.first_name.trim()) {
      showToast(
        translate("common.requiredField", {
          field: translate("profilePage.firstName"),
        }),
        "error",
      );
      return;
    }

    if (!formData.last_name.trim()) {
      showToast(
        translate("common.requiredField", {
          field: translate("profilePage.lastName"),
        }),
        "error",
      );
      return;
    }

    if (!formData.email.trim()) {
      showToast(
        translate("common.requiredField", {
          field: translate("profilePage.emailAddress"),
        }),
        "error",
      );
      return;
    }

    try {
      const updatedUser = await updateProfile(formData).unwrap();
      dispatch(setUser(updatedUser));
      showToast(translate("profilePage.profileUpdated"), "success");
    } catch (err: any) {
      showToast(
        getApiErrorDisplayMessage(err, translate, "apiErrors.default"),
        "error",
      );
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !apiUser?.id) return;

    try {
      const updatedUser = await uploadPhoto({
        userId: apiUser.id,
        photo: file,
      }).unwrap();
      dispatch(setUser(updatedUser));
      showToast(translate("profilePage.photoUpdated"), "success");
    } catch (err: any) {
      showToast(
        getApiErrorDisplayMessage(err, translate, "apiErrors.default"),
        "error",
      );
    } finally {
      e.target.value = "";
    }
  };

  const handlePhotoClick = () => {
    document.getElementById("profile-photo-input")?.click();
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!passwordData.currentPassword.trim()) {
      showToast(
        translate("common.requiredField", {
          field: translate("profilePage.currentPassword"),
        }),
        "error",
      );
      return;
    }

    if (!passwordData.newPassword.trim()) {
      showToast(
        translate("common.requiredField", {
          field: translate("profilePage.newPassword"),
        }),
        "error",
      );
      return;
    }

    if (!passwordData.confirmPassword.trim()) {
      showToast(
        translate("common.requiredField", {
          field: translate("profilePage.confirmNewPassword"),
        }),
        "error",
      );
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showToast(translate("profilePage.passwordsDoNotMatch"), "error");
      return;
    }

    try {
      await resetPassword({
        old_password: passwordData.currentPassword,
        new_password: passwordData.newPassword,
      }).unwrap();

      showToast(translate("profilePage.passwordChanged"), "success");
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err: any) {
      showToast(
        getApiErrorDisplayMessage(err, translate, "apiErrors.default"),
        "error",
      );
    }
  };

  const handleTogglePreference = async (
    type: string,
    currentEnabled: boolean,
  ) => {
    try {
      await updatePreference({
        notification_type: type,
        email_enabled: !currentEnabled,
      }).unwrap();
      showToast(translate("profilePage.notificationUpdated"), "success");
    } catch (err) {
      showToast(
        getApiErrorDisplayMessage(err, translate, "apiErrors.default"),
        "error",
      );
    }
  };

  const getNotificationTypeLabel = (type: string) => {
    const translationKey = getNotificationLabelKey(type);

    if (!translationKey) {
      return formatNotificationTypeFallback(type);
    }

    return translate(translationKey);
  };

  if (isLoadingUser) {
    return <ProfilePageSkeleton />;
  }

  return (
    <div className="relative space-y-8 p-4 text-slate-900 sm:p-6 lg:p-8">
      {/* TOAST NOTIFICATION */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -20, x: "-50%" }}
            className={`fixed top-10 left-1/2 z-[100] flex min-w-[260px] max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold shadow-2xl sm:min-w-[300px] sm:px-6 ${
              toast.type === "success"
                ? "bg-emerald-600 text-white border-emerald-500"
                : "bg-red-600 text-white border-red-500"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <XCircle className="w-5 h-5" />
            )}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <header>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 underline decoration-primary decoration-4 underline-offset-8">
          {translate("profilePage.title")}
        </h2>
        <p className="text-slate-500 mt-6">
          {translate("profilePage.description")}
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-6">
          <div className="flex flex-col items-center rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
            <div className="relative group">
              <div className="w-32 h-32 rounded-full bg-primary flex items-center justify-center text-4xl font-extrabold text-slate-900 border-4 border-white shadow-xl overflow-hidden relative">
                {apiUser?.avatar_url ? (
                  <img
                    src={apiUser.avatar_url}
                    alt={translate("profilePage.profileAlt")}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  apiUser?.initials
                )}
                {isUploadingPhoto && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-6">
                    <div className="w-full h-full rounded-full bg-white/20 animate-pulse" />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={handlePhotoClick}
                disabled={isUploadingPhoto}
                className="absolute bottom-0 right-0 p-2 bg-slate-900 text-white rounded-full shadow-lg hover:scale-110 transition-transform disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input
                id="profile-photo-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </div>
            <h3 className="text-xl font-bold mt-4">
              {apiUser?.first_name} {apiUser?.last_name}
            </h3>
            <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-1">
              {translateRole(apiUser?.role)}
            </p>
            <div className="w-full mt-6 pt-6 border-t border-slate-50 space-y-3">
              <div className="flex items-center gap-3 text-xs text-slate-500 font-bold uppercase tracking-tighter text-left">
                <Shield className="w-3.5 h-3.5 text-primary" />{" "}
                {apiUser?.is_superuser
                  ? translate("profilePage.superuser")
                  : translate("profilePage.standardAccount")}
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 font-bold uppercase tracking-tighter text-left">
                <Shield className="w-3.5 h-3.5 text-primary" />{" "}
                {translate("profilePage.verifiedMember")}
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 font-bold uppercase tracking-tighter text-left">
                <Bell className="w-3.5 h-3.5 text-primary" />{" "}
                {translate("profilePage.activeNotifications")}
              </div>
            </div>
          </div>

          <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary-dark" />{" "}
              {translate("profilePage.emailNotifications")}
            </h3>
            <p className="text-slate-500 text-xs text-left leading-relaxed">
              {translate("profilePage.emailNotificationsDescription")}
            </p>

            <div className="space-y-3 pt-2">
              {isLoadingPrefs ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-2xl animate-pulse"
                    >
                      <SkeletonBar className="h-3 w-32" />
                      <div className="h-6 w-11 rounded-full bg-slate-100" />
                    </div>
                  ))}
                </div>
              ) : (
                preferences?.map((pref) => (
                  <div
                    key={pref.id}
                    className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-2xl group hover:border-primary/30 transition-all"
                  >
                    <div className="text-left">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {getNotificationTypeLabel(pref.notification_type)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        handleTogglePreference(
                          pref.notification_type,
                          pref.email_enabled,
                        )
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                        pref.email_enabled ? "bg-primary" : "bg-slate-200"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          pref.email_enabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <form noValidate onSubmit={handleSubmit} className="md:col-span-2 space-y-6">
          <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <User className="w-5 h-5 text-primary-dark" />{" "}
              {translate("profilePage.generalInformation")}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  {translate("profilePage.firstName")}
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                  value={formData.first_name}
                  onChange={(e) =>
                    setFormData({ ...formData, first_name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  {translate("profilePage.lastName")}
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                  value={formData.last_name}
                  onChange={(e) =>
                    setFormData({ ...formData, last_name: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                {translate("profilePage.emailAddress")}
              </label>
              <input
                type="email"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  {translate("profilePage.phone")}
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  {translate("profilePage.mobile")}
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                  value={formData.mobile}
                  onChange={(e) =>
                    setFormData({ ...formData, mobile: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                {translate("profilePage.address")}
              </label>
              <input
                type="text"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  {translate("profilePage.city")}
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                  value={formData.city}
                  onChange={(e) =>
                    setFormData({ ...formData, city: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  {translate("profilePage.society")}
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                  value={formData.society}
                  onChange={(e) =>
                    setFormData({ ...formData, society: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                {translate("profilePage.department")}
              </label>
              <input
                type="text"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                value={formData.department}
                onChange={(e) =>
                  setFormData({ ...formData, department: e.target.value })
                }
              />
            </div>
          </div>

          <div className="flex flex-col items-stretch justify-end gap-3 sm:flex-row sm:items-center">
            <button
              type="submit"
              disabled={isUpdating}
              className="flex items-center gap-2 px-8 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-xl uppercase tracking-widest disabled:bg-slate-400 disabled:cursor-not-allowed min-w-[160px] justify-center cursor-pointer"
            >
              {isUpdating ? (
                translate("profilePage.saveChanges")
              ) : (
                <>
                  <Save className="w-4 h-4" />{" "}
                  {translate("profilePage.saveChanges")}
                </>
              )}
            </button>
          </div>

          <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary-dark" />{" "}
              {translate("profilePage.security")}
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  {translate("profilePage.currentPassword")}
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    className="w-full px-4 pr-12 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                    value={passwordData.currentPassword}
                    onChange={(e) =>
                      setPasswordData({
                        ...passwordData,
                        currentPassword: e.target.value,
                      })
                    }
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                    {translate("profilePage.newPassword")}
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      className="w-full px-4 pr-12 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                      value={passwordData.newPassword}
                      onChange={(e) =>
                        setPasswordData({
                          ...passwordData,
                          newPassword: e.target.value,
                        })
                      }
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    >
                      {showNewPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                    {translate("profilePage.confirmNewPassword")}
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      className="w-full px-4 pr-12 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                      value={passwordData.confirmPassword}
                      onChange={(e) =>
                        setPasswordData({
                          ...passwordData,
                          confirmPassword: e.target.value,
                        })
                      }
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  disabled={isResettingPassword}
                  onClick={handlePasswordSubmit}
                  className="w-full rounded-xl bg-slate-100 px-6 py-2 text-xs font-bold uppercase tracking-widest text-slate-900 transition-all hover:bg-slate-200 disabled:opacity-50 cursor-pointer sm:w-auto"
                >
                  {isResettingPassword ? (
                    translate("profilePage.updatePassword")
                  ) : (
                    translate("profilePage.updatePassword")
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
