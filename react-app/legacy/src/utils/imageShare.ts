import { Capacitor, registerPlugin } from "@capacitor/core";

interface NativeImageSharePlugin {
  saveToGallery(options: { fileName: string; base64Content: string }): Promise<{ fileName?: string; uri?: string; size?: number }>;
  share(options: { fileName: string; base64Content: string; title?: string }): Promise<{ shared?: boolean }>;
}

const NativeImageShare = registerPlugin<NativeImageSharePlugin>("NativeImageShare");

export interface ImageShareResult {
  fileName: string;
  uri?: string;
}

export async function saveImageToGallery(fileName: string, dataUrl: string): Promise<ImageShareResult> {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
    const result = await NativeImageShare.saveToGallery({
      fileName,
      base64Content: extractBase64Content(dataUrl)
    });
    return {
      fileName: result.fileName || fileName,
      uri: result.uri
    };
  }

  downloadDataUrl(fileName, dataUrl);
  return { fileName };
}

export async function shareImageFile(fileName: string, dataUrl: string, title = "分享 LifeLog 二维码") {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
    await NativeImageShare.share({
      fileName,
      base64Content: extractBase64Content(dataUrl),
      title
    });
    return;
  }

  const file = await dataUrlToFile(dataUrl, fileName);
  const share = navigator.share?.bind(navigator);
  const canShare = navigator.canShare?.bind(navigator);
  if (share && (!canShare || canShare({ files: [file] }))) {
    await share({
      title,
      files: [file]
    });
    return;
  }

  downloadDataUrl(fileName, dataUrl);
}

function extractBase64Content(dataUrl: string) {
  return dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
}

function downloadDataUrl(fileName: string, dataUrl: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function dataUrlToFile(dataUrl: string, fileName: string) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], fileName, { type: blob.type || "image/png" });
}
