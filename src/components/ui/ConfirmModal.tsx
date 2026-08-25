import React from "react";
import { AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useI18n } from "../../i18n";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  loadingText?: string;
  cancelText?: string;
  variant?: "danger" | "warning";
  isLoading?: boolean;
  closeOnConfirm?: boolean;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  loadingText,
  cancelText,
  variant = "danger",
  isLoading = false,
  closeOnConfirm = true,
}: ConfirmModalProps) {
  const { translate } = useI18n();

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (isLoading) {
      return;
    }

    onConfirm();
    if (closeOnConfirm) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={isLoading ? undefined : onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
        >
          <div className="p-8 text-center">
            <div
              className={`mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${
                variant === "danger"
                  ? "bg-red-50 text-red-600"
                  : "bg-amber-50 text-amber-600"
              }`}
            >
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
            <p className="text-sm text-slate-500 leading-relaxed">{message}</p>
          </div>

          <div className="p-6 bg-slate-50 flex gap-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-100 transition-all disabled:opacity-50"
            >
              {cancelText ?? translate("common.cancel")}
            </button>
            <button
              disabled={isLoading}
              onClick={handleConfirm}
              className={`flex-1 px-4 py-3 rounded-xl text-white font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 ${
                variant === "danger"
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-amber-500 hover:bg-amber-600"
              } disabled:opacity-75`}
            >
              {isLoading && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {isLoading
                ? loadingText ?? translate("common.loading")
                : confirmText ?? translate("common.confirm")}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
