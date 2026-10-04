import React from "react";
import { ArrowLeft, Bookmark, Calendar, File as FileIcon, Tag, User } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import AccessRestrictedNotice from "../components/ui/AccessRestrictedNotice";
import { FilePreviewCard } from "../components/ui/FileUploadPreview";
import { useI18n } from "../i18n";
import { useGetTechnicoProByIdQuery } from "../redux/features/technicopro/technicoproApi";
import type {
  TechnicoProStatus,
} from "../redux/features/technicopro/technicoproTypes";
import { normalizeAttachments } from "../utils/attachments";

const getStatusClasses = (status: TechnicoProStatus) => {
  if (status === "published") return "bg-emerald-50 text-emerald-700";
  if (status === "pending") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-700";
};

const getErrorStatus = (error: unknown) => {
  if (error && typeof error === "object" && "status" in error) {
    return (error as { status?: number | string }).status;
  }
  return undefined;
};

export default function TechnicoProDetail() {
  const { technicoproId } = useParams<{ technicoproId: string }>();
  const navigate = useNavigate();
  const { localeCode, translate } = useI18n();
  const { data: item, isLoading, isError, error } = useGetTechnicoProByIdQuery(technicoproId || "", {
    skip: !technicoproId,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="animate-pulse font-bold text-slate-500">{translate("common.loading")}</p>
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
            type="button"
            onClick={() => navigate("/technicopro")}
            className="mt-6 rounded-2xl bg-slate-900 px-8 py-3 font-bold text-white shadow-xl hover:bg-slate-800"
          >
            {translate("articleDetailPage.back")}
          </button>
        </div>
      </div>
    );
  }

  if (isError || !item) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-6 px-6 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-red-50">
          <FileIcon className="h-12 w-12 text-red-500" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900">
            {translate("articleDetailPage.notFoundTitle")}
          </h2>
          <p className="max-w-md text-slate-500">
            {translate("articleDetailPage.notFoundMessage")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/technicopro")}
          className="rounded-2xl bg-slate-900 px-8 py-3 font-bold text-white shadow-xl hover:bg-slate-800"
        >
          {translate("articleDetailPage.back")}
        </button>
      </div>
    );
  }

  const displayDate = new Date(item.created_at).toLocaleDateString(localeCode, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const authorName =
    item.author?.name || item.structured_fields?.author || translate("articleDetailPage.defaultAuthor");
  const attachments = normalizeAttachments(item.structured_fields?.file_urls || [], "Attachment");

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
          <button
            type="button"
            onClick={() => navigate("/technicopro")}
            className="flex items-center gap-2 text-sm font-bold text-slate-500 transition-colors hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            {translate("articleDetailPage.back")}
          </button>
        </div>
      </div>

      <article className="mx-auto max-w-4xl space-y-8 px-4 py-8 text-left sm:px-6 sm:py-12">
        <header className="space-y-6">
          <div className="flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-widest">
            <span className="flex items-center gap-2 text-primary-dark">
              <Tag className="h-3 w-3" />
              {item.category?.name || translate("common.technicopro")}
            </span>
            <span className={`rounded-full px-3 py-1 ${getStatusClasses(item.status)}`}>
              {translate(`articlesPage.status${item.status.charAt(0).toUpperCase()}${item.status.slice(1)}`)}
            </span>
          </div>

          <h1 className="text-3xl font-extrabold leading-tight text-slate-900 sm:text-4xl md:text-5xl">
            {item.title}
          </h1>

          <div className="flex flex-wrap items-center gap-6 border-t border-slate-100 pt-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-400">
              <User className="h-4 w-4" />
              {authorName}
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-400">
              <Calendar className="h-4 w-4" />
              {displayDate}
            </div>
          </div>
        </header>

        <div className="prose prose-slate max-w-none text-left prose-headings:font-bold prose-headings:text-slate-900 prose-p:leading-relaxed prose-p:text-slate-600">
          {item.excerpt ? (
            <p className="mb-8 border-l-4 border-slate-200 pl-6 text-xl font-medium italic text-slate-500">
              {item.excerpt}
            </p>
          ) : null}
          <div className="tiptap-content" dangerouslySetInnerHTML={{ __html: item.body || "" }} />
        </div>

        {attachments.length ? (
          <div className="space-y-4 border-t border-slate-100 pt-12">
            <h3 className="flex items-center gap-2 text-left text-lg font-bold text-slate-900">
              <Bookmark className="h-5 w-5 text-primary" />
              {translate("articleDetailPage.attachmentsTitle")}
            </h3>
            <div className="grid grid-cols-1 justify-items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {attachments.map((attachment) => {
                return (
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
                    aspectClassName="h-36"
                    mediaShapeClassName="rounded-xl"
                    className="w-full sm:max-w-[280px]"
                  />
                );
              })}
            </div>
          </div>
        ) : null}

        <footer className="flex justify-end border-t border-slate-100 pt-12 text-xs font-bold uppercase tracking-widest text-slate-400">
          {translate("articleDetailPage.lastUpdated", { date: displayDate })}
        </footer>
      </article>
    </div>
  );
}
