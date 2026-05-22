import { useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import GlassCard from "./GlassCard";
import MemoryCard from "./MemoryCard";
import type { MemoryDisplayContext, MemoryEvent } from "../types";
import { buildMemoryDisplayContext, compactPlaceNames } from "../utils/memoryDisplay";

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
                  const defaultRenderMeta = (item: MemoryEvent, itemCtx: MemoryDisplayContext, showContentLine: boolean) => (
                    <>
                      <p className="memory-desc memory-meta-line">{compactPlaceNames(itemCtx.placeNames) || "未关联地点"}</p>
                      {showContentLine && <p className="memory-desc">{item.content}</p>}
                    </>
                  );
                  return (
                    <MemoryCard
                      key={memory.id}
                      memory={memory}
                      ctx={ctx}
                      icon="♡"
                      onOpen={() => navigate(`/memories/${memory.id}`)}
                      renderMeta={renderMeta || defaultRenderMeta}
                    />
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
