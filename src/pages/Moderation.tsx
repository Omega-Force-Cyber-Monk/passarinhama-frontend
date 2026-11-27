import { sanitizeRichContent } from "../utils/richContent";
import React, { useState } from "react";
import {
  ShieldCheck,
  XCircle,
  CheckCircle2,
  AlertCircle,
  // Eye,
  MessageSquare,
  History,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useSelector } from "react-redux";
import { RootState } from "../redux/store";
import { Navigate } from "react-router-dom";
import { useAppToast } from "../components/ui/AppToastProvider";
import ConfirmModal from "../components/ui/ConfirmModal";
import { useI18n } from "../i18n";
import { usePermissions } from "../hooks/usePermissions";
import {
  useGetModerationQueueQuery,
  useGetModerationLogsQuery,
  useModeratePostMutation,
} from "../redux/features/moderation/moderationApi";
import { getApiErrorDisplayMessage } from "../utils/apiErrorMessages";

export default function Moderation() {
  const MODERATION_QUEUE_PAGE_SIZE = 20;
  const MODERATION_LOGS_PAGE_SIZE = 20;
  const toast = useAppToast();
  const { user } = useSelector((state: RootState) => state.auth);
  const { localeCode, translate } = useI18n();
  const { canAccessModeration } = usePermissions();
  const [modSubTab, setModSubTab] = useState<"queue" | "logs">("queue");
  const [queuePage, setQueuePage] = useState(1);
  const [logsPage, setLogsPage] = useState(1);

  const {
    data: queueData,
    isLoading,
    isFetching,
    isError,
  } = useGetModerationQueueQuery({
    page: queuePage,
    pageSize: MODERATION_QUEUE_PAGE_SIZE,
  });
  const {
    data: logsData,
    isLoading: isLoadingLogs,
    isFetching: isFetchingLogs,
    isError: isLogsError,
  } = useGetModerationLogsQuery({
    page: logsPage,
    pageSize: MODERATION_LOGS_PAGE_SIZE,
  });
  const [moderatePost] = useModeratePostMutation();

  // Authorizations: Admin or Moderator
  const isAuthorized = canAccessModeration;


  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    id: string;
    type: "approve" | "reject";
  } | null>(null);

  const items = queueData?.results || [];
  const logs = logsData?.results || [];
  const totalQueuePages = queueData
    ? Math.max(
        1,
        queueData.total_pages ||
          Math.ceil(
            queueData.total /
              (queueData.page_size || MODERATION_QUEUE_PAGE_SIZE),
          ),
      )
    : 1;
  const totalLogsPages = logsData
    ? Math.max(
        1,
        logsData.total_pages ||
          Math.ceil(
            logsData.total / (logsData.page_size || MODERATION_LOGS_PAGE_SIZE),
          ),
      )
    : 1;

  const notifySuccess = (msg: string) => {
    toast.success(msg);
  };

  const confirmAction = (id: string, type: "approve" | "reject") => {
    if (type === "reject") {
      setPendingAction({ id, type });
      setIsConfirmOpen(true);
    } else {
      handleAction(id, "approve");
    }
  };

  const handleAction = async (id: string, action: "approve" | "reject") => {
    if (!isAuthorized) return;
    try {
      await moderatePost({ postId: id, body: { action } }).unwrap();
      notifySuccess(
        action === "approve"
          ? translate("moderationPage.contentApproved")
          : translate("moderationPage.contentRejected"),
      );
      setPendingAction(null);
      setIsConfirmOpen(false);
    } catch (error) {
      toast.error(
        getApiErrorDisplayMessage(
          error,
          translate,
          "apiErrors.default",
        ),
      );
    }
  };

  if (!isAuthorized) return <Navigate to="/" replace />;

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-100 text-red-600 rounded-full text-[10px] font-bold uppercase tracking-widest mb-4">
            <ShieldCheck className="w-3.5 h-3.5" />{" "}
            {translate("moderationPage.center")}
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 underline decoration-primary decoration-4 underline-offset-8">
            {translate("moderationPage.portalTitle")}
          </h2>
          <p className="text-slate-500 mt-6">
            {translate("moderationPage.portalDescription")}
          </p>
        </div>
        <div className="flex w-full flex-col rounded-xl border border-slate-200 bg-white p-1 sm:w-auto sm:flex-row">
          <button
            onClick={() => setModSubTab("queue")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              modSubTab === "queue"
                ? "bg-slate-900 text-white"
                : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            {translate("moderationPage.queueTab", { count: queueData?.total || 0 })}
          </button>
          <button
            onClick={() => setModSubTab("logs")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              modSubTab === "logs"
                ? "bg-slate-900 text-white"
                : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            <History className="w-4 h-4" />
            {translate("moderationPage.logsTab", { count: logsData?.total || 0 })}
          </button>
        </div>
      </header>

      <div className="space-y-6">
        <AnimatePresence mode="popLayout">
          {modSubTab === "queue" && isLoading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex justify-center items-center py-20"
            >
              <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
            </motion.div>
          ) : modSubTab === "queue" && isError ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-red-50 text-red-600 p-8 rounded-2xl border border-red-100 text-center font-bold"
            >
              {translate("moderationPage.queueLoadError")}
            </motion.div>
          ) : modSubTab === "queue" && items.length > 0 ? (
            items.map((item) => (
              <motion.div
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
              >
                <div className="flex flex-col gap-6 p-4 sm:p-6 md:flex-row md:items-center">
                  <div className="p-4 rounded-xl shrink-0 bg-amber-50 text-amber-600">
                    <MessageSquare className="w-6 h-6" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-widest ${
                          item.moderation_status === "flagged"
                            ? "bg-red-100 text-red-600"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {item.moderation_status === "flagged"
                          ? translate("moderationPage.flagged")
                          : translate("moderationPage.pending")}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        {new Date(item.created_at).toLocaleDateString(
                          localeCode,
                        )}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 truncate">
                      {item.topic?.title || translate("moderationPage.forumPost")}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                      {translate("moderationPage.submittedBy")}{" "}
                      <span className="font-bold text-slate-900">
                        {item.author_name ||
                          `${item.author?.first_name} ${item.author?.last_name}`}
                      </span>
                    </p>
                    {item.content && (
                      <div
                        className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 prose prose-sm prose-slate max-w-none prose-p:my-0 prose-p:text-slate-700 prose-headings:text-slate-900 prose-strong:text-slate-900 prose-a:text-primary prose-img:rounded-xl"
                        dangerouslySetInnerHTML={{ __html: sanitizeRichContent(item.content) }}
                      />
                    )}
                  </div>

                  <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
                    {/* <button className="p-3 bg-slate-50 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all shadow-sm">
                      <Eye className="w-5 h-5" />
                    </button> */}
                    <button
                      onClick={() => confirmAction(item.id, "reject")}
                      className="flex items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-xs font-bold text-red-600 shadow-sm transition-all hover:bg-red-100 cursor-pointer"
                    >
                      <XCircle className="w-4 h-4" />{" "}
                      {translate("moderationPage.reject")}
                    </button>
                    <button
                      onClick={() => confirmAction(item.id, "approve")}
                      className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-600 shadow-sm transition-all hover:bg-emerald-100 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />{" "}
                      {translate("moderationPage.approve")}
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          ) : modSubTab === "queue" ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 p-20 flex flex-col items-center text-center"
            >
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-6">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                {translate("moderationPage.allCaughtUp")}
              </h3>
              <p className="text-slate-500 mt-2 max-w-sm">
                {translate("moderationPage.emptyQueue")}
              </p>
            </motion.div>
          ) : isLoadingLogs ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex justify-center items-center py-20"
            >
              <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
            </motion.div>
          ) : isLogsError ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-red-50 text-red-600 p-8 rounded-2xl border border-red-100 text-center font-bold"
            >
              {translate("moderationPage.logsLoadError")}
            </motion.div>
          ) : logs.length > 0 ? (
            logs.map((log) => (
              <motion.div
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={log.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
              >
                <div className="p-6 flex flex-col md:flex-row items-center gap-6">
                  <div
                    className={`p-4 rounded-xl shrink-0 ${
                      log.action === "approve"
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-red-50 text-red-600"
                    }`}
                  >
                    {log.action === "approve" ? (
                      <CheckCircle2 className="w-6 h-6" />
                    ) : (
                      <XCircle className="w-6 h-6" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-widest ${
                          log.action === "approve"
                            ? "bg-emerald-100 text-emerald-600"
                            : "bg-red-100 text-red-600"
                        }`}
                      >
                        {translate(
                          log.action === "approve"
                            ? "moderationPage.approve"
                            : "moderationPage.reject",
                        )}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        {new Date(log.acted_at).toLocaleDateString(localeCode)}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 truncate">
                      {log.post?.author_name || translate("moderationPage.moderatedContent")}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                      {translate("moderationPage.moderatedBy")}{" "}
                      <span className="font-bold text-slate-900">
                        {log.moderator?.first_name} {log.moderator?.last_name}
                      </span>
                    </p>
                    {log.post?.content && (
                      <div
                        className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 prose prose-sm prose-slate max-w-none prose-p:my-0 prose-p:text-slate-700 prose-headings:text-slate-900 prose-strong:text-slate-900 prose-a:text-primary prose-img:rounded-xl"
                        dangerouslySetInnerHTML={{ __html: sanitizeRichContent(log.post.content) }}
                      />
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 p-20 flex flex-col items-center text-center"
            >
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-6">
                <History className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                {translate("moderationPage.noLogsYet")}
              </h3>
              <p className="text-slate-500 mt-2 max-w-sm">
                {translate("moderationPage.emptyLogs")}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
        {modSubTab === "queue" && !isLoading && !isError && items.length > 0 && (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              {translate("moderationPage.showingQueue", {
                count: items.length,
                total: queueData?.total || 0,
              })}
              {isFetching && !isLoading
                ? translate("moderationPage.refreshing")
                : ""}
            </p>
            <div className="flex items-center gap-3 self-end sm:self-auto">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                {translate("moderationPage.pageOf", {
                  current: queuePage,
                  total: totalQueuePages,
                })}
              </span>
              <button
                onClick={() =>
                  setQueuePage((currentPage) => Math.max(1, currentPage - 1))
                }
                className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-30 cursor-pointer"
                disabled={queuePage <= 1 || isFetching}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() =>
                  setQueuePage((currentPage) =>
                    Math.min(totalQueuePages, currentPage + 1),
                  )
                }
                className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-30 cursor-pointer"
                disabled={queuePage >= totalQueuePages || isFetching}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        {modSubTab === "logs" && !isLoadingLogs && !isLogsError && logs.length > 0 && (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              {translate("moderationPage.showingLogs", {
                count: logs.length,
                total: logsData?.total || 0,
              })}
              {isFetchingLogs && !isLoadingLogs
                ? translate("moderationPage.refreshing")
                : ""}
            </p>
            <div className="flex items-center gap-3 self-end sm:self-auto">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                {translate("moderationPage.pageOf", {
                  current: logsPage,
                  total: totalLogsPages,
                })}
              </span>
              <button
                onClick={() =>
                  setLogsPage((currentPage) => Math.max(1, currentPage - 1))
                }
                className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-30 cursor-pointer"
                disabled={logsPage <= 1 || isFetchingLogs}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() =>
                  setLogsPage((currentPage) =>
                    Math.min(totalLogsPages, currentPage + 1),
                  )
                }
                className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-30 cursor-pointer"
                disabled={logsPage >= totalLogsPages || isFetchingLogs}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="flex flex-col items-center rounded-3xl bg-slate-900 p-6 text-center text-white shadow-xl sm:p-8">
          <ShieldCheck className="w-10 h-10 text-primary mb-4" />
          <span className="text-3xl font-extrabold">98.5%</span>
          <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
            {translate("moderationPage.validationRate")}
          </p>
        </div>
        <div className="flex flex-col items-center rounded-3xl border border-slate-200 bg-white p-6 text-center text-slate-900 shadow-sm sm:p-8">
          <AlertCircle className="w-10 h-10 text-amber-400 mb-4" />
          <span className="text-3xl font-extrabold">0.2s</span>
          <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
            {translate("moderationPage.averagePurgeTime")}
          </p>
        </div>
        <div className="flex flex-col items-center rounded-3xl border border-slate-200 bg-white p-6 text-center text-slate-900 shadow-sm sm:p-8">
          <Trash2 className="w-10 h-10 text-red-400 mb-4" />
          <span className="text-3xl font-extrabold">12</span>
          <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
            {translate("moderationPage.contentsRemovedThisMonth")}
          </p>
        </div>
      </div>

      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={() =>
          pendingAction && handleAction(pendingAction.id, "reject")
        }
        title={translate("moderationPage.confirmRejectionTitle")}
        message={translate("moderationPage.confirmRejectionMessage")}
      />
    </div>
  );
}
