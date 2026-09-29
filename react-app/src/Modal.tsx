import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";
import { X } from "lucide-react";

export const EXIT_MS = 240;
export function modalExitMs() {
  return typeof CSS !== "undefined" &&
    CSS.supports("transition-behavior", "allow-discrete") &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches
    ? EXIT_MS
    : 0;
}
const ModalContext = createContext<(() => void) | null>(null);
export function useModalClose() {
  const close = useContext(ModalContext);
  if (!close) throw new Error("useModalClose must be used inside Modal");
  return close;
}

export default function Modal({
  title,
  onClose,
  onCancel,
  children,
  busy = false,
  className = "",
}: {
  title: string;
  onClose: () => void;
  onCancel?: () => void;
  children: ReactNode;
  busy?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const closing = useRef(false);
  const timer = useRef<number>();
  const latest = useRef({ busy, onClose });
  latest.current = { busy, onClose };
  const requestClose = useCallback(() => {
    if (closing.current || latest.current.busy) return;
    closing.current = true;
    if (ref.current) {
      ref.current.dataset.closing = "true";
      ref.current.setAttribute("inert", "");
      ref.current.close();
    }
    const delay = modalExitMs();
    if (delay)
      timer.current = window.setTimeout(() => latest.current.onClose(), delay);
    else latest.current.onClose();
  }, []);
  useEffect(() => {
    const dialog = ref.current!;
    const trigger = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closing.current = false;
    delete dialog.dataset.closing;
    dialog.removeAttribute("inert");
    dialog.showModal();
    dialog.querySelector<HTMLElement>('[data-initial-focus="true"]')?.focus();
    return () => {
      window.clearTimeout(timer.current);
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (trigger?.isConnected) trigger.focus();
      else {
        const open =
          document.querySelectorAll<HTMLDialogElement>("dialog[open]");
        const previous = open[open.length - 1];
        (
          previous?.querySelector<HTMLElement>('[tabindex="0"]') ??
          previous?.querySelector<HTMLElement>("button:not(:disabled)")
        )?.focus();
      }
    };
  }, []);
  return (
    <ModalContext.Provider value={requestClose}>
      <dialog
        ref={ref}
        className={`modal ${className}`}
        aria-labelledby={titleId}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            // Handle nested disclosures before the browser closes the dialog.
            event.preventDefault();
            event.stopPropagation();
            if (!busy && !document.querySelector('dialog[data-closing="true"]'))
              (onCancel ?? requestClose)();
            return;
          }
          if (event.key !== "Tab") return;
          const controls = Array.from(
            ref.current!.querySelectorAll<HTMLElement>(
              'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
            ),
          ).filter((el) => el.tabIndex >= 0 && el.getClientRects().length > 0);
          const first = controls[0],
            last = controls[controls.length - 1];
          if (!first) {
            event.preventDefault();
            return;
          }
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
        onCancel={(event) => {
          event.preventDefault();
          if (!busy && !document.querySelector('dialog[data-closing="true"]'))
            (onCancel ?? requestClose)();
        }}
        onClick={(event) => {
          if (event.target === ref.current && !busy) {
            const rect = ref.current!.getBoundingClientRect();
            if (
              event.clientX < rect.left ||
              event.clientX > rect.right ||
              event.clientY < rect.top ||
              event.clientY > rect.bottom
            )
              requestClose();
          }
        }}
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">LIFELOG · DAYS</span>
            <h2 id={titleId}>{title}</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="关闭"
            disabled={busy}
            onClick={requestClose}
          >
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </dialog>
    </ModalContext.Provider>
  );
}
