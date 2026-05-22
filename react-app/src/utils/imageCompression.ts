import imageCompression from 'browser-image-compression';

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
    // 压缩原图：最大宽度 1920px，质量 0.8，目标 500KB
    const originalOptions = {
      maxSizeMB: 0.5,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      initialQuality: 0.8,
      preserveExif: true,
    };

    const compressedOriginal = await imageCompression(file, originalOptions);

    // 生成缩略图：200x200px，质量 0.7，目标 50KB
    const thumbnailOptions = {
      maxSizeMB: 0.05,
      maxWidthOrHeight: 200,
      useWebWorker: true,
      initialQuality: 0.7,
    };

    const thumbnail = await imageCompression(file, thumbnailOptions);

    // 获取图片尺寸
    const dimensions = await getImageDimensions(compressedOriginal);

    // 提取 EXIF 数据
    const exif = await extractExifData(file);

    return {
      original: compressedOriginal,
      thumbnail,
      width: dimensions.width,
      height: dimensions.height,
      exif,
    };
  } catch (error) {
    console.error('图片压缩失败:', error);
    throw new Error('图片压缩失败，请重试');
  }
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
  // 检查文件类型
  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      error: '不支持的图片格式，请上传 JPG、PNG、GIF 或 WebP 格式',
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
