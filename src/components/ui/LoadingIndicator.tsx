import { useI18n } from '../../i18n';

export default function LoadingIndicator({ fullScreen = false }: { fullScreen?: boolean }) {
  const { translate } = useI18n();
  return (
    <div role="status" aria-live="polite" className={`flex items-center justify-center px-6 ${fullScreen ? 'min-h-screen' : 'min-h-[40vh]'}`}>
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-600 shadow-sm">
        <div aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span>{translate('common.loading')}</span>
      </div>
    </div>
  );
}
