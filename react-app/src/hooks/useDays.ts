import { useCallback, useEffect, useRef, useState } from "react";
import { db } from "../storage";
import type { Day } from "../domain";
import { commitWithTransition } from "../listTransition";
export default function useDays(
  onChanged: (message: string, afterClose: boolean) => void,
) {
  const [days, setDays] = useState<Day[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const loadedOnce = useRef(false);
  const reloadSequence = useRef(0);
  const reload = useCallback(async () => {
    const sequence = ++reloadSequence.current;
    const next = await db.days.toArray();
    if (sequence !== reloadSequence.current) return;
    const update = () => {
      if (sequence === reloadSequence.current) setDays(next);
    };
    if (loadedOnce.current) await commitWithTransition(update);
    else {
      update();
      loadedOnce.current = true;
    }
  }, []);
  const load = useCallback(async () => {
    setError("");
    try {
      await reload();
      setLoaded(true);
    } catch {
      setError(
        "无法读取本地数据。请检查浏览器是否允许本地存储，然后重试；原数据没有被清除。",
      );
    }
  }, [reload]);

  useEffect(() => {
    void load();
    const channel = new BroadcastChannel("lifelog-days");
    channel.onmessage = () => void load();
    return () => channel.close();
  }, [load]);

  async function changed(message: string, afterClose = false) {
    await reload();
    const channel = new BroadcastChannel("lifelog-days");
    channel.postMessage("updated");
    channel.close();
    onChanged(message, afterClose);
  }

  return { days, loaded, error, setError, reload, load, changed };
}
