import React, { useId, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { DialogParentContext, useDialogLifecycle } from './useDialogLifecycle';
import './ModalLayout.css';
import { X } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useI18n } from '../../i18n';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
  className?: string;
  layout?: "legacy" | "compact" | "sectioned" | "drawer";
  footer?: React.ReactNode;
  description?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  closeDisabled?: boolean;
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
}

export default function Modal({ isOpen, onClose, title, children, maxWidth, className = "", layout = "legacy", footer, description, initialFocusRef, closeDisabled = false, closeOnEscape = true, closeOnBackdrop = true }: ModalProps) {
  const { translate } = useI18n();
  const titleId = useId();
  const descriptionId = useId();
  const reducedMotion = useReducedMotion();
  const { rootRef, panelRef, requestClose } = useDialogLifecycle(isOpen, { onClose, closeDisabled, closeOnEscape, initialFocusRef });
  const modern = layout !== "legacy";
  const content = (
    <DialogParentContext.Provider value={rootRef}><AnimatePresence>
      {isOpen && (
        <div ref={rootRef} data-dialog-base-z="50" data-modal-custom-width={Boolean(maxWidth)} className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${className}${modern ? ` shared-modal shared-modal--${layout}` : ""}`}>
          <motion.div
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
            onClick={closeOnBackdrop ? requestClose : undefined}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            tabIndex={-1}
            initial={reducedMotion ? false : layout === "drawer" ? { opacity: 0, x: "100%" } : { opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
            exit={reducedMotion ? { opacity: 1 } : layout === "drawer" ? { opacity: 0, x: "100%" } : { opacity: 0, scale: 0.95, y: 20 }}
            className={`relative w-full ${maxWidth || (modern ? "" : "max-w-lg")} bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]`}
          >
            <div className={`${modern ? "shared-modal-header " : ""}px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50`}>
              <div className="min-w-0"><h3 id={titleId} className="font-bold text-slate-900">{title}</h3>{description ? <p id={descriptionId} className="mt-1 text-sm text-slate-500">{description}</p> : null}</div>
              <button
                type="button"
                aria-label={translate("common.close")}
                disabled={closeDisabled}
                onClick={requestClose}
                className="p-1 hover:bg-slate-200 rounded-lg transition-colors text-slate-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className={`flex-1 overflow-y-auto p-6${modern ? " shared-modal-body" : ""}`}>
              {children}
            </div>
            {footer ? <div className={modern ? "shared-modal-footer" : "shrink-0 border-t border-slate-100 px-6 py-4"}>{footer}</div> : null}
          </motion.div>
        </div>
      )}
    </AnimatePresence></DialogParentContext.Provider>
  );
  return typeof document === "undefined" ? content : createPortal(content, document.body);
}
