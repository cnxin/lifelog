import { Image as ImageIcon, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { blobToDataURL, compressImage, validateImageFile } from "../utils/imageCompression";

interface PlacePhotoInputProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  maxPhotos?: number;
  disabled?: boolean;
}

export default function PlacePhotoInput({
  value,
  defaultValue = "",
  onChange,
  maxPhotos = 6,
  disabled = false
}: PlacePhotoInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
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
    const remaining = maxPhotos - photos.length;
    if (remaining <= 0) {
      alert(`最多只能添加 ${maxPhotos} 张地点照片`);
      return;
    }

    setIsProcessing(true);
    const nextPhotos = [...photos];
    try {
      for (const file of Array.from(files).slice(0, remaining)) {
        const validation = validateImageFile(file);
        if (!validation.valid) {
          alert(`${file.name}: ${validation.error}`);
          continue;
        }
        const compressed = await compressImage(file);
        nextPhotos.push(await blobToDataURL(compressed.original));
      }
      commit(nextPhotos.join("\n"));
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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
        accept="image/jpeg,image/png,image/gif,image/webp"
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
      <p className="form-hint">本地图片会压缩后保存到地点资料中；最多 {maxPhotos} 张，详情页展示前 3 张。</p>
    </div>
  );
}

function splitPhotoLines(value: string) {
  return value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}
