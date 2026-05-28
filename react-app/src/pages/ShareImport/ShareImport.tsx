import { ArrowLeft, CheckCircle2, Link2, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import GlassCard from "../../components/GlassCard";
import { useLifeLog } from "../../context/LifeLogContext";
import { useToast } from "../../context/ToastContext";
import { buildShareImportPreview, normalizeLifeLogSharePayload, type LifeLogShareImportPreview, type LifeLogSharePayload } from "../../utils/lifelogShare";
import { extractLifeLogShareHashFromText, parseLifeLogShareLinkHash } from "../../utils/lifelogShareLink";

export default function ShareImport() {
  const { state, importShareData, undoShareImport } = useLifeLog();
  const notify = useToast();
  const navigate = useNavigate();
  const [payload, setPayload] = useState<LifeLogSharePayload | null>(null);
  const [error, setError] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [doneText, setDoneText] = useState("");
  const [manualLink, setManualLink] = useState("");

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

  async function handleImport() {
    if (!payload) return;
    setIsImporting(true);
    try {
      const result = await importShareData(payload);
      const message = [
        result.peopleCreated ? `新增人物 ${result.peopleCreated}` : "",
        result.placesCreated ? `新增地点 ${result.placesCreated}` : "",
        result.placesReused ? `复用地点 ${result.placesReused}` : "",
        result.memoriesCreated ? `新增回忆 ${result.memoriesCreated}` : "",
        result.memoriesSkipped ? `跳过重复 ${result.memoriesSkipped}` : ""
      ].filter(Boolean).join(" · ") || "分享内容已处理";
      setDoneText(message);
      notify({
        message,
        tone: "success",
        actions: [
          {
            label: "撤销",
            onClick: async () => {
              await undoShareImport(result);
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
    const hash = extractLifeLogShareHashFromText(manualLink);
    if (!hash) {
      setPayload(null);
      setError("没有识别到 LifeLog 分享链接。");
      return;
    }
    try {
      const parsed = await parseLifeLogShareLinkHash(hash);
      setPayload(normalizeLifeLogSharePayload(parsed));
      setError("");
      setDoneText("");
      window.history.replaceState(null, "", `/share/import#${hash}`);
    } catch (err) {
      setPayload(null);
      setError(err instanceof Error ? err.message : "分享链接无法解析。");
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
              <small>{preview.shareType === "memory" ? "回忆分享" : "地点分享"} · {formatShareDate(preview.exportedAt)}</small>
            </div>
          </div>
          <div className="share-import-metrics">
            <Metric label="人物" value={preview.incoming.people} />
            <Metric label="地点" value={preview.incoming.places} />
            <Metric label="回忆" value={preview.incoming.memories} />
            <Metric label="照片" value={preview.incoming.photos} />
          </div>
          <div className="share-import-effect">
            {[
              preview.willCreate.people ? `新增人物 ${preview.willCreate.people}` : "",
              preview.willCreate.places ? `新增地点 ${preview.willCreate.places}` : "",
              preview.willReuse.places ? `复用已有地点 ${preview.willReuse.places}` : "",
              preview.willCreate.memories ? `新增回忆 ${preview.willCreate.memories}` : "",
              preview.skippedMemories ? `跳过重复回忆 ${preview.skippedMemories}` : ""
            ].filter(Boolean).map((item) => (
              <span key={item}>{item}</span>
            ))}
            {!preview.willCreate.people && !preview.willCreate.places && !preview.willCreate.memories && !preview.skippedMemories && (
              <span>没有新内容需要添加</span>
            )}
          </div>
          {doneText ? (
            <div className="share-import-done-row">
              <div className="share-import-done">
                <CheckCircle2 size={17} />
                <span>{doneText}</span>
              </div>
              <button className="mini-action" type="button" onClick={() => setDoneText("")}>
                继续导入
              </button>
            </div>
          ) : (
            <button className="primary-btn share-import-submit" type="button" onClick={() => void handleImport()} disabled={isImporting}>
              <Upload size={16} />
              {isImporting ? "导入中…" : "添加到 LifeLog"}
            </button>
          )}
        </GlassCard>
      )}
    </section>
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
