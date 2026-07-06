import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import type { Photo } from "../types";
import { blobToDataURL } from "../utils/imageCompression";

interface PhotoViewerProps {
  photos: Photo[];
  initialIndex: number;
  onClose: () => void;
}

export function PhotoViewer({ photos, initialIndex, onClose }: PhotoViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragXOffset, setDragXOffset] = useState(0);
  const dragStartRef = useRef<{ x: number; y: number; mode: "pending" | "horizontal" | "vertical" } | null>(null);
  const currentPhoto = photos[currentIndex];

  // 加载当前照片的原图
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

  const handlePrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
  }, [photos.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
  }, [photos.length]);

  // 键盘导航
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

  const handlePointerDown = (event: React.PointerEvent) => {
    dragStartRef.current = { x: event.clientX, y: event.clientY, mode: "pending" };
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    const start = dragStartRef.current;
    if (!start) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (start.mode === "pending") {
      if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 8) return;
      start.mode = Math.abs(deltaX) > Math.abs(deltaY) * 1.2 ? "horizontal" : "vertical";
    }
    if (start.mode === "horizontal") {
      setDragXOffset(deltaX);
      return;
    }
    setDragOffset(deltaY);
  };

  const handlePointerUp = () => {
    const mode = dragStartRef.current?.mode;
    if (mode === "horizontal" && Math.abs(dragXOffset) > 72 && photos.length > 1) {
      if (dragXOffset < 0) handleNext();
      else handlePrevious();
      dragStartRef.current = null;
      setDragXOffset(0);
      setDragOffset(0);
      return;
    }
    if (mode === "vertical" && Math.abs(dragOffset) > 88) {
      onClose();
      return;
    }
    dragStartRef.current = null;
    setDragOffset(0);
    setDragXOffset(0);
  };

  const viewer = (
    <div className="photo-viewer-overlay" onClick={handleBackdropClick}>
      <div
        className="photo-viewer-container"
        style={{
          transform: `translate(${dragXOffset * 0.28}px, ${dragOffset}px)`,
          opacity: Math.max(0.35, 1 - Math.max(Math.abs(dragOffset), Math.abs(dragXOffset) * 0.45) / 260)
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* 关闭按钮 */}
        <button
          className="photo-viewer-close"
          onClick={onClose}
          title="关闭 (Esc)"
        >
          <X size={24} />
        </button>

        {/* 照片计数 */}
        <div className="photo-viewer-counter">
          {currentIndex + 1} / {photos.length}
        </div>

        {/* 左箭头 */}
        {photos.length > 1 && (
          <button
            className="photo-viewer-nav photo-viewer-nav-left"
            onClick={handlePrevious}
            title="上一张 (←)"
          >
            <ChevronLeft size={32} />
          </button>
        )}

        {/* 照片内容 */}
        <div className="photo-viewer-content">
          {loading ? (
            <div className="photo-viewer-loading">
              <div className="spinner"></div>
              <p>加载中...</p>
            </div>
          ) : imageUrl ? (
            <img
              src={imageUrl}
              alt={`照片 ${currentIndex + 1}`}
              className="photo-viewer-image"
            />
          ) : (
            <div className="photo-viewer-error">
              <p>照片加载失败</p>
            </div>
          )}
        </div>

        {/* 右箭头 */}
        {photos.length > 1 && (
          <button
            className="photo-viewer-nav photo-viewer-nav-right"
            onClick={handleNext}
            title="下一张 (→)"
          >
            <ChevronRight size={32} />
          </button>
        )}

        {/* 照片信息 */}
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
