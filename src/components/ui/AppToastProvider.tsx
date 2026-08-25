import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import FeedbackToast, { type FeedbackToastState } from "./FeedbackToast";

type ToastContextValue = {
  showToast: (
    message: string,
    type?: FeedbackToastState["type"],
    durationMs?: number,
  ) => void;
  success: (message: string, durationMs?: number) => void;
  error: (message: string, durationMs?: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function AppToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<FeedbackToastState | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const showToast = useCallback(
    (
      message: string,
      type: FeedbackToastState["type"] = "success",
      durationMs = 3000,
    ) => {
      clearTimer();
      setToast({ message, type });
      timeoutRef.current = window.setTimeout(() => {
        setToast(null);
        timeoutRef.current = null;
      }, durationMs);
    },
    [clearTimer],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast,
      success: (message, durationMs) => showToast(message, "success", durationMs),
      error: (message, durationMs) => showToast(message, "error", durationMs),
    }),
    [showToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <FeedbackToast toast={toast} />
    </ToastContext.Provider>
  );
}

export const useAppToast = () => {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useAppToast must be used within an AppToastProvider");
  }

  return context;
};
