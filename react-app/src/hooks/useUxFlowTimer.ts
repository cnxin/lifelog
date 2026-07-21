import { useCallback, useEffect, useRef } from "react";

export function useUxFlowTimer(active: boolean, sessionKey: string) {
  const startedAtRef = useRef(0);

  useEffect(() => {
    startedAtRef.current = active ? performance.now() : 0;
  }, [active, sessionKey]);

  return useCallback(() => {
    if (!startedAtRef.current) return 0;
    return Math.max(0, Math.round(performance.now() - startedAtRef.current));
  }, []);
}
