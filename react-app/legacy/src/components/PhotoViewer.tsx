import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import type { Photo } from "../types";
import { blobToDataURL } from "../utils/imageCompression";
import {
  animateOrSnap,
  project,
  rubberband,
  prefersReducedMotion,
  SPRING_BOUNCY,
  SPRING_DEFAULT,
  type SpringAnimation
} from "../utils/motion";
import { isFluidFeatureEnabled } from "../utils/features";

interface PhotoViewerProps {
  photos: Photo[];
  initialIndex: number;
  onClose: () => void;
}

export function PhotoViewer({ photos, initialIndex, onClose }: PhotoViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const fluid = isFluidFeatureEnabled("fluidPhotoViewer");
  const stageRef = useRef<HTMLDivElement | null>(null);
  const xRef = useRef(0);
  const yRef = useRef(0);
  const animRef = useRef<SpringAnimation | null>(null);
  const dragRef = useRef<{
    active: boolean;
    pointerId: number;
    startX: number;
    startY: number;
    mode: "pending" | "horizontal" | "vertical";
    samples: Array<{ t: number; x: number; y: number }>;
  } | null>(null);
  const currentPhoto = photos[currentIndex];

  useEffect(() => {
    if (!currentPhoto) return;

    setLoading(true);
    let mounted = true;

    blobToDataURL(currentPhoto.originalBlob)
      .then((url) => {
        if (mounted) {
          setImageUrl(url);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("加载照片失败:", err);
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [currentPhoto]);

  const applyStage = useCallback((x: number, y: number, opacity = 1) => {
    xRef.current = x;
    yRef.current = y;
    const el = stageRef.current;
    if (!el) return;
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    el.style.opacity = String(opacity);
  }, []);

  const stopAnim = useCallback(() => {
    if (animRef.current) {
      animRef.current.stop();
      animRef.current = null;
    }
  }, []);

  useEffect(() => () => stopAnim(), [stopAnim]);

  const handlePrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
  }, [photos.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
  }, [photos.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        handlePrevious();
      } else if (e.key === "ArrowRight") {
        handleNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNext, handlePrevious, onClose]);

  useEffect(() => {
    const handleCloseRequest = () => onClose();
    window.addEventListener("lifelog:close-photo-viewer", handleCloseRequest);
    return () => window.removeEventListener("lifelog:close-photo-viewer", handleCloseRequest);
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const velocityFromSamples = (axis: "x" | "y", samples: Array<{ t: number; x: number; y: number }>) => {
    if (samples.length < 2) return 0;
    const a = samples[0];
    const b = samples[samples.length - 1];
    const dt = (b.t - a.t) / 1000;
    if (dt <= 0) return 0;
    return axis === "x" ? (b.x - a.x) / dt : (b.y - a.y) / dt;
  };

  const handlePointerDown = (event: React.PointerEvent) => {
    stopAnim();
    dragRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      mode: "pending",
      samples: [{ t: performance.now(), x: event.clientX, y: event.clientY }]
    };
    try {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag?.active || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (drag.mode === "pending") {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
      drag.mode = Math.abs(dx) > Math.abs(dy) * 1.15 ? "horizontal" : "vertical";
    }
    drag.samples.push({ t: performance.now(), x: event.clientX, y: event.clientY });
    if (drag.samples.length > 6) drag.samples.shift();

    if (!fluid) {
      if (drag.mode === "horizontal") {
        applyStage(dx * 0.28, 0, Math.max(0.35, 1 - (Math.abs(dx) * 0.45) / 260));
      } else {
        applyStage(0, dy, Math.max(0.35, 1 - Math.abs(dy) / 260));
      }
      return;
    }

    if (drag.mode === "horizontal") {
      applyStage(dx, 0, Math.max(0.45, 1 - Math.abs(dx) / 480));
    } else {
      let y = dy;
      if (y < 0) y = -rubberband(-y, 320, 0.45);
      applyStage(0, y, Math.max(0.35, 1 - Math.max(0, y) / 360));
    }
  };

  const handlePointerUp = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag?.active || drag.pointerId !== event.pointerId) return;
    drag.active = false;
    dragRef.current = null;
    try {
      (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }

    const reduced = prefersReducedMotion();
    const width = stageRef.current?.parentElement?.clientWidth || 320;

    if (!fluid) {
      if (drag.mode === "horizontal" && Math.abs(xRef.current / 0.28) > 72 && photos.length > 1) {
        if (xRef.current < 0) handleNext();
        else handlePrevious();
      } else if (drag.mode === "vertical" && Math.abs(yRef.current) > 88) {
        onClose();
        return;
      }
      applyStage(0, 0, 1);
      return;
    }

    if (drag.mode === "horizontal") {
      const vx = velocityFromSamples("x", drag.samples);
      const projected = xRef.current + project(vx, 0.994);
      let dir = 0;
      if (photos.length > 1) {
        if (projected < -width * 0.22 || vx < -700) dir = 1;
        else if (projected > width * 0.22 || vx > 700) dir = -1;
      }
      if (dir !== 0) {
        const target = dir > 0 ? -width : width;
        animRef.current = animateOrSnap(reduced, {
          from: xRef.current,
          to: target,
          velocity: vx,
          spring: SPRING_BOUNCY,
          onUpdate: (x) => applyStage(x, 0, Math.max(0.2, 1 - Math.abs(x) / width)),
          onComplete: () => {
            if (dir > 0) handleNext();
            else handlePrevious();
            applyStage(dir > 0 ? width * 0.35 : -width * 0.35, 0, 1);
            animRef.current = animateOrSnap(reduced, {
              from: xRef.current,
              to: 0,
              velocity: 0,
              spring: SPRING_DEFAULT,
              onUpdate: (x) => applyStage(x, 0, 1),
              onComplete: () => {
                animRef.current = null;
                applyStage(0, 0, 1);
              }
            });
          }
        });
      } else {
        animRef.current = animateOrSnap(reduced, {
          from: xRef.current,
          to: 0,
          velocity: vx,
          spring: SPRING_DEFAULT,
          onUpdate: (x) => applyStage(x, 0, Math.max(0.5, 1 - Math.abs(x) / 500)),
          onComplete: () => {
            animRef.current = null;
            applyStage(0, 0, 1);
          }
        });
      }
      return;
    }

    if (drag.mode === "vertical") {
      const vy = velocityFromSamples("y", drag.samples);
      const projected = yRef.current + project(vy, 0.995);
      const shouldClose = projected > 120 || vy > 900;
      if (shouldClose) {
        animRef.current = animateOrSnap(reduced, {
          from: yRef.current,
          to: 560,
          velocity: Math.max(vy, 0),
          spring: SPRING_BOUNCY,
          onUpdate: (y) => applyStage(0, y, Math.max(0, 1 - y / 420)),
          onComplete: () => {
            animRef.current = null;
            onClose();
          }
        });
      } else {
        animRef.current = animateOrSnap(reduced, {
          from: yRef.current,
          to: 0,
          velocity: vy,
          spring: SPRING_DEFAULT,
          onUpdate: (y) => applyStage(0, y, Math.max(0.4, 1 - Math.abs(y) / 400)),
          onComplete: () => {
            animRef.current = null;
            applyStage(0, 0, 1);
          }
        });
      }
      return;
    }

    applyStage(0, 0, 1);
  };

  const viewer = (
    <div className="photo-viewer-overlay" onClick={handleBackdropClick}>
      <div
        className={`photo-viewer-container${fluid ? " photo-viewer-container--fluid" : ""}`}
        ref={stageRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <button className="photo-viewer-close pressable" onClick={onClose} title="关闭 (Esc)" type="button">
          <X size={24} />
        </button>

        <div className="photo-viewer-counter">
          {currentIndex + 1} / {photos.length}
        </div>

        {photos.length > 1 && (
          <button
            className="photo-viewer-nav photo-viewer-nav-left pressable"
            onClick={handlePrevious}
            title="上一张 (←)"
            type="button"
          >
            <ChevronLeft size={32} />
          </button>
        )}

        <div className="photo-viewer-content">
          {loading ? (
            <div className="photo-viewer-loading">
              <div className="spinner"></div>
              <p>加载中...</p>
            </div>
          ) : imageUrl ? (
            <img src={imageUrl} alt={`照片 ${currentIndex + 1}`} className="photo-viewer-image" draggable={false} />
          ) : (
            <div className="photo-viewer-error">
              <p>照片加载失败</p>
            </div>
          )}
        </div>

        {photos.length > 1 && (
          <button
            className="photo-viewer-nav photo-viewer-nav-right pressable"
            onClick={handleNext}
            title="下一张 (→)"
            type="button"
          >
            <ChevronRight size={32} />
          </button>
        )}

        {currentPhoto && (
          <div className="photo-viewer-info">
            <span>
              {currentPhoto.width} × {currentPhoto.height}
            </span>
            <span>·</span>
            <span>{formatFileSize(currentPhoto.fileSize)}</span>
            {currentPhoto.capturedAt && (
              <>
                <span>·</span>
                <span>{new Date(currentPhoto.capturedAt).toLocaleString()}</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(viewer, document.body);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
