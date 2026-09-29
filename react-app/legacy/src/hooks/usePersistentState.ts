import { useEffect, useState } from "react";

export function usePersistentState<T>(
  key: string,
  initialValue: T,
  validate?: (value: unknown) => value is T
) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return initialValue;
      const parsed = JSON.parse(raw) as unknown;
      return validate && !validate(parsed) ? initialValue : (parsed as T);
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // 筛选状态只是体验优化，保存失败不影响主流程。
    }
  }, [key, value]);

  return [value, setValue] as const;
}
