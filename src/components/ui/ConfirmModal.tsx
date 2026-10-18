import React, { useId, useRef } from "react";
import { createPortal } from "react-dom";
import { DialogParentContext, useDialogLifecycle } from "./useDialogLifecycle";
import "./ModalLayout.css";
import { AlertTriangle } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
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
  className?: string;
  presentation?: "legacy" | "compact";
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
  className = "",
  presentation = "legacy",
}: ConfirmModalProps) {
  const { translate } = useI18n();

  const titleId = useId();
  const messageId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const reducedMotion = useReducedMotion();
  const { rootRef, panelRef, requestClose } = useDialogLifecycle(isOpen, { onClose, closeDisabled: isLoading, initialFocusRef: cancelRef });
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

  const content = (
    <DialogParentContext.Provider value={rootRef}><AnimatePresence>
      <div ref={rootRef} data-dialog-base-z="60" className={`fixed inset-0 z-[60] flex items-center justify-center p-4 ${className}${presentation === "compact" ? " shared-confirm" : ""}`}>
        <motion.div
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
          onClick={isLoading ? undefined : requestClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />
        <motion.div
          ref={panelRef}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={messageId}
          aria-busy={isLoading}
          tabIndex={-1}
          initial={reducedMotion ? false : { opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.95, y: 20 }}
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

            <h3 id={titleId} className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
            <p id={messageId} className="text-sm text-slate-500 leading-relaxed">{message}</p>
          </div>

          <div className="p-6 bg-slate-50 flex gap-3">
            <button
              ref={cancelRef}
              type="button"
              onClick={requestClose}
              disabled={isLoading}
              className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-100 transition-all disabled:opacity-50"
            >
              {cancelText ?? translate("common.cancel")}
            </button>
            <button
              type="button"
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
    </AnimatePresence></DialogParentContext.Provider>
  );
  return typeof document === "undefined" ? content : createPortal(content, document.body);
}
