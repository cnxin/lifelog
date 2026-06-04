type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue?: string }>>;
};

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

export function isQrCodeDetectionSupported() {
  return typeof window !== "undefined" && Boolean(window.BarcodeDetector);
}

export function createQrBarcodeDetector() {
  if (!window.BarcodeDetector) {
    throw new Error("当前环境不支持二维码识别，请改用扫码或粘贴链接。");
  }
  return new window.BarcodeDetector({ formats: ["qr_code"] });
}

export async function detectQrTextFromImageFile(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("请选择包含 LifeLog 二维码的图片。");
  }
  const detector = createQrBarcodeDetector();
  const image = await loadImageSource(file);
  try {
    const codes = await detector.detect(image.source);
    return codes.find((code) => code.rawValue)?.rawValue?.trim() || "";
  } finally {
    image.cleanup();
  }
}

async function loadImageSource(file: File): Promise<{ source: CanvasImageSource; cleanup: () => void }> {
  if ("createImageBitmap" in window) {
    const bitmap = await window.createImageBitmap(file);
    return {
      source: bitmap,
      cleanup: () => bitmap.close()
    };
  }

  const url = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  const loaded = new Promise<HTMLImageElement>((resolve, reject) => {
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片读取失败，请换一张二维码图片。"));
  });
  image.src = url;
  return {
    source: await loaded,
    cleanup: () => URL.revokeObjectURL(url)
  };
}
