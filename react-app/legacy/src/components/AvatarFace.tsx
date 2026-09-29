import type { CSSProperties, HTMLAttributes } from "react";
import { initials, initialsLength } from "../utils/text";

type AvatarFaceProps = {
  name: string;
  className?: string;
  title?: string;
} & HTMLAttributes<HTMLDivElement>;

/**
 * Person monogram avatar: keeps up to 4 Chinese glyphs on one line
 * and auto-scales font size by glyph count.
 */
export default function AvatarFace({ name, className = "", title, style, ...rest }: AvatarFaceProps) {
  const label = initials(name);
  const len = Math.min(4, Math.max(1, initialsLength(label)));
  const mergedStyle = {
    ...style,
    ["--avatar-chars" as string]: String(len)
  } as CSSProperties;

  return (
    <div
      className={`avatar-face avatar-chars-${len} ${className}`.trim()}
      data-avatar-chars={len}
      style={mergedStyle}
      title={title || name}
      aria-hidden={rest["aria-label"] ? undefined : true}
      {...rest}
    >
      <span className="avatar-face-label">{label}</span>
    </div>
  );
}
