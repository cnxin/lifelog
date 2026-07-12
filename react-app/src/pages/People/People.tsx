import { ArrowDownUp, CheckSquare, Download, MapPin, Plus, RotateCcw, Square, Star, Trash2, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import BatchActionToolbar from "../../components/BatchActionToolbar";
import EmptyState from "../../components/EmptyState";
import CardActions from "../../components/CardActions";
import EntrySheet from "../../components/EntrySheet";
import GlassCard from "../../components/GlassCard";
import ListViewModeToggle from "../../components/ListViewModeToggle";
import NotionSyncBadge from "../../components/NotionSyncBadge";
import PageSegmentNav from "../../components/PageSegmentNav";
import PersonPreferenceSheet, { type PersonPreferenceMode } from "../../components/PersonPreferenceSheet";
import SearchBar from "../../components/SearchBar";
import { useConfirm } from "../../context/ConfirmContext";
import { useLifeLog } from "../../context/LifeLogContext";
import { useToast } from "../../context/ToastContext";
import { usePersistentState } from "../../hooks/usePersistentState";
import { useUserPreferences } from "../../hooks/useUserPreferences";
import type { LifeLogState, Person } from "../../types";
import { anniversaryRelativeLabel, anniversaryYearLabel, buildBirthdayInfo, getWesternZodiacSign } from "../../utils/date";
import { buildRelationshipHealth, type RelationshipHealth } from "../../utils/relationshipHealth";
import { getNotionRecordSyncMeta } from "../../utils/notionStatus";
import { initials } from "../../utils/text";
import { saveReadableFile } from "../../utils/backupExport";
import { buildReadableMarkdownForSelection } from "../../utils/readableExport";

type PeopleSortMode = "smart" | "recent" | "name";
interface PeopleFilterState {
  query: string;
  sortMode: PeopleSortMode;
}

export default function People() {
  const {
    state,
    notionSettings,
    notionPageMappings,
    notionSyncQueue,
    deleteEntry,
    getDeleteSnapshot,
    restoreDeletedEntry,
    togglePersonFavorite,
    updatePersonProfile,
    updatePeopleBulk,
    restorePeopleBulk
  } = useLifeLog();
  const confirm = useConfirm();
  const notify = useToast();
  const navigate = useNavigate();
  const { prefs, updatePreference } = useUserPreferences();
  const [filters, setFilters] = usePersistentState<PeopleFilterState>(
    "lifelog:filters:people",
    { query: "", sortMode: "smart" },
    isPeopleFilterState
  );
  const [editingId, setEditingId] = useState<string | undefined>();
  const [creatingNew, setCreatingNew] = useState(false);
  const [preferenceEditor, setPreferenceEditor] = useState<{ personId: string; mode: PersonPreferenceMode } | null>(null);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const query = filters.query;
  const sortMode = filters.sortMode;
  const normalizedQuery = query.trim().toLowerCase();
  const isCustomSort = sortMode !== "smart";
  const [sortOpen, setSortOpen] = useState(isCustomSort);
  const denseList = prefs.listViewMode === "compact";

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
  const selectablePersonIds = useMemo(() => peopleRows.map(({ person }) => person.id), [peopleRows]);
  const selectedPersonCount = selectedPersonIds.length;
  const allVisiblePeopleSelected =
    selectablePersonIds.length > 0 &&
    selectedPersonCount === selectablePersonIds.length &&
    selectablePersonIds.every((id) => selectedPersonIds.includes(id));

  useEffect(() => {
    if (!batchMode) return;
    const visibleIdSet = new Set(selectablePersonIds);
    setSelectedPersonIds((current) => current.filter((id) => visibleIdSet.has(id)));
  }, [batchMode, selectablePersonIds]);

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

  function togglePersonSelection(id: string) {
    setSelectedPersonIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function closeBatchMode() {
    setBatchMode(false);
    setSelectedPersonIds([]);
  }

  async function handleBatchDeletePeople() {
    if (!selectedPersonCount) return;
    const ids = [...selectedPersonIds];
    const accepted = await confirm({
      title: "批量删除人物",
      message: `确认删除选中的 ${ids.length} 个人物？相关回忆中的人物关联也会被移除。`,
      confirmText: "删除"
    });
    if (!accepted) return;

    const snapshotResults = await Promise.all(ids.map((id) => getDeleteSnapshot("person", id)));
    await Promise.all(ids.map((id) => deleteEntry("person", id)));
    const snapshots = snapshotResults.filter((snapshot) => snapshot !== null);
    closeBatchMode();
    notify({
      message: `已删除 ${ids.length} 个人物`,
      tone: "info",
      actions: snapshots.length
        ? [
            {
              label: "撤销",
              onClick: async () => {
                await Promise.all(snapshots.map((snapshot) => restoreDeletedEntry(snapshot)));
                notify({ message: `已恢复 ${snapshots.length} 个人物`, tone: "success" });
              }
            }
          ]
        : undefined
    });
  }

  async function handleBatchExportPeople() {
    if (!selectedPersonCount) return;
    const content = buildReadableMarkdownForSelection(state, {
      people: selectedPersonIds
    } satisfies Partial<Record<keyof LifeLogState, string[]>>);
    const result = await saveReadableFile(`lifelog-people-${formatExportDate()}.md`, content, "text/markdown;charset=utf-8");
    notify({
      message: `已导出 ${selectedPersonCount} 个人物：${result.locationLabel}`,
      tone: "success",
      durationMs: 4200
    });
  }

  async function handleBatchFavoritePeople(favorite: boolean) {
    if (!selectedPersonCount) return;
    const result = await updatePeopleBulk(selectedPersonIds, { favorite });
    if (!result.count) {
      notify({ message: favorite ? "选中的人物已全部收藏" : "选中的人物均未收藏", tone: "info" });
      return;
    }
    notify({
      message: favorite ? `已收藏 ${result.count} 个人物` : `已取消收藏 ${result.count} 个人物`,
      tone: "success",
      actions: [
        {
          label: "撤销",
          onClick: async () => {
            const restored = await restorePeopleBulk(result.before);
            notify({ message: restored ? `已恢复 ${restored} 个人物` : "没有可恢复的人物", tone: restored ? "success" : "info" });
          }
        }
      ]
    });
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
            <ListViewModeToggle
              dense={denseList}
              ariaLabel="人物列表密度"
              onChange={(mode) => updatePreference("listViewMode", mode)}
            />
            {peopleRows.length > 0 && (
              <button
                aria-pressed={batchMode}
                className={`filter-toggle-button ${batchMode ? "active" : ""}`}
                type="button"
                onClick={() => {
                  setBatchMode((current) => !current);
                  setSelectedPersonIds([]);
                }}
              >
                <CheckSquare />
                管理
              </button>
            )}
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
        {batchMode && (
          <BatchActionToolbar
            className="people-batch-toolbar"
            selectedCount={selectedPersonCount}
            itemLabel="个人物"
            hint="可统一导出、收藏，或集中清理重复和误建档案。"
            allSelected={allVisiblePeopleSelected}
            onToggleAll={() => setSelectedPersonIds(allVisiblePeopleSelected ? [] : selectablePersonIds)}
            onClose={closeBatchMode}
            actions={[
              { id: "export", label: "导出", icon: <Download size={14} />, disabled: !selectedPersonCount, onClick: () => void handleBatchExportPeople() },
              { id: "favorite", label: "收藏", icon: <Star size={14} />, disabled: !selectedPersonCount, onClick: () => void handleBatchFavoritePeople(true) },
              { id: "unfavorite", label: "取消收藏", icon: <Star size={14} />, disabled: !selectedPersonCount, onClick: () => void handleBatchFavoritePeople(false) },
              { id: "delete", label: "删除", icon: <Trash2 size={14} />, tone: "danger", disabled: !selectedPersonCount, onClick: () => void handleBatchDeletePeople() }
            ]}
          />
        )}
        <div className="list">
          {peopleRows.map(({ person, health }) => {
            const anniversary = person.anniversaries[0];
            const birthdayInfo = buildBirthdayInfo(person.birthday);
            const selected = selectedPersonIds.includes(person.id);
            return (
              <GlassCard className={`person-card ${denseList ? "dense-person-card" : ""} ${batchMode ? "selectable" : ""} ${selected ? "selected" : ""}`} key={person.id}>
                {batchMode && (
                  <button
                    className="person-select-toggle"
                    type="button"
                    aria-pressed={selected}
                    aria-label={selected ? "取消选择人物" : "选择人物"}
                    onClick={(event) => {
                      event.stopPropagation();
                      togglePersonSelection(person.id);
                    }}
                  >
                    {selected ? <CheckSquare size={18} /> : <Square size={18} />}
                  </button>
                )}
                <button
                  className="person-open"
                  onClick={() => {
                    if (batchMode) {
                      togglePersonSelection(person.id);
                      return;
                    }
                    navigate(`/people/${person.id}`);
                  }}
                >
                  <div className="person-photo">{initials(person.name)}</div>
                </button>
                <div
                  className="person-info"
                  onClick={() => {
                    if (batchMode) {
                      togglePersonSelection(person.id);
                      return;
                    }
                    navigate(`/people/${person.id}`);
                  }}
                >
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
                        if (batchMode) {
                          togglePersonSelection(person.id);
                          return;
                        }
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
                  {!denseList && !batchMode && (
                    <PreferenceLines
                      preferences={person.preferences}
                      dislikes={person.dislikes}
                      onEdit={(mode) => setPreferenceEditor({ personId: person.id, mode })}
                    />
                  )}
                </div>
                <div className="person-side-actions">
                  {batchMode ? (
                    <button
                      className="icon-action"
                      type="button"
                      aria-label={selected ? "取消选择人物" : "选择人物"}
                      onClick={() => togglePersonSelection(person.id)}
                    >
                      {selected ? <CheckSquare /> : <Square />}
                    </button>
                  ) : (
                    <CardActions onEdit={() => setEditingId(person.id)} onDelete={() => handleDelete(person.id)} />
                  )}
                </div>
              </GlassCard>
            );
          })}
          {!peopleRows.length &&
            (state.people.length === 0 ? (
              <EmptyState
                icon={<Users />}
                title="还没有人物"
                description="先留下一个重要的人，生日和相处细节以后慢慢补。"
                primaryAction={{ label: "记一个人", onClick: () => setCreatingNew(true) }}
              />
            ) : (
              <EmptyState
                icon={<RotateCcw />}
                title="没有找到匹配的人物"
                description="换个名字、关系或备注关键词试试。"
                primaryAction={{ label: "清除搜索", onClick: clearSearch, primary: false }}
              />
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

function formatExportDate() {
  return new Date().toISOString().slice(0, 10);
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
