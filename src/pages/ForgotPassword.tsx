import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Mail, ArrowLeft, Send, CheckCircle2, Lock } from 'lucide-react';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useAppToast } from '../components/ui/AppToastProvider';
import { useI18n } from '../i18n';
import {
  useForgotPasswordMutation,
  useSendOtpMutation,
} from '../redux/features/auth/authApi';
import { getApiErrorDisplayMessage } from '../utils/apiErrorMessages';

type ForgotPasswordRouteState = {
  email?: string;
  sessionKey?: string;
  purpose?: 'forgot_password';
};

export default function ForgotPassword() {
  const location = useLocation();
  const navigate = useNavigate();
  const routeState = (location.state ?? {}) as ForgotPasswordRouteState;
  const [email, setEmail] = useState(routeState.email || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { translate } = useI18n();
  const toast = useAppToast();
  const [sendOtp, { isLoading: isSendingOtp }] = useSendOtpMutation();
  const [forgotPassword, { isLoading: isResettingPassword }] =
    useForgotPasswordMutation();
  const isResetStep = Boolean(routeState.sessionKey && routeState.email);

  useEffect(() => {
    if (routeState.email) {
      setEmail(routeState.email);
    }
  }, [routeState.email]);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error(
        translate("common.requiredField", {
          field: translate("forgotPassword.emailAddress"),
        }),
      );
      return;
    }

    try {
      await sendOtp({ email: email.trim(), purpose: 'forgot_password' }).unwrap();
      navigate('/verify-otp', {
        state: {
          email: email.trim(),
          purpose: 'forgot_password',
        },
      });
    } catch (err: any) {
      toast.error(getApiErrorDisplayMessage(err, translate));
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword.trim()) {
      toast.error(
        translate("common.requiredField", {
          field: translate("forgotPassword.newPassword"),
        }),
      );
      return;
    }

    if (!confirmPassword.trim()) {
      toast.error(
        translate("common.requiredField", {
          field: translate("forgotPassword.confirmNewPassword"),
        }),
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(translate('forgotPassword.passwordsDoNotMatch'));
      return;
    }

    if (!routeState.sessionKey || !routeState.email) {
      toast.error(translate('forgotPassword.missingResetSession'));
      return;
    }

    try {
      const response = await forgotPassword({
        email: routeState.email,
        new_password: newPassword,
        session_key: routeState.sessionKey,
      }).unwrap();

      setSuccessMessage(response.message || translate('forgotPassword.passwordResetSuccess'));
      setTimeout(() => navigate('/login'), 1800);
    } catch (err: any) {
      toast.error(getApiErrorDisplayMessage(err, translate));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 relative">
      <div className="fixed top-4 right-4 z-10">
        <LanguageSwitcher />
      </div>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden"
      >
        <div className="p-8 bg-slate-900 flex flex-col items-center text-white">
          <div className="w-16 h-16 bg-white flex items-center justify-center rounded-2xl shadow-xl border-4 border-slate-900 mb-4 overflow-hidden">
             <img src="/logo.png" alt="ARCHICOPRO" className="w-full h-full object-cover" />
          </div>
          <h2 className="text-2xl font-black tracking-tighter uppercase leading-none">
            {translate("forgotPassword.title")}
          </h2>
          <p className="opacity-60 text-center mt-2 px-6 text-[10px] font-bold leading-tight uppercase tracking-[0.2em] text-primary">
            {translate("forgotPassword.subtitle")}
          </p>
        </div>

        <div className="p-8">
          {!successMessage ? (
            <form
              noValidate
              onSubmit={isResetStep ? handleResetPassword : handleRequestOtp}
              className="space-y-6"
            >
              <p className="text-slate-500 text-sm leading-relaxed text-center">
                {isResetStep
                  ? translate("forgotPassword.resetDescription")
                  : translate("forgotPassword.description")}
              </p>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                  {translate("forgotPassword.emailAddress")}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="email" 
                    required
                    disabled={isResetStep}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-sm"
                    placeholder={translate("forgotPassword.emailPlaceholder")}
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
              </div>

              {isResetStep ? (
                <>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                      {translate("forgotPassword.newPassword")}
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="password"
                        required
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-sm"
                        placeholder="••••••••"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                      {translate("forgotPassword.confirmNewPassword")}
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="password"
                        required
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-sm"
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              ) : null}

              <button 
                type="submit"
                disabled={isSendingOtp || isResettingPassword}
                className="w-full bg-primary hover:bg-primary-dark text-black font-bold py-4 px-6 rounded-xl shadow-lg transform active:scale-95 transition-all flex items-center justify-center gap-2 group disabled:opacity-50 uppercase tracking-widest text-[11px]"
              >
                {isSendingOtp || isResettingPassword ? (
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    {isResetStep ? <CheckCircle2 className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                    <span>
                      {isResetStep
                        ? translate("forgotPassword.resetPassword")
                        : translate("forgotPassword.sendInstructions")}
                    </span>
                  </>
                )}
              </button>
            </form>
          ) : (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-4"
            >
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600 mb-4">
                 <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                {translate("forgotPassword.passwordResetDone")}
              </h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                {successMessage}
              </p>
            </motion.div>
          )}

          <div className="mt-8 pt-6 border-t border-slate-100 flex justify-center">
            <Link to="/login" className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-900 uppercase tracking-widest transition-colors">
              <ArrowLeft className="w-4 h-4" />
              {translate("forgotPassword.backToLogin")}
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
