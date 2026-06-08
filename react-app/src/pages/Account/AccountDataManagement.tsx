import { ChevronDown, Database, Download, ExternalLink, RotateCcw, ShieldCheck, Sparkles, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import GlassCard from "../../components/GlassCard";
import { useConfirm } from "../../context/ConfirmContext";
import { useLifeLog } from "../../context/LifeLogContext";
import { useToast } from "../../context/ToastContext";
import { buildBackupHealthDetailGroups, buildBackupHealthReport, buildBackupImportPreview } from "../../utils/backupHealth";
import { saveReadableFile, type BackupExportTarget } from "../../utils/backupExport";
import { buildShareImportPreview, isLifeLogSharePayload, normalizeLifeLogSharePayload } from "../../utils/lifelogShare";
import { isRecord } from "../../utils/lifelogHelpers";
import { buildReadableHtml, buildReadableMarkdown } from "../../utils/readableExport";
import { addShareHistoryEntry, clearShareHistory, formatShareHistoryCounts, loadShareHistory, updateShareHistoryEntry, type ShareHistoryEntry } from "../../utils/shareHistory";
import { getShareImportViewTarget } from "../../utils/shareImportResult";

export default function AccountDataManagement() {
  const { state, exportData, importData, importShareData, undoShareImport, resetDemo, duplicatePlaceGroups, mergeAllDuplicatePlaces } = useLifeLog();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const notify = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const importLockRef = useRef(false);
  const [isImporting, setIsImporting] = useState(false);
  const [lastExport, setLastExport] = useState<BackupExportMeta | null>(null);
  const [lastBackupMeta, setLastBackupMeta] = useState<BackupExportMeta | null>(() => loadLastFullBackupMeta());
  const [lastImportPreview, setLastImportPreview] = useState<ImportPreviewCard | null>(null);
  const [importRecovery, setImportRecovery] = useState<ImportRecoveryState | null>(null);
  const [shareHistory, setShareHistory] = useState<ShareHistoryEntry[]>(() => loadShareHistory());
  const [openHealthGroupId, setOpenHealthGroupId] = useState<string | null>(null);
  const healthReport = useMemo(() => buildBackupHealthReport(state), [state]);
  const healthDetails = useMemo(() => buildBackupHealthDetailGroups(state), [state]);
  const [lastFullBackupAt, setLastFullBackupAt] = useState(() => localStorage.getItem("lifelog:last-full-backup-at") || "");
  const backupReminder = useMemo(() => getBackupReminder(lastBackupMeta?.exportedAt || lastFullBackupAt), [lastBackupMeta?.exportedAt, lastFullBackupAt]);
  const latestExportResult = lastExport || lastBackupMeta;
  const backupSnapshotStats = useMemo(
    () => [
      { label: "人物", value: state.people.length },
      { label: "地点", value: state.places.length },
      { label: "回忆", value: state.memories.length },
      { label: "照片", value: healthReport.photoRefs }
    ],
    [healthReport.photoRefs, state.memories.length, state.people.length, state.places.length]
  );

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
    let recoveryPreview: ImportRecoveryState["preview"];

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
      const effect = [
        `覆盖为人物 ${preview.people}`,
        `地点 ${preview.places}`,
        `回忆 ${preview.memories}`,
        `安排 ${preview.anniversaryPlans}`,
        `照片 ${preview.photos}`
      ].join(" · ");
      recoveryPreview = {
        summary: countPreview,
        backupTime: preview.exportedAt ? formatBackupDate(preview.exportedAt) : "",
        appVersion: preview.appVersion,
        issueCount: preview.issueCount,
        issues: preview.issues.slice(0, 4),
        photoNotes: photoPreview ? [photoPreview] : ["照片检查未发现明显关联问题。"]
      };
      setLastImportPreview({
        kind: "backup",
        title: file.name,
        modeLabel: "完整备份 · 覆盖恢复",
        effect,
        summary: countPreview,
        warning: "导入后会覆盖当前本地资料、照片、设置和提醒。",
        exportedAt: preview.exportedAt,
        issueCount: preview.issueCount
      });
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
      const warnings = await importData(file);
      setImportRecovery(null);
      notify({ message: warnings.length ? `数据导入完成，跳过 ${warnings.length} 项异常` : "数据导入完成，当前资料已恢复", tone: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "请检查文件格式。";
      setImportRecovery({
        file,
        fileName: file.name,
        message,
        happenedAt: new Date().toISOString(),
        preview: recoveryPreview,
        suggestions: buildImportRecoverySuggestions(message, recoveryPreview)
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
      setLastImportPreview({
        kind: "share",
        title: preview.title,
        modeLabel: "分享导入 · 只添加内容",
        effect,
        summary: incoming,
        warning: "分享包只会添加或复用资料，不会覆盖当前本地数据。",
        exportedAt: preview.exportedAt,
        issueCount: 0
      });
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
      const viewTarget = getShareImportViewTarget(result);
      const historyEntry = addShareHistoryEntry({
        direction: "import",
        method: "file",
        status: "imported",
        title: payload.title || "分享包",
        summary: [
          result.peopleCreated ? `新增人物 ${result.peopleCreated}` : "",
          result.placesCreated ? `新增地点 ${result.placesCreated}` : "",
          result.placesReused ? `复用地点 ${result.placesReused}` : "",
          result.memoriesCreated ? `新增回忆 ${result.memoriesCreated}` : "",
          result.memoriesSkipped ? `跳过重复 ${result.memoriesSkipped}` : "",
          result.photosCreated ? `新增照片 ${result.photosCreated}` : ""
        ].filter(Boolean).join(" · ") || "分享包已处理",
        targetPath: viewTarget?.path,
        counts: {
          people: result.peopleCreated,
          places: result.placesCreated,
          memories: result.memoriesCreated,
          photos: result.photosCreated
        }
      });
      setShareHistory(loadShareHistory());
      notify({
        message: [
          result.peopleCreated ? `新增人物 ${result.peopleCreated}` : "",
          result.placesCreated ? `新增地点 ${result.placesCreated}` : "",
          result.placesReused ? `复用地点 ${result.placesReused}` : "",
          result.memoriesCreated ? `新增回忆 ${result.memoriesCreated}` : "",
          result.memoriesSkipped ? `跳过重复 ${result.memoriesSkipped}` : "",
          result.photosCreated ? `新增照片 ${result.photosCreated}` : ""
        ].filter(Boolean).join(" · ") || "分享包已处理",
        tone: "success",
        durationMs: 6200,
        actions: [
          ...(viewTarget
            ? [{
                label: viewTarget.label,
                onClick: () => navigate(viewTarget.path)
              }]
            : []),
          {
            label: "撤销",
            onClick: async () => {
              await undoShareImport(result);
              updateShareHistoryEntry(historyEntry.id, {
                status: "undone",
                summary: `${formatShareHistoryCounts(historyEntry.counts) || "分享内容"} · 已撤销`
              });
              setShareHistory(loadShareHistory());
              notify({ message: "已撤销本次分享导入", tone: "success" });
            }
          }
        ]
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
      const nextBackupAt = new Date().toISOString();
      const nextMeta = buildBackupExportMeta(result, nextBackupAt, {
        people: state.people.length,
        places: state.places.length,
        memories: state.memories.length,
        photoRefs: healthReport.photoRefs
      });
      setLastExport(nextMeta);
      setLastBackupMeta(nextMeta);
      localStorage.setItem("lifelog:last-full-backup-at", nextBackupAt);
      saveLastFullBackupMeta(nextMeta);
      setLastFullBackupAt(nextBackupAt);
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
      setLastExport(buildBackupExportMeta(result, new Date().toISOString()));
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

  async function recoverLastImportSafely() {
    if (!importRecovery?.file || importLockRef.current) return;
    const accepted = await confirm({
      title: "安全导入备份",
      message: "安全导入会跳过异常照片和完整性差异，尽量恢复可用的人物、地点、回忆、安排和设置。导入会覆盖当前本地数据，建议先导出当前数据。",
      confirmText: "安全导入"
    });
    if (!accepted) return;

    importLockRef.current = true;
    setIsImporting(true);
    try {
      const warnings = await importData(importRecovery.file, { safeMode: true });
      setImportRecovery(null);
      notify({
        message: warnings.length ? `安全导入完成，跳过 ${warnings.length} 项异常` : "安全导入完成，当前资料已恢复",
        tone: "success",
        durationMs: 7000
      });
    } catch (error) {
      await confirm({
        title: "安全导入失败",
        message: error instanceof Error ? error.message : "这个备份无法安全恢复，请保留文件等待进一步修复。",
        confirmText: "知道了",
        tone: "info"
      });
    } finally {
      importLockRef.current = false;
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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

  function handleClearShareHistory() {
    clearShareHistory();
    setShareHistory([]);
  }

  async function handleCopyShareLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      notify({ message: "分享链接已复制", tone: "success" });
    } catch {
      notify({ message: "当前环境不能写入剪贴板，请重新生成分享链接", tone: "info" });
    }
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
        <GlassCard className={`backup-reminder-card ${backupReminder.state}`}>
          <div className="backup-reminder-main">
            <div className="backup-reminder-head">
              <ShieldCheck />
              <div>
                <strong>{backupReminder.title}</strong>
                <span>{backupReminder.subtitle}</span>
              </div>
            </div>
            <button className="mini-action backup-reminder-action" type="button" onClick={() => void handleExport()} disabled={!hasUserData}>
              <Download size={14} />
              立即备份
            </button>
          </div>
          <p>{backupReminder.detail}</p>
          <div className="backup-reminder-stats">
            {backupSnapshotStats.map((item) => (
              <span key={item.label}>
                <strong>{item.value}</strong>
                {item.label}
              </span>
            ))}
          </div>
          {lastBackupMeta && (
            <div className="backup-reminder-location">
              <span>上次文件</span>
              <strong>{lastBackupMeta.fileName}</strong>
              <small>{lastBackupMeta.locationLabel}</small>
            </div>
          )}
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
        {lastImportPreview && (
          <GlassCard className={`backup-import-preview-card ${lastImportPreview.kind}`}>
            <div className="backup-import-preview-head">
              <span>{lastImportPreview.modeLabel}</span>
              <strong>{lastImportPreview.title}</strong>
            </div>
            <div className="backup-import-preview-grid">
              <span>
                <strong>内容</strong>
                {lastImportPreview.summary}
              </span>
              <span>
                <strong>导入后</strong>
                {lastImportPreview.effect}
              </span>
            </div>
            <p>{lastImportPreview.warning}</p>
            <small>
              {lastImportPreview.exportedAt ? `来源时间：${formatBackupDate(lastImportPreview.exportedAt)}` : "来源时间：未记录"}
              {lastImportPreview.issueCount ? ` · 预检问题 ${lastImportPreview.issueCount} 个` : ""}
            </small>
          </GlassCard>
        )}
        {latestExportResult && (
          <GlassCard className="backup-export-result">
            <strong>{latestExportResult.fileName}</strong>
            <span>{latestExportResult.locationLabel}</span>
            <p>{latestExportResult.locationDetail}</p>
            {latestExportResult.exportedAt && <p>导出时间：{formatBackupDate(latestExportResult.exportedAt)}</p>}
            {latestExportResult.path && <code>{latestExportResult.path}</code>}
          </GlassCard>
        )}
        {importRecovery && (
          <GlassCard className="backup-import-recovery">
            <div>
              <strong>上次导入失败</strong>
              <span>{importRecovery.fileName} · {formatBackupDate(importRecovery.happenedAt)}</span>
              <p>{importRecovery.message}</p>
              {importRecovery.preview && (
                <div className="backup-import-recovery-preview">
                  <strong>失败前预检</strong>
                  <span>{importRecovery.preview.summary}</span>
                  {importRecovery.preview.backupTime && <span>备份时间：{importRecovery.preview.backupTime}</span>}
                  {importRecovery.preview.appVersion && <span>备份版本：{importRecovery.preview.appVersion}</span>}
                  {importRecovery.preview.issueCount > 0 && (
                    <ul>
                      {importRecovery.preview.issues.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  )}
                  {importRecovery.preview.photoNotes.map((note) => (
                    <span key={note}>{note}</span>
                  ))}
                </div>
              )}
              <div className="backup-import-recovery-preview">
                <strong>建议处理</strong>
                <ul>
                  {importRecovery.suggestions.map((suggestion) => (
                    <li key={suggestion}>{suggestion}</li>
                  ))}
                </ul>
              </div>
              <p>当前本地数据没有被覆盖，可以重试、重新选择文件，或先导出当前数据。</p>
            </div>
            <div className="backup-import-recovery-actions">
              <button type="button" onClick={() => void retryLastImport()} disabled={isImporting}>
                重试这个文件
              </button>
              <button type="button" onClick={() => void recoverLastImportSafely()} disabled={isImporting}>
                安全导入
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
        <GlassCard className="share-history-card">
          <div className="settings-capability-overview-head">
            <strong>分享记录</strong>
            {shareHistory.length ? (
              <button className="mini-action" type="button" onClick={handleClearShareHistory}>
                清空
              </button>
            ) : (
              <span>暂无记录</span>
            )}
          </div>
          {shareHistory.length ? (
            <div className="share-history-list">
              {shareHistory.slice(0, 8).map((entry) => (
                <div className={`share-history-item ${entry.status}`} key={entry.id}>
                  <div>
                    <strong>{entry.title}</strong>
                    <span>{entry.summary || formatShareHistoryCounts(entry.counts) || "分享记录"}</span>
                    <small>{formatShareHistoryDate(entry.createdAt)} · {formatShareHistoryMeta(entry)}</small>
                  </div>
                  <div className="share-history-actions">
                    {entry.shareLink && entry.status !== "undone" && (
                      <button className="mini-action" type="button" onClick={() => void handleCopyShareLink(entry.shareLink!)}>
                        复制链接
                      </button>
                    )}
                    {entry.targetPath && entry.status !== "undone" && (
                      <button className="mini-action" type="button" onClick={() => navigate(entry.targetPath || "/")}>
                        查看
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="form-hint">生成分享包、复制分享链接或导入分享后，这里会保留最近记录。</p>
          )}
        </GlassCard>
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
  preview?: {
    summary: string;
    backupTime: string;
    appVersion: string;
    issueCount: number;
    issues: string[];
    photoNotes: string[];
  };
  suggestions: string[];
}

interface BackupExportMeta extends BackupExportTarget {
  exportedAt: string;
  counts?: {
    people: number;
    places: number;
    memories: number;
    photoRefs: number;
  };
}

interface ImportPreviewCard {
  kind: "backup" | "share";
  title: string;
  modeLabel: string;
  effect: string;
  summary: string;
  warning: string;
  exportedAt: string;
  issueCount: number;
}

const LAST_FULL_BACKUP_META_KEY = "lifelog:last-full-backup-meta";

function buildBackupExportMeta(
  result: BackupExportTarget,
  exportedAt: string,
  counts?: NonNullable<BackupExportMeta["counts"]>
): BackupExportMeta {
  return {
    ...result,
    exportedAt,
    counts
  };
}

function loadLastFullBackupMeta(): BackupExportMeta | null {
  try {
    const raw = localStorage.getItem(LAST_FULL_BACKUP_META_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isBackupExportMeta(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveLastFullBackupMeta(meta: BackupExportMeta) {
  try {
    localStorage.setItem(LAST_FULL_BACKUP_META_KEY, JSON.stringify(meta));
  } catch {
    // The timestamp is stored separately; losing detail metadata should not block export.
  }
}

function isBackupExportMeta(value: unknown): value is BackupExportMeta {
  if (!isRecord(value)) return false;
  return typeof value.fileName === "string"
    && typeof value.locationLabel === "string"
    && typeof value.locationDetail === "string"
    && typeof value.exportedAt === "string";
}

function buildImportRecoverySuggestions(message: string, preview?: ImportRecoveryState["preview"]) {
  const suggestions = ["先导出当前本地数据，保留导入前现场。"];
  if (/完整性|integrity/i.test(message)) {
    suggestions.push("优先让原设备重新导出完整备份；如果是旧备份，检查人物、地点、回忆和照片数量是否被手动改动。");
  }
  if (/照片|photo/i.test(message) || preview?.photoNotes.some((note) => !note.includes("未发现"))) {
    suggestions.push("如果问题集中在照片，可以先尝试使用不含照片的备份或重新导出照片完整的备份。");
  }
  if (preview?.issueCount) {
    suggestions.push("预检已发现关联问题，导入前建议先查看上方问题摘要，必要时保留原文件等待修复。");
  }
  suggestions.push("如果连续失败，保留这个 JSON 文件，后续可以按预检摘要做可恢复导入。");
  return Array.from(new Set(suggestions));
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

function formatShareHistoryDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatShareHistoryMeta(entry: ShareHistoryEntry) {
  const direction = entry.direction === "export" ? "发出" : "导入";
  const method = entry.method === "link" ? "链接" : "文件";
  const statusMap: Record<ShareHistoryEntry["status"], string> = {
    created: "已生成",
    imported: "已导入",
    undone: "已撤销",
    failed: "失败"
  };
  return `${direction} · ${method} · ${statusMap[entry.status]}`;
}

function formatDelta(value: number | null) {
  if (value === null || value === 0) return "";
  return value > 0 ? `（+${value}）` : `（${value}）`;
}

function getBackupReminder(raw: string) {
  if (!raw) {
    return {
      state: "warning",
      title: "还没有完整备份",
      subtitle: "建议先导出一次完整备份",
      detail: "当前设备还没有记录到完整备份时间。建议先导出完整备份，便于后续导入恢复。"
    };
  }

  const time = new Date(raw).getTime();
  if (!Number.isFinite(time)) {
    return {
      state: "warning",
      title: "备份时间无法识别",
      subtitle: "建议重新导出一次完整备份",
      detail: "本地记录的完整备份时间格式异常。重新导出一次完整备份后会自动修正。"
    };
  }

  const days = Math.floor((Date.now() - time) / 86400000);
  if (days < 7) {
    return {
      state: "ok",
      title: "最近已备份",
      subtitle: `${days} 天前导出过完整备份`,
      detail: "本地完整备份时间较新，可以继续正常使用。"
    };
  }

  return {
    state: "warning",
    title: "建议重新备份",
    subtitle: `${days} 天未导出完整备份`,
    detail: "完整备份时间已经较久，建议重新导出一次，减少数据丢失风险。"
  };
}
