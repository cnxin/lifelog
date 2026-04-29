import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

interface PendingConfirm extends Required<ConfirmOptions> {
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
        resolve
      });
    });
  }

  function close(result: boolean) {
    pending?.resolve(result);
    setPending(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div className="confirm-layer">
          <div className="confirm-backdrop" onClick={() => close(false)} />
          <section className="confirm-dialog">
            <h2>{pending.title}</h2>
            <p>{pending.message}</p>
            <div className="submit-row">
              <button className="ghost-btn" onClick={() => close(false)}>
                {pending.cancelText}
              </button>
              <button className="primary-btn danger-btn" onClick={() => close(true)}>
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
