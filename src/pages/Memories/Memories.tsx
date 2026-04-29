import { Heart } from "lucide-react";
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

export default function Memories() {
  const { state, getPersonName, getPlaceName, deleteEntry } = useLifeLog();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | undefined>();

  const memories = useMemo(() => {
    return [...state.memories]
      .sort((a, b) => b.date.localeCompare(a.date))
      .filter((memory) => {
        const content = [
          memory.title,
          memory.content,
          memory.mood,
          memory.personIds.map(getPersonName).join(","),
          getPlaceName(memory.placeId),
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
          {memories.map((memory) => (
            <GlassCard className="memory-card" key={memory.id}>
              <button className="place-tap" onClick={() => navigate(`/memories/${memory.id}`)}>
                <div className="memory-badge">
                <Heart />
                </div>
              </button>
              <div className="memory-info" onClick={() => navigate(`/memories/${memory.id}`)}>
                <div className="memory-title">
                  <span>{memory.title}</span>
                  <span className="place-rating">{formatMonthDay(memory.date)}</span>
                </div>
                <p className="memory-desc">
                  {memory.personIds.map(getPersonName).join("、")} · {getPlaceName(memory.placeId)}
                </p>
                <p className="memory-desc">{memory.content}</p>
                <Tags items={[memory.mood, ...memory.tags]} />
              </div>
              <div className="person-side-actions">
                <CardActions onEdit={() => setEditingId(memory.id)} onDelete={() => handleDelete(memory.id)} />
              </div>
            </GlassCard>
          ))}
          {!memories.length && <GlassCard className="empty">没有找到回忆</GlassCard>}
        </div>
      </section>
      <EntrySheet type={editingId ? "memory" : null} itemId={editingId} onClose={() => setEditingId(undefined)} />
    </>
  );
}
