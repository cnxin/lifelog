import { Plus, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import CardActions from "../../components/CardActions";
import EntrySheet from "../../components/EntrySheet";
import GlassCard from "../../components/GlassCard";
import MemoryCard from "../../components/MemoryCard";
import SearchBar from "../../components/SearchBar";
import SelectPicker from "../../components/SelectPicker";
import { useConfirm } from "../../context/ConfirmContext";
import { useLifeLog } from "../../context/LifeLogContext";
import { useToast } from "../../context/ToastContext";
import type { MemoryEvent } from "../../types";
import { buildMemoryDisplayContext, getMemoryDisplayTitle } from "../../utils/memoryDisplay";
import { getMemoryPlaceIds } from "../../utils/memoryPlaces";
import { groupMemoriesByMonth } from "../../utils/detailHelpers";

export default function Memories() {
  const { state, getPersonName, getPlaceName, deleteEntry, getDeleteSnapshot, restoreDeletedEntry } = useLifeLog();
  const confirm = useConfirm();
  const notify = useToast();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [personFilter, setPersonFilter] = useState("");
  const [placeFilter, setPlaceFilter] = useState("");
  const [moodFilter, setMoodFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [editingId, setEditingId] = useState<string | undefined>();
  const [creatingNew, setCreatingNew] = useState(false);

  const filterOptions = useMemo(() => buildFilterOptions(state.memories, getPersonName, getPlaceName), [state.memories, getPersonName, getPlaceName]);
  const hasActiveFilters = Boolean(query.trim() || personFilter || placeFilter || moodFilter || tagFilter);
  const activeFilterLabels = buildActiveFilterLabels({
    query: query.trim(),
    person: personFilter ? getPersonName(personFilter) : "",
    place: placeFilter ? getPlaceName(placeFilter) : "",
    mood: moodFilter,
    tag: tagFilter
  });

  const memories = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

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
          (memory.tags || []).join(",")
        ].join(" ").toLowerCase();

        if (normalizedQuery && !content.includes(normalizedQuery)) return false;
        if (personFilter && !(memory.personIds || []).includes(personFilter)) return false;
        if (placeFilter && !getMemoryPlaceIds(memory).includes(placeFilter)) return false;
        if (moodFilter && memory.mood !== moodFilter) return false;
        if (tagFilter && !(memory.tags || []).includes(tagFilter)) return false;
        return true;
      });
  }, [getPersonName, getPlaceName, moodFilter, personFilter, placeFilter, query, state.memories, tagFilter]);
  const groupedMemories = useMemo(() => groupMemoriesByMonth(memories), [memories]);
  const yearAnchors = useMemo(() => buildYearAnchors(groupedMemories), [groupedMemories]);

  async function handleDelete(id: string) {
    const accepted = await confirm({
      title: "删除回忆",
      message: "确认删除这条回忆？",
      confirmText: "删除"
    });
    if (!accepted) return;
    const snapshot = await getDeleteSnapshot("memory", id);
    await deleteEntry("memory", id);
    if (snapshot) {
      notify({
        message: "回忆已删除",
        tone: "info",
        actions: [
          {
            label: "撤销",
            onClick: async () => {
              await restoreDeletedEntry(snapshot);
              notify({ message: "回忆已恢复", tone: "success" });
            }
          }
        ]
      });
    }
  }

  function clearFilters() {
    setQuery("");
    setPersonFilter("");
    setPlaceFilter("");
    setMoodFilter("");
    setTagFilter("");
  }

  return (
    <>
      <SearchBar value={query} placeholder="搜索标题、正文、人物、地点、心情或标签" onChange={setQuery} />
      <section className="section memory-filter-section">
        <div className="memory-filter-grid">
          <SelectPicker
            label="筛选人物"
            value={personFilter}
            onChange={setPersonFilter}
            placeholder="全部人物"
            options={[{ value: "", label: "全部人物" }, ...filterOptions.people]}
          />
          <SelectPicker
            label="筛选地点"
            value={placeFilter}
            onChange={setPlaceFilter}
            placeholder="全部地点"
            options={[{ value: "", label: "全部地点" }, ...filterOptions.places]}
          />
          <SelectPicker
            label="筛选心情"
            value={moodFilter}
            onChange={setMoodFilter}
            placeholder="全部心情"
            options={[{ value: "", label: "全部心情" }, ...filterOptions.moods]}
          />
          <SelectPicker
            label="筛选标签"
            value={tagFilter}
            onChange={setTagFilter}
            placeholder="全部标签"
            options={[{ value: "", label: "全部标签" }, ...filterOptions.tags]}
          />
        </div>
        <div className="memory-filter-summary">
          <span>
            显示 {memories.length} / {state.memories.length} 条回忆
          </span>
          {hasActiveFilters && (
            <button type="button" onClick={clearFilters}>
              <RotateCcw /> 清除筛选
            </button>
          )}
        </div>
        {activeFilterLabels.length > 0 && (
          <div className="list-filter-chips">
            {activeFilterLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        )}
      </section>
      <section className="section">
        {yearAnchors.length > 1 && (
          <div className="memory-year-jump">
            {yearAnchors.map((anchor) => (
              <a href={`#memory-year-${anchor}`} key={anchor}>
                {anchor}
              </a>
            ))}
          </div>
        )}
        <div className="memory-timeline-list">
          {groupedMemories.map((group) => {
            const year = extractYear(group.month);
            return (
              <div className="memory-timeline-month" id={isFirstYearGroup(groupedMemories, group.month) ? `memory-year-${year}` : undefined} key={group.month}>
                <div className="memory-timeline-title">
                  <strong>{group.month}</strong>
                  <span>{group.memories.length} 条</span>
                </div>
                <div className="list">
                  {group.memories.map((memory) => {
                    const ctx = buildMemoryDisplayContext(memory, getPersonName, getPlaceName);
                    return (
                      <MemoryCard
                        key={memory.id}
                        memory={memory}
                        ctx={ctx}
                        onOpen={() => navigate(`/memories/${memory.id}`)}
                        showPhotoCount
                        actions={<CardActions onEdit={() => setEditingId(memory.id)} onDelete={() => handleDelete(memory.id)} />}
                      />
                    );
                  })}
                </div>
              </div>
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
              <GlassCard className="empty empty-cta">
                <p>没有找到匹配的回忆</p>
                <button className="primary-btn" onClick={clearFilters}>
                  <RotateCcw size={16} /> 清除筛选
                </button>
              </GlassCard>
            ))}
        </div>
      </section>
      <EntrySheet type={editingId ? "memory" : null} itemId={editingId} onClose={() => setEditingId(undefined)} />
      <EntrySheet type={creatingNew ? "memory" : null} memoryMode="quick" onClose={() => setCreatingNew(false)} />
    </>
  );
}

function buildYearAnchors(groups: Array<{ month: string; memories: MemoryEvent[] }>) {
  return Array.from(new Set(groups.map((group) => extractYear(group.month)).filter(Boolean)));
}

function extractYear(monthLabel: string) {
  const match = monthLabel.match(/\d{4}/);
  return match?.[0] || monthLabel;
}

function isFirstYearGroup(groups: Array<{ month: string; memories: MemoryEvent[] }>, month: string) {
  const year = extractYear(month);
  return groups.find((group) => extractYear(group.month) === year)?.month === month;
}

function buildActiveFilterLabels(filters: {
  query: string;
  person: string;
  place: string;
  mood: string;
  tag: string;
}) {
  return [
    filters.query ? `搜索：${filters.query}` : "",
    filters.person ? `人物：${filters.person}` : "",
    filters.place ? `地点：${filters.place}` : "",
    filters.mood ? `心情：${filters.mood}` : "",
    filters.tag ? `标签：${filters.tag}` : ""
  ].filter(Boolean);
}

function buildFilterOptions(memories: MemoryEvent[], getPersonName: (id: string) => string, getPlaceName: (id: string) => string) {
  const people = new Map<string, string>();
  const places = new Map<string, string>();
  const moods = new Set<string>();
  const tags = new Set<string>();

  memories.forEach((memory) => {
    (memory.personIds || []).forEach((personId) => {
      const name = getPersonName(personId);
      if (name) people.set(personId, name);
    });
    getMemoryPlaceIds(memory).forEach((placeId) => {
      const placeName = getPlaceName(placeId);
      if (placeName) places.set(placeId, placeName);
    });
    if (memory.mood) moods.add(memory.mood);
    (memory.tags || []).filter(Boolean).forEach((tag) => tags.add(tag));
  });

  return {
    people: mapToOptions(people),
    places: mapToOptions(places),
    moods: setToOptions(moods),
    tags: setToOptions(tags)
  };
}

function mapToOptions(items: Map<string, string>) {
  return Array.from(items, ([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "zh-CN"));
}

function setToOptions(items: Set<string>) {
  return Array.from(items)
    .sort((a, b) => a.localeCompare(b, "zh-CN"))
    .map((item) => ({ value: item, label: item }));
}
