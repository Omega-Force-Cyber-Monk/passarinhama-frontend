import React from 'react';
import { useRouteError, useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle, RefreshCcw, Home, ChevronLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { useI18n } from '../i18n';

export default function RouteError() {
  const error = useRouteError() as any;
  const navigate = useNavigate();
  const location = useLocation();
  const { translate } = useI18n();

  console.error('Route Error:', error);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-[2rem] shadow-2xl shadow-slate-200/50 border border-slate-100 p-10 text-center"
      >
        <div className="flex justify-center mb-8">
          <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
        </div>

        <h1 className="text-3xl font-extrabold text-slate-900 mb-4 tracking-tight">
          {translate("routeError.title")}
        </h1>
        
        <p className="text-slate-500 mb-8 leading-relaxed">
          {error?.name === 'PageLoadTimeout' ? translate('routeError.loadTimeout') : error?.message || translate("routeError.message")}
        </p>

        {error?.statusText || error?.status ? (
          <div className="mb-8 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-left">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
              {translate("routeError.details")}
            </p>
            <p className="text-sm font-mono text-slate-600 break-words">
              {error.status} {error.statusText}
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3">
          <button
            onClick={() => navigate(location.pathname + location.search + location.hash, { replace: true, state: location.state })}
            className="flex items-center justify-center gap-2 px-6 py-4 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 active:scale-[0.98]"
          >
            <RefreshCcw className="w-4 h-4" />
            {translate("routeError.tryAgain")}
          </button>
          
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center justify-center gap-2 px-6 py-4 bg-white text-slate-600 border border-slate-200 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all active:scale-[0.98]"
            >
              <ChevronLeft className="w-4 h-4" />
              {translate("routeError.goBack")}
            </button>
            
            <button
              onClick={() => navigate('/')}
              className="flex items-center justify-center gap-2 px-6 py-4 bg-white text-slate-600 border border-slate-200 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all active:scale-[0.98]"
            >
              <Home className="w-4 h-4" />
              {translate("common.home")}
            </button>
          </div>
        </div>
        
        <p className="mt-10 text-xs text-slate-400 font-medium">
          {translate("routeError.support")}
        </p>
      </motion.div>
    </div>
  );
}
