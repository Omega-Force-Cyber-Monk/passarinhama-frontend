import { AlertCircle, CheckCircle2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

export type FeedbackToastState = {
  type: "success" | "error";
  message: string;
};

type FeedbackToastProps = {
  toast: FeedbackToastState | null;
};

export default function FeedbackToast({ toast }: FeedbackToastProps) {
  return (
    <AnimatePresence>
      {toast ? (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={`fixed left-1/2 top-24 z-[100] flex -translate-x-1/2 items-center gap-3 rounded-2xl px-6 py-3 font-bold text-white shadow-xl ${
            toast.type === "success" ? "bg-emerald-600" : "bg-red-600"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
          {toast.message}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
