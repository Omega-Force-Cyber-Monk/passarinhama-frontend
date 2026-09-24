import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Clock, 
  Calendar, 
  Tag, 
  ArrowRight,
  File as FileIcon,
  Bookmark
} from 'lucide-react';
// import Markdown from 'react-markdown';
import AccessRestrictedNotice from '../components/ui/AccessRestrictedNotice';
import { FilePreviewCard } from '../components/ui/FileUploadPreview';
import { useI18n } from '../i18n';
import { 
  useGetArticleByIdQuery, 
  useGetArticlesQuery
} from '../redux/features/articles/articlesApi';
import { normalizeAttachments } from '../utils/attachments';

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
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
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
      <div className="min-h-screen bg-white px-4 py-12 sm:px-6">
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
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center space-y-6">
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

  const categoryName = article.category?.name ?? '';
  const displayDate = new Date(article.created_at).toLocaleDateString(localeCode, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const authorName =
    article.structured_fields?.author || translate('articleDetailPage.defaultAuthor');
  const authorInitials = authorName.split(' ').map(n => n[0]).join('').toUpperCase();
  const featuredImageUrl = article.thumbnail_url || null;
  const statusLabel = translate(
    `articlesPage.status${article.status.charAt(0).toUpperCase()}${article.status.slice(1)}`,
  );
  const statusClass =
    article.status === 'published'
      ? 'bg-emerald-50 text-emerald-700'
      : article.status === 'pending'
        ? 'bg-amber-50 text-amber-700'
        : 'bg-slate-100 text-slate-700';
  const attachmentUrls = (article.structured_fields?.file_urls || []).filter(
    (attachment) => {
      const url = getAttachmentUrl(attachment);
      return url && url !== featuredImageUrl;
    },
  );
  const attachments = normalizeAttachments(
    attachmentUrls,
    translate('articleDetailPage.attachmentFallback', { count: 1 }).replace('1', '').trim() ||
      'Attachment',
  );

  return (
    <div className="bg-white min-h-screen">
      {/* Article Header / Progress */}
      <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
          <button 
            onClick={() => navigate('/articles')}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold text-sm transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            {translate('articleDetailPage.back')}
          </button>
        </div>
      </div>

      <article className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6 sm:py-12">
        {/* Meta Info */}
        <header className="space-y-6 text-left">
          <div className="flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-widest">
            <span className="flex items-center gap-2 text-primary-dark">
              <Tag className="w-3 h-3" />
              {categoryName}
            </span>
            <span className={`rounded-full px-3 py-1 ${statusClass}`}>
              {statusLabel}
            </span>
          </div>
          
          <h1 className="text-3xl font-extrabold leading-tight text-slate-900 sm:text-4xl md:text-5xl">
            {article.title}
          </h1>

          <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-600">
                {authorInitials}
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-slate-900">{authorName}</p>
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">
                  {translate('articleDetailPage.publisher')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-slate-400 text-sm font-medium">
              <Calendar className="w-4 h-4" />
              {displayDate}
            </div>
            <div className="flex items-center gap-2 text-slate-400 text-sm font-medium">
              <Clock className="w-4 h-4" />
              {translate('articleDetailPage.minRead', {
                count: article.structured_fields?.estimated_read_time_minutes || 5,
              })}
            </div>
          </div>
        </header>

        {/* Featured Image */}
        <div className="aspect-video w-full overflow-hidden rounded-[24px] border border-slate-100 bg-slate-100 shadow-2xl sm:rounded-[40px]">
          {featuredImageUrl ? (
            <img
              src={featuredImageUrl}
              alt={article.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-primary flex items-center justify-center">
              <span className="text-6xl md:text-8xl font-black text-slate-900 tracking-tighter select-none">
                ARCHICOPRO
              </span>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="markdown-body prose prose-slate max-w-none prose-headings:font-bold prose-headings:text-slate-900 prose-p:text-slate-600 prose-p:leading-relaxed prose-a:text-primary prose-blockquote:border-l-primary prose-blockquote:bg-slate-50 prose-blockquote:px-6 prose-blockquote:py-2 prose-blockquote:rounded-r-xl text-left">
          {article.excerpt && (
            <p className="text-xl text-slate-500 font-medium italic mb-8 border-l-4 border-slate-200 pl-6">
              {article.excerpt}
            </p>
          )}
          <div 
            className="tiptap-content"
            dangerouslySetInnerHTML={{ __html: article.body }} 
          />
        </div>

        {/* Attachments Section */}
        {attachments.length > 0 && (
          <div className="pt-12 border-t border-slate-100 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 text-left flex items-center gap-2">
              <Bookmark className="w-5 h-5 text-primary" />
              {translate('articleDetailPage.attachmentsTitle')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {attachments.map((attachment) => (
                <FilePreviewCard
                  key={attachment.url}
                  url={attachment.url}
                  name={attachment.displayName}
                  subtitle={
                    attachment.fileSizeDisplay ||
                    attachment.mimeType ||
                    attachment.category.toUpperCase()
                  }
                  href={attachment.url}
                />
              ))}
            </div>
          </div>
        )}

        {/* Interaction Footer */}
        <footer className="flex flex-col items-start justify-between gap-6 border-t border-slate-100 pt-12 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
            {translate('articleDetailPage.lastUpdated', { date: displayDate })}
          </div>
        </footer>

        {/* Related / Next Articles Preview */}
        <div className="pt-20 space-y-8">
           <h3 className="text-2xl font-bold text-slate-900 text-left">
             {translate('articleDetailPage.continueReading')}
           </h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {relatedArticlesData?.results.filter(a => a.id !== article.id).slice(0, 2).map(item => {
                const itemCategory = item.category?.name ?? '';
                const itemDate = new Date(item.created_at).toLocaleDateString(localeCode, {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                });
                return (
                  <Link 
                    key={item.id} 
                    to={`/articles/${item.id}`}
                    className="group flex flex-col p-6 bg-slate-50 rounded-3xl border border-transparent hover:border-slate-200 hover:bg-white transition-all text-left"
                  >
                    <span className="text-[10px] font-bold text-primary-dark uppercase mb-3">{itemCategory}</span>
                    <h4 className="font-bold text-slate-900 group-hover:text-primary-dark transition-colors mb-4 line-clamp-2">{item.title}</h4>
                    <div className="mt-auto flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                        <span>{itemDate}</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </Link>
                );
              })}
           </div>
        </div>
      </article>
      
      {/* Decorative background element */}
      <div className="fixed top-0 right-0 -z-10 w-1/3 h-screen bg-slate-50/50 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2 opacity-50" />
    </div>
  );
}
