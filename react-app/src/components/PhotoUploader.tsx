import { Upload, X, Image as ImageIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import type { Photo } from "../types";
import { compressImage, validateImageFile, blobToObjectURL, SUPPORTED_IMAGE_ACCEPT, SUPPORTED_IMAGE_FORMAT_LABEL } from "../utils/imageCompression";
import { useToast } from "../context/ToastContext";
import { PhotoViewer } from "./PhotoViewer";
import PhotoUploadQueue, { type PhotoUploadQueueItem } from "./PhotoUploadQueue";

interface PhotoUploaderProps {
  photos: Photo[];
  memoryId: string;
  maxPhotos?: number;
  onPhotosChange: (photos: Photo[]) => void;
  disabled?: boolean;
}

interface FailedUpload {
  file: File;
  message: string;
}

export function PhotoUploader({
  photos,
  memoryId,
  maxPhotos = 9,
  onPhotosChange,
  disabled = false
}: PhotoUploaderProps) {
  const notify = useToast();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const [uploadPercent, setUploadPercent] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [failedUploads, setFailedUploads] = useState<FailedUpload[]>([]);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [queueItems, setQueueItems] = useState<PhotoUploadQueueItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (disabled) return;
    await processFiles(Array.from(files));
  };

  async function retryFailedUploads() {
    if (!failedUploads.length || disabled) return;
    await processFiles(failedUploads.map((item) => item.file));
  }

  async function processFiles(selectedFiles: File[]) {
    setErrors([]);
    setFailedUploads([]);
    setUploadPercent(0);
    setQueueItems([]);

    const remainingSlots = maxPhotos - photos.length;
    if (remainingSlots <= 0) {
      const message = `最多只能上传 ${maxPhotos} 张照片`;
      setErrors([message]);
      notify({ message, tone: "error" });
      return;
    }

    const filesToProcess = selectedFiles.slice(0, remainingSlots);
    const nextQueueItems = filesToProcess.map((file, index) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
      name: file.name || `照片 ${index + 1}`,
      status: "queued" as const,
      message: "等待处理"
    }));
    setQueueItems(nextQueueItems);
    const nextErrors: string[] = [];
    const nextFailedUploads: FailedUpload[] = [];
    if (selectedFiles.length > remainingSlots) {
      nextErrors.push(`已达到上限，只处理前 ${remainingSlots} 张照片。`);
    }
    setUploading(true);
    setUploadProgress(`正在处理 0/${filesToProcess.length} 张照片...`);

    const newPhotos: Photo[] = [];

    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      const queueId = nextQueueItems[i]?.id;
      setUploadPercent(Math.round((i / filesToProcess.length) * 100));
      const isHeic = isHeicFile(file);
      if (queueId) updateQueueItem(queueId, { status: "processing", message: isHeic ? "正在转换 HEIC 并压缩" : "正在压缩和生成缩略图" });

      // 验证文件
      const validation = validateImageFile(file);
      if (!validation.valid) {
        const message = validation.error || "不支持的图片格式";
        nextErrors.push(`${file.name}: ${message}`);
        nextFailedUploads.push({ file, message });
        if (queueId) updateQueueItem(queueId, { status: "error", message });
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
        if (queueId) updateQueueItem(queueId, { status: "done", message: "已添加" });
      } catch (error) {
        console.error(`处理 ${file.name} 失败:`, error);
        const message = getUploadErrorMessage(error);
        nextErrors.push(`${file.name}: ${message}`);
        nextFailedUploads.push({ file, message });
        if (queueId) updateQueueItem(queueId, { status: "error", message });
      }
    }

    setUploading(false);
    setUploadProgress("");
    setUploadPercent(100);
    setErrors(nextErrors);
    setFailedUploads(nextFailedUploads);

    if (newPhotos.length > 0) {
      onPhotosChange([...photos, ...newPhotos]);
      notify({
        message: nextErrors.length ? `已添加 ${newPhotos.length} 张照片，${nextErrors.length} 项未处理` : `已添加 ${newPhotos.length} 张照片`,
        tone: nextErrors.length ? "info" : "success"
      });
    } else if (nextErrors.length) {
      notify({ message: nextErrors[0], tone: "error" });
    }
  }

  function updateQueueItem(id: string, patch: Partial<PhotoUploadQueueItem>) {
    setQueueItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

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
              onOpen={() => setViewerIndex(index)}
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
            accept={SUPPORTED_IMAGE_ACCEPT}
            multiple
            onChange={(event) => {
              void handleFileSelect(event.target.files);
              event.currentTarget.value = "";
            }}
            style={{ display: "none" }}
            disabled={disabled}
          />
          <Upload size={32} />
          <p>点击或拖拽上传照片</p>
          <p className="upload-hint">
            支持 {SUPPORTED_IMAGE_FORMAT_LABEL}；HEIC 会自动尝试转换
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
          <div className="photo-upload-progress-bar" aria-hidden="true">
            <span style={{ width: `${uploadPercent}%` }} />
          </div>
        </div>
      )}

      <PhotoUploadQueue items={queueItems} />

      {errors.length > 0 && (
        <div className="photo-upload-errors" role="status" aria-live="polite">
          <strong>{errors.length === 1 ? "有一项未处理" : `${errors.length} 项未处理`}</strong>
          {errors.slice(0, 3).map((error) => (
            <span key={error}>{error}</span>
          ))}
          {errors.length > 3 && <small>还有 {errors.length - 3} 项未显示。</small>}
          {failedUploads.length > 0 && (
            <button type="button" onClick={() => void retryFailedUploads()} disabled={disabled || uploading}>
              重试未处理照片
            </button>
          )}
        </div>
      )}

      {viewerIndex !== null && photos.length > 0 && (
        <PhotoViewer
          key={`upload-photo-viewer-${viewerIndex}`}
          photos={photos}
          initialIndex={Math.min(viewerIndex, photos.length - 1)}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </div>
  );
}

function getUploadErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return "处理失败，请重试";
}

function isHeicFile(file: File) {
  return ["image/heic", "image/heif"].includes(file.type) || /\.(heic|heif)$/i.test(file.name);
}

interface PhotoPreviewProps {
  photo: Photo;
  index: number;
  onOpen: () => void;
  onRemove: () => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  disabled: boolean;
}

function PhotoPreview({ photo, index, onOpen, onRemove, disabled }: PhotoPreviewProps) {
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
    <div
      className="photo-preview"
      role="button"
      tabIndex={0}
      title="查看大图"
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
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
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          title="删除照片"
        >
          <X size={16} />
        </button>
      )}
      <div className="photo-order">{index + 1}</div>
    </div>
  );
}
