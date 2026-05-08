import { useState, useEffect, useCallback } from "react";
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
  }, [currentIndex, photos.length]);

  const handlePrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
  }, [photos.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
  }, [photos.length]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="photo-viewer-overlay" onClick={handleBackdropClick}>
      <div className="photo-viewer-container">
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
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
