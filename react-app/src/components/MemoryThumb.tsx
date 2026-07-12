import { useEffect, useState } from "react";
import type { MemoryEvent, Photo } from "../types";
import { useLifeLog } from "../context/LifeLogContext";
import { isMemoryPlan } from "../utils/memoryDisplay";

/** Soft monogram thumb when no photo; real photo when available. */
export default function MemoryThumb({
  memory,
  enabled
}: {
  memory: MemoryEvent;
  enabled: boolean;
}) {
  const { loadMemoryPhotos } = useLifeLog();
  const [url, setUrl] = useState<string>("");
  const plan = isMemoryPlan(memory);
  const label = (memory.title || memory.content || (plan ? "计" : "记")).trim().slice(0, 1) || (plan ? "计" : "记");
  const photoIds = memory.photos || [];

  useEffect(() => {
    if (!enabled || !photoIds.length) {
      setUrl("");
      return;
    }
    let active = true;
    let objectUrl = "";
    loadMemoryPhotos(memory.id, photoIds.slice(0, 1))
      .then((photos: Photo[]) => {
        if (!active) return;
        const blob = photos[0]?.thumbnailBlob || photos[0]?.originalBlob;
        if (!blob) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (active) setUrl("");
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [enabled, memory.id, photoIds.join("|"), loadMemoryPhotos]);

  if (!enabled) return null;

  return (
    <div className={`memory-thumb ${plan ? "plan" : "memory"}`}>
      {url ? (
        <img src={url} alt="" draggable={false} />
      ) : (
        <span className={`memory-thumb-fallback ${plan ? "plan" : "memory"}`}>{label}</span>
      )}
    </div>
  );
}
