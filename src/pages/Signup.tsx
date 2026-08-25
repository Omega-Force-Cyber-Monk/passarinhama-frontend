
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { UserPlus, Mail, Lock, User, CheckCircle2, ArrowRight } from 'lucide-react';
import { useSendOtpMutation } from '../redux/features/auth/authApi';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useAppToast } from '../components/ui/AppToastProvider';
import { useI18n } from '../i18n';
import { getApiErrorDisplayMessage } from '../utils/apiErrorMessages';

export default function Signup() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const [sendOtp, { isLoading: isSendingOtp }] = useSendOtpMutation();
  const { translate } = useI18n();
  const toast = useAppToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.firstName.trim()) {
      toast.error(
        translate("common.requiredField", {
          field: translate("signup.firstName"),
        }),
      );
      return;
    }

    if (!formData.lastName.trim()) {
      toast.error(
        translate("common.requiredField", {
          field: translate("signup.lastName"),
        }),
      );
      return;
    }

    if (!formData.email.trim()) {
      toast.error(
        translate("common.requiredField", {
          field: translate("signup.professionalEmail"),
        }),
      );
      return;
    }

    if (!formData.password.trim()) {
      toast.error(
        translate("common.requiredField", {
          field: translate("signup.password"),
        }),
      );
      return;
    }

    if (!formData.confirmPassword.trim()) {
      toast.error(
        translate("common.requiredField", {
          field: translate("signup.confirmPassword"),
        }),
      );
      return;
    }
    
    if (formData.password !== formData.confirmPassword) {
      toast.error(translate("signup.passwordsDoNotMatch"));
      return;
    }

    try {
      await sendOtp({ email: formData.email, purpose: 'signup' }).unwrap();
      navigate('/verify-otp', { 
        state: { 
          signupData: {
            first_name: formData.firstName,
            last_name: formData.lastName,
            email: formData.email,
            password: formData.password,
            role: 'membre'
          }
        } 
      });
    } catch (err: any) {
      toast.error(getApiErrorDisplayMessage(err, translate));
    }
  };


  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="fixed top-4 right-4 z-10">
          <LanguageSwitcher />
        </div>
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-gray-100 p-10 text-center space-y-6"
        >
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600">
             <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 leading-tight">
            {translate("signup.successTitle")}
          </h2>
          <p className="text-slate-500 text-sm leading-relaxed">
            {translate("signup.successBody")}
          </p>
          <div className="pt-4">
            <Link to="/login" className="text-primary-dark font-bold flex items-center justify-center gap-2 hover:gap-3 transition-all underline">
              {translate("signup.returnToLogin")} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 py-12 relative">
      <div className="fixed top-4 right-4 z-10">
        <LanguageSwitcher />
      </div>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden"
      >
        <div className="p-8 bg-primary flex flex-col items-center text-black">
          <div className="w-16 h-16 bg-white flex items-center justify-center rounded-2xl shadow-xl border-4 border-white mb-4 overflow-hidden">
             <img src="/logo.png" alt="ARCHICOPRO" className="w-full h-full object-cover" />
          </div>
          <h2 className="text-2xl font-black tracking-tighter uppercase leading-none">
            {translate("signup.title")}
          </h2>
          <p className="opacity-80 text-center mt-2 px-6 italic text-[11px] font-bold leading-tight uppercase tracking-widest">
            {translate("signup.subtitle")}
          </p>
        </div>

        <form noValidate onSubmit={handleSubmit} className="p-8 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                {translate("signup.firstName")}
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-sm"
                  placeholder="Jean"
                  value={formData.firstName}
                  onChange={e => setFormData({...formData, firstName: e.target.value})}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                {translate("signup.lastName")}
              </label>
              <input 
                type="text" 
                required
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-sm"
                placeholder="Dupont"
                value={formData.lastName}
                onChange={e => setFormData({...formData, lastName: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
              {translate("signup.professionalEmail")}
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="email" 
                required
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-sm"
                placeholder="architect@cabinet.fr"
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
              {translate("signup.password")}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="password" 
                required
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-sm"
                placeholder="••••••••"
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
              {translate("signup.confirmPassword")}
            </label>
            <input 
              type="password" 
              required
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-sm"
              placeholder="••••••••"
              value={formData.confirmPassword}
              onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
            />
          </div>

          <div className="pt-4">
            <button 
              type="submit"
              disabled={isSendingOtp}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg transform active:scale-95 transition-all flex items-center justify-center gap-2 group disabled:opacity-50 uppercase tracking-widest text-[11px]"
            >
              {isSendingOtp ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>{translate("signup.requestMembership")}</span>
                </>
              )}
            </button>
          </div>
        </form>


        <div className="px-8 pb-8 text-center text-xs text-slate-400 font-bold uppercase tracking-widest">
           {translate("signup.alreadyMember")} <Link to="/login" className="text-primary-dark underline hover:text-black">{translate("signup.signIn")}</Link>
        </div>
      </motion.div>
    </div>
  );
}
