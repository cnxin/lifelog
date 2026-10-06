import { useEffect, useRef, useState } from "react";

// Shared by the compact header and the permanent desktop toolbar field.
export default function useHomeSearch(compact: boolean, query: string, setQuery: (query: string) => void) {
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [exiting, setExiting] = useState(false);
  const exitTimer = useRef<ReturnType<typeof setTimeout>>();
  const open = compact && (searchOpen || query.length > 0);
  useEffect(() => () => clearTimeout(exitTimer.current), []);

  function close() {
    setQuery("");
    if (!compact) return;
    clearTimeout(exitTimer.current);
    const animate = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    setExiting(animate);
    if (animate) exitTimer.current = setTimeout(() => setExiting(false), 160);
    setSearchOpen(false);
    requestAnimationFrame(() => buttonRef.current?.focus());
  }
  function toggle() {
    if (open) return close();
    clearTimeout(exitTimer.current);
    setExiting(false);
    setSearchOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }
  return { open, exiting, inputRef, buttonRef, close, toggle };
}
