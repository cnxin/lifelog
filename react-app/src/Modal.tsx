import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type RefObject,
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
const mountedDialogs = new Set<HTMLDialogElement>();
let unlockedOverflow = "";
export function useModalClose() {
  const close = useContext(ModalContext);
  if (!close) throw new Error("useModalClose must be used inside Modal");
  return close;
}

// Direct manipulation stays available under reduced motion; only settling
// uses a transition. Keep gesture ownership local to each stacked dialog.
function useSheetDrag(
  ref: RefObject<HTMLDialogElement>,
  requestClose: () => void,
  busy: boolean,
) {
  const latestBusy = useRef(busy);
  latestBusy.current = busy;
  const cancelDrag = useRef<() => void>();
  useEffect(() => {
    const dialog = ref.current!;
    const body = dialog.querySelector<HTMLElement>(".modal-body")!;
    const mobile = matchMedia("(max-width: 760px)");
    type Sample = { y: number; time: number };
    let gesture: {
      id: number; x: number; y: number; heading: boolean; captured: boolean;
      offset: number; samples: Sample[];
    } | null = null;
    let suppressClick = false;
    let clickTimer: number | undefined;
    let settleTimer: number | undefined;
    const clearStyles = () => {
      delete dialog.dataset.dragging;
      delete dialog.dataset.rebounding;
      dialog.style.removeProperty("--drag-y");
      dialog.style.removeProperty("--drag-backdrop");
    };
    const releaseCapture = (id: number) => {
      if (dialog.hasPointerCapture(id)) dialog.releasePointerCapture(id);
    };
    const bounce = () => {
      delete dialog.dataset.dragging;
      dialog.dataset.rebounding = "true";
      dialog.style.setProperty("--drag-y", "0px");
      dialog.style.setProperty("--drag-backdrop", "1");
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        delete dialog.dataset.rebounding;
      }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : EXIT_MS);
    };
    const suppressNextClick = () => {
      suppressClick = true;
      window.clearTimeout(clickTimer);
      clickTimer = window.setTimeout(() => { suppressClick = false; }, 350);
    };
    const cancel = () => {
      const previous = gesture;
      gesture = null;
      if (previous?.captured) {
        suppressNextClick();
        if (dialog.open && !dialog.dataset.closing) bounce();
      }
      if (previous) releaseCapture(previous.id);
    };
    cancelDrag.current = cancel;
    const syncScroll = () => { dialog.dataset.bodyAtTop = String(body.scrollTop === 0); };
    const onMediaChange = () => {
      cancel();
      window.clearTimeout(settleTimer);
      clearStyles();
    };
    const onDown = (event: PointerEvent) => {
      if (!mobile.matches || latestBusy.current || !dialog.open ||
          dialog.dataset.closing || gesture || !event.isPrimary || event.button !== 0) return;
      const target = event.target as Element;
      const heading = !!target.closest(".modal-heading");
      if (!heading && (!body.contains(target) || body.scrollTop !== 0)) return;
      const transform = getComputedStyle(dialog).transform;
      const offset = transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m42;
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY,
        heading, captured: false, offset, samples: [{ y: event.clientY, time: event.timeStamp }] };
    };
    const sample = (event: PointerEvent) => {
      if (!gesture) return;
      gesture.samples.push({ y: event.clientY, time: event.timeStamp });
      // Keep the sample straddling the 100ms boundary for interpolation.
      while (gesture.samples.length > 2 && gesture.samples[1].time < event.timeStamp - 100)
        gesture.samples.shift();
    };
    const onMove = (event: PointerEvent) => {
      if (!gesture || event.pointerId !== gesture.id) return;
      if (latestBusy.current || !mobile.matches || !dialog.open) { cancel(); return; }
      const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
      if (!gesture.captured) {
        if (Math.abs(dx) > 8 && Math.abs(dx) >= Math.abs(dy)) { gesture = null; return; }
        if (!gesture.heading && (dy < -8 || body.scrollTop !== 0)) { gesture = null; return; }
        if (Math.abs(dy) <= 8 || Math.abs(dy) <= Math.abs(dx)) return;
        gesture.captured = true;
        window.clearTimeout(settleTimer);
        delete dialog.dataset.rebounding;
        dialog.dataset.dragging = "true";
        dialog.setPointerCapture(event.pointerId);
      }
      event.preventDefault();
      sample(event);
      const distance = gesture.offset + dy;
      const y = distance >= 0 ? distance : Math.max(-24, distance * .25);
      dialog.style.setProperty("--drag-y", `${y}px`);
      dialog.style.setProperty("--drag-backdrop", String(Math.max(0, 1 - Math.max(0, y) / innerHeight)));
    };
    const onUp = (event: PointerEvent) => {
      if (!gesture || event.pointerId !== gesture.id) return;
      sample(event);
      const previous = gesture;
      gesture = null;
      releaseCapture(previous.id);
      if (!previous.captured) return;
      suppressNextClick();
      const first = previous.samples[0], last = previous.samples[previous.samples.length - 1];
      const next = previous.samples[1] ?? first;
      const start = Math.max(first.time, last.time - 100);
      const startY = next.time > first.time
        ? first.y + (next.y - first.y) * Math.min(1, (start - first.time) / (next.time - first.time))
        : first.y;
      const velocity = last.time > start ? (last.y - startY) / (last.time - start) : 0;
      const dy = event.clientY - previous.y;
      if (!latestBusy.current && (dy > 96 || velocity > .6)) requestClose();
      else bounce();
    };
    const onCancel = (event: PointerEvent) => {
      // Touch starts with implicit capture on the original child. Its lost
      // capture bubbles when we transfer ownership to the dialog; that is
      // not cancellation of the new sheet capture.
      if (event.type === "lostpointercapture" && event.target !== dialog) return;
      if (event.pointerId === gesture?.id) cancel();
    };
    const onClick = (event: MouseEvent) => {
      if (!suppressClick) return;
      suppressClick = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    dialog.addEventListener("pointerdown", onDown);
    dialog.addEventListener("pointermove", onMove, { passive: false });
    dialog.addEventListener("pointerup", onUp);
    dialog.addEventListener("pointercancel", onCancel);
    dialog.addEventListener("lostpointercapture", onCancel);
    dialog.addEventListener("click", onClick, true);
    body.addEventListener("scroll", syncScroll, { passive: true });
    mobile.addEventListener("change", onMediaChange);
    syncScroll();
    return () => {
      dialog.removeEventListener("pointerdown", onDown);
      dialog.removeEventListener("pointermove", onMove);
      dialog.removeEventListener("pointerup", onUp);
      dialog.removeEventListener("pointercancel", onCancel);
      dialog.removeEventListener("lostpointercapture", onCancel);
      dialog.removeEventListener("click", onClick, true);
      body.removeEventListener("scroll", syncScroll);
      mobile.removeEventListener("change", onMediaChange);
      window.clearTimeout(clickTimer);
      window.clearTimeout(settleTimer);
      if (gesture) releaseCapture(gesture.id);
      cancelDrag.current = undefined;
      clearStyles();
      delete dialog.dataset.bodyAtTop;
    };
  }, [ref, requestClose]);
  useEffect(() => { if (busy) cancelDrag.current?.(); }, [busy]);
}

export default function Modal({
  title,
  eyebrow = "LIFELOG · DAYS",
  onClose,
  onCancel,
  children,
  busy = false,
  className = "",
  focusDialog = false,
}: {
  title: string;
  eyebrow?: string;
  onClose: () => void;
  onCancel?: () => void;
  children: ReactNode;
  busy?: boolean;
  className?: string;
  focusDialog?: boolean;
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
      const dialog = ref.current;
      if (dialog.dataset.dragging || dialog.dataset.rebounding) {
        // Freeze the presentation position before restoring exit transitions.
        // Otherwise clearing --drag-y would jump to zero before close().
        dialog.style.transform = getComputedStyle(dialog).transform;
        delete dialog.dataset.dragging;
        delete dialog.dataset.rebounding;
        dialog.style.removeProperty("--drag-y");
        void dialog.offsetHeight;
      }
      dialog.dataset.closing = "true";
      dialog.setAttribute("inert", "");
      dialog.close();
      dialog.style.removeProperty("transform");
    }
    const delay = modalExitMs();
    if (delay)
      timer.current = window.setTimeout(() => latest.current.onClose(), delay);
    else latest.current.onClose();
  }, []);
  useEffect(() => {
    const dialog = ref.current!;
    const trigger = document.activeElement as HTMLElement | null;
    if (!mountedDialogs.size) unlockedOverflow = document.body.style.overflow;
    mountedDialogs.add(dialog);
    document.body.style.overflow = "hidden";
    closing.current = false;
    delete dialog.dataset.closing;
    dialog.removeAttribute("inert");
    dialog.showModal();
    if (focusDialog) dialog.focus({ preventScroll: true });
    else dialog.querySelector<HTMLElement>('[data-initial-focus="true"]')?.focus();
    return () => {
      window.clearTimeout(timer.current);
      dialog.close();
      const stack = Array.from(mountedDialogs);
      const wasTop = stack[stack.length - 1] === dialog;
      mountedDialogs.delete(dialog);
      document.body.style.overflow = mountedDialogs.size
        ? "hidden"
        : unlockedOverflow;
      if (!wasTop) return;
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
  useSheetDrag(ref, requestClose, busy);
  return (
    <ModalContext.Provider value={requestClose}>
      <dialog
        ref={ref}
        className={`modal ${className}`}
        aria-labelledby={titleId}
        tabIndex={-1}
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
          if (focusDialog && document.activeElement === ref.current) {
            event.preventDefault();
            const entry = controls.find(el => el.dataset.tabEntry === "true") ?? first;
            (event.shiftKey ? last : entry).focus();
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
            <span className="eyebrow">{eyebrow}</span>
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
