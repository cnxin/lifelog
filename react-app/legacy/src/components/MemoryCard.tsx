import { ChevronDown, Heart, Image as ImageIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import ListRow from "./ListRow";
import MemoryTags from "./MemoryTags";
import MemoryThumb from "./MemoryThumb";
import NotionSyncBadge from "./NotionSyncBadge";
import type { MemoryDisplayContext, MemoryEvent } from "../types";
import { formatMonthDay } from "../utils/date";
import {
  buildMemoryMetaLine,
  getMemoryKindLabel,
  getMemoryDisplayTitle,
  isMemoryPlan,
  isManualTitle
} from "../utils/memoryDisplay";
import type { NotionRecordSyncMeta } from "../utils/notionStatus";

interface MemoryCardProps {
  memory: MemoryEvent;
  ctx: MemoryDisplayContext;
  onOpen: () => void;
  actions?: ReactNode;
  className?: string;
  renderMeta?: (memory: MemoryEvent, ctx: MemoryDisplayContext, showContentLine: boolean) => ReactNode;
  showPhotoCount?: boolean;
  icon?: ReactNode;
  syncMeta?: NotionRecordSyncMeta;
  collapseExtras?: boolean;
  dense?: boolean;
  selectionControl?: ReactNode;
  /** Soft glass-style thumb in detailed (non-dense) list mode */
  showThumb?: boolean;
}

export default function MemoryCard({
  memory,
  ctx,
  onOpen,
  actions,
  className = "",
  renderMeta,
  showPhotoCount = false,
  icon,
  syncMeta,
  collapseExtras = false,
  dense = false,
  selectionControl,
  showThumb = false
}: MemoryCardProps) {
  const [extrasOpen, setExtrasOpen] = useState(false);
  const displayTitle = getMemoryDisplayTitle(memory, ctx);
  const showContentLine = isManualTitle(memory) && Boolean(memory.content.trim());
  const meta = buildMemoryMetaLine(ctx);
  const photoCount = (memory.photos || []).length;
  const kindLabel = getMemoryKindLabel(memory);
  const hasTags = Boolean(memory.mood?.trim() || (memory.tags || []).length);
  const hasCollapsedExtras = !dense && collapseExtras && (showContentLine || hasTags || (showPhotoCount && photoCount > 0));
  const useSoftThumb = showThumb && !dense;

  return (
    <ListRow className={`memory-card ${isMemoryPlan(memory) ? "memory-card-plan" : ""} ${collapseExtras ? "compact-memory-card" : ""} ${dense ? "dense-memory-card" : ""} ${useSoftThumb ? "has-thumb" : ""} ${extrasOpen ? "extras-open" : ""} ${className}`}>
      {selectionControl}
      <button className="place-tap" onClick={onOpen} type="button">
        {useSoftThumb ? <MemoryThumb memory={memory} enabled /> : <div className="memory-badge">{icon || <Heart />}</div>}
      </button>
      <div className="memory-info" onClick={onOpen}>
        <div className="memory-title">
          <span>{displayTitle}</span>
          <span className="place-title-actions">
            {syncMeta ? <NotionSyncBadge compact meta={syncMeta} /> : null}
            <span className={`memory-kind-pill ${isMemoryPlan(memory) ? "plan" : "memory"}`}>{kindLabel}</span>
            <span className="place-rating">{formatMonthDay(memory.date)}</span>
          </span>
        </div>
        {renderMeta ? (
          renderMeta(memory, ctx, showContentLine)
        ) : (
          <>
            {meta && <p className="memory-desc memory-meta-line">{meta}</p>}
            {!collapseExtras && showContentLine && <p className="memory-desc">{memory.content}</p>}
          </>
        )}
        {dense && hasCollapsedExtras && (
          <div className="memory-tags-line dense-tags-line">
            <MemoryTags mood={memory.mood} tags={(memory.tags || []).slice(0, 2)} />
            {showPhotoCount && photoCount > 0 && (
              <span className="memory-photo-count">
                <ImageIcon size={12} />
                {photoCount}
              </span>
            )}
          </div>
        )}
        {!collapseExtras && !dense && (
          <div className="memory-tags-line">
            <MemoryTags mood={memory.mood} tags={memory.tags || []} />
            {showPhotoCount && photoCount > 0 && (
              <span className="memory-photo-count">
                <ImageIcon size={12} />
                {photoCount}
              </span>
            )}
          </div>
        )}
        {hasCollapsedExtras && (
          <button
            className="memory-card-extra-toggle"
            type="button"
            aria-expanded={extrasOpen}
            onClick={(event) => {
              event.stopPropagation();
              setExtrasOpen((open) => !open);
            }}
          >
            {extrasOpen ? "收起详情" : "详情"}
            <ChevronDown />
          </button>
        )}
        {collapseExtras && extrasOpen && (
          <div className="memory-card-extra">
            {showContentLine && <p className="memory-desc">{memory.content}</p>}
            <div className="memory-tags-line">
              <MemoryTags mood={memory.mood} tags={memory.tags || []} />
              {showPhotoCount && photoCount > 0 && (
                <span className="memory-photo-count">
                  <ImageIcon size={12} />
                  {photoCount}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
      {actions && <div className="person-side-actions">{actions}</div>}
    </ListRow>
  );
}
