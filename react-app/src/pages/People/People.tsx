import { Plus, RotateCcw, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import CardActions from "../../components/CardActions";
import EntrySheet from "../../components/EntrySheet";
import GlassCard from "../../components/GlassCard";
import SearchBar from "../../components/SearchBar";
import { useConfirm } from "../../context/ConfirmContext";
import { useLifeLog } from "../../context/LifeLogContext";
import { useToast } from "../../context/ToastContext";
import type { Person } from "../../types";
import { anniversaryRelativeLabel, anniversaryYearLabel, birthdayAgeLabel } from "../../utils/date";
import { buildRelationshipHealth, type RelationshipHealth } from "../../utils/relationshipHealth";
import { initials } from "../../utils/text";

type PeopleSortMode = "smart" | "recent" | "name";

export default function People() {
  const { state, deleteEntry, getDeleteSnapshot, restoreDeletedEntry, togglePersonFavorite } = useLifeLog();
  const confirm = useConfirm();
  const notify = useToast();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | undefined>();
  const [creatingNew, setCreatingNew] = useState(false);
  const [sortMode, setSortMode] = useState<PeopleSortMode>("smart");
  const normalizedQuery = query.trim().toLowerCase();

  const peopleRows = useMemo(() => {
    return state.people
      .filter((person) => {
        const content = [
          person.name,
          person.nickname,
          person.relationship,
          person.preferences.flatMap((group) => [group.category, ...group.items]).join(","),
          person.dislikes.flatMap((group) => [group.category, ...group.items]).join(","),
          person.notes
        ].join(" ");
        return content.toLowerCase().includes(normalizedQuery);
      })
      .map((person) => ({ person, health: buildRelationshipHealth(person.id, state.memories) }))
      .sort((left, right) => comparePeopleRows(left, right, sortMode));
  }, [normalizedQuery, sortMode, state.memories, state.people]);

  function clearSearch() {
    setQuery("");
  }

  async function handleDelete(id: string) {
    const accepted = await confirm({
      title: "删除人物",
      message: "确认删除这个人物？相关回忆中的人物关联也会被移除。",
      confirmText: "删除"
    });
    if (!accepted) return;
    const snapshot = await getDeleteSnapshot("person", id);
    await deleteEntry("person", id);
    if (snapshot) {
      notify({
        message: "人物已删除",
        tone: "info",
        actions: [
          {
            label: "撤销",
            onClick: async () => {
              await restoreDeletedEntry(snapshot);
              notify({ message: "人物已恢复", tone: "success" });
            }
          }
        ]
      });
    }
  }

  return (
    <>
      <SearchBar value={query} placeholder="搜索姓名、喜好、关系" onChange={setQuery} />
      <section className="section list-filter-section">
        <div className="list-filter-summary">
          <span>
            显示 {peopleRows.length} / {state.people.length} 个人物
          </span>
          {normalizedQuery && (
            <button type="button" onClick={clearSearch}>
              <RotateCcw /> 清除搜索
            </button>
          )}
        </div>
        <div className="list-sort-control" role="group" aria-label="人物排序">
          {peopleSortOptions.map((option) => (
            <button
              type="button"
              className={option.value === sortMode ? "active" : ""}
              key={option.value}
              onClick={() => setSortMode(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>
      <section className="section">
        <div className="list">
          {peopleRows.map(({ person, health }) => {
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
                    <button
                      type="button"
                      className={`favorite-toggle ${person.favorite ? "active" : ""}`}
                      aria-pressed={person.favorite}
                      aria-label={person.favorite ? "取消收藏" : "收藏"}
                      onClick={(event) => {
                        event.stopPropagation();
                        void togglePersonFavorite(person.id);
                      }}
                    >
                      <Star size={18} fill={person.favorite ? "currentColor" : "none"} />
                    </button>
                  </div>
                  <p className="person-desc">
                    {person.relationship} ·{" "}
                    {anniversary
                      ? `${anniversary.title}${anniversaryRelativeLabel(anniversary.date)} · ${anniversary.title === "生日" ? birthdayAgeLabel(anniversary.date) : anniversaryYearLabel(anniversary.date)}`
                      : "暂无纪念日"}
                  </p>
                  <div className="relationship-health-line">
                    <span className={`relationship-health-pill ${health.temperature}`}>{health.label}</span>
                    <span>{health.detail}</span>
                    {health.memoryCount > 0 && <span>{health.memoryCount} 条回忆</span>}
                  </div>
                  <PreferenceLines preferences={person.preferences} dislikes={person.dislikes} />
                </div>
                <div className="person-side-actions">
                  <CardActions onEdit={() => setEditingId(person.id)} onDelete={() => handleDelete(person.id)} />
                </div>
              </GlassCard>
            );
          })}
          {!peopleRows.length &&
            (state.people.length === 0 ? (
              <GlassCard className="empty empty-cta">
                <p>还没有人物记录</p>
                <button className="primary-btn" onClick={() => setCreatingNew(true)}>
                  <Plus size={16} /> 新增第一个人物
                </button>
              </GlassCard>
            ) : (
              <GlassCard className="empty empty-cta">
                <p>没有找到匹配的人物</p>
                <button className="primary-btn" onClick={clearSearch}>
                  <RotateCcw size={16} /> 清除搜索
                </button>
              </GlassCard>
            ))}
        </div>
      </section>
      <EntrySheet type={editingId ? "person" : null} itemId={editingId} onClose={() => setEditingId(undefined)} />
      <EntrySheet type={creatingNew ? "person" : null} onClose={() => setCreatingNew(false)} />
    </>
  );
}

const peopleSortOptions: Array<{ value: PeopleSortMode; label: string }> = [
  { value: "smart", label: "智能" },
  { value: "recent", label: "最近" },
  { value: "name", label: "名称" }
];

function comparePeopleRows(
  left: { person: Person; health: RelationshipHealth },
  right: { person: Person; health: RelationshipHealth },
  mode: PeopleSortMode
) {
  if (mode === "name") return comparePeopleName(left.person, right.person);

  if (mode === "recent") {
    return (
      compareDateDesc(left.health.latestDate, right.health.latestDate) ||
      compareFavorite(left.person.favorite, right.person.favorite) ||
      comparePeopleName(left.person, right.person)
    );
  }

  return (
    compareFavorite(left.person.favorite, right.person.favorite) ||
    compareDateDesc(left.health.latestDate, right.health.latestDate) ||
    right.health.memoryCount - left.health.memoryCount ||
    comparePeopleName(left.person, right.person)
  );
}

function compareFavorite(left: boolean, right: boolean) {
  return Number(right) - Number(left);
}

function compareDateDesc(left: string, right: string) {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return right.localeCompare(left);
}

function comparePeopleName(left: Person, right: Person) {
  const leftName = [left.name, left.nickname].filter(Boolean).join(" ");
  const rightName = [right.name, right.nickname].filter(Boolean).join(" ");
  return leftName.localeCompare(rightName, "zh-CN");
}

interface PreferenceGroupShape {
  category: string;
  items: string[];
}

function PreferenceLines({
  preferences,
  dislikes,
}: {
  preferences: PreferenceGroupShape[];
  dislikes: PreferenceGroupShape[];
}) {
  const hasContent = preferences.some((g) => g.items.length) || dislikes.some((g) => g.items.length);
  if (!hasContent) return null;

  return (
    <div className="person-pref-lines">
      {preferences
        .filter((g) => g.items.length)
        .slice(0, 2)
        .map((group) => (
          <div className="person-pref-line like" key={`like-${group.category}`}>
            <span className="person-pref-label">喜 · {group.category}</span>
            <span className="person-pref-items">{group.items.slice(0, 4).join("、")}</span>
          </div>
        ))}
      {dislikes
        .filter((g) => g.items.length)
        .slice(0, 1)
        .map((group) => (
          <div className="person-pref-line dislike" key={`dis-${group.category}`}>
            <span className="person-pref-label">忌 · {group.category}</span>
            <span className="person-pref-items">{group.items.slice(0, 4).join("、")}</span>
          </div>
        ))}
    </div>
  );
}
