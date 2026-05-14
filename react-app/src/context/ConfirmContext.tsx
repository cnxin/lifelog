import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  tone?: "default" | "info";
}

interface PendingConfirm {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  tone: NonNullable<ConfirmOptions["tone"]>;
  resolve: (value: boolean) => void;
}

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  function confirm(options: ConfirmOptions) {
    return new Promise<boolean>((resolve) => {
      setPending({
        title: options.title,
        message: options.message,
        confirmText: options.confirmText || "确认",
        cancelText: options.cancelText || "取消",
        tone: options.tone || "default",
        resolve
      });
    });
  }

  function close(result: boolean) {
    if (!pending) return;
    pending.resolve(pending.tone === "info" ? true : result);
    setPending(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div className="confirm-layer">
          <div className="confirm-backdrop" onClick={() => close(false)} />
          <section
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-message"
          >
            <h2 id="confirm-title">{pending.title}</h2>
            <p id="confirm-message">{pending.message}</p>
            <div className="submit-row">
              {pending.tone !== "info" && (
                <button className="ghost-btn" onClick={() => close(false)}>
                  {pending.cancelText}
                </button>
              )}
              <button
                className={pending.tone === "info" ? "primary-btn" : "primary-btn danger-btn"}
                onClick={() => close(true)}
              >
                {pending.confirmText}
              </button>
            </div>
          </section>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used inside ConfirmProvider");
  }
  return context;
}
