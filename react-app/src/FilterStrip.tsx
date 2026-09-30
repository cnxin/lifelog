import { useEffect, useRef, type ReactNode } from "react";

export default function FilterStrip({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const strip = ref.current!;
    const update = () => {
      strip.dataset.atEnd = String(
        strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 1,
      );
    };
    const resize = new ResizeObserver(update);
    resize.observe(strip);
    Array.from(strip.children).forEach(child => resize.observe(child));
    strip.addEventListener("scroll", update, { passive: true });
    strip.addEventListener("scrollend", update);
    update();
    return () => {
      resize.disconnect();
      strip.removeEventListener("scroll", update);
      strip.removeEventListener("scrollend", update);
    };
  }, []);
  return (
    <div ref={ref} className="filters" role="group" aria-label="按分类筛选">
      {children}
    </div>
  );
}
