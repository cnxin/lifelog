import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

type ToastTone = "success" | "info" | "error";

interface ToastAction {
  label: string;
  onClick: () => void | Promise<void>;
}

interface ToastOptions {
  message: string;
  tone?: ToastTone;
  actionLabel?: string;
  onAction?: () => void;
  actions?: ToastAction[];
  durationMs?: number;
}

interface ActiveToast {
  id: number;
  message: string;
  tone: ToastTone;
  actions?: ToastAction[];
}

const ToastContext = createContext<((options: ToastOptions) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ActiveToast | null>(null);
  const timerRef = useRef<number | null>(null);

  function notify(options: ToastOptions) {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    const actions = options.actions || (options.actionLabel && options.onAction ? [{ label: options.actionLabel, onClick: options.onAction }] : undefined);
    const nextToast = {
      id: Date.now(),
      message: options.message,
      tone: options.tone || "info",
      actions
    };
    setToast(nextToast);
    timerRef.current = window.setTimeout(() => setToast(null), options.durationMs ?? (actions?.length ? 6200 : 2600));
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      {toast && (
        <div className={`toast-message ${toast.tone}`} role="status" aria-live="polite" key={toast.id}>
          <span>{toast.message}</span>
          {toast.actions?.length ? (
            <div className="toast-actions">
              {toast.actions.map((action) => (
                <button
                  type="button"
                  key={action.label}
                  onClick={() => {
                    setToast(null);
                    action.onClick();
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
}
