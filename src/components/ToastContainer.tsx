import { AnimatePresence, motion } from "framer-motion";
import { X, CheckCircle2, AlertCircle, AlertTriangle } from "lucide-react";
import { useAppStore } from "@stores/appStore";
import { cn } from "@utils/index";

export function ToastContainer() {
  const { toasts, removeToast } = useAppStore();

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className={cn(
              "pointer-events-auto flex items-start gap-3 w-80 p-4 rounded-xl shadow-lg border backdrop-blur-xl",
              toast.variant === "destructive" &&
                "bg-destructive/10 border-destructive/20 text-destructive",
              toast.variant === "success" &&
                "bg-emerald-500/10 border-emerald-500/20 text-emerald-500",
              (!toast.variant || toast.variant === "default") &&
                "bg-card/90 border-border text-foreground"
            )}
          >
            <div className="mt-0.5 shrink-0">
              {toast.variant === "success" && <CheckCircle2 className="w-5 h-5" />}
              {toast.variant === "destructive" && <AlertCircle className="w-5 h-5" />}
              {(!toast.variant || toast.variant === "default") && (
                <AlertTriangle className="w-5 h-5 text-naviki-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{toast.title}</p>
              {toast.description && (
                <p className="text-xs text-muted-foreground mt-1">{toast.description}</p>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
