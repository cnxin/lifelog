import { Bell, Copy, Download, ExternalLink, Info, PackageCheck, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  const [latestUpdate, setLatestUpdate] = useState<AppUpdateInfo | null>(null);
  const [updateDiagnostics, setUpdateDiagnostics] = useState<UpdateSourceDiagnostic[]>([]);
  const [installPermissionGranted, setInstallPermissionGranted] = useState<boolean | null>(null);
  const [notificationPermissionGranted, setNotificationPermissionGranted] = useState<boolean | null>(null);
  const pendingUpgradeRef = useRef<AppUpdateInfo | null>(null);
  const currentRelease = getReleaseNote(APP_VERSION);
  const previousReleases = RELEASE_NOTES.filter((note) => note.version !== currentRelease.version).slice(0, 3);

  useEffect(() => {
    let removeListener: (() => void) | null = null;
    void addApkDownloadProgressListener((progress) => {
      setUpgradeProgress(progress);
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
    const [canInstall, canNotify] = await Promise.all([
      canInstallApkPackages(),
      checkNotificationPermission()
    ]);
    setInstallPermissionGranted(canInstall);
    setNotificationPermissionGranted(canNotify);
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
                <i style={{ width: `${Math.max(0, Math.min(100, upgradeProgress.percent || 0))}%` }} />
              </div>
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
                <strong>APK 安装权限</strong>
                <span>{formatPermissionStatus(installPermissionGranted, "允许安装新版本", "需要允许未知来源安装")}</span>
              </div>
              <button className="mini-action" type="button" onClick={() => void handleOpenInstallPermission()}>
                设置
              </button>
            </div>
            <div className="native-permission-item">
              <Bell />
              <div>
                <strong>通知权限</strong>
                <span>{formatPermissionStatus(notificationPermissionGranted, "纪念日和联系提醒可用", "提醒可能无法弹出")}</span>
              </div>
              <button className="mini-action" type="button" onClick={() => void handleRequestNotificationPermission()}>
                授权
              </button>
            </div>
          </div>
          <button className="mini-action add native-permission-refresh" type="button" onClick={() => void refreshPermissionStatus()}>
            <RefreshCw size={14} />
            刷新权限状态
          </button>
        </GlassCard>
        <button className="glass-card detail-row github-project-row" type="button" onClick={() => void openExternalUrl("https://github.com/cnxin/lifelog")}>
          <strong>GitHub</strong>
          <span>github.com/cnxin/lifelog</span>
        </button>
        <GlassCard className="settings-capability-overview">
          <div className="settings-capability-overview-head">
            <strong>应用能力</strong>
            <span>本地优先</span>
          </div>
          <div className="settings-capability-overview-list">
            {[
              { label: "资料管理", value: "人物、地点、商场、关系档案" },
              { label: "生活记录", value: "回忆、照片、纪念日安排" },
              { label: "提醒备份", value: "本地提醒、完整备份、恢复导入" },
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
  return `${progress.percent || 0}% · ${formatFileSize(progress.bytesRead)} / ${total}`;
}

function formatPermissionStatus(value: boolean | null, grantedText: string, deniedText: string) {
  if (value === null) return "检查中";
  return value ? grantedText : deniedText;
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
