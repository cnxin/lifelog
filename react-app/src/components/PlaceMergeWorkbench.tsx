import { useMemo, useState } from "react";
import type { Place, PlaceMergePreview } from "../types";
import { buildPlaceDisplayName, buildPlaceGeoLine } from "../utils/placeMeta";

interface PlaceMergeWorkbenchProps {
  preview: PlaceMergePreview;
  title: string;
  confirmLabel: string;
  cancelLabel?: string;
  keepBothLabel?: string;
  allowKeepBoth?: boolean;
  onCancel: () => void;
  onConfirm: (preview: PlaceMergePreview) => void;
  onKeepBoth?: () => void;
}

export default function PlaceMergeWorkbench({
  preview,
  title,
  confirmLabel,
  cancelLabel = "取消",
  keepBothLabel = "保留两条",
  allowKeepBoth = false,
  onCancel,
  onConfirm,
  onKeepBoth,
}: PlaceMergeWorkbenchProps) {
  const incoming = preview.sources[0];
  const [mergedDraft, setMergedDraft] = useState(preview.merged);

  const nextPreview = useMemo(
    () => ({
      ...preview,
      merged: mergedDraft,
    }),
    [mergedDraft, preview],
  );

  function updateMerged<K extends keyof Place>(key: K, value: Place[K]) {
    setMergedDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="merge-preview">
      <div className="merge-preview-head">
        <div>
          <span className={`merge-badge ${preview.strength}`}>
            {preview.strength === "strong" ? "强重复" : "疑似重复"}
          </span>
          <h3>{title}</h3>
        </div>
        <p>{preview.reason}</p>
      </div>

      {!!preview.details.length && (
        <div className="merge-reason-list">
          {preview.details.map((detail) => (
            <p key={detail}>{detail}</p>
          ))}
        </div>
      )}

      <div className="merge-preview-grid">
        <PlaceMergeCard title="已有地点" place={preview.canonical} />
        <PlaceMergeCard title="本次记录" place={incoming} />
        <PlaceMergeDraftCard place={mergedDraft} onChange={updateMerged} />
      </div>

      <div className="submit-row merge-preview-actions">
        <button type="button" className="ghost-btn" onClick={onCancel}>
          {cancelLabel}
        </button>
        {allowKeepBoth && onKeepBoth && (
          <button type="button" className="ghost-btn" onClick={onKeepBoth}>
            {keepBothLabel}
          </button>
        )}
        <button type="button" className="primary-btn" onClick={() => onConfirm(nextPreview)}>
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}

function PlaceMergeCard({
  title,
  place,
  highlight = false,
}: {
  title: string;
  place: Place;
  highlight?: boolean;
}) {
  return (
    <div className={`merge-preview-card ${highlight ? "highlight" : ""}`}>
      <span className="merge-preview-label">{title}</span>
      <strong>{buildPlaceDisplayName(place) || place.name}</strong>
      <p>{buildPlaceGeoLine(place)}</p>
      <p>{[place.area, place.mall].filter(Boolean).join(" · ") || "未设置区域"}</p>
      <p>{place.address || place.desc || "未补充地址和备注"}</p>
      <div className="merge-preview-meta">
        <span>{place.category || "其他"}</span>
        <span>{place.storeName || "无店铺信息"}</span>
      </div>
    </div>
  );
}

function PlaceMergeDraftCard({
  place,
  onChange,
}: {
  place: Place;
  onChange: <K extends keyof Place>(key: K, value: Place[K]) => void;
}) {
  return (
    <div className="merge-preview-card highlight">
      <span className="merge-preview-label">合并后</span>
      <div className="merge-edit-grid">
        <label>
          地点名称
          <input value={place.name} onChange={(event) => onChange("name", event.target.value)} />
        </label>
        <label>
          店铺 / 场所
          <input value={place.storeName} onChange={(event) => onChange("storeName", event.target.value)} />
        </label>
        <label>
          商场 / 园区
          <input value={place.mall} onChange={(event) => onChange("mall", event.target.value)} />
        </label>
        <label>
          区 / 商圈
          <input value={place.area} onChange={(event) => onChange("area", event.target.value)} />
        </label>
      </div>
      <label>
        详细地址
        <input value={place.address} onChange={(event) => onChange("address", event.target.value)} />
      </label>
      <label>
        备注
        <textarea value={place.desc} onChange={(event) => onChange("desc", event.target.value)} />
      </label>
      <label>
        标签
        <input
          value={place.tags.join("，")}
          onChange={(event) =>
            onChange(
              "tags",
              event.target.value
                .split(/[，,]/)
                .map((item) => item.trim())
                .filter(Boolean),
            )
          }
        />
      </label>
      <div className="merge-preview-meta">
        <span>{place.category || "其他"}</span>
        <span>{buildPlaceGeoLine(place)}</span>
      </div>
    </div>
  );
}
