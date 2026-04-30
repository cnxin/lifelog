import { Star } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import CardActions from "../../components/CardActions";
import EntrySheet from "../../components/EntrySheet";
import GlassCard from "../../components/GlassCard";
import SearchBar from "../../components/SearchBar";
import Tags from "../../components/Tags";
import { useConfirm } from "../../context/ConfirmContext";
import { useLifeLog } from "../../context/LifeLogContext";
import { anniversaryRelativeLabel, anniversaryYearLabel, formatLunarDate } from "../../utils/date";
import { groupSummary, initials } from "../../utils/text";

export default function People() {
  const { state, deleteEntry } = useLifeLog();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | undefined>();

  const people = useMemo(() => {
    return state.people.filter((person) => {
      const content = [
        person.name,
        person.nickname,
        person.relationship,
        person.preferences.flatMap((group) => [group.category, ...group.items]).join(","),
        person.dislikes.flatMap((group) => [group.category, ...group.items]).join(","),
        person.notes
      ].join(" ");
      return content.toLowerCase().includes(query.toLowerCase());
    });
  }, [query, state.people]);

  async function handleDelete(id: string) {
    const accepted = await confirm({
      title: "删除人物",
      message: "确认删除这个人物？相关回忆中的人物关联也会被移除。",
      confirmText: "删除"
    });
    if (!accepted) return;
    await deleteEntry("person", id);
  }

  return (
    <>
      <SearchBar value={query} placeholder="搜索姓名、喜好、关系" onChange={setQuery} />
      <section className="section">
        <div className="list">
          {people.map((person) => {
            const anniversary = person.anniversaries[0];
            return (
              <GlassCard className="person-card" key={person.id}>
                <button className="person-open" onClick={() => navigate(`/people/${person.id}`)}>
                  <div className="person-photo">{initials(person.name)}</div>
                </button>
                <div className="person-info" onClick={() => navigate(`/people/${person.id}`)}>
                  <div className="person-name">
                    <span>
                      {person.name}
                      {person.nickname ? ` · ${person.nickname}` : ""}
                    </span>
                    {person.favorite && <Star />}
                  </div>
                  <p className="person-desc">
                    {person.relationship} ·{" "}
                    {anniversary
                      ? `${anniversary.title}${anniversaryRelativeLabel(anniversary.date)} · ${anniversaryYearLabel(anniversary.date)} · ${formatLunarDate(anniversary.date)}`
                      : "暂无纪念日"}
                  </p>
                  <Tags items={[...groupSummary(person.preferences, 3), ...groupSummary(person.dislikes, 1)]} />
                </div>
                <div className="person-side-actions">
                  <CardActions onEdit={() => setEditingId(person.id)} onDelete={() => handleDelete(person.id)} />
                </div>
              </GlassCard>
            );
          })}
          {!people.length && <GlassCard className="empty">没有找到人物</GlassCard>}
        </div>
      </section>
      <EntrySheet type={editingId ? "person" : null} itemId={editingId} onClose={() => setEditingId(undefined)} />
    </>
  );
}
