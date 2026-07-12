import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject
} from "react";

export const DEFAULT_VIRTUAL_LIST_THRESHOLD = 80;

interface UseWindowedListOptions {
  itemCount: number;
  estimateSize: number;
  overscan?: number;
  enabled?: boolean;
  /** Prefer the nearest scrollable ancestor; falls back to window. */
  scrollRootRef?: RefObject<HTMLElement | null>;
}

interface WindowedListState {
  enabled: boolean;
  startIndex: number;
  endIndex: number;
  offsetTop: number;
  totalHeight: number;
  visibleCount: number;
}

function findScrollParent(node: HTMLElement | null): HTMLElement | Window {
  let current = node?.parentElement || null;
  while (current) {
    const style = window.getComputedStyle(current);
    const overflowY = style.overflowY;
    if ((overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") && current.scrollHeight > current.clientHeight + 1) {
      return current;
    }
    current = current.parentElement;
  }
  return window;
}

export function useWindowedList({
  itemCount,
  estimateSize,
  overscan = 6,
  enabled = true,
  scrollRootRef
}: UseWindowedListOptions): WindowedListState & { listRef: RefObject<HTMLDivElement> } {
  const listRef = useRef<HTMLDivElement>(null!);
  const [range, setRange] = useState({ startIndex: 0, endIndex: Math.max(itemCount - 1, 0) });
  const active = enabled && itemCount >= DEFAULT_VIRTUAL_LIST_THRESHOLD && estimateSize > 0;

  const measure = useCallback(() => {
    const listEl = listRef.current;
    if (!active || !listEl) {
      setRange({ startIndex: 0, endIndex: Math.max(itemCount - 1, 0) });
      return;
    }

    const root = scrollRootRef?.current || findScrollParent(listEl);
    const rootIsWindow = root === window;
    const rootRect = rootIsWindow
      ? { top: 0, height: window.innerHeight }
      : (root as HTMLElement).getBoundingClientRect();
    const listRect = listEl.getBoundingClientRect();
    const scrollTop = rootIsWindow
      ? Math.max(0, -listRect.top)
      : Math.max(0, (root as HTMLElement).scrollTop + (listRect.top - rootRect.top));
    const viewportHeight = rootIsWindow ? window.innerHeight : (root as HTMLElement).clientHeight;

    const rawStart = Math.floor(scrollTop / estimateSize) - overscan;
    const startIndex = Math.max(0, rawStart);
    const visible = Math.ceil(viewportHeight / estimateSize) + overscan * 2;
    const endIndex = Math.min(itemCount - 1, startIndex + visible);

    setRange((current) =>
      current.startIndex === startIndex && current.endIndex === endIndex
        ? current
        : { startIndex, endIndex }
    );
  }, [active, estimateSize, itemCount, overscan, scrollRootRef]);

  useLayoutEffect(() => {
    measure();
  }, [measure, itemCount]);

  useEffect(() => {
    if (!active) return;
    const listEl = listRef.current;
    const root = scrollRootRef?.current || findScrollParent(listEl);
    const onScroll = () => measure();
    root.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      root.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [active, measure, scrollRootRef]);

  const totalHeight = itemCount * estimateSize;
  const offsetTop = range.startIndex * estimateSize;
  const visibleCount = active ? Math.max(0, range.endIndex - range.startIndex + 1) : itemCount;

  return {
    enabled: active,
    startIndex: active ? range.startIndex : 0,
    endIndex: active ? range.endIndex : Math.max(itemCount - 1, 0),
    offsetTop: active ? offsetTop : 0,
    totalHeight: active ? totalHeight : 0,
    visibleCount,
    listRef
  };
}

interface WindowedListProps<T> {
  items: T[];
  estimateSize: number;
  overscan?: number;
  threshold?: number;
  enabled?: boolean;
  getKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function WindowedList<T>({
  items,
  estimateSize,
  overscan = 6,
  threshold = DEFAULT_VIRTUAL_LIST_THRESHOLD,
  enabled = true,
  getKey,
  renderItem,
  className = "",
  style
}: WindowedListProps<T>) {
  const windowed = useWindowedList({
    itemCount: items.length,
    estimateSize,
    overscan,
    enabled: enabled && items.length >= threshold
  });

  const slice = useMemo(() => {
    if (!windowed.enabled) return items;
    return items.slice(windowed.startIndex, windowed.endIndex + 1);
  }, [items, windowed.enabled, windowed.endIndex, windowed.startIndex]);

  if (!windowed.enabled) {
    return (
      <div className={className} style={style} ref={windowed.listRef}>
        {items.map((item, index) => (
          <div key={getKey(item, index)} className="windowed-list-item">
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={`${className} windowed-list`.trim()}
      ref={windowed.listRef}
      style={{
        ...style,
        position: "relative",
        height: windowed.totalHeight,
        minHeight: windowed.totalHeight
      }}
    >
      <div
        className="windowed-list-window"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          transform: `translateY(${windowed.offsetTop}px)`,
          display: "grid",
          gap: "inherit"
        }}
      >
        {slice.map((item, offset) => {
          const index = windowed.startIndex + offset;
          return (
            <div key={getKey(item, index)} className="windowed-list-item">
              {renderItem(item, index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
