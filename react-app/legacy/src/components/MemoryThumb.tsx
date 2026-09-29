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
  const [missingBlob, setMissingBlob] = useState(false);
  const plan = isMemoryPlan(memory);
  const label = (memory.title || memory.content || (plan ? "计" : "记")).trim().slice(0, 1) || (plan ? "计" : "记");
  const photoIds = memory.photos || [];

  useEffect(() => {
    if (!enabled || !photoIds.length) {
      setUrl("");
      setMissingBlob(false);
      return;
    }
    let active = true;
    let objectUrl = "";
    setMissingBlob(false);
    loadMemoryPhotos(memory.id, photoIds.slice(0, 1))
      .then((photos: Photo[]) => {
        if (!active) return;
        const blob = photos[0]?.thumbnailBlob || photos[0]?.originalBlob;
        if (!blob) {
          setMissingBlob(true);
          setUrl("");
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
        setMissingBlob(false);
      })
      .catch(() => {
        if (active) {
          setUrl("");
          setMissingBlob(true);
        }
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [enabled, memory.id, photoIds.join("|"), loadMemoryPhotos]);

  if (!enabled) return null;

  return (
    <div className={`memory-thumb ${plan ? "plan" : "memory"} ${missingBlob ? "photo-missing" : ""}`} title={missingBlob ? "照片文件不在当前设备" : undefined}>
      {url ? (
        <img src={url} alt="" draggable={false} />
      ) : (
        <span className={`memory-thumb-fallback ${plan ? "plan" : "memory"} ${missingBlob ? "missing" : ""}`}>
          {missingBlob ? "缺" : label}
        </span>
      )}
    </div>
  );
}
