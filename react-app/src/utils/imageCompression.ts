import imageCompression from 'browser-image-compression';
import heic2any from 'heic2any';

export const SUPPORTED_IMAGE_ACCEPT = "image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif";
export const SUPPORTED_IMAGE_FORMAT_LABEL = "JPG、PNG、GIF、WebP、HEIC";

export interface CompressedImageResult {
  original: Blob;
  thumbnail: Blob;
  width: number;
  height: number;
  exif: {
    capturedAt?: string;
  };
}

/**
 * 压缩图片并生成缩略图
 * @param file 原始图片文件
 * @returns 压缩后的原图、缩略图和元数据
 */
export async function compressImage(file: File): Promise<CompressedImageResult> {
  try {
    const sourceFile = await normalizeImageFile(file);
    // 压缩原图：最大宽度 1920px，质量 0.8，目标 500KB
    const originalOptions = {
      maxSizeMB: 0.5,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      initialQuality: 0.8,
      preserveExif: true,
    };

    const compressedOriginal = await compressWithFallback(sourceFile, originalOptions, {
      maxWidthOrHeight: 1920,
      quality: 0.82,
      fallbackType: getOutputMimeType(sourceFile)
    });

    // 生成缩略图：200x200px，质量 0.7，目标 50KB
    const thumbnailOptions = {
      maxSizeMB: 0.05,
      maxWidthOrHeight: 200,
      useWebWorker: true,
      initialQuality: 0.7,
    };

    const thumbnail = await compressWithFallback(sourceFile, thumbnailOptions, {
      maxWidthOrHeight: 240,
      quality: 0.72,
      fallbackType: "image/jpeg"
    });

    // 获取图片尺寸
    const dimensions = await getImageDimensions(compressedOriginal);

    // 提取 EXIF 数据
    const exif = await extractExifData(sourceFile);

    return {
      original: compressedOriginal,
      thumbnail,
      width: dimensions.width,
      height: dimensions.height,
      exif,
    };
  } catch (error) {
    console.error('图片压缩失败:', error);
    throw new Error(getImageProcessingErrorMessage(error));
  }
}

async function compressWithFallback(
  file: File,
  options: Parameters<typeof imageCompression>[1],
  fallback: { maxWidthOrHeight: number; quality: number; fallbackType: string }
) {
  try {
    return await imageCompression(file, options);
  } catch (error) {
    console.warn("browser-image-compression 失败，尝试 Canvas 回退:", error);
    return compressImageWithCanvas(file, fallback);
  }
}

async function compressImageWithCanvas(
  file: File,
  options: { maxWidthOrHeight: number; quality: number; fallbackType: string }
): Promise<Blob> {
  const source = await loadImageFromFile(file);
  try {
    const ratio = Math.min(1, options.maxWidthOrHeight / Math.max(source.width, source.height));
    const width = Math.max(1, Math.round(source.width * ratio));
    const height = Math.max(1, Math.round(source.height * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("当前设备不支持图片处理");
    context.drawImage(source.image, 0, 0, width, height);

    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("图片导出失败"));
          return;
        }
        resolve(blob);
      }, options.fallbackType, options.quality);
    });
  } finally {
    source.dispose();
  }
}

function loadImageFromFile(file: File): Promise<{ image: HTMLImageElement; width: number; height: number; dispose: () => void }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({
        image,
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
        dispose: () => URL.revokeObjectURL(url)
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("无法读取图片，请确认图片格式可被当前设备打开"));
    };
    image.src = url;
  });
}

/**
 * 获取图片尺寸
 */
async function getImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('无法加载图片'));
    };

    img.src = url;
  });
}

/**
 * 提取 EXIF 数据（拍摄时间）
 */
async function extractExifData(file: File): Promise<{ capturedAt?: string }> {
  try {
    // 使用 browser-image-compression 的内置 EXIF 读取
    const exifData = await imageCompression.getExifOrientation(file);

    // 注意：browser-image-compression 只提供 orientation，
    // 完整的 EXIF 提取需要额外的库（如 exif-js）
    // 这里先返回空对象，后续可扩展
    return {};
  } catch (error) {
    console.warn('EXIF 提取失败:', error);
    return {};
  }
}

/**
 * 验证文件是否为有效的图片
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const fileName = file.name.toLowerCase();

  // 检查文件类型
  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
  const validExtensions = /\.(jpe?g|png|gif|webp|heic|heif)$/;
  if (!validTypes.includes(file.type) && !validExtensions.test(fileName)) {
    return {
      valid: false,
      error: `不支持的图片格式，请上传 ${SUPPORTED_IMAGE_FORMAT_LABEL} 格式`,
    };
  }

  // 检查文件大小（最大 20MB）
  const maxSize = 20 * 1024 * 1024;
  if (file.size > maxSize) {
    return {
      valid: false,
      error: '图片文件过大，请上传小于 20MB 的图片',
    };
  }

  return { valid: true };
}

function getOutputMimeType(file: File) {
  if (file.type === "image/png" || file.type === "image/webp") return file.type;
  return "image/jpeg";
}

async function normalizeImageFile(file: File) {
  if (!isHeicFile(file)) return file;

  try {
    const converted = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: 0.9
    });
    const blob = Array.isArray(converted) ? converted[0] : converted;
    if (!blob) throw new Error("HEIC 转换失败");
    return new File([blob], replaceImageExtension(file.name, "jpg"), {
      type: "image/jpeg",
      lastModified: file.lastModified
    });
  } catch (error) {
    console.warn("HEIC/HEIF 转换失败:", error);
    throw new Error("HEIC/HEIF 自动转换失败，请在相册中另存为 JPG 后再上传");
  }
}

function isHeicFile(file: File) {
  return ["image/heic", "image/heif"].includes(file.type) || /\.(heic|heif)$/i.test(file.name);
}

function replaceImageExtension(fileName: string, extension: string) {
  const trimmed = fileName.trim() || `photo.${extension}`;
  return /\.(heic|heif)$/i.test(trimmed) ? trimmed.replace(/\.(heic|heif)$/i, `.${extension}`) : `${trimmed}.${extension}`;
}

function getImageProcessingErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (/heic|heif/i.test(message)) return message;
  if (/load|decode|读取|格式/i.test(message)) return "无法读取这张图片，请换一张或先在相册中另存为 JPG";
  if (/canvas|support|支持/i.test(message)) return "当前设备不支持处理这张图片，请换一张较小的 JPG";
  return "图片处理失败，请换一张或先截图/压缩后再上传";
}

/**
 * 将 Blob 转换为 Data URL（用于预览）
 */
export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * 将 Blob 转换为对象 URL。调用方必须在不再使用时 URL.revokeObjectURL。
 */
export function blobToObjectURL(blob: Blob): Promise<string> {
  return Promise.resolve(URL.createObjectURL(blob));
}
