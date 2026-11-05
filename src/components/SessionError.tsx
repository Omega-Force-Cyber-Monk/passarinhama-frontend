import { useDispatch, useSelector } from 'react-redux';
import { useI18n } from '../i18n';
import { membersApi } from '../redux/features/members/membersApi';
import { retrySession } from '../redux/features/auth/authSlice';
import type { AppDispatch, RootState } from '../redux/store';

export default function SessionError() {
  const dispatch = useDispatch<AppDispatch>();
  const error = useSelector((state: RootState) => state.auth.error);
  const { translate } = useI18n();
  const retry = () => {
    dispatch(retrySession());
    void dispatch(membersApi.endpoints.getUsersMe.initiate(undefined, { forceRefetch: true, subscribe: false }));
  };
  return <div className="flex min-h-screen items-center justify-center p-6">
    <div role="alert" className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center">
      <h1 className="text-xl font-bold">{translate('sessionError.title')}</h1>
      <p className="my-4 text-slate-600">{translate(error === 403 ? 'sessionError.forbidden' : 'sessionError.message')}</p>
      <button type="button" onClick={retry} className="rounded-xl bg-slate-900 px-5 py-3 font-bold text-white">{translate('routeError.tryAgain')}</button>
    </div>
  </div>;
}
