import { useLocation, useNavigate } from "react-router-dom";
import { BookOpen, Calendar, FileText, MapPin, MessageSquare } from "lucide-react";
import { useSelector } from "react-redux";
import AccessRestrictedNotice from "../components/ui/AccessRestrictedNotice";
import {
  useGetForumsQuery,
  useGetPinnedTopicsQuery,
} from "../redux/features/forum/forumApi";
import {
  useGetArticlesQuery,
} from "../redux/features/articles/articlesApi";
import { useGetUpcomingEventsQuery } from "../redux/features/events/eventsApi";
import { useGetTrainingsPaginatedQuery } from "../redux/features/trainings/trainingsApi";
import { useI18n } from "../i18n";
import { RootState } from "../redux/store";
import { usePermissions } from "../hooks/usePermissions";

const stripHtml = (value?: string | null) =>
  (value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const truncate = (value: string, maxLength: number) =>
  value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;

const SkeletonLine = ({ className }: { className: string }) => (
  <div className={`rounded-full bg-[var(--archi-surface-soft)] ${className}`} />
);

const ForumCardSkeleton = () => (
  <div className="overflow-hidden rounded-[14px] border border-[var(--archi-border)] bg-white shadow-[var(--archi-shadow-sm)] animate-pulse">
    <div className="relative h-[100px] bg-[var(--archi-surface-soft)]">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-[42px] w-[42px] rounded-full bg-white/80" />
      </div>
    </div>
    <div className="flex flex-col px-4 pb-4 pt-3.5">
      <SkeletonLine className="mb-[8px] h-4 w-3/5" />
      <SkeletonLine className="mb-2 h-3.5 w-full" />
      <SkeletonLine className="h-3.5 w-4/5" />
      <div className="mt-4 flex items-center gap-2">
        <div className="h-4 w-4 rounded-full bg-[var(--archi-surface-soft)]" />
        <SkeletonLine className="h-3.5 w-20" />
      </div>
    </div>
  </div>
);

const TrainingCardSkeleton = () => (
  <div className="overflow-hidden rounded-[14px] border border-[var(--archi-border)] bg-white shadow-[var(--archi-shadow-sm)] animate-pulse">
    <div className="h-[150px] bg-[var(--archi-surface-soft)]" />
    <div className="flex flex-col px-4 pb-4 pt-3.5">
      <SkeletonLine className="mb-[8px] h-3.5 w-2/5" />
      <SkeletonLine className="mb-2 h-4 w-4/5" />
      <SkeletonLine className="mb-3 h-4 w-3/5" />
      <div className="flex items-center gap-2">
        <div className="h-5 w-5 rounded-full bg-[var(--archi-surface-soft)]" />
        <SkeletonLine className="h-3.5 w-28" />
      </div>
    </div>
  </div>
);

const ArticleCardSkeleton = () => (
  <div className="flex h-full flex-col overflow-hidden rounded-[14px] border border-[var(--archi-border)] bg-white shadow-[var(--archi-shadow-sm)] animate-pulse">
    <div className="relative h-[140px] bg-[var(--archi-surface-soft)]">
      <div className="absolute left-2.5 top-2.5 h-5 w-20 rounded-full bg-white/80" />
    </div>
    <div className="flex flex-1 flex-col px-4 pb-4 pt-3.5">
      <SkeletonLine className="mb-[8px] h-3.5 w-2/5" />
      <SkeletonLine className="mb-2 h-4 w-4/5" />
      <SkeletonLine className="mb-2 h-4 w-3/5" />
      <SkeletonLine className="mb-2 h-3.5 w-full" />
      <SkeletonLine className="h-3.5 w-5/6" />
    </div>
  </div>
);

const PostCardSkeleton = () => (
  <div className="flex h-full flex-col overflow-hidden rounded-[14px] border border-[var(--archi-border)] bg-white shadow-[var(--archi-shadow-sm)] animate-pulse">
    <div className="relative h-[120px] bg-[var(--archi-surface-soft)]">
      <div className="absolute bottom-2 left-2.5 h-5 w-32 rounded-full bg-white/80" />
    </div>
    <div className="flex flex-1 flex-col px-4 pb-4 pt-3.5">
      <SkeletonLine className="mb-[8px] h-3.5 w-2/5" />
      <SkeletonLine className="mb-2 h-4 w-4/5" />
      <SkeletonLine className="mb-2 h-4 w-3/5" />
      <SkeletonLine className="mb-2 h-3.5 w-full" />
      <SkeletonLine className="h-3.5 w-4/5" />
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-[22px] w-[22px] rounded-full bg-[var(--archi-surface-soft)]" />
          <SkeletonLine className="h-3.5 w-24" />
        </div>
        <SkeletonLine className="h-3.5 w-6" />
      </div>
    </div>
  </div>
);

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const { localeCode, translate } = useI18n();
  const { user } = useSelector((state: RootState) => state.auth);
  const { hasPermission } = usePermissions();
  const MAX_SECTION_CARDS = 4;
  const canViewForum =
    Boolean(user?.is_superuser) || hasPermission("forum", "view");
  const canViewArticle =
    Boolean(user?.is_superuser) || hasPermission("article", "view");
  const canViewEvent =
    Boolean(user?.is_superuser) || hasPermission("event", "view");
  const canViewTraining =
    Boolean(user?.is_superuser) || hasPermission("training", "view");
  const canViewDocument =
    Boolean(user?.is_superuser) || hasPermission("document", "view");
  const canViewAnyHomeSection =
    canViewForum ||
    canViewArticle ||
    canViewEvent ||
    canViewTraining ||
    canViewDocument;
  const showRestrictedNotice =
    Boolean((location.state as { accessRestricted?: boolean } | null)?.accessRestricted) ||
    !canViewAnyHomeSection;

  const { data: forums = [], isLoading: isForumsLoading } = useGetForumsQuery(
    undefined,
    { skip: !canViewForum } as any,
  );
  const { data: upcomingEvents = [], isLoading: isEventsLoading } =
    useGetUpcomingEventsQuery(
      { limit: MAX_SECTION_CARDS },
      { skip: !canViewEvent } as any,
    );
  const { data: articlesData, isLoading: isArticlesLoading } = useGetArticlesQuery(
    {
      page: 1,
      pageSize: MAX_SECTION_CARDS,
      status: "published",
    },
    { skip: !canViewArticle } as any,
  );
  const { data: trainingsData, isLoading: isTrainingsLoading } =
    useGetTrainingsPaginatedQuery(
      {
        page: 1,
        pageSize: MAX_SECTION_CARDS,
        status: "published",
        details: true,
      },
      { skip: !canViewTraining } as any,
    );

  const articles = (articlesData?.results || []).slice(0, MAX_SECTION_CARDS);
  const trainings = (trainingsData?.results || []).slice(0, MAX_SECTION_CARDS);
  const visibleForums = forums.slice(0, MAX_SECTION_CARDS);
  const visibleEvents = upcomingEvents.slice(0, MAX_SECTION_CARDS);

const formatDate = (value?: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(localeCode, {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
};

const getAttachmentUrl = (value: string | { url: string } | null | undefined) =>
  typeof value === "string" ? value : value?.url || null;

  if (!canViewAnyHomeSection) {
    return (
      <main className="bg-[var(--archi-bg)] px-4 pb-12 pt-8 lg:px-8">
        <AccessRestrictedNotice />
      </main>
    );
  }

  return (
    <main className="bg-[var(--archi-bg)] px-4 pb-12 pt-8 lg:px-8">
      {showRestrictedNotice && (
        <section className="mb-10">
          <AccessRestrictedNotice />
        </section>
      )}

      {canViewForum && <section className="mb-10">
        <div className="mb-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[var(--archi-accent)]/20 text-[var(--archi-text)]">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <h2 className="text-[22px] font-bold tracking-[-0.02em] text-[var(--archi-text)]">
                  {translate("memberHome.forumsTitle")}
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate("/forums")}
              className="cursor-pointer inline-flex shrink-0 items-center rounded-[10px] bg-[var(--archi-accent)] px-4 py-2 text-xs font-semibold text-[var(--archi-text)] transition-all hover:bg-[var(--archi-accent-hover)]"
            >
              {translate("memberHome.viewAll")} →
            </button>
          </div>

          <div className="mt-3">
            <p className="text-[14px] text-[var(--archi-secondary)]">
              {translate("memberHome.forumsDescription")}
            </p>
          </div>
        </div>

        {isForumsLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: MAX_SECTION_CARDS }).map((_, index) => (
              <ForumCardSkeleton key={index} />
            ))}
          </div>
        ) : visibleForums.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {visibleForums.map((forum) => (
              <button
                type="button"
                key={forum.id}
                onClick={() => navigate(`/forums/${forum.id}`)}
                className="cursor-pointer group flex flex-col overflow-hidden rounded-[14px] border border-[var(--archi-border)] bg-white text-left shadow-[var(--archi-shadow-sm)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--archi-border-strong)] hover:shadow-[var(--archi-shadow-md)]"
              >
                {forum.thumbnail_url ? (
                  <div className="relative h-[120px] overflow-hidden">
                    <img
                      src={forum.thumbnail_url}
                      alt={forum.name}
                      className="h-full w-full object-cover transition-transform duration-[400ms] group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,.35)_0%,transparent_60%)]" />
                  </div>
                ) : (
                  <div className="px-4 pt-4">
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[14px] bg-[var(--archi-accent)]/20 text-[var(--archi-text)]">
                      <MessageSquare className="h-5 w-5" />
                    </div>
                  </div>
                )}
                <div className="flex flex-1 flex-col px-4 pb-4 pt-3.5">
                  <div className="mb-[5px] text-[13.5px] font-bold text-[var(--archi-text)]">
                    {forum.name}
                  </div>
                  <div className="line-clamp-3 text-[11.5px] leading-[1.5] text-[var(--archi-secondary)]">
                    {forum.author_name ||
                      translate("memberHome.defaultForumDescription")}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 text-[var(--archi-secondary)]">
                      <MessageSquare className="h-3.5 w-3.5" />
                      {forum.topic_count} {translate("memberHome.topics")}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-[14px] border border-dashed border-[var(--archi-border-strong)] bg-white px-6 py-10 text-center text-sm text-[var(--archi-secondary)]">
            {translate("memberHome.noForums")}
          </div>
        )}
      </section>}

      {canViewForum && canViewEvent && (
        <div className="my-10 h-px bg-[var(--archi-border)]" />
      )}

      {canViewEvent && <section className="mb-10">
        <div className="mb-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[var(--archi-accent)]/20 text-[var(--archi-text)]">
                  <Calendar className="h-5 w-5" />
                </div>
                <h2 className="text-[22px] font-bold tracking-[-0.02em] text-[var(--archi-text)]">
                  {translate("memberHome.agenda.title")}
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate("/agenda")}
              className="cursor-pointer inline-flex shrink-0 items-center rounded-[10px] bg-[var(--archi-accent)] px-4 py-2 text-xs font-semibold text-[var(--archi-text)] transition-all hover:bg-[var(--archi-accent-hover)]"
            >
              {translate("memberHome.viewAll")} →
            </button>
          </div>

          <div className="mt-3">
            <p className="text-[14px] text-[var(--archi-secondary)]">
              {translate("memberHome.agenda.description")}
            </p>
          </div>
        </div>

        {isEventsLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <TrainingCardSkeleton key={index} />
            ))}
          </div>
        ) : visibleEvents.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-4 md:grid-cols-2">
            {visibleEvents.map((event) => {
              const eventDate = new Date(event.event_date);

              return (
                <button
                  type="button"
                  key={event.id}
                  onClick={() => navigate(`/agenda/${event.id}`)}
                  className="cursor-pointer flex items-center gap-4 rounded-[24px] border border-[#e7e3dd] bg-white px-6 py-5 text-left shadow-[0_4px_18px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_26px_rgba(15,23,42,0.1)]"
                >
                  <div className="flex h-[88px] w-[88px] shrink-0 flex-col items-center justify-center rounded-[20px] border border-[#d7d8df] bg-[#f4f5f8] text-center">
                    <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8b92a4]">
                      {eventDate.toLocaleDateString(localeCode, {
                        month: "short",
                      })}
                    </span>
                    <span className="mt-1 text-[24px] font-bold leading-none text-[var(--archi-text)]">
                      {eventDate.toLocaleDateString(localeCode, {
                        day: "2-digit",
                      })}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <div className="text-[18px] font-bold leading-[1.25] text-[var(--archi-text)]">
                      {event.title}
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[13px] text-[#73798c]">
                      <MapPin className="h-4 w-4 shrink-0" />
                      <span className="truncate">{event.location}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[14px] border border-dashed border-[var(--archi-border-strong)] bg-white px-6 py-10 text-center text-sm text-[var(--archi-secondary)]">
            {translate("agendaPage.noUpcomingEvents")}
          </div>
        )}
      </section>}

      {canViewEvent && canViewTraining && (
        <div className="my-10 h-px bg-[var(--archi-border)]" />
      )}

      {canViewTraining && <section className="mb-10">
        <div className="mb-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[var(--archi-accent)]/20 text-[var(--archi-text)]">
                  <BookOpen className="h-5 w-5" />
                </div>
                <h2 className="text-[22px] font-bold tracking-[-0.02em] text-[var(--archi-text)]">
                  {translate("memberHome.trainingsTitle")}
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate("/trainings")}
              className="cursor-pointer inline-flex shrink-0 items-center rounded-[10px] bg-[var(--archi-accent)] px-4 py-2 text-xs font-semibold text-[var(--archi-text)] transition-all hover:bg-[var(--archi-accent-hover)]"
            >
              {translate("memberHome.viewAll")} →
            </button>
          </div>

          <div className="mt-3">
            <p className="text-[14px] text-[var(--archi-secondary)]">
              {translate("memberHome.trainingsDescription")}
            </p>
          </div>
        </div>

        {isTrainingsLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <TrainingCardSkeleton key={index} />
            ))}
          </div>
        ) : trainings.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {trainings.map((training) => {
              const trainingImage =
                training.thumbnail_url || getAttachmentUrl(training.attachments?.[0]) || null;
              const trainingMeta =
                training.category?.name ||
                formatDate(training.published_at || training.created_at);
              const trainingSummary =
                training.excerpt ||
                (training.description || "")
                  .replace(/<[^>]*>/g, " ")
                  .replace(/&nbsp;/g, " ")
                  .replace(/\s+/g, " ")
                  .trim();

              return (
              <button
                type="button"
                key={training.id}
                onClick={() => navigate(`/trainings/${training.id}`)}
                className="cursor-pointer group overflow-hidden rounded-[14px] border border-[var(--archi-border)] bg-white text-left shadow-[var(--archi-shadow-sm)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--archi-border-strong)] hover:shadow-[var(--archi-shadow-md)]"
              >
                {trainingImage ? (
                  <div className="relative h-[150px] overflow-hidden">
                    <img
                      src={trainingImage}
                      alt={training.title}
                      className="h-full w-full object-cover transition-transform duration-[400ms] group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,.45)_0%,transparent_60%)]" />
                  </div>
                ) : null}
                <div className="flex flex-col px-4 pb-4 pt-3.5">
                  <div className="mb-[5px] text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--archi-secondary)]">
                    {trainingMeta}
                  </div>
                  <div className="mb-2 text-[13px] font-bold leading-[1.4] text-[var(--archi-text)]">
                    {training.title}
                  </div>
                  {trainingSummary ? (
                    <p className="mb-3 line-clamp-2 text-[12px] leading-relaxed text-[var(--archi-secondary)]">
                      {trainingSummary}
                    </p>
                  ) : null}
                  <div className="flex items-center gap-1.5 text-[11.5px] text-[var(--archi-secondary)]">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-cyan-400 text-[8px] font-bold text-white">
                      {`${training.created_by?.first_name?.[0] || ""}${training.created_by?.last_name?.[0] || ""}`.trim() ||
                        "AC"}
                    </div>
                    <span>
                      {[training.created_by?.first_name, training.created_by?.last_name]
                        .filter(Boolean)
                        .join(" ") || translate("articlesPage.defaultAuthor")}
                    </span>
                  </div>
                </div>
              </button>
            );
            })}
          </div>
        ) : (
          <div className="rounded-[14px] border border-dashed border-[var(--archi-border-strong)] bg-white px-6 py-10 text-center text-sm text-[var(--archi-secondary)]">
            {translate("memberHome.noTrainings")}
          </div>
        )}
      </section>}

      {canViewTraining && canViewArticle && (
        <div className="my-10 h-px bg-[var(--archi-border)]" />
      )}

      {canViewArticle && <section className="mb-10">
        <div className="mb-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[var(--archi-accent)]/20 text-[var(--archi-text)]">
                  <FileText className="h-5 w-5" />
                </div>
                <h2 className="text-[22px] font-bold tracking-[-0.02em] text-[var(--archi-text)]">
                  {translate("memberHome.articlesTitle")}
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate("/articles")}
              className="cursor-pointer inline-flex shrink-0 items-center rounded-[10px] bg-[var(--archi-accent)] px-4 py-2 text-xs font-semibold text-[var(--archi-text)] transition-all hover:bg-[var(--archi-accent-hover)]"
            >
              {translate("memberHome.viewAll")} →
            </button>
          </div>

          <div className="mt-3">
            <p className="text-[14px] text-[var(--archi-secondary)]">
              {translate("memberHome.articlesDescription")}
            </p>
          </div>
        </div>

        {isArticlesLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <ArticleCardSkeleton key={index} />
            ))}
          </div>
        ) : articles.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {articles.map((article) => {
              const articleImage =
                article.thumbnail_url ||
                getAttachmentUrl(article.structured_fields?.file_urls?.[0]) ||
                null;

              return (
              <button
                type="button"
                key={article.id}
                onClick={() => navigate(`/articles/${article.id}`)}
                className="cursor-pointer group flex h-full flex-col overflow-hidden rounded-[14px] border border-[var(--archi-border)] bg-white text-left shadow-[var(--archi-shadow-sm)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--archi-border-strong)] hover:shadow-[var(--archi-shadow-md)]"
              >
                {articleImage ? (
                  <div className="relative h-[140px] overflow-hidden">
                    <img
                      src={articleImage}
                      alt={article.title}
                      className="h-full w-full object-cover transition-transform duration-[400ms] group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,.45)_0%,transparent_55%)]" />
                    <span className="absolute left-2.5 top-2.5 rounded-full bg-[var(--archi-accent)] px-2 py-[3px] text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--archi-text)] backdrop-blur">
                      {article.category?.name}
                    </span>
                  </div>
                ) : (
                  <div className="px-4 pt-4">
                    <span className="inline-flex rounded-full bg-[var(--archi-accent)] px-2 py-[3px] text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--archi-text)]">
                      {article.category?.name}
                    </span>
                  </div>
                )}
                <div className="flex flex-1 flex-col px-4 pb-4 pt-3.5">
                  <div className="mb-[5px] text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--archi-muted)]">
                    {formatDate(article.created_at)}
                  </div>
                  <div className="mb-2 text-[13px] font-bold leading-[1.4] text-[var(--archi-text)]">
                    {article.title}
                  </div>
                  <div className="text-xs leading-[1.5] text-[var(--archi-secondary)]">
                    {truncate(
                      article.excerpt ||
                        stripHtml(article.body) ||
                        translate("memberHome.articleFallback"),
                      130,
                    )}
                  </div>
                </div>
              </button>
            );
            })}
          </div>
        ) : (
          <div className="rounded-[14px] border border-dashed border-[var(--archi-border-strong)] bg-white px-6 py-10 text-center text-sm text-[var(--archi-secondary)]">
            {translate("memberHome.noArticles")}
          </div>
        )}
      </section>}

      {/* User types section intentionally hidden */}
    </main>
  );
}
