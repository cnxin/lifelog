interface ListSkeletonProps {
  rows?: number;
  variant?: "card" | "detail" | "home";
  className?: string;
}

export default function ListSkeleton({ rows = 4, variant = "card", className = "" }: ListSkeletonProps) {
  if (variant === "home") {
    return (
      <div className={`list-skeleton list-skeleton-home ${className}`.trim()} role="status" aria-live="polite" aria-label="正在加载">
        <div className="list-skeleton-pill" />
        <div className="list-skeleton-composer" />
        {Array.from({ length: Math.max(2, rows) }, (_, index) => (
          <div className="list-skeleton-card" key={index}>
            <div className="list-skeleton-row">
              <span className="list-skeleton-avatar" />
              <span className="list-skeleton-copy">
                <span className="list-skeleton-line w-60" />
                <span className="list-skeleton-line w-40" />
              </span>
            </div>
            <span className="list-skeleton-line w-90" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "detail") {
    return (
      <div className={`list-skeleton list-skeleton-detail ${className}`.trim()} role="status" aria-live="polite" aria-label="正在加载">
        <div className="list-skeleton-hero" />
        <span className="list-skeleton-line w-50" />
        <span className="list-skeleton-line w-80" />
        <span className="list-skeleton-line w-70" />
        <div className="list-skeleton-card">
          <span className="list-skeleton-line w-40" />
          <span className="list-skeleton-line w-90" />
          <span className="list-skeleton-line w-75" />
        </div>
      </div>
    );
  }

  return (
    <div className={`list-skeleton list-skeleton-card-list ${className}`.trim()} role="status" aria-live="polite" aria-label="正在加载">
      {Array.from({ length: rows }, (_, index) => (
        <div className="list-skeleton-card" key={index}>
          <div className="list-skeleton-row">
            <span className="list-skeleton-avatar" />
            <span className="list-skeleton-copy">
              <span className="list-skeleton-line w-55" />
              <span className="list-skeleton-line w-35" />
            </span>
          </div>
          <span className="list-skeleton-line w-85" />
        </div>
      ))}
    </div>
  );
}
