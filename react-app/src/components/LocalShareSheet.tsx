import { ChevronDown, Copy, Download, ImageDown, QrCode, Share2, X } from "lucide-react";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useLifeLog } from "../context/LifeLogContext";
import { useToast } from "../context/ToastContext";
import { copyTextToClipboard } from "../utils/diagnostics";
import { saveImageToGallery, shareImageFile } from "../utils/imageShare";
import { addShareHistoryEntry, formatShareHistoryCounts } from "../utils/shareHistory";
import { buildLifeLogShareLink, buildLifeLogShareQrCode, ShareLinkTooLargeError } from "../utils/lifelogShareLink";
import { buildSharePresetOptions, type LifeLogSharePayload, type MemoryShareOptions, type PlaceShareOptions, type SharePrivacyPreset, type SharedMemoryPlaceMode, type SharedPeopleMode } from "../utils/lifelogShare";
import SheetPrimitive from "./motion/SheetPrimitive";

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

type ShareCardTemplate = "clean" | "warm" | "night";

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

const shareCardTemplateOptions: Array<{ value: ShareCardTemplate; label: string }> = [
  { value: "clean", label: "简洁" },
  { value: "warm", label: "暖色" },
  { value: "night", label: "夜色" }
];

const privacyPresetOptions: Array<{ value: SharePrivacyPreset; label: string }> = [
  { value: "private", label: "私密" },
  { value: "trusted", label: "熟人" },
  { value: "custom", label: "自定义" }
];

export default function LocalShareSheet({ target, onClose }: LocalShareSheetProps) {
  const { buildMemoryShare, buildPlacesShare, exportMemoryShare, exportPlacesShare } = useLifeLog();
  const notify = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [isCopyingLink, setIsCopyingLink] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isSharingCard, setIsSharingCard] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [qrImage, setQrImage] = useState("");
  const [qrPreviewOpen, setQrPreviewOpen] = useState(false);
  const [qrSaveStatus, setQrSaveStatus] = useState("");
  const [shareCardTemplate, setShareCardTemplate] = useState<ShareCardTemplate>("clean");
  const [privacyPreset, setPrivacyPreset] = useState<SharePrivacyPreset>("private");
  const [memoryOptions, setMemoryOptions] = useState<MemoryShareOptions>(() => buildSharePresetOptions("private").memory);
  const [placeOptions, setPlaceOptions] = useState<PlaceShareOptions>(() => buildSharePresetOptions("private").place);
  const targetKey = target?.type === "memory"
    ? `memory:${target.memoryId}`
    : target?.type === "places"
      ? `places:${target.placeIds.join("|")}`
      : "";

  useEffect(() => {
    const next = buildSharePresetOptions("private");
    setPrivacyPreset("private");
    setMemoryOptions(next.memory);
    setPlaceOptions(next.place);
    setAdvancedOpen(false);
    setShareLink("");
    setQrImage("");
  }, [targetKey]);

  if (!target) return null;

  const isBusy = isExporting || isCopyingLink || isSharing || isSharingCard;

  function applyPrivacyPreset(preset: SharePrivacyPreset) {
    setPrivacyPreset(preset);
    if (preset === "custom") {
      setAdvancedOpen(true);
      return;
    }
    const next = buildSharePresetOptions(preset);
    setMemoryOptions(next.memory);
    setPlaceOptions(next.place);
  }

  function updateMemoryOptions(update: (current: MemoryShareOptions) => MemoryShareOptions) {
    setPrivacyPreset("custom");
    setMemoryOptions(update);
  }

  function updatePlaceOptions(update: (current: PlaceShareOptions) => PlaceShareOptions) {
    setPrivacyPreset("custom");
    setPlaceOptions(update);
  }

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
      const payload = await buildConfiguredSharePayload();
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

  async function handleImmediateShare() {
    if (!target) return;
    setIsSharing(true);
    try {
      const { link, compacted } = await buildQuickShareLink();
      const result = await shareTextOrCopy(target.title, buildShareMessage(target), link);
      const counts = target.type === "memory" ? { memories: 1 } : { places: target.count };
      addShareHistoryEntry({
        direction: "export",
        method: "link",
        status: result === "failed" ? "failed" : "created",
        title: target.title,
        summary: result === "shared"
          ? (formatShareHistoryCounts(counts) || "已打开系统分享")
          : result === "copied"
            ? "分享链接已复制"
            : "分享链接生成失败",
        shareLink: link,
        counts
      });
      notify({
        message: result === "shared"
          ? (compacted ? "已打开系统分享面板，内容已自动精简" : "已打开系统分享面板")
          : result === "copied"
            ? (compacted ? "内容较长，已复制精简分享链接" : "分享链接已复制")
            : "当前环境无法分享，也无法写入剪贴板",
        tone: result === "failed" ? "info" : "success",
        durationMs: 3600
      });
    } catch (error) {
      const message = error instanceof ShareLinkTooLargeError
        ? "内容太多，链接会过长，请展开更多设置后改用分享包。"
        : error instanceof Error
          ? error.message
          : "请稍后重试";
      notify({ message: `分享失败：${message}`, tone: error instanceof ShareLinkTooLargeError ? "info" : "error" });
    } finally {
      setIsSharing(false);
    }
  }

  async function handleShareCardImage() {
    if (!target) return;
    setIsSharingCard(true);
    try {
      const payload = await buildQuickSharePayload();
      const dataUrl = await buildShareCardImage(payload, shareCardTemplate);
      await shareImageFile(buildShareCardFileName(target.title), dataUrl, "分享 LifeLog 卡片");
      const counts = target.type === "memory" ? { memories: 1 } : { places: target.count };
      addShareHistoryEntry({
        direction: "export",
        method: "file",
        status: "created",
        title: target.title,
        summary: formatShareHistoryCounts(counts) || "分享图片卡片",
        counts
      });
      notify({ message: "已打开系统分享面板", tone: "success", durationMs: 2600 });
    } catch {
      notify({ message: "生成分享图片失败，请改用链接或二维码。", tone: "error", durationMs: 3600 });
    } finally {
      setIsSharingCard(false);
    }
  }

  async function handleGenerateQr(mode: "quick" | "configured" = "configured") {
    if (!target) return;
    if (mode === "configured" && target.type === "memory" && memoryOptions.includePhotos) {
      notify({ message: "二维码不支持图片内容，请关闭图片后生成。", tone: "info" });
      return;
    }
    if (mode === "configured" && target.type === "places" && placeOptions.includePhotos) {
      notify({ message: "二维码不支持地点图片链接，请关闭图片后生成。", tone: "info" });
      return;
    }

    setIsCopyingLink(true);
    try {
      const payload = mode === "quick" ? await buildQuickSharePayload() : await buildConfiguredSharePayload();
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

  async function buildConfiguredSharePayload() {
    if (!target) throw new Error("没有可分享的内容。");
    return target.type === "memory"
      ? await buildMemoryShare(target.memoryId, { ...memoryOptions, includePhotos: false })
      : await buildPlacesShare(target.placeIds, { ...placeOptions, includePhotos: false });
  }

  async function buildQuickSharePayload(compact = false) {
    if (!target) throw new Error("没有可分享的内容。");
    return target.type === "memory"
      ? await buildMemoryShare(target.memoryId, compact ? getCompactMemoryShareOptions(memoryOptions) : { ...memoryOptions, includePhotos: false })
      : await buildPlacesShare(target.placeIds, compact ? getCompactPlaceShareOptions(placeOptions) : { ...placeOptions, includePhotos: false });
  }

  async function buildQuickShareLink() {
    try {
      return {
        link: await buildLifeLogShareLink(await buildQuickSharePayload(false)),
        compacted: false
      };
    } catch (error) {
      if (!(error instanceof ShareLinkTooLargeError)) throw error;
      return {
        link: await buildLifeLogShareLink(await buildQuickSharePayload(true)),
        compacted: true
      };
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
    <>
    <SheetPrimitive open onDismissRequest={onClose} className="local-share-sheet" ariaLabel="本地分享">
        <div className="sheet-handle" data-sheet-drag-handle />
        <div className="sheet-header">
          <div>
            <h2>本地分享</h2>
            <p>{target.title}</p>
          </div>
          <button className="sheet-close pressable" aria-label="关闭" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        <div className="local-share-content">
          <div className="local-share-summary">
            <span className="local-share-icon">
              <Share2 size={18} />
            </span>
            <div>
              <strong>{target.type === "memory" ? "分享这条回忆" : `分享 ${target.count} 个地点`}</strong>
              <span>{getShareFieldSummary(target, memoryOptions, placeOptions)}</span>
            </div>
          </div>
          <div className="local-share-privacy-presets" role="group" aria-label="分享隐私预设">
            {privacyPresetOptions.map((option) => (
              <button
                className={privacyPreset === option.value ? "active" : ""}
                type="button"
                key={option.value}
                aria-pressed={privacyPreset === option.value}
                onClick={() => applyPrivacyPreset(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="local-share-field-preview">
            <strong>发送前确认</strong>
            <span>{getShareExclusionSummary(target, memoryOptions, placeOptions)}</span>
          </div>
          <div className="local-share-primary-actions">
            <button className="primary-btn pressable" type="button" onClick={() => void handleImmediateShare()} disabled={isBusy}>
              <Share2 size={16} />
              {isSharing ? "准备中…" : "立即分享"}
            </button>
            <button className="ghost-btn pressable" type="button" onClick={() => void handleShareCardImage()} disabled={isBusy}>
              <ImageDown size={16} />
              {isSharingCard ? "生成中…" : "图片"}
            </button>
            <button className="ghost-btn pressable" type="button" onClick={() => void handleGenerateQr("quick")} disabled={isBusy}>
              <QrCode size={16} />
              二维码
            </button>
          </div>
          <div className="local-share-card-template-row" role="group" aria-label="分享图片模板">
            <span>图片模板</span>
            <div>
              {shareCardTemplateOptions.map((option) => (
                <button
                  className={shareCardTemplate === option.value ? "active" : ""}
                  type="button"
                  key={option.value}
                  onClick={() => setShareCardTemplate(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <button className={`local-share-advanced-toggle ${advancedOpen ? "open" : ""}`} type="button" onClick={() => setAdvancedOpen((open) => !open)}>
            <span>{advancedOpen ? "收起分享设置" : "调整隐私或导出分享包"}</span>
            <ChevronDown size={16} />
          </button>

          {advancedOpen && (
            <div className="local-share-advanced-panel">
              {target.type === "memory" ? (
                <>
                  <ShareSwitch
                    checked={memoryOptions.includeContent}
                    title="分享正文"
                    desc="关闭后只保留标题、日期、心情和标签。"
                    onChange={(includeContent) => updateMemoryOptions((current) => ({ ...current, includeContent }))}
                  />
                  <ShareOptionGroup
                    title="关联人物"
                    options={peopleModeOptions}
                    value={memoryOptions.peopleMode}
                    onChange={(peopleMode) => updateMemoryOptions((current) => ({ ...current, peopleMode }))}
                  />
                  <ShareOptionGroup
                    title="关联地点"
                    options={placeModeOptions}
                    value={memoryOptions.placeMode}
                    onChange={(placeMode) => updateMemoryOptions((current) => ({ ...current, placeMode }))}
                  />
                  <ShareSwitch
                    checked={memoryOptions.includePhotos}
                    title={`分享图片${target.photoCount ? `（${target.photoCount} 张）` : ""}`}
                    desc="图片会让分享包明显变大，默认不导出。"
                    disabled={!target.photoCount}
                    onChange={(includePhotos) => updateMemoryOptions((current) => ({ ...current, includePhotos }))}
                  />
                </>
              ) : (
                <>
                  <ShareSwitch
                    checked={placeOptions.includeAddress}
                    title="分享地址"
                    desc="保留城市、区域、商场和详细地址。"
                    onChange={(includeAddress) => updatePlaceOptions((current) => ({ ...current, includeAddress }))}
                  />
                  <ShareSwitch
                    checked={placeOptions.includePreciseLocation}
                    title="分享精准定位"
                    desc="包含经纬度和地图入口，适合可信接收方。"
                    onChange={(includePreciseLocation) => updatePlaceOptions((current) => ({ ...current, includePreciseLocation }))}
                  />
                  <ShareSwitch
                    checked={placeOptions.includeLinks}
                    title="分享外部链接"
                    desc="包含美团、大众点评、小红书或参考链接。"
                    onChange={(includeLinks) => updatePlaceOptions((current) => ({ ...current, includeLinks }))}
                  />
                  <ShareSwitch
                    checked={placeOptions.includePhotos}
                    title="分享地点图片链接"
                    desc="仅导出地点里的图片链接，不处理本地回忆照片。"
                    onChange={(includePhotos) => updatePlaceOptions((current) => ({ ...current, includePhotos }))}
                  />
                </>
              )}
            </div>
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

        {advancedOpen && (
          <div className="submit-row">
            <button className="ghost-btn pressable" type="button" onClick={onClose}>
              取消
            </button>
            <button className="ghost-btn pressable" type="button" onClick={() => void handleCopyLink()} disabled={isBusy}>
              <Copy size={16} />
              {isCopyingLink ? "生成中…" : "复制链接"}
            </button>
            <button className="ghost-btn pressable" type="button" onClick={() => void handleGenerateQr()} disabled={isBusy}>
              <QrCode size={16} />
              二维码
            </button>
            <button className="primary-btn pressable" type="button" onClick={() => void handleExport()} disabled={isBusy}>
              <Download size={16} />
              {isExporting ? "生成中…" : "生成分享包"}
            </button>
          </div>
        )}
    </SheetPrimitive>
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
              <button className="ghost-btn pressable" type="button" onClick={() => void handleCopyLink()} disabled={isCopyingLink || isExporting}>
                <Copy size={16} />
                复制链接
              </button>
              <button className="ghost-btn pressable" type="button" onClick={() => void handleSaveQrImage()}>
                <Download size={16} />
                保存到相册
              </button>
              <button className="primary-btn pressable" type="button" onClick={() => void handleShareQrImage()}>
                <Share2 size={16} />
                分享图片
              </button>
            </div>
          </div>
        </section>
      )}
    </>
  );
}

function buildQrFileName(title: string) {
  const slug = title.replace(/[\\/:*?"<>|]/g, "_").trim().slice(0, 24) || "lifelog-share";
  return `lifelog-qr-${slug}.png`;
}

function buildShareCardFileName(title: string) {
  const slug = title.replace(/[\\/:*?"<>|]/g, "_").trim().slice(0, 24) || "lifelog-share";
  return `lifelog-card-${slug}.png`;
}

function getShareFieldSummary(target: ShareTarget, memory: MemoryShareOptions, place: PlaceShareOptions) {
  if (target.type === "memory") {
    const fields = [
      "标题与日期",
      memory.includeContent ? "正文" : "不含正文",
      memory.peopleMode === "public" ? "人物姓名" : memory.peopleMode === "anonymous" ? "匿名人物" : "不含人物",
      memory.placeMode === "full" ? "地点与地址" : memory.placeMode === "name" ? "地点名称" : "不含地点",
      memory.includePhotos ? "照片仅进分享包" : "不含照片"
    ];
    return fields.join(" · ");
  }
  return [
    "地点名称与城市",
    place.includeAddress ? "详细地址" : "不含详细地址",
    place.includeLinks ? "外部链接" : "不含链接",
    place.includePhotos ? "图片链接仅进分享包" : "不含图片"
  ].join(" · ");
}

function getShareExclusionSummary(target: ShareTarget, memory: MemoryShareOptions, place: PlaceShareOptions) {
  if (target.type === "memory") {
    const excluded = [
      memory.peopleMode === "public" ? "" : "公开姓名",
      "精准定位",
      memory.includePhotos ? "链接和二维码中的照片" : "照片"
    ].filter(Boolean);
    return `不会包含：${excluded.join("、")}`;
  }
  const excluded = [
    place.includePreciseLocation ? "" : "经纬度与地图定位",
    place.includePhotos ? "链接和二维码中的图片" : "图片链接"
  ].filter(Boolean);
  return `不会包含：${excluded.join("、") || "无"}`;
}

function buildShareMessage(target: ShareTarget) {
  return target.type === "memory"
    ? `我用 LifeLog 分享了一条回忆：${target.title}`
    : `我用 LifeLog 分享了 ${target.count} 个地点：${target.title}`;
}

function getCompactMemoryShareOptions(options: MemoryShareOptions): MemoryShareOptions {
  return {
    includeContent: false,
    peopleMode: options.peopleMode,
    placeMode: options.placeMode,
    includePhotos: false
  };
}

function getCompactPlaceShareOptions(options: PlaceShareOptions): PlaceShareOptions {
  return {
    includeAddress: false,
    includePreciseLocation: false,
    includeLinks: options.includeLinks,
    includePhotos: false
  };
}

async function shareTextOrCopy(title: string, text: string, url: string): Promise<"shared" | "copied" | "failed"> {
  const share = navigator.share?.bind(navigator);
  if (share) {
    try {
      await share({ title, text, url });
      return "shared";
    } catch (error) {
      if (isAbortError(error)) return "failed";
    }
  }

  return await copyTextToClipboard(`${text}\n${url}`) ? "copied" : "failed";
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

async function buildShareCardImage(payload: LifeLogSharePayload, template: ShareCardTemplate) {
  const width = 1080;
  const height = 1440;
  const scale = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("当前环境无法生成分享图片。");
  ctx.scale(scale, scale);

  const palette = getShareCardPalette(payload.shareType, template);
  const title = clampCardText(payload.title || "LifeLog 分享", 34);
  const subtitle = payload.shareType === "memory" ? "回忆分享" : "地点分享";
  const summaryLines = buildShareCardSummary(payload);

  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, width, height);
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, palette.accent);
  gradient.addColorStop(1, palette.secondary);
  ctx.fillStyle = gradient;
  roundRect(ctx, 70, 70, width - 140, height - 140, 48);
  ctx.fill();

  ctx.fillStyle = palette.card;
  roundRect(ctx, 116, 120, width - 232, height - 240, 36);
  ctx.fill();

  ctx.fillStyle = palette.accent;
  ctx.font = "800 36px sans-serif";
  ctx.fillText("LifeLog", 164, 206);
  ctx.fillStyle = palette.muted;
  ctx.font = "600 24px sans-serif";
  ctx.fillText(subtitle, 164, 248);

  ctx.fillStyle = palette.text;
  ctx.font = "900 56px sans-serif";
  drawWrappedText(ctx, title, 164, 360, width - 328, 74, 3);

  ctx.fillStyle = palette.body;
  ctx.font = "600 28px sans-serif";
  let y = 620;
  for (const line of summaryLines) {
    drawWrappedText(ctx, line, 164, y, width - 328, 40, 2);
    y += 116;
  }

  ctx.fillStyle = palette.footer;
  roundRect(ctx, 164, height - 274, width - 328, 112, 28);
  ctx.fill();
  ctx.fillStyle = palette.text;
  ctx.font = "800 30px sans-serif";
  ctx.fillText("用 LifeLog 打开可导入这份分享", 196, height - 224);
  ctx.fillStyle = palette.muted;
  ctx.font = "600 22px sans-serif";
  ctx.fillText(formatCardDate(payload.exportedAt), 196, height - 184);

  return canvas.toDataURL("image/png", 0.95);
}

function getShareCardPalette(shareType: LifeLogSharePayload["shareType"], template: ShareCardTemplate) {
  const typeAccent = shareType === "memory"
    ? { accent: "#7c4dff", secondary: "#ff8a4c" }
    : { accent: "#0f9f8f", secondary: "#58b4ff" };

  if (template === "warm") {
    return {
      accent: shareType === "memory" ? "#d85c4a" : "#c87919",
      secondary: shareType === "memory" ? "#f4b24b" : "#42a68c",
      background: "#fff7ed",
      card: "rgba(255,255,255,0.94)",
      text: "#2f211c",
      body: "rgba(47, 33, 28, 0.74)",
      muted: "rgba(47, 33, 28, 0.58)",
      footer: "rgba(216, 92, 74, 0.12)"
    };
  }

  if (template === "night") {
    return {
      accent: shareType === "memory" ? "#a78bfa" : "#5eead4",
      secondary: shareType === "memory" ? "#fb7185" : "#60a5fa",
      background: "#15131d",
      card: "rgba(28, 26, 38, 0.94)",
      text: "#f7f4ff",
      body: "rgba(247, 244, 255, 0.78)",
      muted: "rgba(247, 244, 255, 0.58)",
      footer: "rgba(255, 255, 255, 0.08)"
    };
  }

  return {
    ...typeAccent,
    background: "#f8f5ef",
    card: "rgba(255,255,255,0.94)",
    text: "#242033",
    body: "rgba(36, 32, 51, 0.72)",
    muted: "rgba(40, 35, 55, 0.56)",
    footer: "rgba(124, 77, 255, 0.1)"
  };
}

function buildShareCardSummary(payload: LifeLogSharePayload) {
  if (payload.shareType === "places") {
    const places = payload.data.places.slice(0, 4).map((place) => {
      const parts = [place.name || place.storeName || "未命名地点", place.city, place.mall || place.category].filter(Boolean);
      return parts.join(" · ");
    });
    return places.length ? places : [`${payload.data.places.length} 个地点`];
  }

  const memory = payload.data.memories[0];
  const people = payload.data.people.map((person) => person.name).filter(Boolean).slice(0, 4).join("、");
  const places = payload.data.places.map((place) => place.name || place.storeName).filter(Boolean).slice(0, 3).join("、");
  return [
    memory?.date ? `日期：${memory.date}` : "",
    people ? `人物：${people}` : "",
    places ? `地点：${places}` : "",
    memory?.mood ? `心情：${memory.mood}` : ""
  ].filter(Boolean).slice(0, 4);
}

function clampCardText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function formatCardDate(value: string) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "LifeLog 本地分享";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
) {
  const chars = Array.from(text);
  let line = "";
  let currentY = y;
  let lines = 0;

  for (const char of chars) {
    const next = `${line}${char}`;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines += 1;
      ctx.fillText(lines >= maxLines ? `${line.slice(0, Math.max(1, line.length - 1))}…` : line, x, currentY);
      if (lines >= maxLines) return;
      line = char;
      currentY += lineHeight;
    } else {
      line = next;
    }
  }

  if (line && lines < maxLines) ctx.fillText(line, x, currentY);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
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
