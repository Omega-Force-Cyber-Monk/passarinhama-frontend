
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, ArrowLeft, RefreshCw, CheckCircle2 } from 'lucide-react';
import {
  useSignupMutation,
  useSendOtpMutation,
  useVerifyOtpMutation,
} from '../redux/features/auth/authApi';
import { useDispatch } from 'react-redux';
import { setCredentials } from '../redux/features/auth/authSlice';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useAppToast } from '../components/ui/AppToastProvider';
import { useI18n } from '../i18n';
import { getApiErrorDisplayMessage } from '../utils/apiErrorMessages';

type OtpLocationState = {
  signupData?: {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
    role: string;
  };
  email?: string;
  purpose?: 'signup' | 'forgot_password';
};

export default function OTPVerification() {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [success, setSuccess] = useState(false);
  const [timer, setTimer] = useState(59);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { translate } = useI18n();
  const toast = useAppToast();

  const locationState = (location.state ?? {}) as OtpLocationState;
  const signupData = locationState.signupData;
  const purpose = locationState.purpose || (signupData ? 'signup' : 'forgot_password');
  const email = signupData?.email || locationState.email || '';

  const [signup, { isLoading: isSigningUp }] = useSignupMutation();
  const [verifyOtp, { isLoading: isVerifyingOtp }] = useVerifyOtpMutation();
  const [sendOtp, { isLoading: isResendingOtp }] = useSendOtpMutation();

  useEffect(() => {
    let interval: any;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleChange = (element: HTMLInputElement, index: number) => {
    if (isNaN(Number(element.value))) return false;

    setOtp([...otp.map((d, idx) => (idx === index ? element.value : d))]);

    // Focus next input
    if (element.value !== '' && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace' && otp[index] === '' && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const data = e.clipboardData.getData('text').trim();
    if (!data) return;

    // Filter only numbers and take up to 6 characters
    const pasteData = data.replace(/\D/g, '').split('').slice(0, 6);
    if (pasteData.length === 0) return;

    const newOtp = [...otp];
    pasteData.forEach((char, index) => {
      newOtp[index] = char;
    });
    
    setOtp(newOtp);
    
    // Focus the next empty input or the last one
    const nextIndex = pasteData.length < 6 ? pasteData.length : 5;
    inputs.current[nextIndex]?.focus();
    
    e.preventDefault();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const otpValue = otp.join('');

    if (otp.some((digit) => !digit.trim())) {
      toast.error(
        translate("common.requiredField", {
          field: translate("otp.securityVerification"),
        }),
      );
      return;
    }
    
    try {
      if (signupData) {
        // Complete Signup
        const response = await signup({ 
          ...signupData, 
          otp_value: otpValue 
        }).unwrap();
        
        // Store credentials
        dispatch(setCredentials(response));
        setSuccess(true);
        
        setTimeout(() => {
          navigate('/');
        }, 3000);
      } else if (purpose === 'forgot_password' && email) {
        const response = await verifyOtp({
          email,
          otp_value: otpValue,
          purpose: 'forgot_password',
        }).unwrap();

        navigate('/forgot-password', {
          replace: true,
          state: {
            email,
            sessionKey: response.sessionKey || response.session_key,
            purpose: 'forgot_password',
          },
        });
      } else {
        toast.error(translate("otp.missingVerificationContext"));
      }
    } catch (err: any) {
      toast.error(getApiErrorDisplayMessage(err, translate));
    }
  };

  const handleResend = async () => {
    try {
      if (!email) {
        toast.error(translate("otp.missingVerificationContext"));
        return;
      }

      await sendOtp({ email, purpose }).unwrap();
      setTimer(59);
      setOtp(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    } catch (err: any) {
      toast.error(getApiErrorDisplayMessage(err, translate));
    }
  };


  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 relative">
        <div className="fixed top-4 right-4 z-10">
          <LanguageSwitcher />
        </div>
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 p-12 text-center space-y-6"
        >
          <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600">
             <CheckCircle2 className="w-12 h-12" />
          </div>
          <h2 className="text-3xl font-black text-slate-900 leading-tight">
            {translate("otp.identityVerified")}
          </h2>
          <p className="text-slate-500 text-sm leading-relaxed px-4">
            {translate("otp.successBody")}
          </p>
          <div className="flex justify-center">
             <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 relative">
      <div className="fixed top-4 right-4 z-10">
        <LanguageSwitcher />
      </div>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 overflow-hidden"
      >
        <div className="p-10 bg-slate-900 flex flex-col items-center text-white relative">
           <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -mr-16 -mt-16" />
           <div className="w-16 h-16 bg-white/10 backdrop-blur-md flex items-center justify-center rounded-2xl border border-white/20 mb-6 group transition-all">
              <ShieldCheck className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />
           </div>
           <h2 className="text-2xl font-black tracking-tight uppercase">
             {translate("otp.securityVerification")}
           </h2>
           <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mt-2">
             {translate("otp.twoFactorAuthentication")}
           </p>
        </div>

        <div className="p-10 text-center">
          <p className="text-slate-500 text-sm mb-8">
            {translate("otp.sentCodeTo")}<br />
            <span className="font-bold text-slate-900">{email}</span>
          </p>

          <form noValidate onSubmit={handleSubmit} className="space-y-8">
            <div className="flex justify-between gap-2">
              {otp.map((data, index) => (
                <input
                  key={index}
                  type="text"
                  maxLength={1}
                  ref={(el) => { inputs.current[index] = el; }}
                  className="w-12 h-14 bg-slate-50 border-2 border-slate-100 rounded-xl text-center text-xl font-bold text-slate-900 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                  value={data}
                  onChange={(e) => handleChange(e.target, index)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  onPaste={handlePaste}
                />
              ))}
            </div>

            <div className="pt-2">
              <button 
                type="submit"
                disabled={isSigningUp || isVerifyingOtp}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-2xl shadow-xl transform active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-30 uppercase tracking-widest text-xs"
              >
                {isSigningUp || isVerifyingOtp ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <span>{translate("otp.verifyIdentity")}</span>
                )}
              </button>
            </div>
          </form>

          <div className="mt-8 flex flex-col items-center gap-4">
             <div className="text-xs font-bold uppercase tracking-widest">
                {timer > 0 ? (
                  <span className="text-slate-400 italic">
                    {translate("otp.resendCodeIn")}{" "}
                    <span className="text-primary-dark">{timer}s</span>
                  </span>
                ) : (
                  <button 
                    onClick={handleResend} 
                    disabled={isResendingOtp}
                    className="text-primary-dark underline hover:text-black disabled:opacity-50"
                  >
                     {isResendingOtp
                       ? translate("otp.sending")
                       : translate("otp.resendVerificationCode")}
                  </button>
                )}
             </div>

             
             <button 
               onClick={() => navigate('/login')}
               className="flex items-center gap-2 text-[10px] font-bold text-slate-400 hover:text-slate-900 uppercase tracking-[0.2em] transition-colors"
             >
               <ArrowLeft className="w-3.5 h-3.5" />
               {translate("otp.backToLogin")}
             </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
