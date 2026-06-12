import { Heart, Image as ImageIcon } from "lucide-react";
import type { ReactNode } from "react";
import GlassCard from "./GlassCard";
import MemoryTags from "./MemoryTags";
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
  renderMeta?: (memory: MemoryEvent, ctx: MemoryDisplayContext, showContentLine: boolean) => ReactNode;
  showPhotoCount?: boolean;
  icon?: ReactNode;
  syncMeta?: NotionRecordSyncMeta;
}

export default function MemoryCard({
  memory,
  ctx,
  onOpen,
  actions,
  renderMeta,
  showPhotoCount = false,
  icon,
  syncMeta
}: MemoryCardProps) {
  const displayTitle = getMemoryDisplayTitle(memory, ctx);
  const showContentLine = isManualTitle(memory) && Boolean(memory.content.trim());
  const meta = buildMemoryMetaLine(ctx);
  const photoCount = (memory.photos || []).length;
  const kindLabel = getMemoryKindLabel(memory);

  return (
    <GlassCard className={`memory-card ${isMemoryPlan(memory) ? "memory-card-plan" : ""}`}>
      <button className="place-tap" onClick={onOpen} type="button">
        <div className="memory-badge">{icon || <Heart />}</div>
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
            {showContentLine && <p className="memory-desc">{memory.content}</p>}
          </>
        )}
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
      {actions && <div className="person-side-actions">{actions}</div>}
    </GlassCard>
  );
}
