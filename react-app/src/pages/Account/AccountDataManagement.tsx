import { Database, Download, RotateCcw, ShieldCheck, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import GlassCard from "../../components/GlassCard";
import { useConfirm } from "../../context/ConfirmContext";
import { useLifeLog } from "../../context/LifeLogContext";
import { useToast } from "../../context/ToastContext";
import { buildBackupHealthReport, buildBackupImportPreview } from "../../utils/backupHealth";
import { isRecord } from "../../utils/lifelogHelpers";

export default function AccountDataManagement() {
  const { state, exportData, importData, resetDemo } = useLifeLog();
  const confirm = useConfirm();
  const notify = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const importLockRef = useRef(false);
  const [isImporting, setIsImporting] = useState(false);
  const healthReport = useMemo(() => buildBackupHealthReport(state), [state]);

  const dataSummary = useMemo(
    () => [
      `${state.people.length} 个人物`,
      `${state.places.length} 个地点`,
      `${state.memories.length} 条回忆`
    ].join(" · "),
    [state.memories.length, state.people.length, state.places.length]
  );
  const hasUserData = state.people.length > 0 || state.places.length > 0 || state.memories.length > 0;

  async function handleImport(file: File | undefined) {
    if (!file) return;
    if (importLockRef.current) return;
    let parsed: unknown;
    let previewMessage = "";

    try {
      const text = await file.text();
      parsed = JSON.parse(text) as unknown;
      if (!isRecord(parsed)) {
        throw new Error("JSON 结构不正确，请使用 LifeLog 导出的备份文件。");
      }
      const preview = buildBackupImportPreview(parsed);
      previewMessage = [
        `将导入：${preview.people} 个人物 · ${preview.places} 个地点 · ${preview.memories} 条回忆 · ${preview.photos} 张照片。`,
        preview.exportedAt ? `备份时间：${formatBackupDate(preview.exportedAt)}。` : "",
        preview.appVersion ? `备份版本：${preview.appVersion}。` : "",
        preview.issueCount ? `预检发现 ${preview.issueCount} 个关联问题：${preview.issues.slice(0, 2).join("；")}。` : "预检未发现明显关联问题。",
        `导入会覆盖当前本地资料、照片、设置和提醒（${dataSummary}）。建议先导出完整备份。`
      ].filter(Boolean).join("\n");
    } catch (error) {
      await confirm({
        title: "导入失败",
        message: error instanceof Error ? error.message : "文件不是有效的 JSON 格式，请检查备份文件。",
        confirmText: "知道了",
        tone: "info"
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const accepted = await confirm({
      title: "导入预检",
      message: previewMessage,
      confirmText: "确认覆盖导入"
    });
    if (!accepted) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    importLockRef.current = true;
    setIsImporting(true);
    try {
      await importData(file);
      notify({ message: "数据导入完成，当前资料已恢复", tone: "success" });
    } catch (error) {
      await confirm({
        title: "导入失败",
        message: error instanceof Error ? error.message : "请检查文件格式。",
        confirmText: "知道了",
        tone: "info"
      });
    } finally {
      importLockRef.current = false;
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleReset() {
    const accepted = await confirm({
      title: "重置为示例数据",
      message: `这会清空当前本地数据（${dataSummary}）并替换为 Demo 示例数据。建议先导出备份。`,
      confirmText: "确认重置"
    });
    if (!accepted) return;
    await resetDemo();
    notify({ message: "已重置为示例数据", tone: "success" });
  }

  return (
    <section className="section">
      <div className="section-header">
        <h2>
          <Database /> 数据管理
        </h2>
      </div>
      <div className="data-management-panel">
        <GlassCard className="data-management-intro">
          <strong>本地数据备份</strong>
          <span>{dataSummary}</span>
          <p>数据保存在当前设备的 IndexedDB 中。完整备份会包含资料、照片、设置和提醒；导入和重置会覆盖当前本地数据。</p>
        </GlassCard>
        <GlassCard className={`backup-health-card ${healthReport.status}`}>
          <div className="backup-health-head">
            <ShieldCheck />
            <div>
              <strong>{healthReport.status === "ok" ? "备份健康：可备份" : "备份健康：需检查"}</strong>
              <span>
                {healthReport.people} 人物 · {healthReport.places} 地点 · {healthReport.memories} 回忆 · {healthReport.photoRefs} 照片引用
              </span>
            </div>
          </div>
          <p>
            {healthReport.status === "ok"
              ? "当前数据关联完整，可以直接导出完整备份。"
              : `${healthReport.issueCount} 个问题：${healthReport.issues.slice(0, 2).join("；")}`}
          </p>
        </GlassCard>
        <div className="data-action-grid">
          <button
            className="data-action-card glass-card"
            onClick={() => {
              void exportData().then(() => notify({ message: "完整备份文件已生成", tone: "success" }));
            }}
            disabled={!hasUserData}
          >
            <div className="data-action-icon">
              <Download />
            </div>
            <div>
              <strong>导出完整备份</strong>
              <span>保存资料、照片、设置和提醒</span>
            </div>
          </button>
          <button
            className="data-action-card glass-card"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
          >
            <div className="data-action-icon">
              <Upload />
            </div>
            <div>
              <strong>{isImporting ? "导入中…" : "从备份恢复"}</strong>
              <span>恢复资料、照片、设置和提醒</span>
            </div>
          </button>
          <button className="data-action-card danger glass-card" onClick={() => void handleReset()}>
            <div className="data-action-icon">
              <RotateCcw />
            </div>
            <div>
              <strong>重置为示例数据</strong>
              <span>清空当前数据并还原 Demo</span>
            </div>
          </button>
        </div>
      </div>
      <input
        ref={fileInputRef}
        className="hidden-file"
        type="file"
        accept=".json,application/json"
        onChange={(event) => void handleImport(event.target.files?.[0])}
      />
    </section>
  );
}

function formatBackupDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}
