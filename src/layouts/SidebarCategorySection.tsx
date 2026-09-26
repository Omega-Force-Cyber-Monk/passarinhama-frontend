import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { useI18n } from "../i18n";
import type { CategoryQueryParams, PaginatedResponse } from "../redux/features/api/apiTypes";

export interface SidebarCategoryItem {
  id: string;
  name: string;
}

export interface SidebarCategorySectionProps<T extends SidebarCategoryItem> {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  basePath: string;
  allLabel: string;
  isOpen: boolean;
  onToggle: () => void;
  skip?: boolean;
  // RTK Query query hook (subscribes to page 1 and invalidation tags)
  useGetQuery: (
    arg: CategoryQueryParams | void,
    options?: { skip?: boolean }
  ) => {
    data?: PaginatedResponse<T>;
    isLoading: boolean;
    isFetching: boolean;
    isError: boolean;
  };
  // RTK Query lazy query hook (triggers subsequent pages on scroll)
  useLazyQuery: () => [
    (arg: CategoryQueryParams) => { unwrap: () => Promise<PaginatedResponse<T>> },
    { isFetching: boolean },
    ...unknown[]
  ];
  getItemPath: (item: T) => string;
  pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 20;

export function SidebarCategorySection<T extends SidebarCategoryItem>({
  name,
  icon: Icon,
  basePath,
  allLabel,
  isOpen,
  onToggle,
  skip = false,
  useGetQuery,
  useLazyQuery,
  getItemPath,
  pageSize = DEFAULT_PAGE_SIZE,
}: SidebarCategorySectionProps<T>) {
  const { translate } = useI18n();
  const location = useLocation();

  // Lazy loading: do not fetch until this dropdown has been opened at least once
  const [hasEverOpened, setHasEverOpened] = useState(isOpen);
  useEffect(() => {
    if (isOpen && !hasEverOpened) {
      setHasEverOpened(true);
    }
  }, [isOpen, hasEverOpened]);

  // Page 1 query actively subscribes to RTK Query cache and tag invalidations
  const {
    data: page1Data,
    isLoading: isPage1Loading,
    isError: isPage1Error,
  } = useGetQuery(
    { page: 1, pageSize },
    { skip: skip || !hasEverOpened }
  );

  const [triggerLazyQuery] = useLazyQuery();

  // State for subsequent pages
  const [additionalItems, setAdditionalItems] = useState<T[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);

  const isFetchingNextPageRef = useRef(false);
  const currentPageRef = useRef(1);
  const totalPagesRef = useRef(1);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Sync state when page 1 data arrives or refetches from server invalidation
  useEffect(() => {
    if (page1Data) {
      const serverTotalPages = Math.max(1, page1Data.total_pages || 1);
      totalPagesRef.current = serverTotalPages;
      setTotalPages(serverTotalPages);

      // When fresh page 1 data arrives from server (initial load or tag invalidation),
      // reset additional pages so the sidebar stays fully consistent with fresh server data.
      setAdditionalItems([]);
      currentPageRef.current = 1;
      setCurrentPage(1);
    }
  }, [page1Data]);

  // Combined deduplicated displayed items
  const displayedItems = useMemo(() => {
    const page1Items = page1Data?.results ?? [];
    if (additionalItems.length === 0) return page1Items;

    const seenIds = new Set(page1Items.map((item) => item.id));
    const uniqueAdditional = additionalItems.filter((item) => !seenIds.has(item.id));
    return [...page1Items, ...uniqueAdditional];
  }, [page1Data?.results, additionalItems]);

  // Infinite scroll: fetch next page
  const fetchNextPage = useCallback(async () => {
    if (isFetchingNextPageRef.current) return;
    if (currentPageRef.current >= totalPagesRef.current) return;

    const nextPage = currentPageRef.current + 1;
    isFetchingNextPageRef.current = true;
    setIsFetchingNextPage(true);

    try {
      const res = await triggerLazyQuery({
        page: nextPage,
        pageSize,
      }).unwrap();

      if (res && Array.isArray(res.results)) {
        setAdditionalItems((prev) => {
          const existingIds = new Set([
            ...(page1Data?.results?.map((i) => i.id) ?? []),
            ...prev.map((i) => i.id),
          ]);
          const newItems = res.results.filter((i) => !existingIds.has(i.id));
          return [...prev, ...newItems];
        });

        currentPageRef.current = nextPage;
        setCurrentPage(nextPage);

        if (typeof res.total_pages === "number") {
          const newTotalPages = Math.max(1, res.total_pages);
          totalPagesRef.current = newTotalPages;
          setTotalPages(newTotalPages);
        }
      }
    } catch (err) {
      console.error(`Failed to load page ${nextPage} for ${name}`, err);
    } finally {
      isFetchingNextPageRef.current = false;
      setIsFetchingNextPage(false);
    }
  }, [triggerLazyQuery, pageSize, page1Data?.results, name]);

  // Internal scroll handler for category list
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distanceFromBottom <= 50) {
        if (!isFetchingNextPageRef.current && currentPageRef.current < totalPagesRef.current) {
          fetchNextPage();
        }
      }
    },
    [fetchNextPage]
  );

  // Active state calculations
  const isParentActive =
    basePath === "/"
      ? location.pathname === basePath
      : location.pathname === basePath || location.pathname.startsWith(`${basePath}/`);

  const isAllActive = location.pathname === basePath;

  return (
    <div className="rounded-[12px]">
      {/* Module expand / collapse toggle button */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className={`flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-[9px] text-left text-[15px] font-semibold transition-all cursor-pointer ${
          isParentActive
            ? "bg-[var(--archi-accent)] text-[var(--archi-text)]"
            : "text-[var(--archi-text)] hover:bg-[var(--archi-surface-soft)]"
        }`}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" />
        <span className="truncate">{name}</span>
        <ChevronDown
          className={`ml-auto h-4 w-4 shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Collapsible dropdown container */}
      <div
        className={`relative ml-3.5 pl-4 transition-all duration-300 ease-in-out ${
          isOpen
            ? "max-h-[380px] py-1 opacity-100"
            : "max-h-0 overflow-hidden py-0 opacity-0 pointer-events-none"
        }`}
      >
        {/* Left vertical border guideline */}
        <div className="absolute bottom-1.5 left-[6px] top-1.5 w-px bg-[var(--archi-border)]" />

        {/* Top "All" navigation item - stays pinned above the scroll area */}
        <Link
          to={basePath}
          className={`relative flex items-center gap-2.5 rounded-[10px] px-2.5 py-1.5 text-[12.5px] font-medium transition-all ${
            isAllActive
              ? "bg-[var(--archi-surface-soft)] text-[var(--archi-text)] font-semibold"
              : "text-[var(--archi-secondary)] hover:bg-[var(--archi-surface-soft)] hover:text-[var(--archi-text)]"
          }`}
        >
          <span
            className={`h-[5px] w-[5px] shrink-0 rounded-full ${
              isAllActive ? "bg-[var(--archi-text)]" : "bg-[var(--archi-muted)]"
            }`}
          />
          <span className="truncate text-left">{allLabel}</span>
        </Link>

        {/* Subtle divider between "All" and scrollable category list */}
        <div className="my-1 border-t border-[var(--archi-border)]/40" />

        {/* Scrollable category list */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          tabIndex={0}
          role="region"
          aria-label={`${name} categories`}
          className="archi-scrollbar max-h-[280px] overflow-y-auto space-y-0.5 pr-1 focus:outline-none"
        >
          {/* Initial loading skeleton */}
          {isPage1Loading && displayedItems.length === 0 && (
            <div className="space-y-1.5 px-2.5 py-1">
              <div className="flex items-center gap-2.5">
                <div className="h-[5px] w-[5px] shrink-0 rounded-full bg-[var(--archi-muted)]/40" />
                <div className="h-3 w-28 animate-pulse rounded bg-[var(--archi-border)]/60" />
              </div>
              <div className="flex items-center gap-2.5">
                <div className="h-[5px] w-[5px] shrink-0 rounded-full bg-[var(--archi-muted)]/40" />
                <div className="h-3 w-36 animate-pulse rounded bg-[var(--archi-border)]/60" />
              </div>
              <div className="flex items-center gap-2.5">
                <div className="h-[5px] w-[5px] shrink-0 rounded-full bg-[var(--archi-muted)]/40" />
                <div className="h-3 w-20 animate-pulse rounded bg-[var(--archi-border)]/60" />
              </div>
            </div>
          )}

          {/* Empty state */}
          {!isPage1Loading && displayedItems.length === 0 && !isPage1Error && (
            <div className="px-2.5 py-1 text-[11px] text-[var(--archi-secondary)] italic">
              {translate("common.noData") || "No categories"}
            </div>
          )}

          {/* Error state */}
          {isPage1Error && displayedItems.length === 0 && (
            <div className="px-2.5 py-1 text-[11px] text-red-500">
              {translate("common.error") || "Failed to load"}
            </div>
          )}

          {/* Categories list */}
          {displayedItems.map((category) => {
            const categoryPath = getItemPath(category);
            const isCategoryActive =
              location.pathname === categoryPath ||
              location.pathname.startsWith(`${categoryPath}/`);

            return (
              <Link
                key={category.id}
                to={categoryPath}
                title={category.name}
                className={`relative flex items-center gap-2.5 rounded-[10px] px-2.5 py-1.5 text-[12.5px] font-medium transition-all ${
                  isCategoryActive
                    ? "bg-[var(--archi-surface-soft)] text-[var(--archi-text)] font-semibold"
                    : "text-[var(--archi-secondary)] hover:bg-[var(--archi-surface-soft)] hover:text-[var(--archi-text)]"
                }`}
              >
                <span
                  className={`h-[5px] w-[5px] shrink-0 rounded-full ${
                    isCategoryActive
                      ? "bg-[var(--archi-text)]"
                      : "bg-[var(--archi-muted)]"
                  }`}
                />
                <span className="truncate text-left">{category.name}</span>
              </Link>
            );
          })}

          {/* Next page loading indicator */}
          {isFetchingNextPage && (
            <div className="flex items-center gap-2 px-2.5 py-1.5 text-[11.5px] text-[var(--archi-secondary)]">
              <div className="h-3 w-3 animate-spin rounded-full border border-primary border-t-transparent" />
              <span>{translate("common.loading") || "Loading..."}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SidebarCategorySection;
