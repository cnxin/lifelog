import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent as ReactPointerEvent
} from "react";
import {
  animateOrSnap,
  project,
  rubberband,
  prefersReducedMotion,
  subscribePrefersReducedMotion,
  SPRING_BOUNCY,
  SPRING_DEFAULT,
  type SpringAnimation
} from "../../utils/motion";
import { isFluidFeatureEnabled } from "../../utils/features";

export type SheetPrimitiveProps = {
  open?: boolean;
  onDismissRequest: () => void;
  onExited?: () => void;
  children: ReactNode;
  /** When true, drag-to-close springs back and still notifies parent (for unsaved confirm). */
  blockDismiss?: boolean;
  className?: string;
  panelClassName?: string;
  ariaLabel?: string;
};

type Phase = "closed" | "opening" | "open" | "dragging" | "settling" | "closing";

/**
 * Fluid bottom sheet shell: 1:1 drag, velocity projection, interruptible springs.
 * Business content lives in children; dismiss intent is reported upward.
 *
 * Mount pattern: parent mounts while open and unmounts after onDismissRequest.
 * Fluid dismiss animates out first, then calls onDismissRequest so the spring is visible.
 */
export default function SheetPrimitive({
  open = true,
  onDismissRequest,
  onExited,
  children,
  blockDismiss = false,
  className = "",
  panelClassName = "",
  ariaLabel
}: SheetPrimitiveProps) {
  const fluid = isFluidFeatureEnabled("fluidSheet");
  const reducedRef = useRef(prefersReducedMotion());
  const [phase, setPhase] = useState<Phase>("closed");

  const backdropRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const yRef = useRef(0);
  const animRef = useRef<SpringAnimation | null>(null);
  const openRef = useRef(open);
  const blockDismissRef = useRef(blockDismiss);
  const onDismissRequestRef = useRef(onDismissRequest);
  const onExitedRef = useRef(onExited);
  const enteredRef = useRef(false);
  const dismissLockRef = useRef(false);

  const dragRef = useRef<{
    active: boolean;
    pointerId: number;
    startY: number;
    startSheetY: number;
    samples: Array<{ t: number; y: number }>;
  } | null>(null);

  useEffect(() => {
    openRef.current = open;
  }, [open]);
  useEffect(() => {
    blockDismissRef.current = blockDismiss;
  }, [blockDismiss]);
  useEffect(() => {
    onDismissRequestRef.current = onDismissRequest;
  }, [onDismissRequest]);
  useEffect(() => {
    onExitedRef.current = onExited;
  }, [onExited]);
  useEffect(
    () =>
      subscribePrefersReducedMotion((value) => {
        reducedRef.current = value;
      }),
    []
  );

  const panelHeight = useCallback(() => {
    return panelRef.current?.getBoundingClientRect().height || 420;
  }, []);

  const applyY = useCallback(
    (y: number) => {
      const next = Math.max(0, y);
      yRef.current = next;
      if (panelRef.current) {
        panelRef.current.style.transform = `translate3d(0, ${next}px, 0)`;
      }
      if (backdropRef.current) {
        const h = panelHeight();
        const p = h > 0 ? Math.min(1, next / h) : 0;
        backdropRef.current.style.opacity = String(Math.max(0, 1 - p * 0.92));
      }
    },
    [panelHeight]
  );

  const stopAnim = useCallback(() => {
    if (animRef.current) {
      animRef.current.stop();
      animRef.current = null;
    }
  }, []);

  const springTo = useCallback(
    (to: number, velocity: number, nextPhase: Phase, onDone?: () => void, bouncy = false) => {
      stopAnim();
      setPhase(nextPhase);
      const reduced = reducedRef.current || !fluid;
      animRef.current = animateOrSnap(reduced, {
        from: yRef.current,
        to,
        velocity,
        spring: bouncy ? SPRING_BOUNCY : SPRING_DEFAULT,
        onUpdate: (value) => applyY(value),
        onComplete: () => {
          animRef.current = null;
          applyY(to);
          onDone?.();
        }
      });
    },
    [applyY, fluid, stopAnim]
  );

  const finishDismiss = useCallback(() => {
    dismissLockRef.current = false;
    onDismissRequestRef.current();
    onExitedRef.current?.();
  }, []);

  /** Animate out (when fluid) then notify parent; blockDismiss springs back + notifies. */
  const requestDismiss = useCallback(
    (velocity = 0) => {
      if (dismissLockRef.current && phase === "closing") return;

      if (blockDismissRef.current) {
        if (yRef.current > 2) {
          springTo(0, velocity, "settling", () => setPhase("open"), Math.abs(velocity) > 600);
        }
        onDismissRequestRef.current();
        return;
      }

      if (!fluid || reducedRef.current) {
        finishDismiss();
        return;
      }

      dismissLockRef.current = true;
      const h = panelHeight() + 40;
      springTo(
        h,
        Math.max(0, velocity),
        "closing",
        () => {
          finishDismiss();
        },
        Math.abs(velocity) > 600
      );
    },
    [finishDismiss, fluid, panelHeight, phase, springTo]
  );

  // Enter animation on mount / when open becomes true
  useLayoutEffect(() => {
    if (!open) return;
    dismissLockRef.current = false;
    if (!fluid) {
      applyY(0);
      if (backdropRef.current) backdropRef.current.style.opacity = "1";
      setPhase("open");
      enteredRef.current = true;
      return;
    }
    if (enteredRef.current) return;
    enteredRef.current = true;
    const h = panelHeight();
    applyY(h + 40);
    if (backdropRef.current) backdropRef.current.style.opacity = "0";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!openRef.current) return;
        springTo(0, 0, "opening", () => setPhase("open"));
      });
    });
  }, [open, fluid, applyY, panelHeight, springTo]);

  // Exit when open becomes false (controlled mode)
  useEffect(() => {
    if (open) return;
    if (!enteredRef.current) {
      onExitedRef.current?.();
      return;
    }
    if (!fluid || reducedRef.current) {
      onExitedRef.current?.();
      return;
    }
    if (phase === "closing") return;
    const h = panelHeight() + 40;
    springTo(h, Math.max(0, animRef.current?.velocity ?? 0), "closing", () => {
      onExitedRef.current?.();
    });
  }, [open, fluid, panelHeight, phase, springTo]);

  useEffect(() => () => stopAnim(), [stopAnim]);

  const velocityFromSamples = (samples: Array<{ t: number; y: number }>) => {
    if (samples.length < 2) return 0;
    const a = samples[0];
    const b = samples[samples.length - 1];
    const dt = (b.t - a.t) / 1000;
    if (dt <= 0) return 0;
    return (b.y - a.y) / dt;
  };

  const canStartDragFromTarget = (target: EventTarget | null) => {
    const panel = panelRef.current;
    if (!panel || !(target instanceof Element)) return false;
    if (target.closest(".sheet-handle, [data-sheet-drag-handle]")) return true;
    if (target.closest("input, textarea, select, button, a, label, video, [data-no-sheet-drag]")) return false;
    if (panel.scrollTop > 0) return false;
    let node: Element | null = target;
    while (node && node !== panel) {
      if (node instanceof HTMLElement) {
        const style = window.getComputedStyle(node);
        const oy = style.overflowY;
        if ((oy === "auto" || oy === "scroll") && node.scrollTop > 0) return false;
      }
      node = node.parentElement;
    }
    return true;
  };

  const onPointerDown = (event: ReactPointerEvent) => {
    if (!fluid || !openRef.current) return;
    if (phase === "closing") return;
    if (event.button !== 0 && event.pointerType === "mouse") return;
    if (!canStartDragFromTarget(event.target)) return;

    stopAnim();
    dismissLockRef.current = false;
    dragRef.current = {
      active: true,
      pointerId: event.pointerId,
      startY: event.clientY,
      startSheetY: yRef.current,
      samples: [{ t: performance.now(), y: event.clientY }]
    };
    setPhase("dragging");
    try {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  };

  const onPointerMove = (event: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (!drag?.active || drag.pointerId !== event.pointerId) return;
    const dy = event.clientY - drag.startY;
    let next = drag.startSheetY + dy;
    if (next < 0) {
      const pulled = -rubberband(-next, panelHeight(), 0.35);
      if (panelRef.current) {
        panelRef.current.style.transform = `translate3d(0, ${pulled}px, 0)`;
      }
      yRef.current = 0;
      if (backdropRef.current) backdropRef.current.style.opacity = "1";
    } else {
      applyY(next);
    }
    drag.samples.push({ t: performance.now(), y: event.clientY });
    if (drag.samples.length > 6) drag.samples.shift();
  };

  const endDrag = (event: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (!drag?.active || drag.pointerId !== event.pointerId) return;
    drag.active = false;
    dragRef.current = null;
    try {
      (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }

    const v = velocityFromSamples(drag.samples);
    const h = panelHeight();
    const projected = yRef.current + project(v, 0.995);
    const shouldClose = projected > h * 0.28 || v > 900;

    if (shouldClose) {
      requestDismiss(v);
      return;
    }

    springTo(0, v, "settling", () => setPhase("open"), Math.abs(v) > 600);
  };

  if (!open && !enteredRef.current) return null;

  const rootClass = [
    "sheet",
    "sheet-primitive",
    fluid ? "sheet-primitive--fluid" : "sheet-primitive--static",
    phase === "dragging" ? "is-dragging" : "",
    phase === "closing" ? "is-closing" : "",
    className
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass} role="presentation" data-sheet-phase={phase}>
      <button
        ref={backdropRef}
        type="button"
        className="sheet-backdrop"
        aria-label="关闭面板"
        onClick={() => requestDismiss(0)}
        tabIndex={-1}
      />
      <section
        ref={panelRef}
        className={`sheet-panel ${panelClassName}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {children}
      </section>
    </div>
  );
}
