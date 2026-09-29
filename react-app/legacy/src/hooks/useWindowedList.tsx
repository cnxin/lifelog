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
}: UseWindowedListOptions): WindowedListState & {
  listRef: RefObject<HTMLDivElement>;
  sizesRef: RefObject<number[]>;
  setMeasuredSize: (index: number, size: number) => void;
  getOffsetForIndex: (index: number) => number;
} {
  const listRef = useRef<HTMLDivElement>(null!);
  const sizesRef = useRef<number[]>([]);
  const [version, setVersion] = useState(0);
  const [range, setRange] = useState({ startIndex: 0, endIndex: Math.max(itemCount - 1, 0) });
  const active = enabled && itemCount >= DEFAULT_VIRTUAL_LIST_THRESHOLD && estimateSize > 0;

  // Keep size cache length in sync.
  if (sizesRef.current.length !== itemCount) {
    const next = Array.from({ length: itemCount }, (_, i) => sizesRef.current[i] || estimateSize);
    sizesRef.current = next;
  }

  const getSize = useCallback(
    (index: number) => {
      const measured = sizesRef.current[index];
      return measured && measured > 0 ? measured : estimateSize;
    },
    [estimateSize]
  );

  const getOffsetForIndex = useCallback(
    (index: number) => {
      let top = 0;
      const max = Math.max(0, Math.min(index, itemCount));
      for (let i = 0; i < max; i += 1) top += getSize(i);
      return top;
    },
    [getSize, itemCount]
  );

  const totalHeight = useMemo(() => {
    let sum = 0;
    for (let i = 0; i < itemCount; i += 1) sum += getSize(i);
    return sum;
    // version invalidates when measurements change
  }, [getSize, itemCount, version]);

  const findStartIndex = useCallback(
    (scrollTop: number) => {
      let acc = 0;
      for (let i = 0; i < itemCount; i += 1) {
        const size = getSize(i);
        if (acc + size > scrollTop) return i;
        acc += size;
      }
      return Math.max(0, itemCount - 1);
    },
    [getSize, itemCount]
  );

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

    const startIndex = Math.max(0, findStartIndex(scrollTop) - overscan);
    let endIndex = startIndex;
    let covered = getOffsetForIndex(startIndex);
    const target = scrollTop + viewportHeight;
    while (endIndex < itemCount - 1 && covered < target) {
      covered += getSize(endIndex);
      endIndex += 1;
    }
    endIndex = Math.min(itemCount - 1, endIndex + overscan);

    setRange((current) =>
      current.startIndex === startIndex && current.endIndex === endIndex
        ? current
        : { startIndex, endIndex }
    );
  }, [active, findStartIndex, getOffsetForIndex, getSize, itemCount, overscan, scrollRootRef]);

  const setMeasuredSize = useCallback(
    (index: number, size: number) => {
      if (!active || index < 0 || index >= itemCount) return;
      const rounded = Math.max(1, Math.round(size));
      const prev = sizesRef.current[index] || estimateSize;
      // Ignore tiny diffs to avoid feedback loops.
      if (Math.abs(prev - rounded) < 2) return;
      sizesRef.current[index] = rounded;
      setVersion((value) => value + 1);
    },
    [active, estimateSize, itemCount]
  );

  useLayoutEffect(() => {
    measure();
  }, [measure, itemCount, version]);

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

  const offsetTop = getOffsetForIndex(range.startIndex);
  const visibleCount = active ? Math.max(0, range.endIndex - range.startIndex + 1) : itemCount;

  return {
    enabled: active,
    startIndex: active ? range.startIndex : 0,
    endIndex: active ? range.endIndex : Math.max(itemCount - 1, 0),
    offsetTop: active ? offsetTop : 0,
    totalHeight: active ? totalHeight : 0,
    visibleCount,
    listRef,
    sizesRef,
    setMeasuredSize,
    getOffsetForIndex
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
            <WindowedListItem
              key={getKey(item, index)}
              index={index}
              onMeasure={windowed.setMeasuredSize}
            >
              {renderItem(item, index)}
            </WindowedListItem>
          );
        })}
      </div>
    </div>
  );
}

function WindowedListItem({
  index,
  onMeasure,
  children
}: {
  index: number;
  onMeasure: (index: number, size: number) => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const publish = () => {
      const rect = el.getBoundingClientRect();
      // include vertical margins between grid items approximately via offsetHeight
      onMeasure(index, Math.max(rect.height, el.offsetHeight));
    };
    publish();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => publish());
    observer.observe(el);
    return () => observer.disconnect();
  }, [index, onMeasure]);

  return (
    <div ref={ref} className="windowed-list-item">
      {children}
    </div>
  );
}
