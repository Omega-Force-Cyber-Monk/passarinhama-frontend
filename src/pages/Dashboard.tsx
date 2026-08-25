import React, { useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "../redux/store";
import {
  DashboardActivityItem,
  useGetDashboardActivityQuery,
  useGetDashboardStatsQuery,
  useGetDashboardUpcomingEventsQuery,
} from "../redux/features/dashboard/dashboardApi";
import { useGetUsersOnlineQuery } from "../redux/features/members/membersApi";
import { ROLE_SLUGS } from "../redux/features/auth/authTypes";
import {
  Users,
  MessageSquare,
  Calendar,
  BookOpen,
  ArrowRight,
  Clock,
  CheckCircle2,
  Newspaper,
  TrendingUp,
  Activity,
  MapPin,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Modal from "../components/ui/Modal";
import { useAppToast } from "../components/ui/AppToastProvider";
import { useI18n } from "../i18n";
import { useNavigate } from "react-router-dom";

const formatLabel = (value: string) =>
  value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const getActorName = (
  activity: DashboardActivityItem,
  translate: (key: string, params?: Record<string, string | number>) => string,
) => {
  const name =
    `${activity.actor.first_name} ${activity.actor.last_name}`.trim();
  return name || translate("dashboardPage.activityActorFallback");
};

const getActorInitials = (
  activity: DashboardActivityItem,
  translate: (key: string, params?: Record<string, string | number>) => string,
) =>
  getActorName(activity, translate)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

const getActivityText = (
  activity: DashboardActivityItem,
  translate: (key: string, params?: Record<string, string | number>) => string,
) => {
  const targetLabel = formatLabel(activity.target_type).toLowerCase();

  switch (activity.action_type) {
    case "article_published":
      return translate("dashboardPage.activityPublishedArticle");
    case "article_updated":
      return translate("dashboardPage.activityUpdatedArticle");
    case "event_created":
      return translate("dashboardPage.activityCreatedEvent");
    case "training_registered":
      return translate("dashboardPage.activityRegisteredTraining");
    default:
      return translate("dashboardPage.activityUpdatedTarget", {
        target: targetLabel,
      });
  }
};

const getBadgeClasses = (statusBadge: string) => {
  switch (statusBadge) {
    case "success":
      return "bg-emerald-50 text-emerald-600";
    case "info":
      return "bg-sky-50 text-sky-600";
    case "secondary":
      return "bg-slate-100 text-slate-500";
    default:
      return "bg-amber-50 text-amber-600";
  }
};

const SkeletonBlock = ({ className }: { className: string }) => (
  <div className={`animate-pulse rounded-full bg-slate-100 ${className}`} />
);

const DashboardSkeleton = () => (
  <div className="p-8 space-y-8">
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="space-y-4">
        <SkeletonBlock className="h-5 w-24 rounded-md" />
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 animate-pulse rounded-full bg-slate-100" />
          <div className="space-y-3">
            <SkeletonBlock className="h-8 w-64" />
            <SkeletonBlock className="h-4 w-80" />
          </div>
        </div>
      </div>
    </header>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4 animate-pulse"
        >
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-slate-100" />
            <SkeletonBlock className="h-3 w-24" />
          </div>
          <div className="flex items-baseline justify-between">
            <SkeletonBlock className="h-8 w-16" />
            <SkeletonBlock className="h-5 w-14 rounded-full" />
          </div>
        </div>
      ))}
    </div>

    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12 lg:col-span-8">
        <div className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-sm">
          <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
            <div className="h-5 w-5 rounded bg-slate-100 animate-pulse" />
            <SkeletonBlock className="h-4 w-36" />
          </div>
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="px-8 py-6 flex items-start gap-4 animate-pulse">
                <div className="h-12 w-12 rounded-full bg-slate-100 shrink-0" />
                <div className="flex-1 space-y-3">
                  <SkeletonBlock className="h-4 w-4/5" />
                  <SkeletonBlock className="h-3 w-1/3" />
                  <div className="flex items-center gap-4">
                    <SkeletonBlock className="h-3 w-24" />
                    <SkeletonBlock className="h-5 w-16 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="col-span-12 lg:col-span-4 space-y-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <SkeletonBlock className="h-6 w-28" />
          </div>
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex gap-4 animate-pulse">
              <div className="h-12 w-12 rounded-2xl bg-slate-100 shrink-0" />
              <div className="flex-1 space-y-2">
                <SkeletonBlock className="h-4 w-4/5" />
                <SkeletonBlock className="h-3 w-2/5" />
                <SkeletonBlock className="h-3 w-3/5" />
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-slate-100 animate-pulse" />
              <SkeletonBlock className="h-6 w-32" />
            </div>
            <SkeletonBlock className="h-6 w-16 rounded-full" />
          </div>
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 animate-pulse">
              <div className="h-10 w-10 rounded-xl bg-slate-100" />
              <div className="flex-1 space-y-2">
                <SkeletonBlock className="h-3 w-2/3" />
                <SkeletonBlock className="h-2.5 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default function Dashboard() {
  const { language, translate } = useI18n();
  const toast = useAppToast();
  const navigate = useNavigate();
  const { data: stats, isLoading } = useGetDashboardStatsQuery();
  const { data: activityFeed = [], isLoading: isActivityLoading } =
    useGetDashboardActivityQuery();
  const { data: upcomingEvents = [], isLoading: isUpcomingEventsLoading } =
    useGetDashboardUpcomingEventsQuery();
  const { data: onlineUsersData, isLoading: isOnlineUsersLoading } =
    useGetUsersOnlineQuery();
  const { user } = useSelector((state: RootState) => state.auth);
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [isArticleModalOpen, setIsArticleModalOpen] = useState(false);
  const [showAllOnlineMembers, setShowAllOnlineMembers] = useState(false);

  const relativeTimeFormatter = new Intl.RelativeTimeFormat(language, {
    numeric: "auto",
  });

  const formatRelativeTime = (value: string) => {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    const diffInSeconds = Math.round((date.getTime() - Date.now()) / 1000);
    const absDiffInSeconds = Math.abs(diffInSeconds);

    if (absDiffInSeconds < 60) {
      return relativeTimeFormatter.format(diffInSeconds, "second");
    }

    const diffInMinutes = Math.round(diffInSeconds / 60);
    if (Math.abs(diffInMinutes) < 60) {
      return relativeTimeFormatter.format(diffInMinutes, "minute");
    }

    const diffInHours = Math.round(diffInMinutes / 60);
    if (Math.abs(diffInHours) < 24) {
      return relativeTimeFormatter.format(diffInHours, "hour");
    }

    const diffInDays = Math.round(diffInHours / 24);
    return relativeTimeFormatter.format(diffInDays, "day");
  };

  const notifySuccess = (msg: string) => {
    toast.success(msg);
  };

  const handleUpcomingEventClick = (eventId: string) => {
    navigate(`/agenda/${eventId}`);
  };

  const handleCreateTopic = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const title = String(form.get("title") || "").trim();
    const forum = String(form.get("forum") || "").trim();
    const message = String(form.get("message") || "").trim();

    if (!title) {
      toast.error(
        translate("common.requiredField", {
          field: translate("dashboardPage.discussionTitle"),
        }),
      );
      return;
    }

    if (!forum) {
      toast.error(
        translate("common.requiredField", {
          field: translate("dashboardPage.forum"),
        }),
      );
      return;
    }

    if (!message) {
      toast.error(
        translate("common.requiredField", {
          field: translate("dashboardPage.yourMessage"),
        }),
      );
      return;
    }

    setIsTopicModalOpen(false);
    notifySuccess(translate("dashboardPage.topicPublishedSuccess"));
  };

  const handleCreateArticle = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const title = String(form.get("title") || "").trim();
    const category = String(form.get("category") || "").trim();
    const content = String(form.get("content") || "").trim();

    if (!title) {
      toast.error(
        translate("common.requiredField", {
          field: translate("dashboardPage.articleTitle"),
        }),
      );
      return;
    }

    if (!category) {
      toast.error(
        translate("common.requiredField", {
          field: translate("dashboardPage.category"),
        }),
      );
      return;
    }

    if (!content) {
      toast.error(
        translate("common.requiredField", {
          field: translate("dashboardPage.articleContent"),
        }),
      );
      return;
    }

    setIsArticleModalOpen(false);
    notifySuccess(translate("dashboardPage.articlePublishedSuccess"));
  };

  const isAdmin = user?.role === ROLE_SLUGS.ADMIN;
  const isModerator = user?.role === ROLE_SLUGS.MODERATOR;
  const isExpert = isModerator;
  const statValues = {
    totalActiveMembers: stats?.total_active_members ?? 0,
    activeTopics: stats?.active_topics ?? 0,
    eventsThisYear: stats?.events_this_year ?? 0,
    trainingsPlanned: stats?.trainings_planned ?? 0,
  };
  const onlineUsers = onlineUsersData?.users ?? [];
  const visibleOnlineUsers = showAllOnlineMembers
    ? onlineUsers
    : onlineUsers.slice(0, 3);

  const adminStatCards = [
    {
      name: translate("dashboardPage.activeMembers"),
      value: statValues.totalActiveMembers,
      icon: Users,
      color: "text-blue-700",
      bg: "bg-blue-100",
      secondary: translate("dashboardPage.total"),
    },
    {
      name: translate("dashboardPage.activeTopics"),
      value: statValues.activeTopics,
      icon: MessageSquare,
      color: "text-amber-700",
      bg: "bg-amber-100",
      secondary: translate("dashboardPage.live"),
    },
    {
      name: translate("dashboardPage.events"),
      value: statValues.eventsThisYear,
      icon: Calendar,
      color: "text-emerald-700",
      bg: "bg-emerald-100",
      secondary: translate("dashboardPage.thisYear"),
    },
    {
      name: translate("dashboardPage.trainings"),
      value: statValues.trainingsPlanned,
      icon: BookOpen,
      color: "text-purple-700",
      bg: "bg-purple-100",
      secondary: translate("dashboardPage.planned"),
    },
  ];

  const expertStatCards = [
    {
      name: translate("dashboardPage.forumTopics"),
      value: statValues.activeTopics,
      icon: MessageSquare,
      color: "text-indigo-700",
      bg: "bg-indigo-100",
      secondary: translate("dashboardPage.active"),
    },
    {
      name: translate("dashboardPage.activeMembers"),
      value: statValues.totalActiveMembers,
      icon: Users,
      color: "text-pink-700",
      bg: "bg-pink-100",
      secondary: translate("dashboardPage.community"),
    },
    {
      name: translate("dashboardPage.trainings"),
      value: statValues.trainingsPlanned,
      icon: BookOpen,
      color: "text-purple-700",
      bg: "bg-purple-100",
      secondary: translate("dashboardPage.planned"),
    },
    {
      name: translate("dashboardPage.events"),
      value: statValues.eventsThisYear,
      icon: Calendar,
      color: "text-sky-700",
      bg: "bg-sky-100",
      secondary: translate("dashboardPage.thisYear"),
    },
  ];

  const memberStatCards = [
    {
      name: translate("dashboardPage.activeMembers"),
      value: statValues.totalActiveMembers,
      icon: Users,
      color: "text-green-700",
      bg: "bg-green-100",
      secondary: translate("dashboardPage.community"),
    },
    {
      name: translate("dashboardPage.discussions"),
      value: statValues.activeTopics,
      icon: MessageSquare,
      color: "text-yellow-700",
      bg: "bg-yellow-100",
      secondary: translate("dashboardPage.active"),
    },
    {
      name: translate("dashboardPage.events"),
      value: statValues.eventsThisYear,
      icon: Calendar,
      color: "text-blue-700",
      bg: "bg-blue-100",
      secondary: translate("dashboardPage.thisYear"),
    },
    {
      name: translate("dashboardPage.trainings"),
      value: statValues.trainingsPlanned,
      icon: BookOpen,
      color: "text-purple-700",
      bg: "bg-purple-100",
      secondary: translate("dashboardPage.planned"),
    },
  ];

  const currentStatCards = isAdmin
    ? adminStatCards
    : isExpert
      ? expertStatCards
      : memberStatCards;

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="p-8 space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 rounded bg-primary/10 text-primary-dark text-[10px] font-bold uppercase tracking-wider border border-primary/20">
              {isAdmin
                ? translate("dashboardPage.adminPanel")
                : isExpert
                  ? translate("dashboardPage.expertSpace")
                  : translate("dashboardPage.memberPortal")}
            </span>
          </div>
          <div className="flex items-center gap-4">
            {user?.avatar_url && (
              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary shadow-sm shrink-0">
                <img
                  src={user.avatar_url}
                  alt={translate("dashboardPage.profile")}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 underline decoration-primary decoration-4 underline-offset-8">
                {translate("dashboardPage.welcomeBack", {
                  name: user?.firstName || "",
                })}
              </h2>
              <p className="text-slate-500 mt-3 text-sm">
                {translate("dashboardPage.welcomeSubtitle")}
              </p>
            </div>
          </div>
        </div>
        {/* <div className="flex gap-3">
          {isAdmin ? (
            <>
              <button
                onClick={() => setIsTopicModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                New Topic
              </button>
              {isExpert && (
                <button
                  onClick={() => setIsArticleModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-slate-900 rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm hover:bg-primary-dark transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Publish Article
                </button>
              )}
            </>
          ) : (
            <>
              <button
                onClick={() => setIsTopicModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                New Topic
              </button>
              {isExpert && (
                <button
                  onClick={() => setIsArticleModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-slate-900 rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm hover:bg-primary-dark transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Publish Article
                </button>
              )}
            </>
          )}
        </div> */}
      </header>

      {/* Stats Grid */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        {currentStatCards.map((stat) => (
          <motion.div
            key={stat.name}
            variants={item}
            className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden cursor-pointer"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className={`p-2 rounded-lg ${stat.bg} ${stat.color}`}>
                <stat.icon className="w-4 h-4" />
              </div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                {stat.name}
              </p>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-slate-900">
                {stat.value}
              </span>
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-tight ${stat.bg} ${stat.color}`}
              >
                {stat.secondary}
              </span>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid grid-cols-12 gap-6">
        {/* Main Content Areas */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {/* {isAdmin && (
            <div className="bg-slate-900 rounded-[32px] p-8 text-white shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <ShieldAlert className="w-32 h-32" />
              </div>
              <h3 className="text-xl font-bold mb-2">
                {translate("dashboardPage.moderationCenter")}
              </h3>
              <p className="text-slate-400 text-sm mb-6 max-w-md">
                {translate("dashboardPage.moderationSummary")}
              </p>
              <div className="flex gap-4">
                <button className="px-6 py-2 bg-primary text-slate-900 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white transition-all">
                  {translate("dashboardPage.accessQueue")}
                </button>
                <button className="px-6 py-2 bg-white/10 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white/20 transition-all">
                  {translate("dashboardPage.rejectAll")}
                </button>
              </div>
            </div>
          )} */}

          {isExpert && (
            <div className="bg-primary/10 border border-primary/20 rounded-[32px] p-8 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <Newspaper className="w-6 h-6 text-primary-dark" />
                <h3 className="text-xl font-bold text-slate-900 italic">
                  {translate("dashboardPage.expertContributions")}
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-primary/10 shadow-sm">
                  <p className="text-[10px] uppercase font-bold text-slate-400 mb-2">
                    {translate("dashboardPage.draftInProgress")}
                  </p>
                  <h4 className="font-bold text-sm mb-4">
                    {translate("dashboardPage.expertDraftTitle")}
                  </h4>
                  <button className="text-[11px] font-bold text-primary-dark flex items-center gap-1 hover:underline">
                    {translate("dashboardPage.continueWriting")} <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-primary/10 shadow-sm">
                  <p className="text-[10px] uppercase font-bold text-slate-400 mb-2">
                    {translate("dashboardPage.lastArticlePublished")}
                  </p>
                  <h4 className="font-bold text-sm mb-4">
                    {translate("dashboardPage.expertLastArticleTitle")}
                  </h4>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                      {translate("dashboardPage.published")}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {translate("dashboardPage.views", { count: 124 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-[32px] flex flex-col overflow-hidden shadow-sm">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <Activity className="w-5 h-5 text-slate-400" />
                <h3 className="font-bold text-sm text-slate-800 tracking-tight">
                  {translate("dashboardPage.communityFeed")}
                </h3>
              </div>
            </div>
            <div className="divide-y divide-slate-100 overflow-y-auto max-h-[600px] scrollbar-hide">
              {isActivityLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={index}
                    className="px-8 py-6 flex items-start gap-4 animate-pulse"
                  >
                    <div className="w-12 h-12 bg-slate-100 rounded-full border-2 border-white shadow-sm shrink-0" />
                    <div className="flex-1 space-y-3">
                      <div className="h-4 bg-slate-100 rounded-full w-4/5" />
                      <div className="h-3 bg-slate-100 rounded-full w-1/3" />
                    </div>
                  </div>
                ))
              ) : activityFeed.length ? (
                activityFeed.map((activity) => (
                  <div
                    key={activity.id}
                    className="px-8 py-6 flex items-start gap-4 hover:bg-slate-50/50 transition-colors group"
                  >
                    <div className="w-12 h-12 bg-slate-100 rounded-full border-2 border-white shadow-sm shrink-0 overflow-hidden flex items-center justify-center text-sm font-bold text-slate-600">
                      {activity.actor.avatar_url ? (
                        <img
                          src={activity.actor.avatar_url}
                          alt={getActorName(activity, translate)}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        getActorInitials(activity, translate)
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-[13px] text-slate-700 leading-relaxed">
                        <span className="font-bold text-slate-900">
                          {getActorName(activity, translate)}
                        </span>{" "}
                        {getActivityText(activity, translate)}{" "}
                        <span className="font-medium italic text-primary-dark">
                          {activity.description ||
                            formatLabel(activity.target_type)}
                        </span>
                      </p>
                      <div className="flex items-center gap-4 mt-3">
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />{" "}
                          {formatRelativeTime(activity.created_at)}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-tight ${getBadgeClasses(activity.status_badge)}`}
                        >
                          {formatLabel(activity.status_badge)}
                        </span>
                      </div>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="px-2 py-1 rounded-lg bg-primary/10 text-primary-dark text-[10px] font-bold uppercase tracking-widest">
                        {formatLabel(activity.target_type)}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-8 py-12 text-center">
                  <p className="text-sm font-medium text-slate-400">
                    {translate("dashboardPage.noRecentActivity")}
                  </p>
                </div>
              )}
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-center">
              <button
                type="button"
                className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"
              >
                {activityFeed.length
                  ? translate("dashboardPage.recentActivities", {
                      count: activityFeed.length,
                    })
                  : translate("dashboardPage.activityUpdates")}{" "}
                <Clock className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Sections */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          {/* -------------------------------- */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm text-slate-900">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold">{translate("dashboardPage.upcoming")}</h3>
              </div>
              <div className="space-y-6">
                {isUpcomingEventsLoading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="flex gap-4 animate-pulse">
                      <div className="flex-shrink-0 w-12 h-12 bg-slate-100 rounded-2xl border border-slate-100" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-slate-100 rounded-full w-4/5" />
                        <div className="h-3 bg-slate-100 rounded-full w-2/5" />
                        <div className="h-3 bg-slate-100 rounded-full w-3/5" />
                      </div>
                    </div>
                  ))
                ) : upcomingEvents.length ? (
                  upcomingEvents.map((event) => (
                    <motion.button
                      type="button"
                      key={event.id}
                      layout
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      onClick={() => handleUpcomingEventClick(event.id)}
                      className="group block w-full cursor-pointer text-left"
                    >
                      <div className="flex gap-4">
                        <div className="flex-shrink-0 w-12 h-12 bg-slate-50 rounded-2xl flex flex-col items-center justify-center border border-slate-100 group-hover:bg-primary group-hover:border-primary transition-colors text-slate-900">
                          <span className="text-[10px] font-bold text-slate-400 group-hover:text-slate-900 uppercase tracking-tighter">
                            {event.month}
                          </span>
                          <span className="text-lg font-bold group-hover:text-slate-900 leading-tight">
                            {event.day}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-bold group-hover:text-primary-dark transition-colors truncate">
                            {event.title}
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatLabel(event.event_type)}
                            <span className="text-slate-300">|</span>
                            {event.is_public
                              ? translate("dashboardPage.public")
                              : translate("dashboardPage.private")}
                          </p>
                          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {event.location}
                          </p>
                        </div>
                      </div>
                    </motion.button>
                  ))
                ) : (
                  <div className="py-8 text-center">
                    <p className="text-sm font-medium text-slate-400">
                      {translate("dashboardPage.noUpcomingEvents")}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm text-slate-900">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold">{translate("dashboardPage.membersOnline")}</h3>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-full">
                  {translate("dashboardPage.activeCount", {
                    count: onlineUsers.length,
                  })}
                </span>
              </div>
              <div className="space-y-4">
                {isOnlineUsersLoading ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 animate-pulse"
                    >
                      <div className="w-10 h-10 bg-slate-100 rounded-xl" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-slate-100 rounded-full w-2/3" />
                        <div className="h-2 bg-slate-100 rounded-full w-1/3" />
                      </div>
                    </div>
                  ))
                ) : onlineUsers.length ? (
                  <>
                    <div className="space-y-4">
                      {visibleOnlineUsers.map((onlineUser) => {
                        const fullName =
                          `${onlineUser.first_name || ""} ${onlineUser.last_name || ""}`.trim() ||
                          translate("dashboardPage.memberFallback");
                        const initials =
                          onlineUser.initials ||
                          fullName
                            .split(" ")
                            .filter(Boolean)
                            .slice(0, 2)
                            .map((p) => p[0].toUpperCase())
                            .join("");

                        return (
                          <div
                            key={onlineUser.id}
                            className="flex items-center gap-3 group cursor-pointer"
                          >
                            <div className="relative shrink-0">
                              <div className="w-10 h-10 rounded-full bg-slate-50 overflow-hidden border border-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 group-hover:border-primary transition-colors">
                                {onlineUser.avatar_url ? (
                                  <img
                                    src={onlineUser.avatar_url}
                                    alt={fullName}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  initials
                                )}
                              </div>
                              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full shadow-sm" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-900 truncate group-hover:text-primary-dark transition-colors">
                                {fullName}
                              </p>
                              <p className="text-[11px] text-slate-400 font-medium">
                                {onlineUser.last_seen_at
                                  ? formatRelativeTime(onlineUser.last_seen_at)
                                  : translate("dashboardPage.activeNow")}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {onlineUsers.length > 3 && (
                      <button
                        onClick={() =>
                          setShowAllOnlineMembers(!showAllOnlineMembers)
                        }
                        className="w-full mt-4 py-3 bg-slate-50 hover:bg-primary/10 border border-slate-100 hover:border-primary/20 rounded-xl text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-primary-dark transition-all flex items-center justify-center gap-2"
                      >
                        {showAllOnlineMembers
                          ? translate("dashboardPage.showLess")
                          : translate("dashboardPage.seeAll", {
                              count: onlineUsers.length,
                            })}
                      </button>
                    )}
                  </>
                ) : (
                  <div className="py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <p className="text-sm font-medium text-slate-400">
                      {translate("dashboardPage.noMembersOnline")}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* -------------------------------- */}

          {/* Upcoming Events Section (Previously here) */}
        </div>
      </div>

      <Modal
        isOpen={isTopicModalOpen}
        onClose={() => setIsTopicModalOpen(false)}
        title={translate("dashboardPage.newDiscussionTopic")}
      >
        <form noValidate onSubmit={handleCreateTopic} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {translate("dashboardPage.discussionTitle")}
            </label>
            <input
              name="title"
              type="text"
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {translate("dashboardPage.forum")}
            </label>
            <select name="forum" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none">
              <option>{translate("dashboardPage.forumTechnicopro")}</option>
              <option>{translate("dashboardPage.forumLegal")}</option>
              <option>{translate("dashboardPage.forumMutualAid")}</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {translate("dashboardPage.yourMessage")}
            </label>
            <textarea
              name="message"
              rows={4}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none resize-none"
            />
          </div>
          <button
            type="submit"
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-slate-800 transition-all shadow-xl uppercase tracking-widest"
          >
            {translate("dashboardPage.startDiscussion")}
          </button>
        </form>
      </Modal>

      <Modal
        isOpen={isArticleModalOpen}
        onClose={() => setIsArticleModalOpen(false)}
        title={translate("dashboardPage.publishNewArticle")}
      >
        <form noValidate onSubmit={handleCreateArticle} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider text-slate-900 font-bold">
              {translate("dashboardPage.articleTitle")}
            </label>
            <input
              name="title"
              type="text"
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
              placeholder={translate("dashboardPage.articleTitlePlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {translate("dashboardPage.category")}
            </label>
            <select name="category" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none">
              <option>{translate("dashboardPage.categoryTechnical")}</option>
              <option>{translate("dashboardPage.categoryLegal")}</option>
              <option>{translate("dashboardPage.categoryAssociation")}</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {translate("dashboardPage.articleContent")}
            </label>
            <textarea
              name="content"
              rows={6}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none resize-none"
            />
          </div>
          <button
            type="submit"
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 text-sm hover:bg-slate-800 transition-all shadow-xl uppercase tracking-widest"
          >
            <Newspaper className="w-5 h-5" />
            {translate("dashboardPage.confirmPublication")}
          </button>
        </form>
      </Modal>
    </div>
  );
}
