import { Copy, Download, Share2, X } from "lucide-react";
import { useState } from "react";
import QRCode from "qrcode";
import { useLifeLog } from "../context/LifeLogContext";
import { useToast } from "../context/ToastContext";
import { copyTextToClipboard } from "../utils/diagnostics";
import { addShareHistoryEntry, formatShareHistoryCounts } from "../utils/shareHistory";
import { buildLifeLogShareLink, ShareLinkTooLargeError } from "../utils/lifelogShareLink";
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
        ? await buildMemoryShare(target.memoryId, { ...memoryOptions, includePhotos: false })
        : await buildPlacesShare(target.placeIds, { ...placeOptions, includePhotos: false });
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
      const link = await buildLifeLogShareLink(payload);
      setShareLink(link);
      setQrImage(await QRCode.toDataURL(link, { width: 220, margin: 2, errorCorrectionLevel: "M" }));
      const counts = target.type === "memory" ? { memories: 1 } : { places: target.count };
      addShareHistoryEntry({
        direction: "export",
        method: "link",
        status: "created",
        title: target.title,
        summary: formatShareHistoryCounts(counts) || "二维码分享链接",
        shareLink: link,
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
              <strong>{target.type === "memory" ? "导出 1 条回忆" : `导出 ${target.count} 个地点`}</strong>
              <span>生成 `.lifelog-share.json`，接收方可在 LifeLog 中预览后添加。</span>
            </div>
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
              {qrImage && <img src={qrImage} alt="LifeLog 分享二维码" />}
              <span>让对方扫码打开分享导入页面。二维码在本机生成；内容较多时建议改用分享包。</span>
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
