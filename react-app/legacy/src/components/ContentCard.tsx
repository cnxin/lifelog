import { forwardRef, type ReactNode } from "react";

interface ContentCardProps {
  className?: string;
  children: ReactNode;
  elevated?: boolean;
}

const ContentCard = forwardRef<HTMLElement, ContentCardProps>(function ContentCard(
  { className = "", children, elevated = false },
  ref
) {
  return <article ref={ref} className={`content-card${elevated ? " content-card--elevated" : ""} ${className}`.trim()}>{children}</article>;
});

export default ContentCard;
