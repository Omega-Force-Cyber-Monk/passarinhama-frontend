import { ShieldAlert } from "lucide-react";
import { useI18n } from "../../i18n";

type AccessRestrictedNoticeProps = {
  className?: string;
};

export default function AccessRestrictedNotice({
  className = "",
}: AccessRestrictedNoticeProps) {
  const { translate } = useI18n();

  return (
    <div
      className={`rounded-3xl border border-amber-200 bg-amber-50/80 p-8 text-center shadow-sm ${className}`.trim()}
    >
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
        <ShieldAlert className="h-8 w-8" />
      </div>
      <h2 className="text-2xl font-bold text-slate-900">
        {translate("common.accessRestrictedTitle")}
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-600">
        {translate("common.accessRestrictedMessage")}
      </p>
    </div>
  );
}
