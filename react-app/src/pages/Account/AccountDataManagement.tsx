import { ChevronDown, Database, Download, ExternalLink, RotateCcw, ShieldCheck, Sparkles, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import GlassCard from "../../components/GlassCard";
import { useConfirm } from "../../context/ConfirmContext";
import { useLifeLog } from "../../context/LifeLogContext";
import { useToast } from "../../context/ToastContext";
import { buildBackupHealthDetailGroups, buildBackupHealthReport, buildBackupImportPreview } from "../../utils/backupHealth";
import { saveReadableFile } from "../../utils/backupExport";
import { buildShareImportPreview, isLifeLogSharePayload, normalizeLifeLogSharePayload } from "../../utils/lifelogShare";
import { isRecord } from "../../utils/lifelogHelpers";
import { buildReadableHtml, buildReadableMarkdown } from "../../utils/readableExport";

export default function AccountDataManagement() {
  const { state, exportData, importData, importShareData, resetDemo, duplicatePlaceGroups, mergeAllDuplicatePlaces } = useLifeLog();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const notify = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const importLockRef = useRef(false);
  const [isImporting, setIsImporting] = useState(false);
  const [lastExport, setLastExport] = useState<Awaited<ReturnType<typeof exportData>> | null>(null);
  const [importRecovery, setImportRecovery] = useState<ImportRecoveryState | null>(null);
  const [openHealthGroupId, setOpenHealthGroupId] = useState<string | null>(null);
  const healthReport = useMemo(() => buildBackupHealthReport(state), [state]);
  const healthDetails = useMemo(() => buildBackupHealthDetailGroups(state), [state]);

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
    setImportRecovery(null);
    let parsed: unknown;
    let previewMessage = "";

    try {
      const text = await file.text();
      parsed = JSON.parse(text) as unknown;
      if (!isRecord(parsed)) {
        throw new Error("JSON 结构不正确，请使用 LifeLog 导出的备份文件。");
      }
      if (isLifeLogSharePayload(parsed)) {
        await handleShareImport(parsed);
        return;
      }
      const preview = buildBackupImportPreview(parsed, state);
      const countPreview = [
        `人物 ${preview.people}${formatDelta(preview.peopleDelta)}`,
        `地点 ${preview.places}${formatDelta(preview.placesDelta)}`,
        `回忆 ${preview.memories}${formatDelta(preview.memoriesDelta)}`,
        `安排 ${preview.anniversaryPlans}${formatDelta(preview.anniversaryPlansDelta)}`,
        `照片 ${preview.photos}${formatDelta(preview.photosDelta)}`
      ].join(" · ");
      const photoPreview = [
        preview.repairedPhotos ? `${preview.repairedPhotos} 张照片将自动修复归属` : "",
        preview.extraPhotoRefs ? `${preview.extraPhotoRefs} 张照片将补回回忆引用` : "",
        preview.missingPhotoRefs ? `${preview.missingPhotoRefs} 个照片引用缺少文件` : "",
        preview.ignoredPhotos ? `${preview.ignoredPhotos} 张照片会被忽略` : ""
      ].filter(Boolean).join("；");
      previewMessage = [
        `将导入：${countPreview}。`,
        preview.exportedAt ? `备份时间：${formatBackupDate(preview.exportedAt)}。` : "",
        preview.appVersion ? `备份版本：${preview.appVersion}${preview.schemaVersion ? ` · schema ${preview.schemaVersion}` : ""}。` : "",
        photoPreview ? `照片检查：${photoPreview}。` : "照片检查：未发现明显照片关联问题。",
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
      setImportRecovery(null);
      notify({ message: "数据导入完成，当前资料已恢复", tone: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "请检查文件格式。";
      setImportRecovery({
        file,
        fileName: file.name,
        message,
        happenedAt: new Date().toISOString()
      });
      await confirm({
        title: "导入失败",
        message: `${message}\n\n可以稍后重试这个文件，或先导出当前数据后再重新选择备份。`,
        confirmText: "知道了",
        tone: "info"
      });
    } finally {
      importLockRef.current = false;
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleShareImport(parsed: Record<string, unknown>) {
    let previewMessage = "";
    let payload;
    try {
      payload = normalizeLifeLogSharePayload(parsed);
      const preview = buildShareImportPreview(payload, state);
      const incoming = [
        preview.incoming.people ? `${preview.incoming.people} 个人物` : "",
        preview.incoming.places ? `${preview.incoming.places} 个地点` : "",
        preview.incoming.memories ? `${preview.incoming.memories} 条回忆` : "",
        preview.incoming.photos ? `${preview.incoming.photos} 张照片` : ""
      ].filter(Boolean).join(" · ") || "没有可导入内容";
      const effect = [
        preview.willCreate.people ? `新增人物 ${preview.willCreate.people}` : "",
        preview.willCreate.places ? `新增地点 ${preview.willCreate.places}` : "",
        preview.willReuse.places ? `复用已有地点 ${preview.willReuse.places}` : "",
        preview.willCreate.memories ? `新增回忆 ${preview.willCreate.memories}` : "",
        preview.skippedMemories ? `跳过重复回忆 ${preview.skippedMemories}` : "",
        preview.willCreate.photos ? `新增照片 ${preview.willCreate.photos}` : ""
      ].filter(Boolean).join(" · ") || "没有新内容需要添加";
      previewMessage = [
        `分享包：${preview.title}`,
        `内容：${incoming}。`,
        `导入后：${effect}。`,
        preview.exportedAt ? `分享时间：${formatBackupDate(preview.exportedAt)}。` : "",
        "分享包只会添加或复用资料，不会覆盖当前本地数据。"
      ].filter(Boolean).join("\n");
    } catch (error) {
      await confirm({
        title: "分享包无法导入",
        message: error instanceof Error ? error.message : "分享包结构不正确。",
        confirmText: "知道了",
        tone: "info"
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const accepted = await confirm({
      title: "导入分享包",
      message: previewMessage,
      confirmText: "添加到 LifeLog"
    });
    if (!accepted) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    importLockRef.current = true;
    setIsImporting(true);
    try {
      const result = await importShareData(payload);
      notify({
        message: [
          result.placesCreated ? `新增地点 ${result.placesCreated}` : "",
          result.placesReused ? `复用地点 ${result.placesReused}` : "",
          result.memoriesCreated ? `新增回忆 ${result.memoriesCreated}` : "",
          result.memoriesSkipped ? `跳过重复 ${result.memoriesSkipped}` : ""
        ].filter(Boolean).join(" · ") || "分享包已处理",
        tone: "success",
        durationMs: 4200
      });
    } catch (error) {
      await confirm({
        title: "分享包导入失败",
        message: error instanceof Error ? error.message : "请检查分享包后重试。",
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

  async function handleExport() {
    try {
      const result = await exportData();
      setLastExport(result);
      notify({ message: `完整备份已生成：${result.fileName}`, tone: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      console.error("Backup export failed:", error);
      notify({
        message: /cancel/i.test(message) ? "已取消导出备份" : `导出备份失败：${message || "请稍后重试"}`,
        tone: /cancel/i.test(message) ? "info" : "error"
      });
    }
  }

  async function handleReadableExport(format: "markdown" | "html") {
    try {
      const date = new Date().toISOString().slice(0, 10);
      const result = format === "markdown"
        ? await saveReadableFile(`lifelog-readable-${date}.md`, buildReadableMarkdown(state), "text/markdown;charset=utf-8")
        : await saveReadableFile(`lifelog-readable-${date}.html`, buildReadableHtml(state), "text/html;charset=utf-8");
      setLastExport(result);
      notify({ message: `可读导出已生成：${result.fileName}`, tone: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "请稍后重试";
      notify({ message: `可读导出失败：${message}`, tone: "error" });
    }
  }

  async function retryLastImport() {
    if (!importRecovery?.file) return;
    await handleImport(importRecovery.file);
  }

  async function handleMergeStrongDuplicates() {
    const count = duplicatePlaceGroups.filter((group) => group.strength === "strong").length;
    if (!count) return;
    const accepted = await confirm({
      title: "合并强重复地点",
      message: `将自动合并 ${count} 组强重复地点，并同步修正相关回忆关联。合并后可在地点页撤销最近一次合并。`,
      confirmText: "确认合并"
    });
    if (!accepted) return;
    const merged = await mergeAllDuplicatePlaces();
    notify({
      message: merged ? `已合并 ${merged} 条重复地点` : "没有可自动合并的重复地点",
      tone: merged ? "success" : "info"
    });
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
          <strong>本地数据备份与分享导入</strong>
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
              ? healthReport.attentionCount
                ? `备份可用，另有 ${healthReport.attentionCount} 项资料可继续补全。`
                : "当前数据关联完整，可以直接导出完整备份。"
              : `${healthReport.issueCount} 个问题：${healthReport.issues.slice(0, 2).join("；")}`}
          </p>
        </GlassCard>
        <div className="backup-health-grid">
          {healthReport.groups.map((group) => (
            <button
              className={`backup-health-group glass-card ${group.status} ${openHealthGroupId === group.id ? "open" : ""}`}
              type="button"
              key={group.id}
              onClick={() => setOpenHealthGroupId((current) => (current === group.id ? null : group.id))}
            >
              <div className="backup-health-group-head">
                <strong>{group.title}</strong>
                <span>
                  {group.status === "ok" ? "正常" : `${group.count} 项`}
                  <ChevronDown size={13} />
                </span>
              </div>
              <ul>
                {group.items.slice(0, 3).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </button>
          ))}
        </div>
        {openHealthGroupId && (
          <GlassCard className="backup-health-detail-card">
            {healthDetails
              .filter((group) => group.id === openHealthGroupId)
              .map((group) => (
                <div className="backup-health-detail-content" key={group.id}>
                  <div className="backup-health-detail-head">
                    <strong>{group.title}</strong>
                    <span>{group.items.length ? `${group.items.length} 项可处理` : "暂无问题"}</span>
                  </div>
                  {group.items.length ? (
                    <div className="backup-health-detail-list">
                      {group.items.slice(0, 8).map((item) => (
                        <div className={`backup-health-detail-item ${item.tone || ""}`} key={item.id}>
                          <div>
                            <strong>{item.title}</strong>
                            <span>{item.desc}</span>
                          </div>
                          {item.path && (
                            <button
                              type="button"
                              className="mini-action"
                              onClick={() => {
                                if (item.path) navigate(item.path);
                              }}
                            >
                              <ExternalLink size={13} />
                              去处理
                            </button>
                          )}
                        </div>
                      ))}
                      {group.items.length > 8 && <p>还有 {group.items.length - 8} 项，建议按列表逐步处理。</p>}
                    </div>
                  ) : (
                    <p>{group.emptyText}</p>
                  )}
                </div>
              ))}
          </GlassCard>
        )}
        {healthReport.strongDuplicatePlaceGroups > 0 && (
          <button className="data-cleanup-card glass-card" type="button" onClick={() => void handleMergeStrongDuplicates()}>
            <div className="data-action-icon">
              <Sparkles />
            </div>
            <div>
              <strong>合并 {healthReport.strongDuplicatePlaceGroups} 组强重复地点</strong>
              <span>自动保留信息更完整的记录，并同步回忆里的地点关联</span>
            </div>
          </button>
        )}
        <div className="data-action-grid">
          <button
            className="data-action-card glass-card"
            onClick={() => void handleExport()}
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
            onClick={() => void handleReadableExport("markdown")}
            disabled={!hasUserData}
          >
            <div className="data-action-icon">
              <Download />
            </div>
            <div>
              <strong>导出 Markdown</strong>
              <span>生成可直接阅读和归档的文字版本</span>
            </div>
          </button>
          <button
            className="data-action-card glass-card"
            onClick={() => void handleReadableExport("html")}
            disabled={!hasUserData}
          >
            <div className="data-action-icon">
              <ExternalLink />
            </div>
            <div>
              <strong>导出 HTML</strong>
              <span>适合浏览器打开、打印或长期保存</span>
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
              <strong>{isImporting ? "导入中…" : "导入备份 / 分享包"}</strong>
              <span>备份会覆盖恢复，分享包只会添加内容</span>
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
        {lastExport && (
          <GlassCard className="backup-export-result">
            <strong>{lastExport.fileName}</strong>
            <span>{lastExport.locationLabel}</span>
            <p>{lastExport.locationDetail}</p>
            {lastExport.path && <code>{lastExport.path}</code>}
          </GlassCard>
        )}
        {importRecovery && (
          <GlassCard className="backup-import-recovery">
            <div>
              <strong>上次导入失败</strong>
              <span>{importRecovery.fileName} · {formatBackupDate(importRecovery.happenedAt)}</span>
              <p>{importRecovery.message}</p>
            </div>
            <div className="backup-import-recovery-actions">
              <button type="button" onClick={() => void retryLastImport()} disabled={isImporting}>
                重试这个文件
              </button>
              <button type="button" onClick={() => fileInputRef.current?.click()}>
                重新选择
              </button>
              <button type="button" onClick={() => void handleExport()} disabled={!hasUserData}>
                先导出当前数据
              </button>
            </div>
          </GlassCard>
        )}
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

interface ImportRecoveryState {
  file: File;
  fileName: string;
  message: string;
  happenedAt: string;
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

function formatDelta(value: number | null) {
  if (value === null || value === 0) return "";
  return value > 0 ? `（+${value}）` : `（${value}）`;
}
