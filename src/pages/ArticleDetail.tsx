import { ContentDetailLayout, DetailHeader, DetailMetadataItem, RichContentRenderer, DetailAttachments, DetailUpdated, DetailSection, formatDetailDate } from "../components/ui/ContentDetail";
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowRight, File as FileIcon } from 'lucide-react';
import AccessRestrictedNotice from '../components/ui/AccessRestrictedNotice';
import { useI18n } from '../i18n';
import { 
  useGetArticleByIdQuery, 
  useGetArticlesQuery
} from '../redux/features/articles/articlesApi';
import { normalizeAttachments } from '../utils/attachments';
import type { ArticleAttachment } from '../redux/features/articles/articleTypes';

const getAttachmentUrl = (attachment: string | { url: string }) =>
  typeof attachment === 'string' ? attachment : attachment.url;

const getErrorStatus = (error: unknown) => {
  if (error && typeof error === 'object' && 'status' in error) {
    return (error as { status?: number | string }).status;
  }
  return undefined;
};

export default function ArticleDetail() {
  const { slug } = useParams<{ slug: string }>(); // Using slug as id in the path
  const navigate = useNavigate();
  const { localeCode, translate } = useI18n();
  
  const { data: article, isLoading, isError, error } = useGetArticleByIdQuery(slug || '');
  const { data: relatedArticlesData } = useGetArticlesQuery({ page: 1, pageSize: 5 });

  if (isLoading) {
    return (
      <div className="content-detail-state">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 font-bold animate-pulse">
          {translate('articleDetailPage.loadingArticle')}
        </p>
      </div>
    );
  }

  const errorStatus = getErrorStatus(error);

  if (errorStatus === 403) {
    return (
      <div className="content-detail-page">
        <div className="mx-auto max-w-4xl">
          <AccessRestrictedNotice />
          <button
            onClick={() => navigate('/articles')}
            className="mt-6 px-8 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl"
          >
            {translate('articleDetailPage.backToArticles')}
          </button>
        </div>
      </div>
    );
  }

  if (isError || !article) {
    return (
      <div className="content-detail-state">
        <div className="w-24 h-24 bg-red-50 rounded-3xl flex items-center justify-center">
          <FileIcon className="w-12 h-12 text-red-500" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900">
            {translate('articleDetailPage.notFoundTitle')}
          </h2>
          <p className="text-slate-500 max-w-md">
            {translate('articleDetailPage.notFoundMessage')}
          </p>
        </div>
        <button 
          onClick={() => navigate('/articles')}
          className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl"
        >
          {translate('articleDetailPage.backToArticles')}
        </button>
      </div>
    );
  }

  const categoryName = article.category?.name ?? "";
  const authorName = article.structured_fields?.author || article.author?.name || translate("articleDetailPage.defaultAuthor");
  const sources = [...(article.structured_fields?.file_urls || []), ...(article.attachments || [])];
  if (article.pdf_url && !sources.some((source) => getAttachmentUrl(source) === article.pdf_url)) sources.push(article.pdf_url);
  const uniqueSources = new Map<string, string | ArticleAttachment>();
  for (const source of sources) {
    const url = getAttachmentUrl(source);
    if (!url) continue;
    const existing = uniqueSources.get(url);
    // Keep the original structured-file metadata while enriching string-only
    // entries with metadata from the explicit attachments response field.
    const merged = existing && typeof existing === "object"
      ? typeof source === "object"
        ? { ...source, ...Object.fromEntries(Object.entries(existing).filter(([, value]) => value != null && value !== "")) }
        : existing
      : source;
    uniqueSources.set(url, merged);
  }
  const attachments = normalizeAttachments([...uniqueSources.values()], translate("contentDetail.attachment"));
  const relatedArticles = (relatedArticlesData?.results || []).filter((item) => item.id !== article.id).slice(0, 2);

  return (
    <ContentDetailLayout backTo="/articles" moduleLabel={translate("common.articles")} category={categoryName ? { name: categoryName, path: article.category?.id ? '/articles/category/' + article.category.id : undefined } : undefined}>
      <DetailHeader title={article.title} category={categoryName} status={article.status} author={authorName} authorRole={translate("articleDetailPage.publisher")} metadata={<>
        <DetailMetadataItem label={translate("contentDetail.created")}>{formatDetailDate(article.created_at, localeCode)}</DetailMetadataItem>
        {article.published_at ? <DetailMetadataItem label={translate("contentDetail.published")}>{formatDetailDate(article.published_at, localeCode)}</DetailMetadataItem> : null}
        <DetailMetadataItem label={translate("contentDetail.readingTime")}>{translate("articleDetailPage.minRead", { count: article.structured_fields?.estimated_read_time_minutes || 5 })}</DetailMetadataItem>
      </>} />
      <RichContentRenderer html={article.body || ""} excerpt={article.excerpt} />
      <DetailAttachments attachments={attachments} />
      <DetailUpdated value={article.updated_at || article.created_at} />
      {relatedArticles.length ? <DetailSection title={translate("articleDetailPage.continueReading")}>
        <div className="detail-related-grid">
          {relatedArticles.map((item) => <Link key={item.id} to={'/articles/' + item.id} className="detail-related-card group">
            {item.category?.name ? <span className="detail-meta-label text-primary-dark">{item.category.name}</span> : null}
            <h3 className="font-bold text-slate-900 group-hover:text-primary-dark">{item.title}</h3>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span>{new Date(item.created_at).toLocaleDateString(localeCode, { day: "numeric", month: "short", year: "numeric" })}</span>
              <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" />
            </div>
          </Link>)}
        </div>
      </DetailSection> : null}
    </ContentDetailLayout>
  );
}
