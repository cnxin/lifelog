import type { ReactNode } from "react";

interface ListRowProps {
  className?: string;
  children: ReactNode;
}

export default function ListRow({ className = "", children }: ListRowProps) {
  return <article className={`list-row ${className}`.trim()}>{children}</article>;
}
