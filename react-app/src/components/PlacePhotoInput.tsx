import { Image as ImageIcon, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { useToast } from "../context/ToastContext";
import { blobToDataURL, compressImage, validateImageFile, SUPPORTED_IMAGE_ACCEPT, SUPPORTED_IMAGE_FORMAT_LABEL } from "../utils/imageCompression";
import PhotoUploadQueue, { type PhotoUploadQueueItem } from "./PhotoUploadQueue";
import { recordUxMetric } from "../utils/uxMetrics";

interface PlacePhotoInputProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  maxPhotos?: number;
  disabled?: boolean;
}

interface FailedPlacePhoto {
  file: File;
  message: string;
}

export default function PlacePhotoInput({
  value,
  defaultValue = "",
  onChange,
  maxPhotos = 6,
  disabled = false
}: PlacePhotoInputProps) {
  const notify = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingText, setProcessingText] = useState("");
  const [processingPercent, setProcessingPercent] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [failedPhotos, setFailedPhotos] = useState<FailedPlacePhoto[]>([]);
  const [queueItems, setQueueItems] = useState<PhotoUploadQueueItem[]>([]);
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const currentValue = isControlled ? value : internalValue;
  const photos = splitPhotoLines(currentValue);

  function commit(nextValue: string) {
    if (!isControlled) setInternalValue(nextValue);
    onChange?.(nextValue);
  }

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length || disabled) return;
    await processFiles(Array.from(files));
  }

  async function retryFailedPhotos() {
    if (!failedPhotos.length || disabled) return;
    await processFiles(failedPhotos.map((item) => item.file), true);
  }

  async function processFiles(selectedFiles: File[], isRetry = false) {
    setErrors([]);
    setFailedPhotos([]);
    setProcessingText("");
    setProcessingPercent(0);
    setQueueItems([]);
    const remaining = maxPhotos - photos.length;
    if (remaining <= 0) {
      const message = `最多只能添加 ${maxPhotos} 张地点照片`;
      setErrors([message]);
      notify({ message, tone: "error" });
      return;
    }

    setIsProcessing(true);
    setProcessingText("正在准备图片...");
    const nextPhotos = [...photos];
    const nextErrors: string[] = [];
    const nextFailedPhotos: FailedPlacePhoto[] = [];
    const filesToProcess = selectedFiles.slice(0, remaining);
    if (isRetry) {
      for (const file of filesToProcess) {
        recordPlacePhotoProcess(file, "retry", 0);
      }
    }
    const nextQueueItems = filesToProcess.map((file, index) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
      name: file.name || `地点照片 ${index + 1}`,
      status: "queued" as const,
      message: "等待处理"
    }));
    setQueueItems(nextQueueItems);
    if (selectedFiles.length > remaining) {
      nextErrors.push(`已达到上限，只处理前 ${remaining} 张照片。`);
    }
    try {
      for (let index = 0; index < filesToProcess.length; index += 1) {
        const file = filesToProcess[index];
        const startedAt = performance.now();
        const queueId = nextQueueItems[index]?.id;
        setProcessingPercent(Math.round((index / filesToProcess.length) * 100));
        const isHeic = isHeicFile(file);
        setProcessingText(isHeic ? `正在转换 ${index + 1}/${filesToProcess.length} 张 HEIC 图片` : `正在处理 ${index + 1}/${filesToProcess.length} 张图片`);
        if (queueId) updateQueueItem(queueId, { status: "processing", message: isHeic ? "正在转换 HEIC 并压缩" : "正在压缩图片" });
        const validation = validateImageFile(file);
        if (!validation.valid) {
          const message = validation.error || "不支持的图片格式";
          nextErrors.push(`${file.name}: ${message}`);
          nextFailedPhotos.push({ file, message });
          if (queueId) updateQueueItem(queueId, { status: "error", message });
          recordPlacePhotoProcess(file, "fail", performance.now() - startedAt);
          continue;
        }
        try {
          const compressed = await compressImage(file);
          nextPhotos.push(await blobToDataURL(compressed.original));
          recordPlacePhotoProcess(file, "success", performance.now() - startedAt);
          if (queueId) updateQueueItem(queueId, { status: "done", message: "已添加" });
        } catch (error) {
          const message = getPlacePhotoErrorMessage(error);
          nextErrors.push(`${file.name}: ${message}`);
          nextFailedPhotos.push({ file, message });
          recordPlacePhotoProcess(file, "fail", performance.now() - startedAt);
          if (queueId) updateQueueItem(queueId, { status: "error", message });
        }
      }
      setProcessingPercent(100);
      commit(nextPhotos.join("\n"));
      setErrors(nextErrors);
      setFailedPhotos(nextFailedPhotos);
      const addedCount = nextPhotos.length - photos.length;
      if (addedCount > 0) {
        notify({
          message: nextErrors.length ? `已添加 ${addedCount} 张地点照片，${nextErrors.length} 项未处理` : `已添加 ${addedCount} 张地点照片`,
          tone: nextErrors.length ? "info" : "success"
        });
      } else if (nextErrors.length) {
        notify({ message: nextErrors[0], tone: "error" });
      }
    } finally {
      setIsProcessing(false);
      setProcessingText("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function updateQueueItem(id: string, patch: Partial<PhotoUploadQueueItem>) {
    setQueueItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function removePhoto(index: number) {
    commit(photos.filter((_, itemIndex) => itemIndex !== index).join("\n"));
  }

  return (
    <div className="place-photo-input">
      <textarea
        name="photos"
        value={currentValue}
        onChange={(event) => commit(event.target.value)}
        placeholder="每行一个图片链接；也可以点击下方按钮直接上传本地图片"
      />
      {photos.length > 0 && (
        <div className="place-photo-input-preview">
          {photos.map((photo, index) => (
            <div className="place-photo-input-item" key={`${photo.slice(0, 24)}-${index}`}>
              <img
                alt={`地点照片 ${index + 1}`}
                src={photo}
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={(event) => {
                  event.currentTarget.style.opacity = "0.25";
                }}
              />
              <button type="button" aria-label="移除地点照片" onClick={() => removePhoto(index)} disabled={disabled}>
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept={SUPPORTED_IMAGE_ACCEPT}
        multiple
        hidden
        onChange={(event) => void handleFiles(event.target.files)}
      />
      <button
        className="place-photo-upload-button"
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || isProcessing || photos.length >= maxPhotos}
      >
        {isProcessing ? <ImageIcon size={16} /> : <Upload size={16} />}
        {isProcessing ? "正在处理图片" : "上传本地图片"}
      </button>
      {isProcessing && processingText && (
        <div className="place-photo-processing" role="status" aria-live="polite">
          <span>{processingText}</span>
          <div className="photo-upload-progress-bar" aria-hidden="true">
            <span style={{ width: `${processingPercent}%` }} />
          </div>
        </div>
      )}
      <PhotoUploadQueue items={queueItems} />
      {errors.length > 0 && (
        <div className="place-photo-errors" role="status" aria-live="polite">
          <strong>{errors.length === 1 ? "有一项未处理" : `${errors.length} 项未处理`}</strong>
          {errors.slice(0, 3).map((error) => (
            <span key={error}>{error}</span>
          ))}
          {errors.length > 3 && <small>还有 {errors.length - 3} 项未显示。</small>}
          {failedPhotos.length > 0 && (
            <button type="button" onClick={() => void retryFailedPhotos()} disabled={disabled || isProcessing}>
              重试未处理图片
            </button>
          )}
        </div>
      )}
      <p className="form-hint">支持 {SUPPORTED_IMAGE_FORMAT_LABEL}；HEIC 会自动尝试转换。本地图片会压缩后保存到地点资料中，最多 {maxPhotos} 张。</p>
    </div>
  );
}

function recordPlacePhotoProcess(file: File, outcome: "success" | "retry" | "fail", durationMs: number) {
  recordUxMetric({
    event: "photo_process",
    format: isHeicFile(file) ? "heic" : "other",
    outcome,
    durationMs
  });
}

function splitPhotoLines(value: string) {
  return value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function getPlacePhotoErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return "处理失败，请重试";
}

function isHeicFile(file: File) {
  return ["image/heic", "image/heif"].includes(file.type) || /\.(heic|heif)$/i.test(file.name);
}
