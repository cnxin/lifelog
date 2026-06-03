import { useEffect, useRef, useState } from "react";

export function useCollapsingDetailHeader(collapseThreshold = 60, expandThreshold = 0) {
  const [collapsed, setCollapsed] = useState(false);
  const collapsedRef = useRef(false);
  const lastIntentRef = useRef<"up" | "down" | null>(null);
  const lastTouchYRef = useRef<number | null>(null);

  useEffect(() => {
    const scrollRoot = document.querySelector<HTMLElement>(".main-content");
    if (!scrollRoot) return;

    let frameId = 0;
    const updateCollapsed = () => {
      frameId = 0;

      const scrollTop = scrollRoot.scrollTop;
      const next = collapsedRef.current
        ? scrollTop > expandThreshold || lastIntentRef.current !== "up"
        : scrollTop > collapseThreshold;

      if (next === collapsedRef.current) return;

      collapsedRef.current = next;
      setCollapsed(next);
    };

    const onScroll = () => {
      if (frameId) return;
      frameId = requestAnimationFrame(updateCollapsed);
    };
    const onWheel = (event: WheelEvent) => {
      if (event.deltaY > 0) lastIntentRef.current = "down";
      if (event.deltaY < 0) lastIntentRef.current = "up";
    };
    const onTouchStart = (event: TouchEvent) => {
      lastTouchYRef.current = event.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (event: TouchEvent) => {
      const lastTouchY = lastTouchYRef.current;
      const nextTouchY = event.touches[0]?.clientY;
      if (lastTouchY === null || nextTouchY === undefined) return;
      if (nextTouchY < lastTouchY) lastIntentRef.current = "down";
      if (nextTouchY > lastTouchY) lastIntentRef.current = "up";
      lastTouchYRef.current = nextTouchY;
    };

    updateCollapsed();
    scrollRoot.addEventListener("wheel", onWheel, { passive: true });
    scrollRoot.addEventListener("touchstart", onTouchStart, { passive: true });
    scrollRoot.addEventListener("touchmove", onTouchMove, { passive: true });
    scrollRoot.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      scrollRoot.removeEventListener("wheel", onWheel);
      scrollRoot.removeEventListener("touchstart", onTouchStart);
      scrollRoot.removeEventListener("touchmove", onTouchMove);
      scrollRoot.removeEventListener("scroll", onScroll);
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [collapseThreshold, expandThreshold]);

  return collapsed;
}
