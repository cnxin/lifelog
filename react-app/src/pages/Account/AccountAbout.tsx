import { Bell, Copy, Download, ExternalLink, Info, PackageCheck, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import GlassCard from "../../components/GlassCard";
import { useToast } from "../../context/ToastContext";
import { getReleaseNote, RELEASE_NOTES } from "../../constants/releaseNotes";
import { APP_VERSION } from "../../constants/version";
import { copyTextToClipboard } from "../../utils/diagnostics";
import { addApkDownloadProgressListener, canInstallApkPackages, openApkDownload, openApkInstallPermissionSettings, openExternalUrl, type ApkDownloadProgress } from "../../utils/externalLinks";
import { checkNotificationPermission, requestNotificationPermission } from "../../utils/notificationPermissions";
import {
  checkLatestAppUpdate,
  formatFileSize,
  getExternalApkDownloadSource,
  getExternalApkDownloadUrl,
  getPreferredApkDownloadSource,
  getPreferredApkDownloadUrl,
  type AppUpdateInfo,
  type UpdateSourceDiagnostic
} from "../../utils/updateChecker";

export default function AccountAbout() {
  const notify = useToast();
  const [isChecking, setIsChecking] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [upgradeProgress, setUpgradeProgress] = useState<ApkDownloadProgress | null>(null);
  const [upgradeTelemetry, setUpgradeTelemetry] = useState<UpgradeTelemetry | null>(null);
  const [latestUpdate, setLatestUpdate] = useState<AppUpdateInfo | null>(null);
  const [updateDiagnostics, setUpdateDiagnostics] = useState<UpdateSourceDiagnostic[]>([]);
  const [installPermissionGranted, setInstallPermissionGranted] = useState<boolean | null>(null);
  const [notificationPermissionGranted, setNotificationPermissionGranted] = useState<boolean | null>(null);
  const [isRefreshingPermissions, setIsRefreshingPermissions] = useState(false);
  const pendingUpgradeRef = useRef<AppUpdateInfo | null>(null);
  const downloadTelemetryRef = useRef({ startedAt: 0, lastBytes: 0, lastAt: 0 });
  const downloadSourceRef = useRef("");
  const currentRelease = getReleaseNote(APP_VERSION);
  const previousReleases = RELEASE_NOTES.filter((note) => note.version !== currentRelease.version).slice(0, 3);

  useEffect(() => {
    let removeListener: (() => void) | null = null;
    void addApkDownloadProgressListener((progress) => {
      setUpgradeProgress(progress);
      if (progress.stage === "downloading") {
        updateUpgradeTelemetry(downloadTelemetryRef.current, setUpgradeTelemetry, downloadSourceRef.current, progress);
      } else if (progress.stage === "verifying" || progress.stage === "opening") {
        updateUpgradeTelemetry(downloadTelemetryRef.current, setUpgradeTelemetry, downloadSourceRef.current, progress, true);
      } else if (progress.stage === "fallback") {
        setUpgradeTelemetry((current) => (current ? { ...current, sourceLabel: downloadSourceRef.current || current.sourceLabel } : current));
      }
      if (progress.stage === "opening" || progress.stage === "fallback" || progress.stage === "failed") {
        setIsUpgrading(false);
      }
    }).then((handle) => {
      removeListener = () => void handle.remove();
    });

    return () => removeListener?.();
  }, []);

  useEffect(() => {
    void refreshPermissionStatus();
  }, []);

  async function refreshPermissionStatus() {
    setIsRefreshingPermissions(true);
    try {
      const [canInstall, canNotify] = await Promise.all([
        canInstallApkPackages(),
        checkNotificationPermission()
      ]);
      setInstallPermissionGranted(canInstall);
      setNotificationPermissionGranted(canNotify);
    } finally {
      setIsRefreshingPermissions(false);
    }
  }

  useEffect(() => {
    function handleWindowFocus() {
      void refreshPermissionStatus();
      if (!pendingUpgradeRef.current) return;
      const pendingUpdate = pendingUpgradeRef.current;
      pendingUpgradeRef.current = null;
      void handleBuiltInUpgrade(pendingUpdate, true);
    }

    window.addEventListener("focus", handleWindowFocus);
    return () => window.removeEventListener("focus", handleWindowFocus);
  }, []);

  async function handleCheckUpdate() {
    if (isChecking) return;
    setIsChecking(true);
    try {
      const update = await checkLatestAppUpdate();
      setLatestUpdate(update);
      setUpdateDiagnostics(update.diagnostics || []);
      notify({
        message: update.hasUpdate ? `发现新版本 ${update.latestVersion}` : "当前已经是最新版本",
        tone: update.hasUpdate ? "success" : "info"
      });
    } catch (error) {
      setLatestUpdate(null);
      setUpdateDiagnostics(parseDiagnosticsFromError(error));
      notify({
        message: error instanceof Error ? `检查更新失败：${error.message}` : "检查更新失败，请稍后重试",
        tone: "error"
      });
    } finally {
      setIsChecking(false);
    }
  }

  async function handleCopyDownloadUrl(url: string) {
    const copied = await copyTextToClipboard(url);
    notify({
      message: copied ? "下载链接已复制，可到 Chrome 粘贴打开" : "复制失败，请手动长按链接复制",
      tone: copied ? "success" : "error"
    });
  }

  async function handleBuiltInUpgrade(update: AppUpdateInfo, resumedFromPermission = false) {
    if (isUpgrading) return;
    const canInstall = await canInstallApkPackages();
    setInstallPermissionGranted(canInstall);
    if (!canInstall) {
      pendingUpgradeRef.current = update;
      notify({
        message: "请先允许 LifeLog 安装未知来源应用，返回后会继续升级",
        tone: "info"
      });
      await openApkInstallPermissionSettings();
      return;
    }

    setIsUpgrading(true);
    downloadTelemetryRef.current = { startedAt: 0, lastBytes: 0, lastAt: 0 };
    downloadSourceRef.current =
      getPreferredApkDownloadSource(update) ||
      getExternalApkDownloadSource(update) ||
      update.apkUrl ||
      update.mirrorApkUrl ||
      update.releaseUrl ||
      "下载源";
    setUpgradeTelemetry(null);
    setUpgradeProgress({
      stage: "downloading",
      bytesRead: 0,
      totalBytes: update.apkSize || 0,
      percent: 0,
      fileName: update.apkName
    });
    notify({
      message: resumedFromPermission ? "已获得安装权限，继续下载 APK" : "开始下载 APK，完成后会自动打开系统安装器",
      tone: "info"
    });
    try {
      await openApkDownload(update);
    } catch (error) {
      setIsUpgrading(false);
      notify({
        message: error instanceof Error ? `内置升级失败：${error.message}` : "内置升级失败，请尝试外部下载",
        tone: "error"
      });
    }
  }

  async function handleOpenInstallPermission() {
    await openApkInstallPermissionSettings();
    void refreshPermissionStatus();
  }

  async function handleRequestNotificationPermission() {
    const granted = await requestNotificationPermission();
    setNotificationPermissionGranted(granted);
    notify({
      message: granted ? "通知权限已开启" : "通知权限未开启，可在系统设置中允许通知",
      tone: granted ? "success" : "info"
    });
  }

  const downloadUrl = getPreferredApkDownloadUrl(latestUpdate);
  const downloadSource = getPreferredApkDownloadSource(latestUpdate);
  const externalDownloadUrl = getExternalApkDownloadUrl(latestUpdate);
  const externalDownloadSource = getExternalApkDownloadSource(latestUpdate);
  const upgradePercent = upgradeProgress ? getUpgradePercent(upgradeProgress) : 0;
  return (
    <section className="section">
      <div className="section-header">
        <h2>
          <Info /> 关于
        </h2>
      </div>
      <div className="list">
        <GlassCard className="detail-row">
          <strong>版本</strong>
          <span>{APP_VERSION}</span>
        </GlassCard>
        <GlassCard className={`update-check-card ${latestUpdate?.hasUpdate ? "has-update" : ""}`}>
          <div className="update-check-head">
            <div>
              <span>版本更新</span>
              <strong>
                {latestUpdate
                  ? latestUpdate.hasUpdate
                    ? `发现 ${latestUpdate.latestVersion}`
                    : "当前已是最新"
                  : "检查最新版本"}
              </strong>
              <small>
                {latestUpdate
                  ? `当前版本 ${latestUpdate.currentVersion} · 最新版本 ${latestUpdate.latestVersion}`
                  : "同时读取 Gitee 镜像清单、GitHub raw 清单、CDN 清单和 GitHub Release。"}
              </small>
            </div>
            <button className="mini-action add" type="button" onClick={() => void handleCheckUpdate()} disabled={isChecking}>
              <RefreshCw size={14} />
              {isChecking ? "检查中" : "检查"}
            </button>
          </div>
          {latestUpdate && (
            <div className="update-check-meta">
              <span>
                <strong>{latestUpdate.apkName || "APK 文件"}</strong>
                {formatFileSize(latestUpdate.apkSize)}
              </span>
              <span>
                <strong>发布时间</strong>
                {formatReleaseDate(latestUpdate.publishedAt)}
              </span>
              <span>
                <strong>检查时间</strong>
                {formatReleaseDate(latestUpdate.checkedAt)}
              </span>
              <span>
                <strong>检查来源</strong>
                {latestUpdate.source || "未知"}
              </span>
              <span>
                <strong>下载源</strong>
                {downloadSource || "未知"}
              </span>
              <span>
                <strong>外部下载</strong>
                {externalDownloadSource || "未知"}
              </span>
            </div>
          )}
          {latestUpdate?.body && (
            <div className="update-release-body">
              {latestUpdate.body
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean)
                .slice(0, 4)
                .map((line) => (
                  <span key={line}>{line.replace(/^[-*]\s*/, "")}</span>
                ))}
            </div>
          )}
          {updateDiagnostics.length > 0 && (
            <div className="update-source-diagnostics">
              {updateDiagnostics.map((item) => (
                <span className={item.status} key={item.source}>
                  <strong>{item.source}</strong>
                  {formatDiagnosticText(item)}
                </span>
              ))}
            </div>
          )}
          {upgradeProgress && (
            <div className={`update-upgrade-progress ${upgradeProgress.stage}`}>
              <div>
                <strong>{formatUpgradeStage(upgradeProgress.stage)}</strong>
                <span>{formatUpgradeProgress(upgradeProgress)}</span>
              </div>
              <div className="update-progress-track">
                <i style={{ width: `${upgradePercent}%` }} />
              </div>
              {upgradeTelemetry && upgradeProgress.stage === "downloading" && (
                <div className="update-progress-meta">
                  <span>来源：{upgradeTelemetry.sourceLabel || "下载源"}</span>
                  <span>速度：{formatTransferSpeed(upgradeTelemetry.speedBytesPerSecond)}</span>
                  <span>{upgradeTelemetry.etaSeconds !== null ? `预计剩余 ${formatEta(upgradeTelemetry.etaSeconds)}` : "剩余时间计算中"}</span>
                </div>
              )}
            </div>
          )}
          {latestUpdate?.hasUpdate && (
            <div className="update-check-actions">
              <button className="link-action detail-link-button" type="button" onClick={() => void handleBuiltInUpgrade(latestUpdate)} disabled={isUpgrading}>
                <Download /> {isUpgrading ? "升级中" : "内置升级"}
              </button>
              <button className="mini-action" type="button" onClick={() => void openExternalUrl(externalDownloadUrl)}>
                <ExternalLink size={14} />
                外部下载
              </button>
              <button className="mini-action" type="button" onClick={() => void handleCopyDownloadUrl(downloadUrl)}>
                <Copy size={14} />
                复制镜像
              </button>
              <button className="mini-action" type="button" onClick={() => void openExternalUrl(latestUpdate.releaseUrl)}>
                查看 Release
              </button>
              <p className="update-download-hint">内置升级会优先从 Gitee 下载 APK 并打开系统安装器；外部下载优先使用 GitHub Release，保留浏览器下载入口。</p>
            </div>
          )}
        </GlassCard>
        <GlassCard className="release-note-card">
          <div className="release-note-head">
            <div>
              <span>当前更新 · {currentRelease.date}</span>
              <strong>{currentRelease.title}</strong>
            </div>
            <em>{currentRelease.version}</em>
          </div>
          <ul className="release-note-list">
            {currentRelease.highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </GlassCard>
        <GlassCard className="release-history-card">
          <div className="settings-capability-overview-head">
            <strong>最近版本</strong>
            <span>更新记录</span>
          </div>
          <div className="release-history-list">
            {previousReleases.map((note) => (
              <div className="release-history-item" key={note.version}>
                <strong>{note.version}</strong>
                <span>{note.title}</span>
              </div>
            ))}
          </div>
        </GlassCard>
        <GlassCard className="detail-row">
          <strong>存储</strong>
          <span>本机离线存储，支持备份导出</span>
        </GlassCard>
        <GlassCard className="native-permission-card">
          <div className="settings-capability-overview-head">
            <strong>安装与提醒权限</strong>
            <span>真机升级前检查</span>
          </div>
          <div className="native-permission-list">
            <div className="native-permission-item">
              <PackageCheck />
              <div>
                <div className="native-permission-title-row">
                  <strong>APK 安装权限</strong>
                  <PermissionBadge value={installPermissionGranted} />
                </div>
                <PermissionTags
                  value={installPermissionGranted}
                  granted={["可安装更新", "内置升级可用"]}
                  denied={["需安装授权", "升级前设置"]}
                />
              </div>
              {installPermissionGranted ? (
                <button className="mini-action" type="button" onClick={() => void refreshPermissionStatus()}>
                  复查
                </button>
              ) : (
                <button className="mini-action" type="button" onClick={() => void handleOpenInstallPermission()}>
                  设置
                </button>
              )}
            </div>
            <div className="native-permission-item">
              <Bell />
              <div>
                <div className="native-permission-title-row">
                  <strong>通知权限</strong>
                  <PermissionBadge value={notificationPermissionGranted} />
                </div>
                <PermissionTags
                  value={notificationPermissionGranted}
                  granted={["提醒可弹出", "通知已开启"]}
                  denied={["通知未开启", "提醒可能失效"]}
                />
              </div>
              {notificationPermissionGranted ? (
                <button className="mini-action" type="button" onClick={() => void refreshPermissionStatus()}>
                  复查
                </button>
              ) : (
                <button className="mini-action" type="button" onClick={() => void handleRequestNotificationPermission()}>
                  授权
                </button>
              )}
            </div>
          </div>
          <button className="mini-action add native-permission-refresh" type="button" onClick={() => void refreshPermissionStatus()} disabled={isRefreshingPermissions}>
            <RefreshCw size={14} />
            {isRefreshingPermissions ? "刷新中..." : "刷新权限状态"}
          </button>
        </GlassCard>
        <button className="glass-card detail-row github-project-row" type="button" onClick={() => void openExternalUrl("https://github.com/cnxin/lifelog")}>
          <strong>GitHub</strong>
          <span>github.com/cnxin/lifelog</span>
        </button>
        <GlassCard className="settings-capability-overview">
          <div className="settings-capability-overview-head">
            <strong>应用能力</strong>
            <span>本地免费 + 云端高级</span>
          </div>
          <div className="settings-capability-overview-list">
            {[
              { label: "本地免费", value: "人物、地点、回忆、提醒、备份、分享全部可用" },
              { label: "云端高级", value: "云同步、云备份、多设备同步、云端分享恢复" },
              { label: "资料管理", value: "人物、地点、商场、关系档案" },
              { label: "使用方式", value: "本地优先、离线可用、APK 更新" }
            ].map((item) => (
              <div className="settings-capability-overview-item" key={item.label}>
                <em>{item.label}</em>
                <span>{item.value}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </section>
  );
}

function formatReleaseDate(value: string) {
  if (!value) return "未知";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatUpgradeStage(stage: ApkDownloadProgress["stage"]) {
  switch (stage) {
    case "downloading":
      return "正在下载";
    case "verifying":
      return "正在校验";
    case "opening":
      return "打开安装器";
    case "fallback":
      return "已切换备用下载";
    case "failed":
      return "升级失败";
    default:
      return "准备升级";
  }
}

function formatUpgradeProgress(progress: ApkDownloadProgress) {
  if (progress.stage === "verifying") return "正在校验 APK 完整性";
  if (progress.stage === "opening") return "请在系统安装器中确认安装";
  if (progress.stage === "fallback") return "已打开备用下载入口";
  if (progress.stage === "failed") return progress.message || "请尝试外部下载";
  const total = progress.totalBytes > 0 ? formatFileSize(progress.totalBytes) : "未知大小";
  return `${getUpgradePercent(progress)}% · ${formatFileSize(progress.bytesRead)} / ${total}`;
}

function getUpgradePercent(progress: ApkDownloadProgress) {
  if (progress.stage === "verifying" || progress.stage === "opening") return 100;
  if (Number.isFinite(progress.percent) && progress.percent > 0) return Math.max(0, Math.min(100, progress.percent));
  if (progress.totalBytes > 0 && progress.bytesRead > 0) {
    return Math.max(0, Math.min(100, Math.round((progress.bytesRead * 100) / progress.totalBytes)));
  }
  return 0;
}

interface UpgradeTelemetry {
  startedAt: string;
  speedBytesPerSecond: number;
  etaSeconds: number | null;
  sourceLabel: string;
}

interface DownloadTelemetryTracker {
  startedAt: number;
  lastBytes: number;
  lastAt: number;
}

function updateUpgradeTelemetry(
  tracker: DownloadTelemetryTracker,
  setUpgradeTelemetry: Dispatch<SetStateAction<UpgradeTelemetry | null>>,
  sourceLabel: string,
  progress: ApkDownloadProgress,
  keepExisting = false
) {
  const now = Date.now();
  if (!tracker.startedAt) {
    tracker.startedAt = now;
    tracker.lastBytes = progress.bytesRead;
    tracker.lastAt = now;
  }

  const lastAt = tracker.lastAt || tracker.startedAt || now;
  const elapsedMs = Math.max(1, now - lastAt);
  const deltaBytes = Math.max(0, progress.bytesRead - tracker.lastBytes);
  const fallbackElapsed = Math.max(1, now - tracker.startedAt);
  const speedBytesPerSecond = deltaBytes > 0
    ? deltaBytes / (elapsedMs / 1000)
    : progress.bytesRead > 0
      ? progress.bytesRead / (fallbackElapsed / 1000)
      : 0;
  const remainingBytes = progress.totalBytes > 0 ? Math.max(0, progress.totalBytes - progress.bytesRead) : 0;
  const etaSeconds = speedBytesPerSecond > 0 && remainingBytes > 0 ? Math.ceil(remainingBytes / speedBytesPerSecond) : null;

  tracker.lastBytes = Math.max(tracker.lastBytes, progress.bytesRead);
  tracker.lastAt = now;

  setUpgradeTelemetry((current) => ({
    startedAt: new Date(tracker.startedAt).toISOString(),
    speedBytesPerSecond,
    etaSeconds,
    sourceLabel: keepExisting && current?.sourceLabel ? current.sourceLabel : sourceLabel || current?.sourceLabel || ""
  }));
}

function formatTransferSpeed(bytesPerSecond: number) {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return "计算中";
  if (bytesPerSecond < 1024) return `${Math.max(1, Math.round(bytesPerSecond))} B/s`;
  const kb = bytesPerSecond / 1024;
  if (kb < 1024) return `${kb.toFixed(kb >= 100 ? 0 : 1)} KB/s`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB/s`;
}

function formatEta(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "即将完成";
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  return `${minutes} 分 ${remain} 秒`;
}

function PermissionBadge({ value }: { value: boolean | null }) {
  const className = value === null ? "checking" : value ? "granted" : "denied";
  const label = value === null ? "检查中" : value ? "已授权" : "未授权";
  return <em className={`native-permission-badge ${className}`}>{label}</em>;
}

function PermissionTags({ value, granted, denied }: { value: boolean | null; granted: string[]; denied: string[] }) {
  const className = value === null ? "checking" : value ? "granted" : "denied";
  const tags = value === null ? ["正在检查"] : value ? granted : denied;
  return (
    <div className={`native-permission-tags ${className}`}>
      {tags.map((tag) => (
        <span key={tag}>{tag}</span>
      ))}
    </div>
  );
}

function formatDiagnosticText(item: UpdateSourceDiagnostic) {
  const version = item.version ? `${item.version} · ` : "";
  if (item.status === "ok") return `${version}${item.message}`;
  if (item.status === "empty") return "无可用数据";
  if (item.status === "invalid") return `解析失败：${item.message}`;
  return `失败：${item.message}`;
}

function parseDiagnosticsFromError(error: unknown): UpdateSourceDiagnostic[] {
  const message = error instanceof Error ? error.message : "";
  const [, detail = ""] = message.split("：");
  if (!detail) return [];
  return detail.split("；").map((chunk) => {
    const source = chunk.replace(/\s+(正常|无数据|解析失败|失败).*$/, "").trim();
    const status = chunk.includes("正常")
      ? "ok"
      : chunk.includes("无数据")
        ? "empty"
        : chunk.includes("解析失败")
          ? "invalid"
          : "failed";
    const detailMatch = chunk.match(/（(.+)）/);
    return {
      source: source || "更新来源",
      status,
      message: detailMatch?.[1] || ""
    };
  });
}
