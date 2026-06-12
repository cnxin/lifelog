import { Copy, Download, QrCode, Share2, X } from "lucide-react";
import { useState } from "react";
import QRCode from "qrcode";
import { useLifeLog } from "../context/LifeLogContext";
import { useToast } from "../context/ToastContext";
import { copyTextToClipboard } from "../utils/diagnostics";
import { saveImageToGallery, shareImageFile } from "../utils/imageShare";
import { addShareHistoryEntry, formatShareHistoryCounts } from "../utils/shareHistory";
import { buildLifeLogShareLink, buildLifeLogShareQrCode, ShareLinkTooLargeError } from "../utils/lifelogShareLink";
import type { MemoryShareOptions, PlaceShareOptions, SharedMemoryPlaceMode, SharedPeopleMode } from "../utils/lifelogShare";

type ShareTarget =
  | {
      type: "memory";
      memoryId: string;
      title: string;
      photoCount: number;
    }
  | {
      type: "places";
      placeIds: string[];
      title: string;
      count: number;
    };

interface LocalShareSheetProps {
  target: ShareTarget | null;
  onClose: () => void;
}

const peopleModeOptions: Array<{ value: SharedPeopleMode; label: string; desc: string }> = [
  { value: "public", label: "公开姓名", desc: "接收方可看到关联人物名称" },
  { value: "anonymous", label: "匿名同行人", desc: "保留人数，不暴露姓名" },
  { value: "hidden", label: "隐藏人物", desc: "不导出人物关联" }
];

const placeModeOptions: Array<{ value: SharedMemoryPlaceMode; label: string; desc: string }> = [
  { value: "full", label: "公开地点", desc: "导出地点基础信息" },
  { value: "name", label: "仅名称", desc: "隐藏地址、链接和定位" },
  { value: "hidden", label: "隐藏地点", desc: "不导出地点关联" }
];

export default function LocalShareSheet({ target, onClose }: LocalShareSheetProps) {
  const { buildMemoryShare, buildPlacesShare, exportMemoryShare, exportPlacesShare } = useLifeLog();
  const notify = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [isCopyingLink, setIsCopyingLink] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [qrImage, setQrImage] = useState("");
  const [qrPreviewOpen, setQrPreviewOpen] = useState(false);
  const [qrSaveStatus, setQrSaveStatus] = useState("");
  const [memoryOptions, setMemoryOptions] = useState<MemoryShareOptions>({
    includeContent: true,
    peopleMode: "public",
    placeMode: "full",
    includePhotos: false
  });
  const [placeOptions, setPlaceOptions] = useState<PlaceShareOptions>({
    includeAddress: true,
    includePreciseLocation: false,
    includeLinks: true,
    includePhotos: false
  });

  if (!target) return null;

  async function handleExport() {
    if (!target) return;
    setIsExporting(true);
    try {
      const result = target.type === "memory"
        ? await exportMemoryShare(target.memoryId, memoryOptions)
        : await exportPlacesShare(target.placeIds, placeOptions);
      const counts = target.type === "memory"
        ? { memories: 1, photos: memoryOptions.includePhotos ? target.photoCount : 0 }
        : { places: target.count };
      addShareHistoryEntry({
        direction: "export",
        method: "file",
        status: "created",
        title: target.title,
        summary: formatShareHistoryCounts(counts) || result.fileName,
        counts
      });
      notify({
        message: `分享包已生成：${result.fileName}`,
        tone: "success",
        durationMs: 4200
      });
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "请稍后重试";
      notify({ message: `分享失败：${message}`, tone: "error" });
    } finally {
      setIsExporting(false);
    }
  }

  async function handleCopyLink() {
    if (!target) return;
    if (target.type === "memory" && memoryOptions.includePhotos) {
      notify({ message: "图片不适合放进链接里，请关闭图片或使用分享包。", tone: "info" });
      return;
    }
    if (target.type === "places" && placeOptions.includePhotos) {
      notify({ message: "地点图片链接可能让分享链接过长，请关闭图片或使用分享包。", tone: "info" });
      return;
    }

    setIsCopyingLink(true);
    try {
      const payload = target.type === "memory"
        ? await buildMemoryShare(target.memoryId, {
            includeContent: false,
            peopleMode: memoryOptions.peopleMode,
            placeMode: memoryOptions.placeMode === "hidden" ? "hidden" : "name",
            includePhotos: false
          })
        : await buildPlacesShare(target.placeIds, {
            includeAddress: false,
            includePreciseLocation: false,
            includeLinks: false,
            includePhotos: false
          });
      const link = await buildLifeLogShareLink(payload);
      const copied = await copyTextToClipboard(link);
      const counts = target.type === "memory" ? { memories: 1 } : { places: target.count };
      addShareHistoryEntry({
        direction: "export",
        method: "link",
        status: copied ? "created" : "failed",
        title: target.title,
        summary: copied ? (formatShareHistoryCounts(counts) || "分享链接") : "复制失败，已生成链接",
        shareLink: link,
        counts
      });
      notify({
        message: copied ? "分享链接已复制" : "复制失败，已生成链接但当前环境不能写入剪贴板",
        tone: copied ? "success" : "info",
        durationMs: 3600
      });
    } catch (error) {
      const message = error instanceof ShareLinkTooLargeError
        ? "内容太多，链接会过长，请改用分享包。"
        : error instanceof Error
          ? error.message
          : "请稍后重试";
      notify({ message: `生成链接失败：${message}`, tone: error instanceof ShareLinkTooLargeError ? "info" : "error" });
    } finally {
      setIsCopyingLink(false);
    }
  }

  async function handleGenerateQr() {
    if (!target) return;
    if (target.type === "memory" && memoryOptions.includePhotos) {
      notify({ message: "二维码不支持图片内容，请关闭图片后生成。", tone: "info" });
      return;
    }
    if (target.type === "places" && placeOptions.includePhotos) {
      notify({ message: "二维码不支持地点图片链接，请关闭图片后生成。", tone: "info" });
      return;
    }

    setIsCopyingLink(true);
    try {
      const payload = target.type === "memory"
        ? await buildMemoryShare(target.memoryId, { ...memoryOptions, includePhotos: false })
        : await buildPlacesShare(target.placeIds, { ...placeOptions, includePhotos: false });
      const qrCode = await buildLifeLogShareQrCode(payload);
      setShareLink(qrCode.link);
      setQrSaveStatus("");
      setQrImage(await QRCode.toDataURL(qrCode.qrSegments, { width: 320, margin: 2, errorCorrectionLevel: "L" }));
      setQrPreviewOpen(true);
      const counts = target.type === "memory" ? { memories: 1 } : { places: target.count };
      addShareHistoryEntry({
        direction: "export",
        method: "link",
        status: "created",
        title: target.title,
        summary: formatShareHistoryCounts(counts) || "精简二维码分享",
        shareLink: qrCode.link,
        counts
      });
    } catch (error) {
      const message = error instanceof ShareLinkTooLargeError
        ? "内容太多，二维码会过密，请改用分享包。"
        : error instanceof Error
          ? error.message
          : "请稍后重试";
      notify({ message, tone: error instanceof ShareLinkTooLargeError ? "info" : "error" });
    } finally {
      setIsCopyingLink(false);
    }
  }

  async function handleSaveQrImage() {
    if (!target || !qrImage) return;
    try {
      const result = await saveImageToGallery(buildQrFileName(target.title), qrImage);
      setQrSaveStatus(`已保存到相册：${result.fileName}`);
      notify({
        message: `二维码已保存到相册：${result.fileName}`,
        tone: "success",
        durationMs: 3600
      });
    } catch {
      const opened = window.open(qrImage, "_blank");
      notify({
        message: opened ? "当前环境无法直接保存，已打开二维码图片，可长按保存。" : "保存失败，请长按二维码图片保存。",
        tone: "info",
        durationMs: 4200
      });
    }
  }

  async function handleShareQrImage() {
    if (!target || !qrImage) return;
    try {
      await shareImageFile(buildQrFileName(target.title), qrImage, "分享 LifeLog 二维码");
      setQrSaveStatus("已打开系统分享面板");
      notify({ message: "已打开系统分享面板", tone: "success", durationMs: 2600 });
    } catch {
      notify({ message: "当前环境无法分享图片，已保留二维码可长按保存。", tone: "info", durationMs: 3600 });
    }
  }

  return (
    <div className="sheet local-share-sheet">
      <button className="sheet-backdrop" type="button" aria-label="关闭分享面板" onClick={onClose} />
      <section className="sheet-panel">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <div>
            <h2>本地分享</h2>
            <p>{target.title}</p>
          </div>
          <button className="sheet-close" aria-label="关闭" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="local-share-content">
          <div className="local-share-summary">
            <span className="local-share-icon">
              <Share2 size={18} />
            </span>
            <div>
              <strong>{target.type === "memory" ? "导出 1 条记录" : `导出 ${target.count} 个地点`}</strong>
              <span>生成 `.lifelog-share.json`，接收方可在 LifeLog 中预览后添加。</span>
            </div>
          </div>
          <div className="local-share-mode-grid" aria-label="分享方式说明">
            <ShareModeCard title="二维码" desc="当面扫码，内容最精简" />
            <ShareModeCard title="复制链接" desc="适合聊天发送，保留基础信息" />
            <ShareModeCard title="分享包" desc="适合完整迁移，可包含更多内容" />
          </div>

          {target.type === "memory" ? (
            <>
              <ShareSwitch
                checked={memoryOptions.includeContent}
                title="分享正文"
                desc="关闭后只保留标题、日期、心情和标签。"
                onChange={(includeContent) => setMemoryOptions((current) => ({ ...current, includeContent }))}
              />
              <ShareOptionGroup
                title="关联人物"
                options={peopleModeOptions}
                value={memoryOptions.peopleMode}
                onChange={(peopleMode) => setMemoryOptions((current) => ({ ...current, peopleMode }))}
              />
              <ShareOptionGroup
                title="关联地点"
                options={placeModeOptions}
                value={memoryOptions.placeMode}
                onChange={(placeMode) => setMemoryOptions((current) => ({ ...current, placeMode }))}
              />
              <ShareSwitch
                checked={memoryOptions.includePhotos}
                title={`分享图片${target.photoCount ? `（${target.photoCount} 张）` : ""}`}
                desc="图片会让分享包明显变大，默认不导出。"
                disabled={!target.photoCount}
                onChange={(includePhotos) => setMemoryOptions((current) => ({ ...current, includePhotos }))}
              />
            </>
          ) : (
            <>
              <ShareSwitch
                checked={placeOptions.includeAddress}
                title="分享地址"
                desc="保留城市、区域、商场和详细地址。"
                onChange={(includeAddress) => setPlaceOptions((current) => ({ ...current, includeAddress }))}
              />
              <ShareSwitch
                checked={placeOptions.includePreciseLocation}
                title="分享精准定位"
                desc="包含经纬度和地图入口，适合可信接收方。"
                onChange={(includePreciseLocation) => setPlaceOptions((current) => ({ ...current, includePreciseLocation }))}
              />
              <ShareSwitch
                checked={placeOptions.includeLinks}
                title="分享外部链接"
                desc="包含美团、大众点评、小红书或参考链接。"
                onChange={(includeLinks) => setPlaceOptions((current) => ({ ...current, includeLinks }))}
              />
              <ShareSwitch
                checked={placeOptions.includePhotos}
                title="分享地点图片链接"
                desc="仅导出地点里的图片链接，不处理本地回忆照片。"
                onChange={(includePhotos) => setPlaceOptions((current) => ({ ...current, includePhotos }))}
              />
            </>
          )}
          {shareLink && (
            <div className="local-share-qr">
              {qrImage && (
                <button className="local-share-qr-button" type="button" onClick={() => setQrPreviewOpen(true)}>
                  <img src={qrImage} alt="LifeLog 分享二维码" />
                  <span>
                    <QrCode size={14} />
                    点击放大
                  </span>
                </button>
              )}
              <span>二维码默认生成精简版，扫码后可导入标题、日期、人物和地点名称；完整内容请复制链接或用分享包。</span>
            </div>
          )}
        </div>

        <div className="submit-row">
          <button className="ghost-btn" type="button" onClick={onClose}>
            取消
          </button>
          <button className="ghost-btn" type="button" onClick={() => void handleCopyLink()} disabled={isCopyingLink || isExporting}>
            <Copy size={16} />
            {isCopyingLink ? "生成中…" : "复制链接"}
          </button>
          <button className="ghost-btn" type="button" onClick={() => void handleGenerateQr()} disabled={isCopyingLink || isExporting}>
            <Share2 size={16} />
            二维码
          </button>
          <button className="primary-btn" type="button" onClick={() => void handleExport()} disabled={isExporting}>
            <Download size={16} />
            {isExporting ? "生成中…" : "生成分享包"}
          </button>
        </div>
      </section>
      {qrPreviewOpen && qrImage && (
        <section className="qr-preview-modal" role="dialog" aria-modal="true" aria-label="分享二维码">
          <button className="qr-preview-backdrop" type="button" aria-label="关闭二维码预览" onClick={() => setQrPreviewOpen(false)} />
          <div className="qr-preview-panel">
            <div className="qr-preview-head">
              <div>
                <strong>分享二维码</strong>
                <span>{target.title}</span>
              </div>
              <button type="button" aria-label="关闭" onClick={() => setQrPreviewOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <img className="qr-preview-image" src={qrImage} alt="LifeLog 分享二维码" />
            <p>二维码使用精简版，便于扫码和保存。完整正文、地址、链接和照片请用复制链接或分享包。</p>
            {qrSaveStatus && (
              <div className="qr-preview-status" role="status">
                {qrSaveStatus}
              </div>
            )}
            <div className="qr-preview-actions">
              <button className="ghost-btn" type="button" onClick={() => void handleCopyLink()} disabled={isCopyingLink || isExporting}>
                <Copy size={16} />
                复制链接
              </button>
              <button className="ghost-btn" type="button" onClick={() => void handleSaveQrImage()}>
                <Download size={16} />
                保存到相册
              </button>
              <button className="primary-btn" type="button" onClick={() => void handleShareQrImage()}>
                <Share2 size={16} />
                分享图片
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function buildQrFileName(title: string) {
  const slug = title.replace(/[\\/:*?"<>|]/g, "_").trim().slice(0, 24) || "lifelog-share";
  return `lifelog-qr-${slug}.png`;
}

function ShareModeCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div>
      <strong>{title}</strong>
      <span>{desc}</span>
    </div>
  );
}

function ShareSwitch({
  checked,
  title,
  desc,
  disabled,
  onChange
}: {
  checked: boolean;
  title: string;
  desc: string;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={`local-share-switch ${disabled ? "disabled" : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="local-share-switch-copy">
        <strong>{title}</strong>
        <small>{desc}</small>
      </span>
      <span className="toggle-slider" aria-hidden="true" />
    </label>
  );
}

function ShareOptionGroup<T extends string>({
  title,
  options,
  value,
  onChange
}: {
  title: string;
  options: Array<{ value: T; label: string; desc: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="local-share-option-group">
      <strong>{title}</strong>
      <div>
        {options.map((option) => (
          <button
            className={option.value === value ? "active" : ""}
            type="button"
            key={option.value}
            onClick={() => onChange(option.value)}
          >
            <span>{option.label}</span>
            <small>{option.desc}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
