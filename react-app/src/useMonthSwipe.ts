import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type MouseEvent,
} from "react";

export default function useMonthSwipe(onMonth: (direction: -1 | 1) => void) {
  const [slide, setSlide] = useState<"prev" | "next">();
  const timer = useRef<number>();
  const gesture = useRef<{
    id: number;
    x: number;
    y: number;
    horizontal: boolean;
    vertical: boolean;
  }>();
  const suppressClick = useRef(false);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  function animate(direction: -1 | 1) {
    window.clearTimeout(timer.current);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSlide(undefined);
      return;
    }
    setSlide(direction < 0 ? "prev" : "next");
    timer.current = window.setTimeout(() => setSlide(undefined), 240);
  }
  return {
    slide,
    animate,
    clearSlide: () => {
      window.clearTimeout(timer.current);
      setSlide(undefined);
    },
    handlers: {
      onPointerDown(event: PointerEvent<HTMLDivElement>) {
        if (!event.isPrimary || event.button !== 0) return;
        suppressClick.current = false;
        gesture.current = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          horizontal: false,
          vertical: false,
        };
      },
      onPointerMove(event: PointerEvent<HTMLDivElement>) {
        const start = gesture.current;
        if (!start || start.id !== event.pointerId || start.vertical) return;
        const dx = Math.abs(event.clientX - start.x),
          dy = Math.abs(event.clientY - start.y);
        if (!start.horizontal && dy > 48 && dy > dx * 1.5) {
          start.vertical = true;
          return;
        }
        if (dx > 48 && dx > dy * 1.5) {
          start.horizontal = true;
          suppressClick.current = true;
          if (typeof event.currentTarget.setPointerCapture === "function") {
            try {
              event.currentTarget.setPointerCapture(event.pointerId);
            } catch {}
          }
          event.preventDefault();
        }
      },
      onPointerUp(event: PointerEvent<HTMLDivElement>) {
        const start = gesture.current;
        if (!start || start.id !== event.pointerId) return;
        gesture.current = undefined;
        const dx = event.clientX - start.x,
          dy = event.clientY - start.y;
        if (
          start.horizontal &&
          !start.vertical &&
          Math.abs(dx) > 48 &&
          Math.abs(dx) > Math.abs(dy) * 1.5
        )
          onMonth(dx < 0 ? 1 : -1);
      },
      onPointerCancel() {
        gesture.current = undefined;
        suppressClick.current = false;
      },
      onClickCapture(event: MouseEvent<HTMLDivElement>) {
        if (!suppressClick.current) return;
        suppressClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      },
    },
  };
}
