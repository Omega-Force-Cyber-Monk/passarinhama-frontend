import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BookOpen,
  Calendar,
  ExternalLink,
  FileText,
  FolderOpen,
  Home,
  LogOut,
  Menu,
  MessageSquare,
  Settings,
  ShieldCheck,
  Users,
  X,
  LayoutDashboard,
  ChevronDown,
} from "lucide-react";
import { RootState } from "../redux/store";
import { logout, setUser } from "../redux/features/auth/authSlice";
import { ROLE_SLUGS } from "../redux/features/auth/authTypes";
import { useGetForumsQuery } from "../redux/features/forum/forumApi";
import {
  useGetUsersMeQuery,
  useGetUsersOnlineQuery,
} from "../redux/features/members/membersApi";
import { useLazyGetDashboardSearchQuery } from "../redux/features/dashboard/dashboardApi";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { useI18n } from "../i18n";
import { usePermissions } from "../hooks/usePermissions";

type NavItem = {
  name: string;
  path: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  badge?: string;
};

const avatarGradients = [
  "from-indigo-500 to-violet-500",
  "from-fuchsia-400 to-rose-500",
  "from-sky-400 to-cyan-400",
  "from-emerald-400 to-teal-400",
  "from-amber-400 to-orange-500",
];

const buildInitials = (...values: Array<string | null | undefined>) => {
  const name = values.filter(Boolean).join(" ").trim();
  if (!name) return "AC";

  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
};

const getSearchResultPath = (
  type: "article" | "topic" | "event" | "training",
  id: string,
  forumId?: string | null,
) => {
  switch (type) {
    case "article":
      return `/articles/${id}`;
    case "topic":
      return forumId ? `/forums/${forumId}/topics/${id}` : "/forums";
    case "event":
      return `/agenda/${id}`;
    case "training":
      return `/trainings/${id}`;
    default:
      return "/";
  }
};

const formatSearchDate = (value?: string | null) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
};

const OutletLoadingFallback = () => (
  <div className="flex min-h-[40vh] items-center justify-center px-6">
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-600 shadow-sm">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <span>Loading page...</span>
    </div>
  </div>
);

const getProfileSyncSignature = (value: unknown) =>
  JSON.stringify(value ?? null);

const DashboardLayout: React.FC = () => {
  const { isAuthenticated, user } = useSelector(
    (state: RootState) => state.auth,
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [forumsDropdownOpen, setForumsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const dispatch = useDispatch();
  const location = useLocation();
  const isAdminRoute = location.pathname === "/admin";
  const navigate = useNavigate();
  const { translate } = useI18n();
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const lastSyncedProfileRef = useRef<string>("");
  const { canAccessFeature, canAccessAdminPanel, canAccessModeration } =
    usePermissions();
  const isSuperuser = Boolean(user?.is_superuser);

  const { data: profileData } = useGetUsersMeQuery(undefined, {
    skip: !isAuthenticated,
  });
  const { data: forumsData } = useGetForumsQuery(undefined, {
    skip: !isAuthenticated,
  });
  const { data: onlineUsersData } = useGetUsersOnlineQuery(undefined, {
    skip: !isAuthenticated,
  });
  const [
    triggerDashboardSearch,
    {
      data: searchResults,
      isFetching: isSearchFetching,
      isError: isSearchError,
    },
  ] = useLazyGetDashboardSearchQuery();

  useEffect(() => {
    if (!profileData) {
      lastSyncedProfileRef.current = "";
      return;
    }

    const nextSignature = getProfileSyncSignature(profileData);
    if (lastSyncedProfileRef.current === nextSignature) {
      return;
    }

    lastSyncedProfileRef.current = nextSignature;
    dispatch(setUser(profileData));
  }, [dispatch, profileData]);

  useEffect(() => {
    if (location.pathname.startsWith("/forums")) {
      setForumsDropdownOpen(true);
    }
    setSidebarOpen(false);
    setSearchOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getRoleLabel = (role?: string | null) => {
    switch (role) {
      case ROLE_SLUGS.ADMIN:
        return translate("common.roleAdmin");
      case ROLE_SLUGS.MODERATOR:
        return translate("common.roleModerator");
      case ROLE_SLUGS.MEMBER:
        return translate("common.roleMember");
      default:
      // return role?.replace(/_/g, " ") || translate("common.member");
    }
  };

  const navItems = useMemo<NavItem[]>(() => {
    const items: NavItem[] = [
      { name: translate("common.home"), path: "/", icon: Home },
    ];

    if (isSuperuser) {
      items.push({
        name: translate("common.dashboard"),
        path: "/dashboard",
        icon: LayoutDashboard,
      });
    }

    if (canAccessFeature("forum")) {
      items.push({
        name: translate("common.forums"),
        path: "/forums",
        icon: MessageSquare,
      });
    }

    if (canAccessFeature("article")) {
      items.push({
        name: translate("common.articles"),
        path: "/articles",
        icon: FileText,
      });
    }

    if (canAccessFeature("event")) {
      items.push({
        name: translate("common.agenda"),
        path: "/agenda",
        icon: Calendar,
      });
    }

    if (canAccessFeature("training")) {
      items.push({
        name: translate("common.training"),
        path: "/trainings",
        icon: BookOpen,
      });
    }

    if (canAccessFeature("document")) {
      items.push({
        name: translate("common.documents"),
        path: "/documents",
        icon: FolderOpen,
      });
    }

    if (isSuperuser) {
      items.splice(2, 0, {
        name: translate("common.members"),
        path: "/directory",
        icon: Users,
      });
    }

    if (canAccessAdminPanel) {
      items.push({
        name: translate("common.administration"),
        path: "/admin",
        icon: Settings,
      });
    }

    if (canAccessModeration) {
      items.push({
        name: translate("common.moderation"),
        path: "/moderation",
        icon: ShieldCheck,
      });
    }

    return items;
  }, [
    canAccessAdminPanel,
    canAccessFeature,
    canAccessModeration,
    isSuperuser,
    translate,
  ]);

  const pageTitle =
    navItems.find((item) =>
      item.path === "/"
        ? location.pathname === item.path
        : location.pathname === item.path ||
          location.pathname.startsWith(`${item.path}/`),
    )?.name || translate("layout.memberArea");

  const fullName =
    `${user?.first_name || ""} ${user?.last_name || ""}`.trim() ||
    translate("common.member");
  const userInitials =
    user?.initials ||
    user?.avatarInitials ||
    buildInitials(user?.first_name, user?.last_name);
  const onlineUsers = onlineUsersData?.users || [];
  const showForumsActive =
    location.pathname === "/forums" || location.pathname.startsWith("/forums/");
  const hasSearchResults =
    Boolean(searchResults?.articles.length) ||
    Boolean(searchResults?.topics.length) ||
    Boolean(searchResults?.events.length) ||
    Boolean(searchResults?.trainings.length);

  const handleSearchSubmit = async () => {
    const trimmedQuery = searchTerm.trim();
    if (!trimmedQuery) {
      setSearchOpen(false);
      return;
    }

    try {
      await triggerDashboardSearch({ q: trimmedQuery, limit: 5 }).unwrap();
      setSearchOpen(true);
    } catch {
      setSearchOpen(true);
    }
  };

  const handleSearchKeyDown = async (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      await handleSearchSubmit();
    }

    if (event.key === "Escape") {
      setSearchOpen(false);
    }
  };

  const handleResultNavigation = (path: string) => {
    setSearchOpen(false);
    navigate(path);
  };

  return (
    <div className="flex min-h-screen bg-[var(--archi-bg)] text-[var(--archi-text)]">
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/35 backdrop-blur-[2px] lg:hidden cursor-pointer"
          onClick={() => setSidebarOpen(false)}
          aria-label={translate("layout.closeMenu")}
        />
      )}

      <aside
        className={`archi-scrollbar fixed inset-y-0 left-0 z-40 flex h-screen w-[240px] flex-col overflow-y-auto border-r border-[var(--archi-border)] bg-[var(--archi-surface)] transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Link to={"/"} className="p-4 flex items-center gap-3 border-b border-slate-100">
          <div className="w-10 h-10 flex items-center justify-center rounded-lg shadow-sm border-2 border-white overflow-hidden shrink-0">
            <img
              src="/logo.png"
              alt="Compagnie des Architecte de Copropriété"
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="font-black text-xs tracking-tighter text-slate-900 leading-[1.1] uppercase">
            Compagnie <br />
            des Architectes <br />
            de Copropriété
          </h1>
        </Link>

        <nav className="px-3 pb-2 pt-4">
          <div className="space-y-1">
            {navItems.map((item) => {
              const isActive =
                item.path === "/"
                  ? location.pathname === item.path
                  : location.pathname === item.path ||
                    location.pathname.startsWith(`${item.path}/`);

              if (item.path === "/forums") {
                return (
                  <div key={item.path} className="rounded-[12px]">
                    <button
                      type="button"
                      onClick={() => setForumsDropdownOpen((value) => !value)}
                      className={`flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-[9px] text-left text-[15px] font-semibold transition-all cursor-pointer ${
                        showForumsActive
                          ? "bg-[var(--archi-accent)] text-[var(--archi-text)]"
                          : "text-[var(--archi-text)] hover:bg-[var(--archi-surface-soft)]"
                      }`}
                    >
                      <item.icon className="h-[18px] w-[18px] shrink-0" />
                      <span>{item.name}</span>
                      <ChevronDown
                        className={`ml-auto h-4 w-4 shrink-0 transition-transform ${
                          forumsDropdownOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    <div
                      className={`relative ml-3.5 overflow-hidden pl-4 transition-all duration-300 ${
                        forumsDropdownOpen
                          ? "max-h-[600px] py-1 opacity-100"
                          : "max-h-0 py-0 opacity-0"
                      }`}
                    >
                      <div className="absolute bottom-1.5 left-[6px] top-1.5 w-px bg-[var(--archi-border)]" />
                      <Link
                        to="/forums"
                        className={`relative flex items-center gap-2.5 rounded-[10px] px-2.5 py-1.5 text-[12.5px] font-medium transition-all ${
                          location.pathname === "/forums"
                            ? "bg-[var(--archi-surface-soft)] text-[var(--archi-text)]"
                            : "text-[var(--archi-secondary)] hover:bg-[var(--archi-surface-soft)] hover:text-[var(--archi-text)]"
                        }`}
                      >
                        <span className="h-[5px] w-[5px] rounded-full bg-[var(--archi-muted)]" />
                        {translate("layout.allDiscussions")}
                      </Link>

                      {(forumsData || []).map((forum) => (
                        <Link
                          key={forum.id}
                          to={`/forums/${forum.id}`}
                          className={`relative flex items-center gap-2.5 rounded-[10px] px-2.5 py-1.5 text-[12.5px] font-medium transition-all ${
                            location.pathname.includes(`/forums/${forum.id}`)
                              ? "bg-[var(--archi-surface-soft)] text-[var(--archi-text)]"
                              : "text-[var(--archi-secondary)] hover:bg-[var(--archi-surface-soft)] hover:text-[var(--archi-text)]"
                          }`}
                        >
                          <span className="h-[5px] w-[5px] rounded-full bg-[var(--archi-muted)]" />
                          <span className="truncate">{forum.name}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              }

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2.5 rounded-[10px] px-2.5 py-[9px] text-[15px] font-semibold transition-all ${
                    isActive
                      ? "bg-[var(--archi-accent)] text-[var(--archi-text)]"
                      : "text-[var(--archi-text)] hover:bg-[var(--archi-surface-soft)]"
                  }`}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  <span>{item.name}</span>
                  {item.badge ? (
                    <span className="ml-auto rounded-full bg-[var(--archi-accent-soft)] px-1.5 py-[1px] text-[10px] font-semibold">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="mt-auto border-t border-[var(--archi-border)] px-3 pb-2.5 pt-3.5">
          <div className="flex items-center justify-between px-2 pb-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--archi-muted)]">
              {translate("common.membersOnline")}
            </span>
            <span className="rounded-full bg-emerald-600/10 px-[7px] py-[1px] text-[10px] font-bold text-[var(--archi-green)]">
              {onlineUsersData?.count || 0}
            </span>
          </div>

          <div className="space-y-1.5">
            {onlineUsers.slice(0, 5).map((onlineUser, index) => {
              const onlineName =
                `${onlineUser.first_name || ""} ${onlineUser.last_name || ""}`.trim() ||
                translate("common.member");
              const initials =
                onlineUser.initials ||
                buildInitials(onlineUser.first_name, onlineUser.last_name);
              const gradient = avatarGradients[index % avatarGradients.length];

              return (
                <div
                  key={onlineUser.id}
                  className="flex items-center gap-2.5 rounded-[10px] px-2 py-[5px] transition-colors hover:bg-[var(--archi-surface-soft)]"
                >
                  <div className="relative shrink-0">
                    <div
                      className={`flex h-[26px] w-[26px] items-center justify-center overflow-hidden rounded-full bg-gradient-to-br ${gradient} text-[10px] font-bold text-white`}
                    >
                      {onlineUser.avatar_url ? (
                        <img
                          src={onlineUser.avatar_url}
                          alt={onlineName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        initials
                      )}
                    </div>
                    <span className="absolute -bottom-px -right-px h-[9px] w-[9px] rounded-full border-2 border-white bg-[var(--archi-green)]" />
                  </div>
                  <span className="truncate text-xs font-medium text-[var(--archi-secondary)]">
                    {onlineName}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t border-[var(--archi-border)] p-3">
          <Link
            to="/profile"
            className="flex items-center gap-2.5 rounded-[10px] p-2.5 transition-colors hover:bg-[var(--archi-surface-soft)]"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-fuchsia-400 to-rose-500 text-xs font-bold text-white">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={fullName}
                  className="h-full w-full object-cover"
                />
              ) : (
                userInitials
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[12.5px] font-semibold text-[var(--archi-text)]">
                {fullName}
              </div>
              <div className="truncate text-[10px] text-[var(--archi-muted)]">
                {getRoleLabel(user?.role)}
              </div>
            </div>
          </Link>

          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => dispatch(logout())}
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-[10px] border border-[var(--archi-border)] text-[12px] font-semibold text-[var(--archi-secondary)] transition-all hover:bg-red-50 hover:text-[var(--archi-red)] cursor-pointer"
              aria-label={translate("common.logout")}
            >
              <LogOut className="h-4 w-4" />
              <span>{translate("common.logout")}</span>
            </button>
          </div>
        </div>
      </aside>

      <div
        className={`archi-scrollbar flex min-w-0 flex-1 flex-col ${
          isAdminRoute
            ? "min-h-screen overflow-visible"
            : "h-screen overflow-y-auto"
        }`}
      >
        <header className="sticky top-0 z-30 flex h-[60px] shrink-0 items-center gap-4 border-b border-[var(--archi-border)] bg-[var(--archi-surface)] px-4 lg:px-7">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] text-[var(--archi-secondary)] transition-all hover:bg-[var(--archi-surface-soft)] hover:text-[var(--archi-text)] lg:hidden"
            aria-label={translate("layout.openMenu")}
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1 text-[15px] font-semibold text-[var(--archi-text)]">
            {pageTitle}
          </div>

          <div
            ref={searchContainerRef}
            className="relative hidden w-[320px] md:block"
          >
            <div className="flex items-center gap-2 rounded-[10px] border border-[var(--archi-border)] bg-[var(--archi-surface-soft)] px-3 py-[7px] transition-all focus-within:border-[var(--archi-accent)] focus-within:bg-white focus-within:archi-surface-ring">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="shrink-0 text-[var(--archi-muted)]"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder={translate("layout.searchPlaceholder")}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                onFocus={() => {
                  if (searchResults || isSearchError) {
                    setSearchOpen(true);
                  }
                }}
                onKeyDown={handleSearchKeyDown}
                className="w-full border-0 bg-transparent text-[13px] outline-none placeholder:text-[var(--archi-muted)]"
              />
            </div>

            {searchOpen ? (
              <div className="absolute right-0 top-[calc(100%+10px)] z-40 w-full overflow-hidden rounded-[14px] border border-[var(--archi-border)] bg-white shadow-[0_20px_50px_rgba(15,23,42,0.12)]">
                {isSearchFetching ? (
                  <div className="px-4 py-3 text-[12px] font-medium text-[var(--archi-secondary)]">
                    Searching...
                  </div>
                ) : isSearchError ? (
                  <div className="px-4 py-3 text-[12px] font-medium text-[var(--archi-red)]">
                    Search failed. Please try again.
                  </div>
                ) : hasSearchResults && searchResults ? (
                  <div className="max-h-[420px] overflow-y-auto py-2">
                    {searchResults.articles.length ? (
                      <div className="px-2 pb-2">
                        <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--archi-muted)]">
                          Articles
                        </div>
                        {searchResults.articles.map((article) => (
                          <button
                            key={article.id}
                            type="button"
                            onClick={() =>
                              handleResultNavigation(
                                getSearchResultPath("article", article.id),
                              )
                            }
                            className="flex w-full items-start gap-3 rounded-[10px] px-2 py-2 text-left transition-colors hover:bg-[var(--archi-surface-soft)] cursor-pointer"
                          >
                            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[var(--archi-muted)]" />
                            <div className="min-w-0">
                              <div className="truncate text-[12.5px] font-semibold text-[var(--archi-text)]">
                                {article.title}
                              </div>
                              <div className="line-clamp-2 text-[11px] text-[var(--archi-secondary)]">
                                {article.excerpt ||
                                  article.category_name ||
                                  article.author_name}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {searchResults.topics.length ? (
                      <div className="px-2 pb-2">
                        <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--archi-muted)]">
                          Topics
                        </div>
                        {searchResults.topics.map((topic) => {
                          const forumId = topic.forum?.id || topic.forum_id;

                          return (
                            <button
                              key={topic.id}
                              type="button"
                              onClick={() =>
                                handleResultNavigation(
                                  getSearchResultPath(
                                    "topic",
                                    topic.id,
                                    forumId,
                                  ),
                                )
                              }
                              className="flex w-full items-start gap-3 rounded-[10px] px-2 py-2 text-left transition-colors hover:bg-[var(--archi-surface-soft)] cursor-pointer"
                            >
                              <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-[var(--archi-muted)]" />
                              <div className="min-w-0">
                                <div className="truncate text-[12.5px] font-semibold text-[var(--archi-text)]">
                                  {topic.title}
                                </div>
                                <div className="truncate text-[11px] text-[var(--archi-secondary)]">
                                  {topic.forum?.name ||
                                    translate("common.forums")}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}

                    {searchResults.events.length ? (
                      <div className="px-2 pb-2">
                        <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--archi-muted)]">
                          Events
                        </div>
                        {searchResults.events.map((event) => (
                          <button
                            key={event.id}
                            type="button"
                            onClick={() =>
                              handleResultNavigation(
                                getSearchResultPath("event", event.id),
                              )
                            }
                            className="flex w-full items-start gap-3 rounded-[10px] px-2 py-2 text-left transition-colors hover:bg-[var(--archi-surface-soft)] cursor-pointer"
                          >
                            <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-[var(--archi-muted)]" />
                            <div className="min-w-0">
                              <div className="truncate text-[12.5px] font-semibold text-[var(--archi-text)]">
                                {event.title}
                              </div>
                              <div className="truncate text-[11px] text-[var(--archi-secondary)]">
                                {[
                                  formatSearchDate(event.event_date),
                                  event.location,
                                ]
                                  .filter(Boolean)
                                  .join(" • ")}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {searchResults.trainings.length ? (
                      <div className="px-2 pb-2">
                        <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--archi-muted)]">
                          Trainings
                        </div>
                        {searchResults.trainings.map((training) => (
                          <button
                            key={training.id}
                            type="button"
                            onClick={() =>
                              handleResultNavigation(
                                getSearchResultPath("training", training.id),
                              )
                            }
                            className="flex w-full items-start gap-3 rounded-[10px] px-2 py-2 text-left transition-colors hover:bg-[var(--archi-surface-soft)] cursor-pointer"
                          >
                            <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-[var(--archi-muted)]" />
                            <div className="min-w-0">
                              <div className="truncate text-[12.5px] font-semibold text-[var(--archi-text)]">
                                {training.title}
                              </div>
                              <div className="truncate text-[11px] text-[var(--archi-secondary)]">
                                {[
                                  formatSearchDate(training.training_date),
                                  training.format,
                                ]
                                  .filter(Boolean)
                                  .join(" • ")}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="px-4 py-3 text-[12px] font-medium text-[var(--archi-secondary)]">
                    No results found.
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* <div className="hidden items-center gap-2 text-xs text-[var(--archi-secondary)] md:flex">
            <span className="h-[7px] w-[7px] rounded-full bg-[var(--archi-green)] shadow-[0_0_6px_rgba(22,163,74,.55)]" />
            <span>{onlineUsersData?.count || 0} membres en ligne</span>
          </div> */}

          <LanguageSwitcher compact className="hidden lg:inline-flex" />

          <a
            href="https://extra.archicopro.com/index.php"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-2 rounded-[10px] border border-[var(--archi-border)] bg-white px-3 py-2 text-[12px] font-semibold text-[var(--archi-secondary)] transition-all hover:border-[var(--archi-border-strong)] hover:bg-[var(--archi-surface-soft)] hover:text-[var(--archi-text)] md:inline-flex"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {translate("layout.extranet")}
          </a>

          {/* <Link
            to="/profile"
            className="flex h-[34px] w-[34px] items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-fuchsia-400 to-rose-500 text-[12px] font-bold text-white"
          >
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={fullName}
                className="h-full w-full object-cover"
              />
            ) : (
              userInitials
            )}
          </Link> */}
        </header>

        <main className="flex-1">
          <Suspense fallback={<OutletLoadingFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
