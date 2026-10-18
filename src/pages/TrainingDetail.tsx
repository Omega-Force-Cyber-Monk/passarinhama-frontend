import { ContentDetailLayout, DetailHeader, DetailMetadataItem, RichContentRenderer, DetailAttachments, DetailUpdated, formatDetailDate } from "../components/ui/ContentDetail";
import { File as FileIcon } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import AccessRestrictedNotice from "../components/ui/AccessRestrictedNotice";
import { useI18n } from "../i18n";
import { useGetTrainingByIdQuery } from "../redux/features/trainings/trainingsApi";
import { normalizeAttachments } from "../utils/attachments";

const getErrorStatus = (error: unknown) => {
  if (error && typeof error === "object" && "status" in error) {
    return (error as { status?: number | string }).status;
  }
  return undefined;
};

export default function TrainingDetail() {
  const { trainingId } = useParams<{ trainingId: string }>();
  const navigate = useNavigate();
  const { localeCode, translate } = useI18n();
  const { data: training, isLoading, isError, error } = useGetTrainingByIdQuery(trainingId || "", {
    skip: !trainingId,
  });

  if (isLoading) {
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
            onClick={() => navigate("/trainings")}
            className="mt-6 rounded-2xl bg-slate-900 px-8 py-3 font-bold text-white shadow-xl hover:bg-slate-800"
          >
            {translate("articleDetailPage.back")}
          </button>
        </div>
      </div>
    );
  }

  if (isError || !training) {
    return (
      <div className="content-detail-state">
        <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-red-50">
          <FileIcon className="h-12 w-12 text-red-500" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900">
            {translate("contentDetail.trainingNotFoundTitle")}
          </h2>
          <p className="max-w-md text-slate-500">
            {translate("contentDetail.trainingNotFoundMessage")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/trainings")}
          className="rounded-2xl bg-slate-900 px-8 py-3 font-bold text-white shadow-xl hover:bg-slate-800"
        >
          {translate("articleDetailPage.back")}
        </button>
      </div>
    );
  }

  const authorName = [training.created_by?.first_name, training.created_by?.last_name].filter(Boolean).join(" ").trim() || translate("trainingsPage.defaultCreator");
  const attachments = normalizeAttachments(training.attachments || [], translate("contentDetail.attachment"));
  const categoryName = training.category?.name || translate("common.training");

  return (
    <ContentDetailLayout backTo="/trainings" moduleLabel={translate("common.training")} category={training.category?.name ? { name: training.category.name, path: training.category.id ? '/trainings/category/' + training.category.id : undefined } : undefined}>
      <DetailHeader title={training.title} category={categoryName} status={training.status} author={authorName} authorRole={translate("contentDetail.creator")} metadata={<>
        <DetailMetadataItem label={translate("contentDetail.created")}>{formatDetailDate(training.created_at, localeCode)}</DetailMetadataItem>
        {training.published_at ? <DetailMetadataItem label={translate("contentDetail.published")}>{formatDetailDate(training.published_at, localeCode)}</DetailMetadataItem> : null}
      </>} />
      <RichContentRenderer html={training.description || ""} excerpt={training.excerpt} />
      <DetailAttachments attachments={attachments} />
      <DetailUpdated value={training.updated_at || training.created_at} />
    </ContentDetailLayout>
  );
}
