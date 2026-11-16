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
  Search,
  Settings,
  Users,
  X,
  ChevronDown,
  Wrench,
} from "lucide-react";
import { RootState } from "../redux/store";
import { logout } from "../redux/features/auth/authSlice";
import { ROLE_SLUGS } from "../redux/features/auth/authTypes";
import {
  useGetForumsQuery,
  useLazyGetForumsQuery,
} from "../redux/features/forum/forumApi";
import {
  useGetArticleCategoriesQuery,
  useLazyGetArticleCategoriesQuery,
} from "../redux/features/articles/articlesApi";
import {
  useGetTrainingCategoriesQuery,
  useLazyGetTrainingCategoriesQuery,
} from "../redux/features/trainings/trainingsApi";
import {
  useGetTechnicoProCategoriesQuery,
  useLazyGetTechnicoProCategoriesQuery,
} from "../redux/features/technicopro/technicoproApi";
import SidebarCategorySection from "./SidebarCategorySection";
import {
  useGetUsersOnlineQuery,
} from "../redux/features/members/membersApi";
import {
  useGetDashboardSearchQuery,
  type GlobalSearchResult,
  type GlobalSearchResultType,
} from "../redux/features/dashboard/dashboardApi";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { useI18n } from "../i18n";
import { usePermissions } from "../hooks/usePermissions";
import LoadingIndicator from "../components/ui/LoadingIndicator";

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

const formatSearchDate = (value?: string | null) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
};

const getSearchExtraString = (
  extra: Record<string, unknown>,
  key: string,
): string | null => {
  const value = extra[key];
  if (typeof value === "string" && value.trim()) return value;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" && id.trim() ? id : null;
  }

  return null;
};

const getSearchExtraStringFrom = (
  extra: Record<string, unknown>,
  keys: string[],
): string | null => {
  for (const key of keys) {
    const value = getSearchExtraString(extra, key);
    if (value) return value;
  }

  return null;
};

const getSearchResultPath = (result: GlobalSearchResult): string | null => {
  switch (result.type) {
    case "agenda":
      return `/agenda/${result.id}`;
    case "articles":
      return `/articles/${result.id}`;
    case "technicopro":
      return `/technicopro/${result.id}`;
    case "trainings":
      return `/trainings/${result.id}`;
    case "forums":
      return `/forums/${result.id}`;
    case "forum_topics": {
      const forumId = getSearchExtraStringFrom(result.extra, [
        "forum_id",
        "forum",
      ]);
      return forumId ? `/forums/${forumId}/topics/${result.id}` : null;
    }
    case "forum_posts": {
      const forumId = getSearchExtraStringFrom(result.extra, [
        "forum_id",
        "forum",
      ]);
      const topicId = getSearchExtraStringFrom(result.extra, [
        "topic_id",
        "topic",
      ]);
      return forumId && topicId ? `/forums/${forumId}/topics/${topicId}` : null;
    }
    case "documents": {
      const folderId = getSearchExtraStringFrom(result.extra, [
        "folder_id",
        "document_folder_id",
        "parent_id",
      ]);
      return folderId
        ? `/documents/folder/${folderId}/file/${result.id}`
        : null;
    }
    case "document_folders":
      return `/documents/folder/${result.id}`;
    default:
      return null;
  }
};

const SEARCH_PERMISSION_FEATURES: Partial<
  Record<GlobalSearchResultType, Parameters<ReturnType<typeof usePermissions>["hasPermission"]>[0]>
> = {
  agenda: "event",
  articles: "article",
  technicopro: "technicopro",
  trainings: "training",
  forums: "forum",
  forum_topics: "forum",
  forum_posts: "forum",
  documents: "document",
  document_folders: "document",
};

const DashboardLayout: React.FC = () => {
  const { isAuthenticated, user } = useSelector(
    (state: RootState) => state.auth,
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [forumsDropdownOpen, setForumsDropdownOpen] = useState(false);
  const [articlesDropdownOpen, setArticlesDropdownOpen] = useState(false);
  const [trainingsDropdownOpen, setTrainingsDropdownOpen] = useState(false);
  const [technicoProDropdownOpen, setTechnicoProDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const dispatch = useDispatch();
  const location = useLocation();
  const isAdminRoute = location.pathname === "/admin";
  const navigate = useNavigate();
  const { translate } = useI18n();
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const normalizedSearchTerm = searchTerm.trim();
  const { hasPermission, canAccessAdminPanel } =
    usePermissions();
  const isSuperuser = canAccessAdminPanel;

  const { data: onlineUsersData } = useGetUsersOnlineQuery(undefined, {
    skip: !isAuthenticated,
  });
  const {
      currentData: searchResults,
      isFetching: isSearchFetching,
      isError: isSearchError,
      refetch: refetchSearch,
  } = useGetDashboardSearchQuery({q: debouncedSearchTerm, limit: 10}, {
    skip: !isAuthenticated || !debouncedSearchTerm || !searchOpen,
  });
  useEffect(() => {
    // Reopening a failed search retries once; error changes alone must not loop.
    if (searchOpen && debouncedSearchTerm && isSearchError && !isSearchFetching) void refetchSearch();
  }, [searchOpen, debouncedSearchTerm]);

  useEffect(() => {
    setArticlesDropdownOpen(location.pathname.startsWith("/articles"));
    setForumsDropdownOpen(location.pathname.startsWith("/forums"));
    setTrainingsDropdownOpen(location.pathname.startsWith("/trainings"));
    setTechnicoProDropdownOpen(location.pathname.startsWith("/technicopro"));
    setSidebarOpen(false);
    setSearchOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        !searchContainerRef.current?.contains(event.target as Node)
      ) {
        setSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getRoleLabel = (role?: string | null) => {
    const roleDetailsName = user?.role_details?.name;

    switch (role) {
      case ROLE_SLUGS.ADMIN:
        return translate("common.roleAdmin");
      case ROLE_SLUGS.MODERATOR:
        return translate("common.roleModerator");
      case ROLE_SLUGS.MEMBER:
        return translate("common.roleMember");
      default:
        return roleDetailsName || role?.replace(/_/g, " ") || translate("common.member");
    }
  };

  const navItems = useMemo<NavItem[]>(() => {
    const items: NavItem[] = [
      { name: translate("common.home"), path: "/", icon: Home },
    ];

    if (hasPermission("event", "view")) {
      items.push({
        name: translate("common.agenda"),
        path: "/agenda",
        icon: Calendar,
      });
    }

    if (hasPermission("article", "view")) {
      items.push({
        name: translate("common.articles"),
        path: "/articles",
        icon: FileText,
      });
    }

    if (hasPermission("forum", "view")) {
      items.push({
        name: translate("common.forums"),
        path: "/forums",
        icon: MessageSquare,
      });
    }

    if (hasPermission("training", "view")) {
      items.push({
        name: translate("common.training"),
        path: "/trainings",
        icon: BookOpen,
      });
    }

    if (hasPermission("technicopro", "view")) {
      items.push({
        name: translate("common.technicopro"),
        path: "/technicopro",
        icon: Wrench,
      });
    }

    if (hasPermission("document", "view")) {
      items.push({
        name: translate("common.documents"),
        path: "/documents",
        icon: FolderOpen,
      });
    }

    if (hasPermission("user", "view")) {
      items.push({
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

    return items;
  }, [
    canAccessAdminPanel,
    hasPermission,
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
  const visibleSearchResults = useMemo(() => {
    const results = searchResults?.results ?? [];
    if (!isAuthenticated || debouncedSearchTerm !== normalizedSearchTerm) return [];

    return results.filter((result) => {
      const feature = SEARCH_PERMISSION_FEATURES[result.type];
      return feature ? hasPermission(feature, "view") : false;
    });
  }, [hasPermission, isAuthenticated, searchResults?.results, debouncedSearchTerm, normalizedSearchTerm]);
  const hasSearchResults = visibleSearchResults.length > 0;
  const searchResultCount = visibleSearchResults.length;
  const trimmedSearchTerm = searchTerm.trim();

  const executeSearch = async (query: string, force = false) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setSearchOpen(false);
      setDebouncedSearchTerm('');
      return;
    }

    setSearchOpen(true);
    if (trimmedQuery !== debouncedSearchTerm) setDebouncedSearchTerm(trimmedQuery);
    else if (force && searchOpen && !isSearchFetching) void refetchSearch();
  };

  useEffect(() => {
    const trimmedQuery = searchTerm.trim();
    if (!trimmedQuery) {
      setSearchOpen(false);
      setDebouncedSearchTerm('');
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void executeSearch(trimmedQuery);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [searchTerm]);

  const handleSearchSubmit = async () => {
    await executeSearch(searchTerm, true);
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

  const getResultIcon = (type: GlobalSearchResultType) => {
    switch (type) {
      case "agenda":
        return Calendar;
      case "articles":
        return FileText;
      case "technicopro":
        return Wrench;
      case "trainings":
        return BookOpen;
      case "forums":
      case "forum_topics":
      case "forum_posts":
        return MessageSquare;
      case "documents":
      case "document_folders":
        return FolderOpen;
      default:
        return FileText;
    }
  };

  const getResultTypeLabel = (type: GlobalSearchResultType) =>
    translate(`layout.searchType${type
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("")}`);

  const buildResultMeta = (result: GlobalSearchResult) =>
    [
      result.snippet,
      formatSearchDate(result.created_at),
      result.matched_fields.length
        ? translate("layout.searchMatchedFields", {
            fields: result.matched_fields.slice(0, 2).join(", "),
          })
        : "",
    ]
      .filter(Boolean)
      .join(" • ");

  const renderSearchResults = () => (
    <div className="overflow-hidden rounded-[14px] border border-[var(--archi-border)] bg-white shadow-[0_20px_50px_rgba(15,23,42,0.12)]">
      {isSearchFetching ? (
        <div className="px-4 py-3 text-[12px] font-medium text-[var(--archi-secondary)]">
          {translate("layout.searching")}
        </div>
      ) : isSearchError ? (
        <div className="px-4 py-3 text-[12px] font-medium text-[var(--archi-red)]">
          {translate("layout.searchFailed")}
        </div>
      ) : trimmedSearchTerm && hasSearchResults ? (
        <div>
          <div className="border-b border-slate-100 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--archi-muted)]">
            {translate("layout.searchResultsCount", {
              count: searchResultCount,
            })}
          </div>
          <div className="max-h-[420px] overflow-y-auto py-2">
            {visibleSearchResults.map((result) => {
              const ResultIcon = getResultIcon(result.type);
              const path = getSearchResultPath(result);
              const meta = buildResultMeta(result);

              return (
                <button
                  key={`${result.type}-${result.id}-${result.index}`}
                  type="button"
                  disabled={!path}
                  onClick={() => {
                    if (path) {
                      handleResultNavigation(path);
                    }
                  }}
                  className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--archi-surface-soft)] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                >
                  <ResultIcon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--archi-muted)]" />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex min-w-0 flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-[2px] text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500">
                        {getResultTypeLabel(result.type)}
                      </span>
                      {!path ? (
                        <span className="text-[10px] font-semibold text-[var(--archi-red)]">
                          {translate("layout.searchUnavailable")}
                        </span>
                      ) : null}
                    </div>
                    <div className="truncate text-[12.5px] font-semibold text-[var(--archi-text)]">
                      {result.title}
                    </div>
                    {meta ? (
                      <div className="line-clamp-2 break-words text-[11px] text-[var(--archi-secondary)]">
                        {meta}
                      </div>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : trimmedSearchTerm ? (
        <div className="px-4 py-3 text-[12px] font-medium text-[var(--archi-secondary)]">
          {translate("layout.searchNoResults", { query: trimmedSearchTerm })}
        </div>
      ) : null}
    </div>
  );

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
        className={`archi-scrollbar fixed inset-y-0 left-0 z-40 flex h-screen w-[240px] max-w-[85vw] shrink-0 flex-col overflow-y-auto border-r border-[var(--archi-border)] bg-[var(--archi-surface)] transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
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

              if (item.path === "/articles") {
                return (
                  <SidebarCategorySection
                    key={item.path}
                    name={item.name}
                    icon={item.icon}
                    basePath="/articles"
                    allLabel={translate("layout.allNews")}
                    isOpen={articlesDropdownOpen}
                    onToggle={() => setArticlesDropdownOpen((prev) => !prev)}
                    skip={!isAuthenticated || !hasPermission("article", "view")}
                    useGetQuery={useGetArticleCategoriesQuery}
                    useLazyQuery={useLazyGetArticleCategoriesQuery}
                    getItemPath={(category) => `/articles/category/${category.id}`}
                  />
                );
              }

              if (item.path === "/forums") {
                return (
                  <SidebarCategorySection
                    key={item.path}
                    name={item.name}
                    icon={item.icon}
                    basePath="/forums"
                    allLabel={translate("layout.allDiscussions")}
                    isOpen={forumsDropdownOpen}
                    onToggle={() => setForumsDropdownOpen((prev) => !prev)}
                    skip={!isAuthenticated}
                    useGetQuery={useGetForumsQuery}
                    useLazyQuery={useLazyGetForumsQuery}
                    getItemPath={(forum) => `/forums/${forum.id}`}
                  />
                );
              }

              if (item.path === "/trainings") {
                return (
                  <SidebarCategorySection
                    key={item.path}
                    name={item.name}
                    icon={item.icon}
                    basePath="/trainings"
                    allLabel={translate("layout.allTraining")}
                    isOpen={trainingsDropdownOpen}
                    onToggle={() => setTrainingsDropdownOpen((prev) => !prev)}
                    skip={!isAuthenticated || !hasPermission("training", "view")}
                    useGetQuery={useGetTrainingCategoriesQuery}
                    useLazyQuery={useLazyGetTrainingCategoriesQuery}
                    getItemPath={(category) => `/trainings/category/${category.id}`}
                  />
                );
              }

              if (item.path === "/technicopro") {
                return (
                  <SidebarCategorySection
                    key={item.path}
                    name={item.name}
                    icon={item.icon}
                    basePath="/technicopro"
                    allLabel={translate("layout.allTechnicoPro")}
                    isOpen={technicoProDropdownOpen}
                    onToggle={() => setTechnicoProDropdownOpen((prev) => !prev)}
                    skip={!isAuthenticated || !hasPermission("technicopro", "view")}
                    useGetQuery={useGetTechnicoProCategoriesQuery}
                    useLazyQuery={useLazyGetTechnicoProCategoriesQuery}
                    getItemPath={(category) => `/technicopro/category/${category.id}`}
                  />
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
        <header className="dashboard-header sticky top-0 z-30 flex shrink-0 flex-wrap items-center border-b border-[var(--archi-border)] bg-[var(--archi-surface)]">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[var(--archi-secondary)] hover:bg-[var(--archi-surface-soft)] lg:hidden"
            aria-label={translate("layout.openMenu")}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1 break-words text-[15px] font-semibold text-[var(--archi-text)]">
            {pageTitle}
          </div>
          <div ref={searchContainerRef} className="dashboard-search relative min-w-0">
            <div className="relative rounded-[10px] border border-[var(--archi-border)] bg-[var(--archi-surface-soft)] focus-within:border-[var(--archi-accent)] focus-within:bg-white focus-within:archi-surface-ring">
              <input
                ref={searchInputRef}
                type="text"
                aria-label={translate("layout.searchButton")}
                aria-expanded={searchOpen}
                aria-controls="global-search-results"
                placeholder={translate("layout.searchPlaceholder")}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                onFocus={() => {
                  if (trimmedSearchTerm) {
                    setSearchOpen(true);
                    if (searchOpen && isSearchError && !isSearchFetching) void refetchSearch();
                  }
                }}
                onKeyDown={handleSearchKeyDown}
                className="block w-full min-w-0 rounded-[10px] border-0 bg-transparent py-2 pl-3 pr-20 text-[13px] outline-none placeholder:text-[var(--archi-muted)]"
              />
              {searchTerm ? (
                <button
                  type="button"
                  aria-label={translate("layout.searchClear")}
                  onClick={() => {
                    setSearchTerm("");
                    setSearchOpen(false);
                    setDebouncedSearchTerm('');
                    searchInputRef.current?.focus();
                  }}
                  className="absolute inset-y-0 right-10 flex w-8 items-center justify-center text-[var(--archi-muted)] hover:text-[var(--archi-text)]"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleSearchSubmit}
                disabled={!trimmedSearchTerm}
                aria-label={translate("layout.searchButton")}
                className="absolute inset-y-0 right-0 flex w-10 cursor-pointer items-center justify-center rounded-r-[10px] text-[var(--archi-secondary)] hover:bg-[var(--archi-accent-soft)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[var(--archi-accent)]"
              >
                <Search className="h-4 w-4" />
              </button>
            </div>
            {searchOpen ? (
              <div id="global-search-results" className="absolute right-0 top-[calc(100%+10px)] z-40 w-full" aria-live="polite">
                {renderSearchResults()}
              </div>
            ) : null}
          </div>
          <LanguageSwitcher compact className="shrink-0" />
          <a
            href="https://extra.archicopro.com/index.php"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-2 rounded-[10px] border border-[var(--archi-border)] bg-white px-3 py-2 text-[12px] font-semibold text-[var(--archi-secondary)] hover:bg-[var(--archi-surface-soft)]"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {translate("layout.extranet")}
          </a>
        </header>

        <main className="min-w-0 flex-1">
          <Suspense fallback={<LoadingIndicator />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
