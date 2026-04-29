import type { ReactNode } from "react";

interface GlassCardProps {
  className?: string;
  children: ReactNode;
}

export default function GlassCard({ className = "", children }: GlassCardProps) {
  return <article className={`glass-card ${className}`}>{children}</article>;
}
