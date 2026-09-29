import { Capacitor, registerPlugin } from "@capacitor/core";
import { makeBackup, todayKey, type Day } from "./domain";

const NativeBackupFile = registerPlugin<{
  save(options: {
    fileName: string;
    content: string;
  }): Promise<{ path: string }>;
}>("NativeBackupFile");

export async function exportBackup(days: Day[]): Promise<string> {
  const fileName = `lifelog-days-${todayKey()}.json`;
  const content = JSON.stringify(makeBackup(days), null, 2);
  if (Capacitor.getPlatform() === "android") {
    try {
      await NativeBackupFile.save({ fileName, content });
      return "备份已保存到你选择的位置。";
    } catch (error) {
      if (error instanceof Error && error.message.includes("canceled"))
        return "已取消保存，数据没有变化。";
      throw new Error("备份保存失败，请重新选择文件位置。");
    }
  }
  const url = URL.createObjectURL(
    new Blob([content], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  return "已发起备份下载，请确认文件已保存。";
}
