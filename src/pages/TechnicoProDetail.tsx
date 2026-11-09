import { ContentDetailLayout, DetailHeader, DetailMetadataItem, RichContentRenderer, DetailAttachments, DetailUpdated, formatDetailDate } from "../components/ui/ContentDetail";
import { File as FileIcon } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import AccessRestrictedNotice from "../components/ui/AccessRestrictedNotice";
import { useI18n } from "../i18n";
import { useGetTechnicoProByIdQuery } from "../redux/features/technicopro/technicoproApi";
import { normalizeAttachments } from "../utils/attachments";

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
  const { currentData: item, isLoading, isFetching, isError, error } = useGetTechnicoProByIdQuery(technicoproId || "", {
    skip: !technicoproId,
  });

  if (isLoading || (isFetching && !item)) {
    return (
      <div className="content-detail-state">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="animate-pulse font-bold text-slate-500">{translate("common.loading")}</p>
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
      <div className="content-detail-state">
        <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-red-50">
          <FileIcon className="h-12 w-12 text-red-500" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900">
            {translate("contentDetail.technicoproNotFoundTitle")}
          </h2>
          <p className="max-w-md text-slate-500">
            {translate("contentDetail.technicoproNotFoundMessage")}
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

  const authorName = item.author?.name || item.structured_fields?.author || translate("articleDetailPage.defaultAuthor");
  const attachments = normalizeAttachments(item.structured_fields?.file_urls || [], translate("contentDetail.attachment"));
  const categoryName = item.category?.name || translate("common.technicopro");

  return (
    <ContentDetailLayout backTo="/technicopro" moduleLabel={translate("common.technicopro")} category={item.category?.name ? { name: item.category.name, path: item.category.id ? '/technicopro/category/' + item.category.id : undefined } : undefined}>
      <DetailHeader title={item.title} category={categoryName} status={item.status} author={authorName} authorRole={translate("contentDetail.author")} metadata={<>
        <DetailMetadataItem label={translate("contentDetail.created")}>{formatDetailDate(item.created_at, localeCode)}</DetailMetadataItem>
        {item.published_at ? <DetailMetadataItem label={translate("contentDetail.published")}>{formatDetailDate(item.published_at, localeCode)}</DetailMetadataItem> : null}
      </>} />
      <RichContentRenderer html={item.body || ""} excerpt={item.excerpt} />
      <DetailAttachments attachments={attachments} />
      <DetailUpdated value={item.updated_at || item.created_at} />
    </ContentDetailLayout>
  );
}
