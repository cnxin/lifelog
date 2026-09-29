import { ArrowLeft, CheckCircle2, ImageUp, Link2, QrCode, Upload } from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import GlassCard from "../../components/GlassCard";
import QrScannerPanel from "../../components/QrScannerPanel";
import { useLifeLog } from "../../context/LifeLogContext";
import { useToast } from "../../context/ToastContext";
import { buildShareImportPreview, normalizeLifeLogSharePayload, type LifeLogShareImportPreview, type LifeLogSharePayload } from "../../utils/lifelogShare";
import { extractLifeLogShareHashFromText, parseLifeLogShareLinkHash } from "../../utils/lifelogShareLink";
import { detectQrTextFromImageFile, isQrCodeDetectionSupported } from "../../utils/qrCodeReader";
import { addShareHistoryEntry, formatShareHistoryCounts, updateShareHistoryEntry } from "../../utils/shareHistory";
import { getShareImportViewTarget } from "../../utils/shareImportResult";

export default function ShareImport() {
  const { state, importShareData, undoShareImport } = useLifeLog();
  const notify = useToast();
  const navigate = useNavigate();
  const [payload, setPayload] = useState<LifeLogSharePayload | null>(null);
  const [error, setError] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [doneText, setDoneText] = useState("");
  const [doneTarget, setDoneTarget] = useState<{ label: string; path: string } | null>(null);
  const [manualLink, setManualLink] = useState("");
  const [scannerOpen, setScannerOpen] = useState(() => new URLSearchParams(window.location.search).get("scan") === "1");
  const [isReadingImage, setIsReadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;
    const hash = window.location.hash;
    if (!hash) {
      setError("");
      setPayload(null);
      return () => {
        active = false;
      };
    }

    parseLifeLogShareLinkHash(hash)
      .then((parsed) => normalizeLifeLogSharePayload(parsed))
      .then((nextPayload) => {
        if (!active) return;
        setPayload(nextPayload);
        setError("");
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "分享链接无法解析。");
        setPayload(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const preview = useMemo<LifeLogShareImportPreview | null>(() => {
    if (!payload) return null;
    return buildShareImportPreview(payload, state);
  }, [payload, state]);
  const isQrMiniShare = payload?.appVersion === "qr-mini-v1";

  async function handleImport() {
    if (!payload) return;
    setIsImporting(true);
    try {
      const result = await importShareData(payload);
      const message = [
        result.peopleCreated ? `新增人物 ${result.peopleCreated}` : "",
        result.placesCreated ? `新增地点 ${result.placesCreated}` : "",
        result.placesReused ? `复用地点 ${result.placesReused}` : "",
        result.memoriesCreated ? `新增记录 ${result.memoriesCreated}` : "",
        result.memoriesSkipped ? `跳过重复 ${result.memoriesSkipped}` : ""
      ].filter(Boolean).join(" · ") || "分享内容已处理";
      const viewTarget = getShareImportViewTarget(result);
      const historyEntry = addShareHistoryEntry({
        direction: "import",
        method: "link",
        status: "imported",
        title: preview?.title || payload.title || "分享链接",
        summary: message,
        targetPath: viewTarget?.path,
        counts: {
          people: result.peopleCreated,
          places: result.placesCreated,
          memories: result.memoriesCreated,
          photos: result.photosCreated
        }
      });
      setDoneText(message);
      setDoneTarget(viewTarget);
      notify({
        message,
        tone: "success",
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
              setDoneText("");
              notify({ message: "已撤销本次分享导入", tone: "success" });
            }
          }
        ],
        durationMs: 6200
      });
    } catch (err) {
      notify({
        message: `导入失败：${err instanceof Error ? err.message : "请稍后重试"}`,
        tone: "error"
      });
    } finally {
      setIsImporting(false);
    }
  }

  async function handleManualParse() {
    await parseShareText(manualLink, {
      emptyMessage: "没有识别到 LifeLog 分享链接。",
      fallbackMessage: "分享链接无法解析。",
      replaceUrl: true
    });
  }

  async function parseShareText(
    text: string,
    options: { emptyMessage: string; fallbackMessage: string; replaceUrl?: boolean }
  ) {
    const hash = extractLifeLogShareHashFromText(text);
    if (!hash) {
      setPayload(null);
      setError(options.emptyMessage);
      return;
    }
    try {
      const parsed = await parseLifeLogShareLinkHash(hash);
      setPayload(normalizeLifeLogSharePayload(parsed));
      setError("");
      setDoneText("");
      setDoneTarget(null);
      if (options.replaceUrl) window.history.replaceState(null, "", `/share/import#${hash}`);
    } catch (err) {
      setPayload(null);
      setError(err instanceof Error ? err.message : options.fallbackMessage);
    }
  }

  async function handleScannedText(text: string) {
    setManualLink(text);
    await parseShareText(text, {
      emptyMessage: "二维码里没有识别到 LifeLog 分享链接。",
      fallbackMessage: "分享链接无法解析。",
      replaceUrl: true
    });
  }

  async function handleImageSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setIsReadingImage(true);
    try {
      const text = await detectQrTextFromImageFile(file);
      if (!text) {
        setPayload(null);
        setError("这张图片里没有识别到 LifeLog 分享二维码。");
        return;
      }
      setManualLink(text);
      await parseShareText(text, {
        emptyMessage: "图片二维码里没有识别到 LifeLog 分享链接。",
        fallbackMessage: "分享链接无法解析。",
        replaceUrl: true
      });
    } catch (err) {
      setPayload(null);
      setError(err instanceof Error ? err.message : "二维码图片读取失败，请换一张图片或改用粘贴链接。");
    } finally {
      setIsReadingImage(false);
    }
  }

  return (
    <section className="section share-import-page">
      <div className="section-header">
        <h2>
          <Link2 /> 导入分享链接
        </h2>
        <button className="see-all" type="button" onClick={() => navigate("/")}>
          <ArrowLeft size={14} />
          返回
        </button>
      </div>

      {error && (
        <GlassCard className="share-import-card error">
          <strong>链接不可用</strong>
          <p>{error}</p>
        </GlassCard>
      )}

      {!preview && (
        <GlassCard className="share-import-card">
          <div className="share-import-head">
            <span>
              <Link2 size={18} />
            </span>
            <div>
              <strong>粘贴分享链接</strong>
              <small>从首页快捷入口进入时，可以在这里粘贴别人发来的链接。</small>
            </div>
          </div>
          <label className="share-import-manual">
            <span>分享链接</span>
            <textarea
              value={manualLink}
              placeholder="粘贴 LifeLog 分享链接"
              onChange={(event) => setManualLink(event.target.value)}
            />
          </label>
          <div className="share-import-action-row">
            <button className="ghost-btn share-import-scan" type="button" onClick={() => setScannerOpen(true)}>
              <QrCode size={16} />
              扫描二维码
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => void handleImageSelected(event)}
            />
            <button
              className="ghost-btn share-import-scan"
              type="button"
              onClick={() => {
                if (!isQrCodeDetectionSupported()) {
                  setError("当前 WebView 不支持从图片识别二维码，请改用相机扫码或粘贴链接。");
                  return;
                }
                imageInputRef.current?.click();
              }}
              disabled={isReadingImage}
            >
              <ImageUp size={16} />
              {isReadingImage ? "识别中…" : "从相册识别"}
            </button>
          </div>
          <button className="primary-btn share-import-submit" type="button" onClick={() => void handleManualParse()}>
            <Upload size={16} />
            解析分享链接
          </button>
        </GlassCard>
      )}

      {preview && (
        <GlassCard className="share-import-card">
          <div className="share-import-head">
            <span>
              <Link2 size={18} />
            </span>
            <div>
              <strong>{preview.title}</strong>
              <small>{preview.shareType === "memory" ? "记录分享" : "地点分享"} · {formatShareDate(preview.exportedAt)}</small>
            </div>
          </div>
          {isQrMiniShare && (
            <div className="share-import-note">
              <QrCode size={15} />
              <span>这是二维码精简版，只包含标题、日期、标签、人物和地点名称；完整正文、地址、链接和照片需要对方发送分享包或完整链接。</span>
            </div>
          )}
          <div className="share-import-metrics">
            <Metric label="人物" value={preview.incoming.people} />
            <Metric label="地点" value={preview.incoming.places} />
            <Metric label="记录" value={preview.incoming.memories} />
            <Metric label="照片" value={preview.incoming.photos} />
          </div>
          <div className="share-import-effect">
            {[
              preview.willCreate.people ? `新增人物 ${preview.willCreate.people}` : "",
              preview.willCreate.places ? `新增地点 ${preview.willCreate.places}` : "",
              preview.willReuse.places ? `复用已有地点 ${preview.willReuse.places}` : "",
              preview.willCreate.memories ? `新增记录 ${preview.willCreate.memories}` : "",
              preview.skippedMemories ? `跳过重复记录 ${preview.skippedMemories}` : ""
            ].filter(Boolean).map((item) => (
              <span key={item}>{item}</span>
            ))}
            {!preview.willCreate.people && !preview.willCreate.places && !preview.willCreate.memories && !preview.skippedMemories && (
              <span>没有新内容需要添加</span>
            )}
          </div>
          <ImportPreviewDetails preview={preview} />
          {doneText ? (
            <div className="share-import-done-row">
              <div className="share-import-done">
                <CheckCircle2 size={17} />
                <span>{doneText}</span>
              </div>
              <button className="mini-action" type="button" onClick={() => setDoneText("")}>
                继续导入
              </button>
              {doneTarget && (
                <button className="mini-action primary" type="button" onClick={() => navigate(doneTarget.path)}>
                  {doneTarget.label}
                </button>
              )}
            </div>
          ) : (
            <button className="primary-btn share-import-submit" type="button" onClick={() => void handleImport()} disabled={isImporting}>
              <Upload size={16} />
              {isImporting ? "导入中…" : "添加到 LifeLog"}
            </button>
          )}
        </GlassCard>
      )}
      <QrScannerPanel
        open={scannerOpen}
        title="扫描分享二维码"
        onDetected={(text) => void handleScannedText(text)}
        onClose={() => setScannerOpen(false)}
      />
    </section>
  );
}

function ImportPreviewDetails({ preview }: { preview: LifeLogShareImportPreview }) {
  const groups = [
    { title: "将新增", items: [...preview.detail.createMemories, ...preview.detail.createPlaces, ...preview.detail.createPeople], tone: "create" },
    { title: "将复用", items: [...preview.detail.reusePlaces, ...preview.detail.reusePeople], tone: "reuse" },
    { title: "将跳过", items: preview.detail.skipMemories, tone: "skip" },
    { title: "未包含", items: preview.detail.missingFields, tone: "missing" }
  ].filter((group) => group.items.length);

  if (!groups.length) return null;

  return (
    <div className="share-import-detail-list">
      {groups.map((group) => (
        <div className={`share-import-detail-group ${group.tone}`} key={group.title}>
          <strong>{group.title}</strong>
          <div>
            {group.items.map((item) => (
              <span key={`${group.title}-${item}`}>{item}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function formatShareDate(value: string) {
  if (!value) return "未知时间";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}
