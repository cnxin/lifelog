import { useEffect, useState } from "react";
import { todayKey } from "../domain";
export default function useToday() {
  const [today, setToday] = useState(todayKey());
  useEffect(() => {
    const update = () => setToday(todayKey());
    const timer = window.setInterval(update, 30000);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", update);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("focus", update);
    };
  }, []);

  return { today, setToday };
}
