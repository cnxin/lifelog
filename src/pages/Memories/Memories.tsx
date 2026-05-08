import { Heart, Plus, Image as ImageIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import CardActions from "../../components/CardActions";
import EntrySheet from "../../components/EntrySheet";
import GlassCard from "../../components/GlassCard";
import SearchBar from "../../components/SearchBar";
import Tags from "../../components/Tags";
import { useConfirm } from "../../context/ConfirmContext";
import { useLifeLog } from "../../context/LifeLogContext";
import { formatMonthDay } from "../../utils/date";
import { buildMemoryDisplayContext, getMemoryDisplayTitle, isManualTitle } from "../../utils/memoryDisplay";

export default function Memories() {
  const { state, getPersonName, getPlaceName, deleteEntry } = useLifeLog();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | undefined>();
  const [creatingNew, setCreatingNew] = useState(false);

  const memories = useMemo(() => {
    return [...state.memories]
      .sort((a, b) => b.date.localeCompare(a.date))
      .filter((memory) => {
        const ctx = buildMemoryDisplayContext(memory, getPersonName, getPlaceName);
        const content = [
          memory.title,
          getMemoryDisplayTitle(memory, ctx),
          memory.content,
          memory.mood,
          ctx.personNames.join(","),
          ctx.placeName,
          memory.tags.join(",")
        ].join(" ");
        return content.toLowerCase().includes(query.toLowerCase());
      });
  }, [getPersonName, getPlaceName, query, state.memories]);

  async function handleDelete(id: string) {
    const accepted = await confirm({
      title: "删除回忆",
      message: "确认删除这条回忆？",
      confirmText: "删除"
    });
    if (!accepted) return;
    await deleteEntry("memory", id);
  }

  return (
    <>
      <SearchBar value={query} placeholder="搜索回忆、人物、地点" onChange={setQuery} />
      <section className="section">
        <div className="list">
          {memories.map((memory) => {
            const ctx = buildMemoryDisplayContext(memory, getPersonName, getPlaceName);
            const displayTitle = getMemoryDisplayTitle(memory, ctx);
            const meta = [ctx.personNames.join("、"), ctx.placeName].filter(Boolean).join(" · ");
            const showContentLine = isManualTitle(memory) && memory.content.trim();
            return (
              <GlassCard className="memory-card" key={memory.id}>
                <button className="place-tap" onClick={() => navigate(`/memories/${memory.id}`)}>
                  <div className="memory-badge">
                    <Heart />
                  </div>
                </button>
                <div className="memory-info" onClick={() => navigate(`/memories/${memory.id}`)}>
                  <div className="memory-title">
                    <span>{displayTitle}</span>
                    <span className="place-rating">{formatMonthDay(memory.date)}</span>
                  </div>
                  {meta && <p className="memory-desc memory-meta-line">{meta}</p>}
                  {showContentLine && <p className="memory-desc">{memory.content}</p>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <Tags items={[memory.mood, ...memory.tags].filter(Boolean)} />
                    {memory.photos.length > 0 && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 8px',
                        borderRadius: '12px',
                        background: 'var(--soft-purple)',
                        color: 'var(--primary)',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>
                        <ImageIcon size={12} />
                        {memory.photos.length}
                      </span>
                    )}
                  </div>
                </div>
                <div className="person-side-actions">
                  <CardActions onEdit={() => setEditingId(memory.id)} onDelete={() => handleDelete(memory.id)} />
                </div>
              </GlassCard>
            );
          })}
          {!memories.length &&
            (state.memories.length === 0 ? (
              <GlassCard className="empty empty-cta">
                <p>还没有回忆记录</p>
                <button className="primary-btn" onClick={() => setCreatingNew(true)}>
                  <Plus size={16} /> 记录第一条回忆
                </button>
              </GlassCard>
            ) : (
              <GlassCard className="empty">没有找到匹配的回忆</GlassCard>
            ))}
        </div>
      </section>
      <EntrySheet type={editingId ? "memory" : null} itemId={editingId} onClose={() => setEditingId(undefined)} />
      <EntrySheet type={creatingNew ? "memory" : null} onClose={() => setCreatingNew(false)} />
    </>
  );
}
