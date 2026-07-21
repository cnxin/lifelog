import type { ComponentPropsWithoutRef, ReactNode } from "react";

type SurfaceTone = "canvas" | "primary" | "secondary" | "elevated";
type SurfaceElement = "section" | "div" | "article";

interface AppSurfaceProps extends ComponentPropsWithoutRef<"section"> {
  as?: SurfaceElement;
  children: ReactNode;
  tone?: SurfaceTone;
}

export default function AppSurface({
  as: Component = "section",
  children,
  className = "",
  tone = "primary",
  ...props
}: AppSurfaceProps) {
  return (
    <Component className={`app-surface app-surface--${tone} ${className}`.trim()} {...props}>
      {children}
    </Component>
  );
}
