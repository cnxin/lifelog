import { useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import GlassCard from "./GlassCard";
import Tags from "./Tags";
import type { MemoryDisplayContext, MemoryEvent } from "../types";
import { formatMonthDay } from "../utils/date";
import {
  buildMemoryDisplayContext,
  getMemoryDisplayTitle,
  isManualTitle,
} from "../utils/memoryDisplay";

interface MemoryTimelineSectionProps {
  title: string;
  groupedMemories: Array<{ month: string; memories: MemoryEvent[] }>;
  getPersonName: (id: string) => string;
  getPlaceName: (id: string) => string;
  onAddMemory: () => void;
  emptyTitle: string;
  emptyDesc: string;
  emptyAction: string;
  /** 自定义每张卡片的 meta 行渲染（默认显示地点） */
  renderMeta?: (memory: MemoryEvent, ctx: MemoryDisplayContext, showContentLine: boolean) => ReactNode;
}

export default function MemoryTimelineSection({
  title,
  groupedMemories,
  getPersonName,
  getPlaceName,
  onAddMemory,
  emptyTitle,
  emptyDesc,
  emptyAction,
  renderMeta,
}: MemoryTimelineSectionProps) {
  const navigate = useNavigate();

  return (
    <section className="section person-detail-section">
      <div className="section-header">
        <h2>{title}</h2>
        <button className="see-all" onClick={onAddMemory}>
          新增
        </button>
      </div>
      {groupedMemories.length ? (
        <div className="timeline-list">
          {groupedMemories.map((group) => (
            <div className="timeline-month" key={group.month}>
              <div className="timeline-month-title">{group.month}</div>
              <div className="list">
                {group.memories.map((memory) => {
                  const ctx = buildMemoryDisplayContext(memory, getPersonName, getPlaceName);
                  const displayTitle = getMemoryDisplayTitle(memory, ctx);
                  const showContentLine = isManualTitle(memory) && Boolean(memory.content.trim());
                  return (
                    <GlassCard className="memory-card" key={memory.id}>
                      <div className="memory-badge">♡</div>
                      <div
                        className="memory-info"
                        onClick={() => navigate(`/memories/${memory.id}`)}
                      >
                        <div className="memory-title">
                          <span>{displayTitle}</span>
                          <span className="place-rating">{formatMonthDay(memory.date)}</span>
                        </div>
                        {renderMeta ? (
                          renderMeta(memory, ctx, showContentLine)
                        ) : (
                          <>
                            <p className="memory-desc memory-meta-line">{ctx.placeName || "未关联地点"}</p>
                            {showContentLine && <p className="memory-desc">{memory.content}</p>}
                          </>
                        )}
                        <div className="memory-tags-line">
                          <Tags items={[memory.mood, ...(memory.tags || [])].filter(Boolean)} />
                        </div>
                      </div>
                    </GlassCard>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <GlassCard className="empty detail-empty-action">
          <strong>{emptyTitle}</strong>
          <span>{emptyDesc}</span>
          <button onClick={onAddMemory}>{emptyAction}</button>
        </GlassCard>
      )}
    </section>
  );
}
