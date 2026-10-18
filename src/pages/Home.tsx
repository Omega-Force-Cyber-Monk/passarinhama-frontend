import { useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  BookOpen,
  Calendar,
  FileText,
  MapPin,
  MessageSquare,
} from "lucide-react";
import AccessRestrictedNotice from "../components/ui/AccessRestrictedNotice";
import {
  useGetForumsQuery,
} from "../redux/features/forum/forumApi";
import {
  useGetArticlesQuery,
} from "../redux/features/articles/articlesApi";
import { useGetUpcomingEventsQuery } from "../redux/features/events/eventsApi";
import { useGetTrainingsPaginatedQuery } from "../redux/features/trainings/trainingsApi";
import { useI18n } from "../i18n";
import { usePermissions } from "../hooks/usePermissions";

const stripHtml = (value?: string | null) =>
  (value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const SkeletonLine = ({ className }: { className: string }) => (
  <div className={`rounded-full bg-[var(--archi-surface-soft)] ${className}`} />
);

const MAX_SECTION_CARDS = 4;

type SectionGridProps<T> = {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  agenda?: boolean;
};

const SectionGrid = <T,>({ items, getKey, renderItem, agenda = false }: SectionGridProps<T>) => (
  <div className={`home-card-grid${agenda ? "" : " home-content-grid"}`}>
    {items.slice(0, MAX_SECTION_CARDS).map((item) => (
      <div className="min-w-0" key={getKey(item)}>{renderItem(item)}</div>
    ))}
  </div>
);

const AgendaCardSkeleton = () => (
  <div className="home-agenda-card flex items-center rounded-[24px] border border-[var(--archi-border)] bg-white animate-pulse" aria-hidden="true">
    <div className="home-agenda-date shrink-0 rounded-[20px] bg-[var(--archi-surface-soft)]" />
    <div className="min-w-0 flex-1 space-y-2">
      <SkeletonLine className="h-4 w-full" />
      <SkeletonLine className="h-3 w-3/4" />
    </div>
  </div>
);

const ContentCardSkeleton = () => (
  <div className="home-content-card animate-pulse" aria-hidden="true">
    <div className="home-card-image" />
    <div className="home-card-body">
      <SkeletonLine className="home-card-title w-4/5" />
      <SkeletonLine className="home-card-description w-full" />
      <SkeletonLine className="home-card-metadata w-3/5" />
    </div>
  </div>
);

type ContentCardProps = {
  image?: string | null;
  icon: ReactNode;
  badge?: string | null;
  title: string;
  description?: string | null;
  metadata?: ReactNode;
  onClick: () => void;
};

const ContentCard = ({ image, icon, badge, title, description, metadata, onClick }: ContentCardProps) => {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  return (
    <button type="button" onClick={onClick} className="home-content-card group cursor-pointer text-left transition-all hover:-translate-y-0.5 hover:border-[var(--archi-border-strong)] hover:shadow-[var(--archi-shadow-md)]">
      <div className="home-card-image">
        <div className="absolute inset-0 flex items-center justify-center text-[var(--archi-muted)]" aria-hidden="true">{icon}</div>
        {image && failedImage !== image ? (
          <img src={image} alt="" loading="lazy" onError={() => setFailedImage(image)} className="relative h-full w-full object-cover transition-transform duration-[400ms] group-hover:scale-105" />
        ) : null}
        {badge ? <span className="home-card-badge">{badge}</span> : null}
      </div>
      <div className="home-card-body">
        <div className="home-card-title">{title}</div>
        <div className="home-card-description">{description}</div>
        <div className="home-card-metadata"><span>{metadata}</span></div>
      </div>
    </button>
  );
};

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const { localeCode, translate } = useI18n();
  const { hasPermission } = usePermissions();
  const canViewForum = hasPermission("forum", "view");
  const canViewArticle = hasPermission("article", "view");
  const canViewEvent = hasPermission("event", "view");
  const canViewTraining = hasPermission("training", "view");
  const canViewDocument = hasPermission("document", "view");
  const canViewAnyHomeSection =
    canViewForum ||
    canViewArticle ||
    canViewEvent ||
    canViewTraining ||
    canViewDocument;
  const showRestrictedNotice =
    Boolean((location.state as { accessRestricted?: boolean } | null)?.accessRestricted) ||
    !canViewAnyHomeSection;

  const { data: forumsData, isLoading: isForumsLoading } = useGetForumsQuery(
    { pageSize: MAX_SECTION_CARDS },
    { skip: !canViewForum },
  );
  const { data: upcomingEvents = [], isLoading: isEventsLoading } =
    useGetUpcomingEventsQuery(
      { limit: MAX_SECTION_CARDS },
      { skip: !canViewEvent },
    );
  const { data: articlesData, isLoading: isArticlesLoading } = useGetArticlesQuery(
    {
      page: 1,
      pageSize: MAX_SECTION_CARDS,
      status: "published",
    },
    { skip: !canViewArticle },
  );
  const { data: trainingsData, isLoading: isTrainingsLoading } =
    useGetTrainingsPaginatedQuery(
      {
        page: 1,
        pageSize: MAX_SECTION_CARDS,
        status: "published",
        details: true,
      },
      { skip: !canViewTraining },
    );

  const articles = articlesData?.results || [];
  const trainings = trainingsData?.results || [];
  const forums = forumsData?.results ?? [];

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
      <main className="home-page bg-[var(--archi-bg)]">
        <AccessRestrictedNotice />
      </main>
    );
  }

  return (
    <main className="home-page bg-[var(--archi-bg)]">
      {showRestrictedNotice && (
        <section className="mb-10">
          <AccessRestrictedNotice />
        </section>
      )}

      {canViewForum && <section className="mb-10">
        <div className="mb-5">
          <div className="home-section-heading">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <div className="home-section-icon flex shrink-0 items-center justify-center rounded-[14px] bg-[var(--archi-accent)]/20 text-[var(--archi-text)]">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <h2 className="home-section-title font-bold tracking-[-0.02em] text-[var(--archi-text)]">
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
          <div className="home-card-grid">
            {Array.from({ length: MAX_SECTION_CARDS }).map((_, index) => (
              <ContentCardSkeleton key={index} />
            ))}
          </div>
        ) : forums.length > 0 ? (
          <SectionGrid
            items={forums}
            getKey={(forum) => forum.id}
            renderItem={(forum) => (
              <ContentCard
                image={forum.thumbnail_url}
                icon={<MessageSquare className="h-8 w-8" />}
                title={forum.name}
                description={stripHtml(forum.description) || translate("memberHome.defaultForumDescription")}
                metadata={<><MessageSquare className="mr-1 inline h-3.5 w-3.5" /><span>{forum.topic_count} {translate("memberHome.topics")}{forum.author_name ? " \u00b7 " + forum.author_name : ""}</span></>}
                onClick={() => navigate(`/forums/${forum.id}`)}
              />
            )}
          />
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
          <div className="home-section-heading">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <div className="home-section-icon flex shrink-0 items-center justify-center rounded-[14px] bg-[var(--archi-accent)]/20 text-[var(--archi-text)]">
                  <Calendar className="h-5 w-5" />
                </div>
                <h2 className="home-section-title font-bold tracking-[-0.02em] text-[var(--archi-text)]">
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
          <div className="home-card-grid">
            {Array.from({ length: 4 }).map((_, index) => (
              <AgendaCardSkeleton key={index} />
            ))}
          </div>
        ) : upcomingEvents.length > 0 ? (
          <SectionGrid
            agenda
            items={upcomingEvents}
            getKey={(event) => event.id}
            renderItem={(event) => {
              const eventDate = new Date(event.event_date);

              return (
                <button
                  type="button"
                  onClick={() => navigate(`/agenda/${event.id}`)}
                  className="home-agenda-card cursor-pointer flex h-full w-full items-center rounded-[24px] border border-[#e7e3dd] bg-white text-left shadow-[0_4px_18px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_26px_rgba(15,23,42,0.1)]"
                >
                  <div className="home-agenda-date flex shrink-0 flex-col items-center justify-center rounded-[20px] border border-[#d7d8df] bg-[#f4f5f8] text-center">
                    <span className="home-agenda-month font-bold uppercase tracking-[0.12em] text-[#8b92a4]">
                      {eventDate.toLocaleDateString(localeCode, {
                        month: "short",
                      })}
                    </span>
                    <span className="home-agenda-day mt-1 font-bold leading-none text-[var(--archi-text)]">
                      {eventDate.toLocaleDateString(localeCode, {
                        day: "2-digit",
                      })}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <div className="home-agenda-title font-bold leading-[1.25] text-[var(--archi-text)]">
                      {event.title}
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[13px] text-[#73798c]">
                      <MapPin className="h-4 w-4 shrink-0" />
                      <span className="truncate">{event.location}</span>
                    </div>
                  </div>
                </button>
              );
            }}
          />
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
          <div className="home-section-heading">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <div className="home-section-icon flex shrink-0 items-center justify-center rounded-[14px] bg-[var(--archi-accent)]/20 text-[var(--archi-text)]">
                  <BookOpen className="h-5 w-5" />
                </div>
                <h2 className="home-section-title font-bold tracking-[-0.02em] text-[var(--archi-text)]">
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
          <div className="home-card-grid">
            {Array.from({ length: 4 }).map((_, index) => (
              <ContentCardSkeleton key={index} />
            ))}
          </div>
        ) : trainings.length > 0 ? (
          <SectionGrid
            items={trainings}
            getKey={(training) => training.id}
            renderItem={(training) => {
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
                <ContentCard
                  image={trainingImage}
                  icon={<BookOpen className="h-8 w-8" />}
                  badge={trainingMeta}
                  title={training.title}
                  description={trainingSummary}
                  metadata={[training.created_by?.first_name, training.created_by?.last_name].filter(Boolean).join(" ") || translate("articlesPage.defaultAuthor")}
                  onClick={() => navigate('/trainings/' + training.id)}
                />
              );
            }}
          />
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
          <div className="home-section-heading">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <div className="home-section-icon flex shrink-0 items-center justify-center rounded-[14px] bg-[var(--archi-accent)]/20 text-[var(--archi-text)]">
                  <FileText className="h-5 w-5" />
                </div>
                <h2 className="home-section-title font-bold tracking-[-0.02em] text-[var(--archi-text)]">
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
          <div className="home-card-grid">
            {Array.from({ length: 4 }).map((_, index) => (
              <ContentCardSkeleton key={index} />
            ))}
          </div>
        ) : articles.length > 0 ? (
          <SectionGrid
            items={articles}
            getKey={(article) => article.id}
            renderItem={(article) => {
              const articleImage =
                article.thumbnail_url ||
                getAttachmentUrl(article.structured_fields?.file_urls?.[0]) ||
                null;

              return (
                <ContentCard
                  image={articleImage}
                  icon={<FileText className="h-8 w-8" />}
                  badge={article.category?.name}
                  title={article.title}
                  description={article.excerpt || stripHtml(article.body) || translate("memberHome.articleFallback")}
                  metadata={[article.author?.name, formatDate(article.created_at)].filter(Boolean).join(" \u00b7 ")}
                  onClick={() => navigate('/articles/' + article.id)}
                />
              );
            }}
          />
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
