import { useEffect, useState } from "react";
import type { Day } from "../domain";
export default function useCardFocus(
  editor: Day | null,
  detailId: string | null,
  calendarDate: string | null,
  settings: boolean,
) {
  const [focusId, setFocusId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  useEffect(() => {
    // Do not scroll the inert home underneath an editor or a retained calendar.
    if (!focusId || editor || detailId || calendarDate || settings) return;
    const frame = requestAnimationFrame(() => {
      const card = Array.from(
        document.querySelectorAll<HTMLElement>(".day-card[data-id]"),
      ).find((item) => item.dataset.id === focusId);
      if (card) {
        card.scrollIntoView({
          block: "center",
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
        });
        card
          .querySelector<HTMLElement>(".card-main")
          ?.focus({ preventScroll: true });
        setHighlightId(focusId);
      }
      setFocusId(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [focusId, editor, detailId, calendarDate, settings]);
  useEffect(() => {
    if (!highlightId) return;
    // animationend does not fire in reduced-motion, or if a card is filtered out.
    const timer = window.setTimeout(() => setHighlightId(null), 1400);
    return () => window.clearTimeout(timer);
  }, [highlightId]);

  return { setFocusId, highlightId, setHighlightId };
}
