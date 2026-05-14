import { useEffect, useRef, useState } from "react";

export function useCollapsingDetailHeader(collapseThreshold = 60, expandThreshold = 0) {
  const [collapsed, setCollapsed] = useState(false);
  const collapsedRef = useRef(false);

  useEffect(() => {
    const scrollRoot = document.querySelector<HTMLElement>(".main-content");
    if (!scrollRoot) return;

    let frameId = 0;
    let suppressUntil = 0;

    const updateCollapsed = () => {
      frameId = 0;
      if (performance.now() < suppressUntil) return;

      const next = collapsedRef.current
        ? scrollRoot.scrollTop > expandThreshold
        : scrollRoot.scrollTop > collapseThreshold;

      if (next === collapsedRef.current) return;

      console.log(`[Collapse] scrollTop=${scrollRoot.scrollTop}, next=${next}, threshold=${next ? expandThreshold : collapseThreshold}`);
      collapsedRef.current = next;
      setCollapsed(next);
      suppressUntil = performance.now() + 400;
    };

    const onScroll = () => {
      if (frameId) return;
      frameId = requestAnimationFrame(updateCollapsed);
    };

    updateCollapsed();
    scrollRoot.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      scrollRoot.removeEventListener("scroll", onScroll);
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [collapseThreshold, expandThreshold]);

  return collapsed;
}
