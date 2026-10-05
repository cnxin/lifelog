import { useEffect, useRef, type RefObject } from "react";
import { dayStatus, type Day } from "../domain";
import { tones } from "../dayMeta";
import { haptic } from "../haptics";
import {
  CELEBRATED_KEY,
  playCelebration,
  shouldCelebrate,
  type CelebrationTone,
} from "../celebrate";
export default function useCelebration(
  loaded: boolean,
  featured: Day | undefined,
  today: string,
  status: ReturnType<typeof dayStatus> | null,
  heroRef: RefObject<HTMLDivElement>,
) {
  const cancelCelebration = useRef<(() => void) | null>(null);
  const celebratedFallback = useRef<string | null>(null);
  useEffect(() => {
    if (!loaded || !featured || status?.delta !== 0) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const stop = () => {
      cancelCelebration.current?.();
      cancelCelebration.current = null;
    };
    const reduce = () => {
      if (motion.matches) stop();
    };
    motion.addEventListener("change", reduce);
    const frame = requestAnimationFrame(() => {
      if (!heroRef.current) return;
      let stored = celebratedFallback.current;
      try {
        stored = localStorage.getItem(CELEBRATED_KEY) ?? stored;
      } catch {}
      if (!shouldCelebrate(featured, today, stored)) return;
      const marker = `${featured.id}:${today}`;
      celebratedFallback.current = marker;
      try {
        localStorage.setItem(CELEBRATED_KEY, marker);
      } catch {}
      void haptic("success");
      if (!motion.matches) {
        stop();
        cancelCelebration.current = playCelebration(
          heroRef.current,
          tones[featured.category] as CelebrationTone,
        );
      }
    });
    return () => {
      cancelAnimationFrame(frame);
      motion.removeEventListener("change", reduce);
      stop();
    };
  }, [loaded, featured?.id, featured?.category, today, status?.delta]);
  function replayCelebration() {
    if (!featured || status?.delta !== 0 || !heroRef.current) return;
    void haptic("light");
    cancelCelebration.current?.();
    cancelCelebration.current = null;
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
      cancelCelebration.current = playCelebration(
        heroRef.current,
        tones[featured.category] as CelebrationTone,
      );
  }

  return replayCelebration;
}
