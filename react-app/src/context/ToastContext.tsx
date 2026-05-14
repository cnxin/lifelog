import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

type ToastTone = "success" | "info" | "error";

interface ToastOptions {
  message: string;
  tone?: ToastTone;
}

interface ActiveToast {
  id: number;
  message: string;
  tone: ToastTone;
}

const ToastContext = createContext<((options: ToastOptions) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ActiveToast | null>(null);
  const timerRef = useRef<number | null>(null);

  function notify(options: ToastOptions) {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    const nextToast = {
      id: Date.now(),
      message: options.message,
      tone: options.tone || "info"
    };
    setToast(nextToast);
    timerRef.current = window.setTimeout(() => setToast(null), 2600);
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
          {toast.message}
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
