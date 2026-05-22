import { Upload, X, Image as ImageIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import type { Photo } from "../types";
import { compressImage, validateImageFile, blobToObjectURL } from "../utils/imageCompression";

interface PhotoUploaderProps {
  photos: Photo[];
  memoryId: string;
  maxPhotos?: number;
  onPhotosChange: (photos: Photo[]) => void;
  disabled?: boolean;
}

export function PhotoUploader({
  photos,
  memoryId,
  maxPhotos = 9,
  onPhotosChange,
  disabled = false
}: PhotoUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (disabled) return;

    const remainingSlots = maxPhotos - photos.length;
    if (remainingSlots <= 0) {
      alert(`最多只能上传 ${maxPhotos} 张照片`);
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    setUploading(true);
    setUploadProgress(`正在处理 0/${filesToProcess.length} 张照片...`);

    const newPhotos: Photo[] = [];

    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];

      // 验证文件
      const validation = validateImageFile(file);
      if (!validation.valid) {
        alert(`${file.name}: ${validation.error}`);
        continue;
      }

      try {
        setUploadProgress(`正在处理 ${i + 1}/${filesToProcess.length} 张照片...`);

        // 压缩图片
        const compressed = await compressImage(file);

        // 创建照片记录
        const photo: Photo = {
          id: uuidv4(),
          memoryId,
          originalBlob: compressed.original,
          thumbnailBlob: compressed.thumbnail,
          width: compressed.width,
          height: compressed.height,
          fileSize: compressed.original.size,
          mimeType: compressed.original.type,
          capturedAt: compressed.exif.capturedAt,
          uploadedAt: new Date().toISOString(),
          order: photos.length + newPhotos.length
        };

        newPhotos.push(photo);
      } catch (error) {
        console.error(`处理 ${file.name} 失败:`, error);
        alert(`${file.name} 处理失败，请重试`);
      }
    }

    setUploading(false);
    setUploadProgress("");

    if (newPhotos.length > 0) {
      onPhotosChange([...photos, ...newPhotos]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setDragActive(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    handleFileSelect(files);
  };

  const handleRemovePhoto = (photoId: string) => {
    const updatedPhotos = photos
      .filter((p) => p.id !== photoId)
      .map((p, index) => ({ ...p, order: index }));
    onPhotosChange(updatedPhotos);
  };

  const handleReorder = (fromIndex: number, toIndex: number) => {
    const reordered = [...photos];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    const updated = reordered.map((p, index) => ({ ...p, order: index }));
    onPhotosChange(updated);
  };

  return (
    <div className="photo-uploader">
      {/* 照片网格 */}
      {photos.length > 0 && (
        <div className="photo-grid">
          {photos.map((photo, index) => (
            <PhotoPreview
              key={photo.id}
              photo={photo}
              index={index}
              onRemove={() => handleRemovePhoto(photo.id)}
              onReorder={handleReorder}
              disabled={disabled}
            />
          ))}
        </div>
      )}

      {/* 上传区域 */}
      {photos.length < maxPhotos && !uploading && (
        <div
          className={`photo-upload-zone ${dragActive ? "drag-active" : ""} ${disabled ? "disabled" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            multiple
            onChange={(e) => handleFileSelect(e.target.files)}
            style={{ display: "none" }}
            disabled={disabled}
          />
          <Upload size={32} />
          <p>点击或拖拽上传照片</p>
          <p className="upload-hint">
            支持 JPG、PNG、GIF、WebP 格式，最多 {maxPhotos} 张
          </p>
          <p className="upload-hint">
            已上传 {photos.length}/{maxPhotos} 张
          </p>
        </div>
      )}

      {/* 上传进度 */}
      {uploading && (
        <div className="photo-upload-progress">
          <div className="spinner"></div>
          <p>{uploadProgress}</p>
        </div>
      )}
    </div>
  );
}

interface PhotoPreviewProps {
  photo: Photo;
  index: number;
  onRemove: () => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  disabled: boolean;
}

function PhotoPreview({ photo, index, onRemove, disabled }: PhotoPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    let mounted = true;
    let objectUrl = "";

    setPreviewUrl("");
    blobToObjectURL(photo.thumbnailBlob)
      .then((url) => {
        objectUrl = url;
        if (mounted) {
          setPreviewUrl(url);
        } else {
          URL.revokeObjectURL(url);
        }
      })
      .catch((error) => {
        console.error("加载照片预览失败:", error);
      });

    return () => {
      mounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photo.thumbnailBlob]);

  return (
    <div className="photo-preview">
      {previewUrl ? (
        <img src={previewUrl} alt={`照片 ${index + 1}`} />
      ) : (
        <div className="photo-loading">
          <ImageIcon size={24} />
        </div>
      )}
      {!disabled && (
        <button
          type="button"
          className="photo-remove-btn"
          onClick={onRemove}
          title="删除照片"
        >
          <X size={16} />
        </button>
      )}
      <div className="photo-order">{index + 1}</div>
    </div>
  );
}
