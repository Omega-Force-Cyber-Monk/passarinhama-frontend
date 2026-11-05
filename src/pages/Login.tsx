import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { Link } from "react-router-dom";
import { setCredentials } from "../redux/features/auth/authSlice";
import { motion } from "motion/react";
import { LogIn, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { useLoginMutation } from "../redux/features/auth/authApi";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { useAppToast } from "../components/ui/AppToastProvider";
import { useI18n } from "../i18n";
import { getApiErrorDisplayMessage } from "../utils/apiErrorMessages";
import type { AppDispatch } from "../redux/store";

export default function Login() {
  const [email, setEmail] = useState("admin@gmail.com");
  const [password, setPassword] = useState("admin");
  const [showPassword, setShowPassword] = useState(false);
  const dispatch = useDispatch<AppDispatch>();
  const [login, { isLoading }] = useLoginMutation();
  const { translate } = useI18n();
  const toast = useAppToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      const message = translate("common.requiredField", {
        field: translate("login.email"),
      });
      toast.error(message);
      return;
    }

    if (!password.trim()) {
      const message = translate("common.requiredField", {
        field: translate("login.password"),
      });
      toast.error(message);
      return;
    }

    try {
      const response = await login({ email, password }).unwrap();

      if (response.status === "pending") {
        toast.error(translate("login.pendingValidation"));
        return;
      }

      dispatch(setCredentials(response));
    } catch (err: any) {
      console.error("Login error:", err);
      const message = getApiErrorDisplayMessage(err, translate);
      toast.error(message);
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
        className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
      >
        <div className="p-8 bg-primary flex flex-col items-center text-black">
          <div className="flex items-center gap-4 mb-4">
            <div className="h-16 w-16 bg-white flex items-center justify-center rounded-xl shadow-xl border-2 border-white overflow-hidden shrink-0">
              <img
                src="/logo.png"
                alt="Compagnie
des Architecte
de Copropriété"
                className="w-full h-full object-cover"
              />
            </div>
            <h2 className="text-xl font-black tracking-tighter uppercase leading-[1.1] text-left">
              Compagnie <br />
              des Architectes <br />
              de Copropriété
            </h2>
          </div>
          <p className="opacity-80 text-center px-10 italic text-sm font-medium leading-tight">
            {translate("login.privateMemberSpace")}
          </p>
        </div>

        <form noValidate onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 block ml-1">
              {translate("login.email")}
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                placeholder={translate("login.emailPlaceholder")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 block ml-1">
              {translate("login.password")}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-10 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end">
            {/* <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
              />
              <span className="text-sm text-gray-600 group-hover:text-black">
                Remember me
              </span>
            </label> */}
            <Link
              to="/forgot-password"
              className="text-sm text-primary-dark font-medium hover:underline"
            >
              {translate("login.forgotPassword")}
            </Link>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary hover:bg-primary-dark text-black font-bold py-4 px-6 rounded-xl shadow-md transform active:scale-95 transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest text-xs cursor-pointer"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                <span>{translate("login.submit")}</span>
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
