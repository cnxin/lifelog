import { Capacitor, registerPlugin } from "@capacitor/core";

interface NativeBackupFilePlugin {
  save(options: {
    fileName: string;
    content: string;
    mimeType?: string;
  }): Promise<{ fileName?: string; path?: string; size?: number }>;
}

export interface BackupExportTarget {
  fileName: string;
  locationLabel: string;
  locationDetail: string;
  path?: string;
}

const NativeBackupFile = registerPlugin<NativeBackupFilePlugin>("NativeBackupFile");

export async function saveBackupFile(fileName: string, content: string): Promise<BackupExportTarget> {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
    const result = await NativeBackupFile.save({
      fileName,
      content
    });
    const savedName = result.fileName || fileName;
    return {
      fileName: savedName,
      path: result.path,
      locationLabel: "已保存到你选择的位置",
      locationDetail: result.path
        ? "系统文件保存器已完成写入，下方是 Android 返回的文件位置标识。"
        : "系统文件保存器已完成写入，可以在刚才选择的目录中找到备份文件。"
    };
  }

  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);

  return {
    fileName,
    locationLabel: "浏览器默认下载目录",
    locationDetail: "具体位置取决于当前浏览器设置，桌面端通常是“下载/Downloads”。"
  };
}

export async function saveReadableFile(fileName: string, content: string, mimeType = "text/plain;charset=utf-8"): Promise<BackupExportTarget> {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
    const result = await NativeBackupFile.save({
      fileName,
      content,
      mimeType
    });
    const savedName = result.fileName || fileName;
    return {
      fileName: savedName,
      path: result.path,
      locationLabel: "已保存到你选择的位置",
      locationDetail: result.path
        ? "系统文件保存器已完成写入，下方是 Android 返回的文件位置标识。"
        : "系统文件保存器已完成写入，可以在刚才选择的目录中找到导出文件。"
    };
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);

  return {
    fileName,
    locationLabel: "浏览器默认下载目录",
    locationDetail: "具体位置取决于当前浏览器设置，桌面端通常是“下载/Downloads”。"
  };
}
