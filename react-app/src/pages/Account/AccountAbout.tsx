import { Copy, Download, Info, RefreshCw } from "lucide-react";
import { useState } from "react";
import GlassCard from "../../components/GlassCard";
import { useToast } from "../../context/ToastContext";
import { getReleaseNote, RELEASE_NOTES } from "../../constants/releaseNotes";
import { APP_VERSION } from "../../constants/version";
import { copyTextToClipboard } from "../../utils/diagnostics";
import { openApkDownloadUrl, openExternalUrl } from "../../utils/externalLinks";
import { checkLatestAppUpdate, formatFileSize, getPreferredApkDownloadUrl, type AppUpdateInfo } from "../../utils/updateChecker";

export default function AccountAbout() {
  const notify = useToast();
  const [isChecking, setIsChecking] = useState(false);
  const [latestUpdate, setLatestUpdate] = useState<AppUpdateInfo | null>(null);
  const currentRelease = getReleaseNote(APP_VERSION);
  const previousReleases = RELEASE_NOTES.filter((note) => note.version !== currentRelease.version).slice(0, 3);

  async function handleCheckUpdate() {
    if (isChecking) return;
    setIsChecking(true);
    try {
      const update = await checkLatestAppUpdate();
      setLatestUpdate(update);
      notify({
        message: update.hasUpdate ? `发现新版本 ${update.latestVersion}` : "当前已经是最新版本",
        tone: update.hasUpdate ? "success" : "info"
      });
    } catch (error) {
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

  const downloadUrl = getPreferredApkDownloadUrl(latestUpdate);
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
                  : "同时读取 CDN 清单、GitHub raw 清单和 GitHub Release。"}
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
          {latestUpdate?.hasUpdate && (
            <div className="update-check-actions">
              <button className="link-action detail-link-button" type="button" onClick={() => void openApkDownloadUrl(downloadUrl)}>
                <Download /> 下载 APK
              </button>
              <button className="mini-action" type="button" onClick={() => void handleCopyDownloadUrl(downloadUrl)}>
                <Copy size={14} />
                复制链接
              </button>
              <button className="mini-action" type="button" onClick={() => void openExternalUrl(latestUpdate.releaseUrl)}>
                查看 Release
              </button>
              <p className="update-download-hint">优先使用 GitHub Release APK；如果很慢，请复制链接到浏览器，或进入 Release 页面手动选择 APK。</p>
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
