import { useState, useEffect } from "react";
import { Image as ImageIcon } from "lucide-react";
import type { Photo } from "../types";
import { blobToObjectURL } from "../utils/imageCompression";

interface PhotoGridProps {
  photos: Photo[];
  columns?: number;
  onClick?: (index: number) => void;
}

export function PhotoGrid({ photos, columns = 3, onClick }: PhotoGridProps) {
  if (photos.length === 0) return null;

  return (
    <div className="photo-grid" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {photos.map((photo, index) => (
        <PhotoGridItem
          key={photo.id}
          photo={photo}
          index={index}
          onClick={onClick ? () => onClick(index) : undefined}
        />
      ))}
    </div>
  );
}

interface PhotoGridItemProps {
  photo: Photo;
  index: number;
  onClick?: () => void;
}

function PhotoGridItem({ photo, index, onClick }: PhotoGridItemProps) {
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    let objectUrl = "";

    setLoading(true);
    setError(false);
    setImageUrl("");

    blobToObjectURL(photo.thumbnailBlob)
      .then((url) => {
        objectUrl = url;
        if (mounted) {
          setImageUrl(url);
          setLoading(false);
        } else {
          URL.revokeObjectURL(url);
        }
      })
      .catch((err) => {
        console.error("加载照片失败:", err);
        if (mounted) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photo.thumbnailBlob]);

  return (
    <div
      className={`photo-grid-item ${onClick ? "clickable" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {loading && (
        <div className="photo-grid-item-loading">
          <ImageIcon size={24} />
        </div>
      )}
      {error && (
        <div className="photo-grid-item-error">
          <ImageIcon size={24} />
          <span>加载失败</span>
        </div>
      )}
      {!loading && !error && imageUrl && (
        <img
          src={imageUrl}
          alt={`照片 ${index + 1}`}
          loading="lazy"
        />
      )}
    </div>
  );
}
