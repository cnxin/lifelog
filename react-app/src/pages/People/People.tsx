import { ArrowDownUp, MapPin, Plus, RotateCcw, Star, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import CardActions from "../../components/CardActions";
import EntrySheet from "../../components/EntrySheet";
import GlassCard from "../../components/GlassCard";
import NotionSyncBadge from "../../components/NotionSyncBadge";
import PageSegmentNav from "../../components/PageSegmentNav";
import PersonPreferenceSheet, { type PersonPreferenceMode } from "../../components/PersonPreferenceSheet";
import SearchBar from "../../components/SearchBar";
import { useConfirm } from "../../context/ConfirmContext";
import { useLifeLog } from "../../context/LifeLogContext";
import { useToast } from "../../context/ToastContext";
import { usePersistentState } from "../../hooks/usePersistentState";
import type { Person } from "../../types";
import { anniversaryRelativeLabel, anniversaryYearLabel, buildBirthdayInfo, getWesternZodiacSign } from "../../utils/date";
import { buildRelationshipHealth, type RelationshipHealth } from "../../utils/relationshipHealth";
import { getNotionRecordSyncMeta } from "../../utils/notionStatus";
import { initials } from "../../utils/text";

type PeopleSortMode = "smart" | "recent" | "name";
interface PeopleFilterState {
  query: string;
  sortMode: PeopleSortMode;
}

export default function People() {
  const { state, notionSettings, notionPageMappings, notionSyncQueue, deleteEntry, getDeleteSnapshot, restoreDeletedEntry, togglePersonFavorite, updatePersonProfile } = useLifeLog();
  const confirm = useConfirm();
  const notify = useToast();
  const navigate = useNavigate();
  const [filters, setFilters] = usePersistentState<PeopleFilterState>(
    "lifelog:filters:people",
    { query: "", sortMode: "smart" },
    isPeopleFilterState
  );
  const [editingId, setEditingId] = useState<string | undefined>();
  const [creatingNew, setCreatingNew] = useState(false);
  const [preferenceEditor, setPreferenceEditor] = useState<{ personId: string; mode: PersonPreferenceMode } | null>(null);
  const query = filters.query;
  const sortMode = filters.sortMode;
  const normalizedQuery = query.trim().toLowerCase();
  const isCustomSort = sortMode !== "smart";
  const [sortOpen, setSortOpen] = useState(isCustomSort);

  const peopleRows = useMemo(() => {
    return state.people
      .filter((person) => {
        const content = [
          person.name,
          person.nickname,
          person.relationship,
          getWesternZodiacSign(person.birthday),
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
    setFilters({ query: "", sortMode: "smart" });
    setSortOpen(false);
  }

  function setQuery(query: string) {
    setFilters({ ...filters, query });
  }

  function setSortMode(sortMode: PeopleSortMode) {
    setFilters({ ...filters, sortMode });
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
      <PageSegmentNav
        ariaLabel="档案视图"
        items={[
          { to: "/people", label: "人物", icon: <Users />, end: true },
          { to: "/places", label: "地点", icon: <MapPin /> }
        ]}
      />
      <SearchBar value={query} placeholder="搜索姓名、喜好、关系" onChange={setQuery} />
      <section className="section list-filter-section compact-filter-section">
        <div className="list-filter-toolbar">
          <div className="list-filter-summary">
            <span>
              显示 {peopleRows.length} / {state.people.length} 个人物
            </span>
          </div>
          <div className="list-filter-actions">
            {(normalizedQuery || isCustomSort) && (
              <button className="filter-clear-button" type="button" onClick={clearSearch}>
                <RotateCcw /> 清除
              </button>
            )}
            <button
              aria-expanded={sortOpen}
              className={`filter-toggle-button ${sortOpen ? "active" : ""}`}
              type="button"
              onClick={() => setSortOpen((current) => !current)}
            >
              <ArrowDownUp />
              排序{isCustomSort ? ` · ${peopleSortOptions.find((option) => option.value === sortMode)?.label || ""}` : ""}
            </button>
          </div>
        </div>
        {isCustomSort && (
          <div className="list-filter-chips">
            <span>排序：{peopleSortOptions.find((option) => option.value === sortMode)?.label}</span>
          </div>
        )}
        {sortOpen && (
          <div className="advanced-filter-panel">
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
          </div>
        )}
      </section>
      <section className="section">
        <div className="list">
          {peopleRows.map(({ person, health }) => {
            const anniversary = person.anniversaries[0];
            const birthdayInfo = buildBirthdayInfo(person.birthday);
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
                    <NotionSyncBadge
                      compact
                      meta={getNotionRecordSyncMeta({
                        enabled: Boolean(notionSettings.enabled && notionSettings.peopleDatabaseId),
                        entityType: "person",
                        entityId: person.id,
                        mappings: notionPageMappings,
                        queue: notionSyncQueue
                      })}
                    />
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
                      ? `${anniversary.title === "生日" && birthdayInfo ? birthdayInfo.listText : `${anniversary.title}${anniversaryRelativeLabel(anniversary.date)} · ${anniversaryYearLabel(anniversary.date)}`}`
                      : "暂无纪念日"}
                  </p>
                  <div className="relationship-health-line">
                    <span className={`relationship-health-pill ${health.temperature}`}>{health.label}</span>
                    <span>{health.detail}</span>
                    {health.memoryCount > 0 && <span>{health.memoryCount} 条回忆</span>}
                  </div>
                  <PreferenceLines
                    preferences={person.preferences}
                    dislikes={person.dislikes}
                    onEdit={(mode) => setPreferenceEditor({ personId: person.id, mode })}
                  />
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
      <PersonPreferenceSheet
        person={state.people.find((person) => person.id === preferenceEditor?.personId) || null}
        mode={preferenceEditor?.mode || "preferences"}
        onClose={() => setPreferenceEditor(null)}
        onSave={async (personId, patch) => {
          await updatePersonProfile(personId, patch);
          notify({ message: preferenceEditor?.mode === "dislikes" ? "雷区已更新" : "喜好档案已更新", tone: "success" });
        }}
      />
    </>
  );
}

const peopleSortOptions: Array<{ value: PeopleSortMode; label: string }> = [
  { value: "smart", label: "智能" },
  { value: "recent", label: "最近" },
  { value: "name", label: "名称" }
];

function isPeopleFilterState(value: unknown): value is PeopleFilterState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PeopleFilterState>;
  return (
    typeof candidate.query === "string" &&
    ["smart", "recent", "name"].includes(String(candidate.sortMode))
  );
}

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
  onEdit
}: {
  preferences: PreferenceGroupShape[];
  dislikes: PreferenceGroupShape[];
  onEdit: (mode: PersonPreferenceMode) => void;
}) {
  const preferenceCount = countPreferenceItems(preferences);
  const dislikeCount = countPreferenceItems(dislikes);

  return (
    <div className="person-pref-lines">
      <PreferenceLineButton
        mode="preferences"
        tone="like"
        label="喜好档案"
        text={preferenceCount ? `${preferenceCount} 项` : "未填写"}
        onEdit={onEdit}
      />
      <PreferenceLineButton
        mode="dislikes"
        tone="dislike"
        label="禁忌雷区"
        text={dislikeCount ? `${dislikeCount} 项` : "未填写"}
        onEdit={onEdit}
      />
    </div>
  );
}

function countPreferenceItems(groups: PreferenceGroupShape[]) {
  return groups.reduce((total, group) => total + group.items.length, 0);
}

function PreferenceLineButton({
  mode,
  tone,
  label,
  text,
  onEdit
}: {
  mode: PersonPreferenceMode;
  tone: "like" | "dislike";
  label: string;
  text: string;
  onEdit: (mode: PersonPreferenceMode) => void;
}) {
  return (
    <button
      className={`person-pref-line person-pref-edit-area ${tone}`}
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onEdit(mode);
      }}
    >
      <span className="person-pref-label">{label}</span>
      <span className="person-pref-items">{text}</span>
    </button>
  );
}
