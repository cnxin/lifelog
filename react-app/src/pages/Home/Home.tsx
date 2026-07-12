import { Calendar, CheckCircle2, ChevronDown, Clock, Gift, Heart, History, MapPin, PenLine, Search, Sparkles, Star, Users } from "lucide-react";
import { MouseEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import EntrySheet from "../../components/EntrySheet";
import GlassCard from "../../components/GlassCard";
import MemoryCard from "../../components/MemoryCard";
import { useLifeLog } from "../../context/LifeLogContext";
import { useHomeLayout } from "../../hooks/useHomeLayout";
import { getBooleanPreference, useUserPreferences } from "../../hooks/useUserPreferences";
import type { AnniversaryPlan, EntryType, MemoryEvent, Place } from "../../types";
import { buildPersonAnniversarySuffix } from "../../utils/anniversaryLinks";
import { findPlanForAnniversaryTarget, formatAnniversaryPlanTargetTitle } from "../../utils/anniversaryPlans";
import { formatLunarDate, formatMonthDay, getUpcomingAnniversaries } from "../../utils/date";
import { buildMemoryDisplayContext, getMemoryDisplayTitle, isActiveMemoryPlan, isMemoryPlan } from "../../utils/memoryDisplay";
import { buildPlaceDisplayName } from "../../utils/placeMeta";
import { buildPlaceVisitStats, type PlaceVisitStats } from "../../utils/placeVisitStats";
import { previewUpcomingReminders } from "../../utils/reminderScheduler";
import { initials } from "../../utils/text";

export default function Home() {
  const navigate = useNavigate();
  const { state, reminderSettings, getPersonName, getPlaceName, saveAnniversaryPlan } = useLifeLog();
  const { prefs, updatePreference } = useUserPreferences();
  const [entrySheetType, setEntrySheetType] = useState<EntryType | null>(null);
  const [initialMemoryPersonIds, setInitialMemoryPersonIds] = useState<string[]>([]);
  const [initialMemoryPlaceIds, setInitialMemoryPlaceIds] = useState<string[]>([]);
  const [initialMemoryDate, setInitialMemoryDate] = useState<string | undefined>();
  const [pendingMemoryPlanId, setPendingMemoryPlanId] = useState<string | null>(null);
  const [actionPrefs, setActionPrefs] = useState<TodayActionPrefs>(() => loadTodayActionPrefs());
  const [smartPromptPrefs, setSmartPromptPrefs] = useState<TodayActionPrefs>(() => loadSmartPromptPrefs());
  const monthlySchedule = buildCurrentMonthScheduleItems({
    anniversaryPlans: state.anniversaryPlans,
    memories: state.memories,
    getPersonName,
    getPlaceName
  });
  const monthlyScheduleItems = monthlySchedule.items;
  const hiddenMonthlyScheduleCount = Math.max(0, monthlySchedule.total - monthlyScheduleItems.length);
  const upcomingWithPlanStatus = getUpcomingAnniversaries(state.people)
    .filter((item) => item.days >= 0 && item.days <= 30)
    .map((item) => ({
      ...item,
      planStatus: buildUpcomingPlanStatus(state.anniversaryPlans, item)
    }));
  const upcoming = upcomingWithPlanStatus
    .filter((item) => !isUpcomingCoveredByMonthlySchedule(item, monthlyScheduleItems))
    .slice(0, 3);
  const favorites = state.people.filter((person) => person.favorite).slice(0, 3);
  const actualMemories = state.memories.filter((memory) => !isMemoryPlan(memory));
  const recentEntries = [...state.memories].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const featuredPlaces = useMemo(
    () =>
      state.places
        .map((place) => ({ place, visitStats: buildPlaceVisitStats(place.id, state.memories, getPersonName) }))
        .sort(compareHomePlaceRows)
        .slice(0, 3),
    [getPersonName, state.memories, state.places]
  );
  const monthlyMemoryCount = countMemoriesInCurrentMonth(actualMemories);
  const onThisDayMemories = buildOnThisDayMemories(actualMemories, getPersonName, getPlaceName).slice(0, 3);
  const mainOnThisDay = onThisDayMemories[0];
  const otherOnThisDayMemories = onThisDayMemories.slice(1);
  const totalRecords = state.people.length + state.places.length + actualMemories.length;
  const isNewUser = totalRecords < 10;
  const hasMonthlySchedule = monthlyScheduleItems.length > 0 || upcoming.length > 0;
  const hasHomeLibrary = favorites.length > 0 || featuredPlaces.length > 0 || recentEntries.length > 0;
  const homeLibrarySummary =
    favorites.length || featuredPlaces.length || recentEntries.length
      ? `收藏 ${favorites.length} 人 · 常去 ${featuredPlaces.length} 处 · 最近 ${recentEntries.length} 条`
      : "人物、地点、记录会在这里汇总";

  function openQuickMemory(options: OpenMemoryOptions | string[] = {}, legacyPlaceIds: string[] = [], legacyPlanId: string | null = null) {
    const nextOptions = Array.isArray(options)
      ? { personIds: options, placeIds: legacyPlaceIds, pendingPlanId: legacyPlanId }
      : options;
    const {
      personIds = [],
      placeIds = [],
      initialDate,
      pendingPlanId = null
    } = nextOptions;
    setInitialMemoryPersonIds(personIds);
    setInitialMemoryPlaceIds(placeIds);
    setInitialMemoryDate(initialDate);
    setPendingMemoryPlanId(pendingPlanId || null);
    setEntrySheetType("memory");
  }

  const tasks = [
    {
      id: "people-birthday",
      icon: <Users />,
      count: state.people.filter((person) => !person.birthday).length,
      title: "补充生日",
      desc: "生日和纪念日会出现在首页与日历",
      path: "/people"
    },
    {
      id: "people-preferences",
      icon: <Heart />,
      count: state.people.filter((person) => !person.preferences.length && !person.dislikes.length).length,
      title: "补充喜好",
      desc: "记录颜色、食物、禁忌和送礼线索",
      path: "/people"
    },
    {
      id: "place-map",
      icon: <MapPin />,
      count: state.places.filter((place) => !place.mapUrl && !(place.latitude && place.longitude)).length,
      title: "补充高德入口",
      desc: "有高德链接后可以直接从地点详情打开高德",
      path: "/places"
    }
  ].filter((task) => task.count > 0);
  const todayActions = buildTodayActions({
    state,
    reminderSettings,
    getPersonName,
    getPlaceName,
    onOpenMemory: (memoryId) => navigate(`/memories/${memoryId}`),
    onOpenPerson: (personId, hash = "") => navigate(`/people/${personId}${hash}`),
    onOpenCalendar: () => navigate("/calendar"),
    actionPrefs
  });
  const smartPrompts = todayActions.length
    ? []
    : buildSmartPrompts({
      state,
      actualMemories,
      getPersonName,
      upcoming: upcomingWithPlanStatus,
      onOpenPerson: (personId) => navigate(`/people/${personId}`),
      onOpenPlace: (placeId) => navigate(`/places/${placeId}`),
      onQuickMemory: openQuickMemory,
      promptPrefs: smartPromptPrefs
    });
  const homeLayout = useHomeLayout({
    totalRecords,
    todayActionCount: todayActions.length,
    smartPromptCount: smartPrompts.length,
    onThisDayCount: onThisDayMemories.length,
    monthlyScheduleCount: monthlySchedule.total,
    taskCount: tasks.length,
    hasHomeLibrary
  });
  const todayQueueOpen = getBooleanPreference(prefs, "homeTodayQueueExpanded", homeLayout.defaultTodayQueueOpen);
  const taskQueueOpen = getBooleanPreference(prefs, "homeTaskQueueExpanded", homeLayout.defaultTaskQueueOpen);
  const homeLibraryOpen = getBooleanPreference(prefs, "homeLibraryExpanded", homeLayout.defaultHomeLibraryOpen);
  const setTodayQueueOpen = (updater: boolean | ((value: boolean) => boolean)) =>
    updatePreference("homeTodayQueueExpanded", typeof updater === "function" ? updater(todayQueueOpen) : updater);
  const setTaskQueueOpen = (updater: boolean | ((value: boolean) => boolean)) =>
    updatePreference("homeTaskQueueExpanded", typeof updater === "function" ? updater(taskQueueOpen) : updater);
  const setHomeLibraryOpen = (updater: boolean | ((value: boolean) => boolean)) =>
    updatePreference("homeLibraryExpanded", typeof updater === "function" ? updater(homeLibraryOpen) : updater);
  function updateActionPref(actionId: string, mode: "snooze" | "dismiss") {
    const next: TodayActionPrefs = {
      ...actionPrefs,
      [actionId]: mode === "snooze" ? buildSnoozeUntil() : "dismissed"
    };
    setActionPrefs(next);
    saveTodayActionPrefs(next);
  }
  function updateSmartPromptPref(promptId: string, mode: "snooze" | "dismiss") {
    const next: TodayActionPrefs = {
      ...smartPromptPrefs,
      [promptId]: mode === "snooze" ? buildSnoozeUntil() : "dismissed"
    };
    setSmartPromptPrefs(next);
    saveSmartPromptPrefs(next);
  }

  function recordAnotherOnThisDay(item: FlashbackItem) {
    saveQuickInboxPrefill(buildOnThisDayQuickPrefill(item.memory, getPersonName, getPlaceName));
    openQuickMemory({
      personIds: item.memory.personIds || [],
      placeIds: getMemoryPlaceIdsForHome(item.memory)
    });
  }

  return (
    <div className="home-layout-flow">
      <section className="section home-top-tools">
        <button
          className="home-search-pill pressable"
          type="button"
          onClick={() => window.dispatchEvent(new Event("lifelog:open-global-search"))}
        >
          <Search />
          搜索人物、地点、回忆
        </button>
        <button className="home-composer pressable" type="button" onClick={() => openQuickMemory()}>
          <span className="home-composer-dot">
            <PenLine />
          </span>
          今天发生了什么…
        </button>
      </section>

      {isNewUser && totalRecords === 0 && (
        <section className="section" style={{ order: 0 }}>
          <div className="home-welcome-card">
            <h2>从一句小事开始你的 LifeLog</h2>
            <p>不用一次写完。先留下今天，人物和地点以后再补。</p>
            <div className="home-welcome-actions">
              <button className="primary-btn pressable" type="button" onClick={() => openQuickMemory()}>
                写下今天第一件事
              </button>
              <div className="home-welcome-secondary">
                <button className="ghost-btn pressable" type="button" onClick={() => setEntrySheetType("person")}>
                  先记一个人
                </button>
                <button className="ghost-btn pressable" type="button" onClick={() => setEntrySheetType("place")}>
                  先记一个地方
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {todayActions.length > 0 && (
        <section className="section" style={{ order: homeLayout.getSectionOrder("todayQueue") }}>
          <GlassCard className={`today-queue-card ${todayQueueOpen ? "open" : ""}`}>
            <button className="today-queue-summary" type="button" onClick={() => setTodayQueueOpen((open) => !open)}>
              <span className="today-queue-icon">
                <Sparkles />
              </span>
              <span className="today-queue-copy">
                <strong>今天还有 {todayActions.length} 个待处理</strong>
                <small>{todayActions[0].title}</small>
              </span>
              <span className="today-queue-toggle">
                {todayQueueOpen ? "收起" : "展开"}
                <ChevronDown />
              </span>
            </button>
            {todayQueueOpen && (
              <div className="today-queue-list">
                {todayActions.map((action) => (
                  <div className={`today-action-card ${action.tone || ""}`} key={action.id}>
                    <button className="today-action-main" type="button" onClick={action.onClick}>
                      <span className="today-action-icon">{action.icon}</span>
                      <span className="today-action-copy">
                        <strong>{action.title}</strong>
                        <small>{action.desc}</small>
                      </span>
                      {action.meta && <em>{action.meta}</em>}
                    </button>
                    {action.canDismiss && (
                      <span className="today-action-tools">
                        <button type="button" onClick={(event) => handleActionTool(event, () => updateActionPref(action.id, "snooze"))}>
                          稍后
                        </button>
                        <button type="button" onClick={(event) => handleActionTool(event, () => updateActionPref(action.id, "dismiss"))}>
                          今天忽略
                        </button>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </section>
      )}

      {smartPrompts.length > 0 && (
        <section className="section" style={{ order: homeLayout.getSectionOrder("smartPrompt") }}>
          <GlassCard className={`home-smart-prompt-card ${smartPrompts[0].tone || ""}`}>
            <button className="home-smart-prompt-main" type="button" onClick={smartPrompts[0].onClick}>
              <span className="home-smart-prompt-icon">{smartPrompts[0].icon}</span>
              <span className="home-smart-prompt-copy">
                <strong>{smartPrompts[0].title}</strong>
                <small>{smartPrompts[0].desc}</small>
              </span>
              <em>{smartPrompts[0].meta}</em>
            </button>
            <span className="home-smart-prompt-tools">
              <button type="button" onClick={(event) => handleActionTool(event, () => updateSmartPromptPref(smartPrompts[0].id, "snooze"))}>
                稍后
              </button>
              <button type="button" onClick={(event) => handleActionTool(event, () => updateSmartPromptPref(smartPrompts[0].id, "dismiss"))}>
                今天忽略
              </button>
            </span>
          </GlassCard>
        </section>
      )}

      {onThisDayMemories.length > 0 && (
        <section className="section" style={{ order: homeLayout.getSectionOrder("flashback") }}>
          <div className="section-header">
            <h2>
              <History /> 历年今日
            </h2>
            <button className="see-all" onClick={() => navigate("/memories")}>
              时间线
            </button>
          </div>
          <div className="on-this-day-spotlight glass-card">
            <button className="on-this-day-main" type="button" onClick={() => navigate(`/memories/${mainOnThisDay.memory.id}`)}>
              <span className="on-this-day-year">{mainOnThisDay.badge}</span>
              <span className="on-this-day-copy">
                <strong>{mainOnThisDay.title}</strong>
                <small>{mainOnThisDay.desc}</small>
              </span>
              <em>{formatMonthDay(mainOnThisDay.memory.date)}</em>
            </button>
            <div className="on-this-day-actions">
              <button type="button" onClick={() => navigate(`/memories/${mainOnThisDay.memory.id}`)}>
                回看
              </button>
              <button
                type="button"
                onClick={() => recordAnotherOnThisDay(mainOnThisDay)}
              >
                今天再记一条
              </button>
            </div>
            {otherOnThisDayMemories.length > 0 && (
              <div className="on-this-day-list compact">
                {otherOnThisDayMemories.map((item) => (
                  <button className="on-this-day-card" type="button" key={item.memory.id} onClick={() => navigate(`/memories/${item.memory.id}`)}>
                    <span className="on-this-day-year">{item.badge}</span>
                    <span className="on-this-day-copy">
                      <strong>{item.title}</strong>
                      <small>{item.desc}</small>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {hasMonthlySchedule && (
        <section className="section" style={{ order: homeLayout.getSectionOrder("monthlySchedule") }}>
          <div className="section-header">
            <h2>
              <Calendar /> 本月安排
            </h2>
            <button className="see-all" onClick={() => navigate("/calendar")}>
              查看
            </button>
          </div>
          <div className="home-anniversary-stack">
            {monthlyScheduleItems.length > 0 && (
              <div className="monthly-plan-list">
                {monthlyScheduleItems.map((item) => (
                  <button
                    className="monthly-plan-card glass-card"
                    key={item.id}
                    type="button"
                    onClick={() => navigate(item.path)}
                  >
                    <span className={`monthly-plan-status ${item.statusTone}`}>{item.statusLabel}</span>
                    <span className="monthly-plan-copy">
                      <strong>{item.title}</strong>
                      <small>{item.desc}</small>
                    </span>
                    <em>{formatMonthDay(item.date)}</em>
                  </button>
                ))}
                {hiddenMonthlyScheduleCount > 0 && (
                  <button className="monthly-plan-more glass-card" type="button" onClick={() => navigate("/calendar")}>
                    还有 {hiddenMonthlyScheduleCount} 条安排 · 去日历查看
                  </button>
                )}
              </div>
            )}
            {upcoming.length > 0 && (
              <div className="anniversary-scroll-wrapper">
                <div className="anniversary-scroll">
                  {upcoming.map((item, index) => (
                    <button
                      key={`${item.personId}-${item.title}-${item.kind}-${item.date}-${"milestoneDay" in item ? item.milestoneDay : ""}`}
                      className={`anniversary-card glass-card ${index % 2 ? "secondary" : ""} ${item.kind === "milestone" ? "milestone" : ""}`}
                      onClick={() => navigate(`/people/${item.personId}${buildPersonAnniversarySuffix(getUpcomingAnniversaryLinkTarget(item))}`)}
                    >
                      <div className="a-title">
                        {item.personName} · {item.title}
                      </div>
                      <div className="a-days">
                        {item.days}
                        <span>天</span>
                      </div>
                      <div className="a-date">{item.label === "今天" ? "就是今天" : item.label}</div>
                      <div className="a-date">{item.yearLabel}</div>
                      <div className={`a-plan-status ${item.planStatus.tone}`}>{item.planStatus.label}</div>
                      <div className="a-date">{formatMonthDay(item.date)}</div>
                      <div className="a-date">{formatLunarDate(item.date)}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {tasks.length > 0 && isNewUser && (
        <section className="section" style={{ order: homeLayout.getSectionOrder("taskQueue") }}>
          <GlassCard className={`today-queue-card profile-queue-card ${taskQueueOpen ? "open" : ""}`}>
            <button className="today-queue-summary" type="button" onClick={() => setTaskQueueOpen((open) => !open)}>
              <span className="today-queue-icon">
                <Sparkles />
              </span>
              <span className="today-queue-copy">
                <strong>有 {Math.min(tasks.length, 2)} 类资料可以顺手补</strong>
                <small>{tasks[0].title} · {tasks[0].count} 项</small>
              </span>
              <span className="today-queue-toggle">
                {taskQueueOpen ? "收起" : "整理"}
                <ChevronDown />
              </span>
            </button>
            {taskQueueOpen && (
              <div className="task-grid compact">
                {tasks.slice(0, 2).map((task) => (
                  <button className="task-card" key={task.id} onClick={() => navigate(task.path)}>
                    <div className="task-icon">{task.icon}</div>
                    <div>
                      <strong>
                        {task.count} 项 · {task.title}
                      </strong>
                      <span>{task.desc}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </GlassCard>
        </section>
      )}

      {(monthlyMemoryCount > 0 || hasMonthlySchedule) && !isNewUser && (
        <p className="home-monthly-note" style={{ order: homeLayout.getSectionOrder("monthlySchedule") }}>
          本月已记 {monthlyMemoryCount} 条
          {hasMonthlySchedule ? " · 下面是近期安排" : ""}
        </p>
      )}

      {hasHomeLibrary && (
      <section className="section home-library-section" style={{ order: homeLayout.getSectionOrder("homeLibrary") }}>
        <div className="section-header">
          <h2>
            <Clock /> 最近看看
          </h2>
          <button className="see-all home-library-toggle" type="button" onClick={() => setHomeLibraryOpen((open) => !open)}>
            {homeLibraryOpen ? "收起" : "展开"}
            <ChevronDown />
          </button>
        </div>
        <button className="home-library-strip glass-card" type="button" onClick={() => setHomeLibraryOpen((open) => !open)}>
          <span className="home-library-copy">
            <strong>{homeLibrarySummary}</strong>
            <small>需要回看时再展开，不占用今天的主流程</small>
          </span>
          <span className="home-library-metrics">
            <span>
              <Users />
              {favorites.length}
            </span>
            <span>
              <MapPin />
              {featuredPlaces.length}
            </span>
            <span>
              <Clock />
              {recentEntries.length}
            </span>
          </span>
        </button>
        {homeLibraryOpen && (
          <div className="home-library-content">
            <div className="home-library-group">
              <div className="home-library-group-header">
                <h3>
                  <Users /> 收藏的人
                </h3>
                <button type="button" onClick={() => navigate("/people")}>
                  全部
                </button>
              </div>
              {favorites.length > 0 ? (
                <div className="favorites-grid">
                  {favorites.map((person) => (
                    <button className="favorite-item favorite-button" key={person.id} onClick={() => navigate(`/people/${person.id}`)}>
                      <div className="fav-avatar">{initials(person.name)}</div>
                      <div className="fav-name">{person.name}</div>
                    </button>
                  ))}
                </div>
              ) : (
                <GlassCard className="home-empty-card compact">
                  <strong>还没有收藏人物</strong>
                  <span>把重要的人设为收藏后，这里会优先显示 TA。</span>
                  <button onClick={() => navigate("/people")}>去看看人物</button>
                </GlassCard>
              )}
            </div>

            <div className="home-library-group">
              <div className="home-library-group-header">
                <h3>
                  <MapPin /> 常去地点
                </h3>
                <button type="button" onClick={() => navigate("/places")}>
                  全部
                </button>
              </div>
              {featuredPlaces.length > 0 ? (
                <div className="home-place-list">
                  {featuredPlaces.map(({ place, visitStats }) => (
                    <GlassCard className="home-place-card" key={place.id}>
                      <button className="home-place-main" type="button" onClick={() => navigate(`/places/${place.id}`)}>
                        <span className="home-place-icon">
                          <MapPin />
                        </span>
                        <span className="home-place-copy">
                          <strong>{buildPlaceDisplayName(place)}</strong>
                          <small>{buildHomePlaceSubtitle(place)}</small>
                        </span>
                        {place.favorite && <Star className="home-place-favorite" />}
                      </button>
                      <div className="home-place-meta">
                        <span>{visitStats.visitCount ? `去过 ${visitStats.visitCount} 次` : "还没有到访"}</span>
                        <span>{visitStats.latestLabel}</span>
                      </div>
                      <button className="home-place-action" type="button" onClick={() => openQuickMemory([], [place.id])}>
                        再记一次
                      </button>
                    </GlassCard>
                  ))}
                </div>
              ) : (
                <GlassCard className="home-empty-card compact">
                  <strong>还没有地点</strong>
                  <span>添加餐厅、景点或常去的地方后，这里会显示最近到访。</span>
                  <button onClick={() => setEntrySheetType("place")}>添加地点</button>
                </GlassCard>
              )}
            </div>

            <div className="home-library-group">
              <div className="home-library-group-header">
                <h3>
                  <Clock /> 最近记录
                </h3>
                <button type="button" onClick={() => navigate("/memories")}>
                  全部
                </button>
              </div>
              {recentEntries.length > 0 ? (
                <div className="list">
                  {recentEntries.map((memory) => {
                    const ctx = buildMemoryDisplayContext(memory, getPersonName, getPlaceName);
                    return (
                      <MemoryCard
                        key={memory.id}
                        memory={memory}
                        ctx={ctx}
                        icon="♡"
                        onOpen={() => navigate(`/memories/${memory.id}`)}
                      />
                    );
                  })}
                </div>
              ) : (
                <GlassCard className="home-empty-card compact">
                  <strong>还没有记录</strong>
                  <span>从今天发生的一件小事开始，建立你的第一条 LifeLog。</span>
                  <div className="home-empty-actions">
                    <button
                      onClick={() => {
                        openQuickMemory();
                      }}
                    >
                      记录一条
                    </button>
                    <button onClick={() => setEntrySheetType("place")}>添加地点</button>
                  </div>
                </GlassCard>
              )}
            </div>
          </div>
        )}
      </section>
      )}

      <EntrySheet
        type={entrySheetType}
        memoryMode={entrySheetType === "memory" ? "quick" : "full"}
        initialPersonIds={entrySheetType === "memory" ? initialMemoryPersonIds : []}
        initialPlaceIds={entrySheetType === "memory" ? initialMemoryPlaceIds : []}
        initialDate={entrySheetType === "memory" ? initialMemoryDate : undefined}
        onClose={() => {
          setEntrySheetType(null);
          setInitialMemoryPersonIds([]);
          setInitialMemoryPlaceIds([]);
          setInitialMemoryDate(undefined);
          setPendingMemoryPlanId(null);
        }}
        onSaved={async (result) => {
          if (result.type !== "memory" || !pendingMemoryPlanId) return;
          const plan = state.anniversaryPlans.find((item) => item.id === pendingMemoryPlanId);
          if (!plan) return;
          await saveAnniversaryPlan({
            ...plan,
            status: "done",
            memoryId: result.id,
            updatedAt: new Date().toISOString()
          });
        }}
      />
    </div>
  );
}

interface FlashbackItem {
  kind: string;
  badge: string;
  title: string;
  desc: string;
  memory: MemoryEvent;
}

function buildOnThisDayMemories(
  memories: MemoryEvent[],
  getPersonName: (id: string) => string,
  getPlaceName: (id: string) => string
): FlashbackItem[] {
  const today = new Date();
  const month = today.getMonth();
  const day = today.getDate();
  const currentYear = today.getFullYear();

  return memories
    .filter((memory) => {
      const date = new Date(`${memory.date}T00:00:00`);
      return date.getFullYear() < currentYear && date.getMonth() === month && date.getDate() === day;
    })
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((memory) => {
      const years = currentYear - new Date(`${memory.date}T00:00:00`).getFullYear();
      return {
        kind: "on-this-day",
        badge: `${years} 年前`,
        title: memory.title || "往年今日",
        desc: buildMemoryContextLine(memory, getPersonName, getPlaceName) || memory.content || "有一条旧回忆可以回看。",
        memory
      };
    });
}

function buildMemoryContextLine(memory: MemoryEvent, getPersonName: (id: string) => string, getPlaceName: (id: string) => string) {
  const ctx = buildMemoryDisplayContext(memory, getPersonName, getPlaceName);
  return [ctx.personNames.join("、"), ctx.placeNames.join("、")].filter(Boolean).join(" · ");
}

function getMemoryPlaceIdsForHome(memory: MemoryEvent) {
  return Array.from(new Set([...(memory.placeIds || []), memory.placeId || ""].filter(Boolean)));
}

function buildOnThisDayQuickPrefill(
  memory: MemoryEvent,
  getPersonName: (id: string) => string,
  getPlaceName: (id: string) => string
) {
  const context = buildMemoryDisplayContext(memory, getPersonName, getPlaceName);
  const people = context.personNames.slice(0, 2).join("、");
  const place = context.placeNames[0] || "";
  if (people && place) return `今天和${people}在${place}又有了一点新的记录`;
  if (people) return `今天和${people}又有了一点新的记录`;
  if (place) return `今天在${place}又有了一点新的记录`;
  const title = memory.title?.trim();
  if (title && title !== "新的回忆") return `今天又想起了「${title}」`;
  return "今天又有了一点新的记录";
}

function saveQuickInboxPrefill(value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("lifelog:quick-inbox-prefill", value);
  } catch {
    // Ignore storage failures; quick record can still open normally.
  }
}

interface TodayAction {
  id: string;
  icon: JSX.Element;
  title: string;
  desc: string;
  meta?: string;
  tone?: "warm" | "cool";
  canDismiss?: boolean;
  onClick: () => void;
}

type TodayActionPrefs = Record<string, number | "dismissed">;

interface SmartPrompt {
  id: string;
  icon: JSX.Element;
  title: string;
  desc: string;
  meta: string;
  tone?: "warm" | "cool";
  priority: number;
  onClick: () => void;
}

interface OpenMemoryOptions {
  personIds?: string[];
  placeIds?: string[];
  initialDate?: string;
  pendingPlanId?: string | null;
}

interface MonthlyScheduleItem {
  id: string;
  kind: "anniversary-plan" | "memory-plan";
  title: string;
  desc: string;
  date: string;
  statusLabel: string;
  statusTone: string;
  path: string;
  anniversaryKey?: string;
  sortScore: number;
  updatedAt: string;
}

function buildTodayActions({
  state,
  reminderSettings,
  getPersonName,
  getPlaceName,
  onOpenMemory,
  onOpenPerson,
  onOpenCalendar,
  actionPrefs
}: {
  state: ReturnType<typeof useLifeLog>["state"];
  reminderSettings: ReturnType<typeof useLifeLog>["reminderSettings"];
  getPersonName: (id: string) => string;
  getPlaceName: (id: string) => string;
  onOpenMemory: (memoryId: string) => void;
  onOpenPerson: (personId: string, hash?: string) => void;
  onOpenCalendar: () => void;
  actionPrefs: TodayActionPrefs;
}): TodayAction[] {
  const actions: TodayAction[] = [];
  const dueMemoryPlan = findDueMemoryPlan(state.memories);
  if (dueMemoryPlan) {
    const ctx = buildMemoryDisplayContext(dueMemoryPlan, getPersonName, getPlaceName);
    const days = daysBetweenToday(dueMemoryPlan.date);
    actions.push({
      id: `due-memory-plan-${dueMemoryPlan.id}`,
      icon: <CheckCircle2 />,
      title: days === 0 ? "这条计划今天到了" : `有一条计划已过期 ${days} 天`,
      desc: buildDueMemoryPlanDesc(dueMemoryPlan, ctx),
      meta: "补回忆",
      tone: "warm",
      canDismiss: true,
      onClick: () => onOpenMemory(dueMemoryPlan.id)
    });
  }

  const todayPlanAction = findTodayAnniversaryPlanAction(state.anniversaryPlans, state.people);
  if (todayPlanAction) {
    actions.push({
      id: `today-plan-${todayPlanAction.plan.id}`,
      icon: <Sparkles />,
      title: todayPlanAction.title,
      desc: todayPlanAction.desc,
      meta: todayPlanAction.meta,
      tone: "warm",
      canDismiss: true,
      onClick: () => onOpenPerson(todayPlanAction.plan.personId, buildPersonAnniversarySuffix({
        title: todayPlanAction.plan.anniversaryTitle,
        date: todayPlanAction.plan.anniversaryDate
      }))
    });
  }

  const reminders = previewUpcomingReminders(state.people, state.memories, reminderSettings, { days: 0, limit: 4 })
    .filter((reminder) => reminder.type !== "生日" && reminder.type !== "纪念日")
    .slice(0, 2);

  reminders.forEach((reminder) => {
    actions.push({
      id: `reminder-${reminder.id}`,
      icon: <Calendar />,
      title: reminder.title,
      desc: [formatMonthDay(toDateKey(reminder.at)), reminder.body || "未来 7 天内需要留意"].filter(Boolean).join(" · "),
      meta: reminder.type,
      canDismiss: true,
      onClick: () => {
        if (reminder.sourcePath) {
          navigateToReminderSource(reminder.sourcePath, onOpenPerson, onOpenCalendar);
          return;
        }
        onOpenCalendar();
      }
    });
  });

  const visibleActions = actions.filter((action) => !isActionSuppressed(action.id, actionPrefs));

  if (!visibleActions.length) {
    return [];
  }

  return visibleActions.slice(0, 3);
}

function handleActionTool(event: MouseEvent<HTMLButtonElement>, handler: () => void) {
  event.stopPropagation();
  handler();
}

function loadTodayActionPrefs(): TodayActionPrefs {
  if (typeof window === "undefined") return {};
  try {
    const stored = window.localStorage.getItem(getTodayActionPrefKey());
    return stored ? JSON.parse(stored) as TodayActionPrefs : {};
  } catch {
    return {};
  }
}

function saveTodayActionPrefs(prefs: TodayActionPrefs) {
  try {
    window.localStorage.setItem(getTodayActionPrefKey(), JSON.stringify(prefs));
  } catch {
    // 本地偏好失败时不影响首页主流程。
  }
}

function loadSmartPromptPrefs(): TodayActionPrefs {
  if (typeof window === "undefined") return {};
  try {
    const stored = window.localStorage.getItem(getSmartPromptPrefKey());
    return stored ? JSON.parse(stored) as TodayActionPrefs : {};
  } catch {
    return {};
  }
}

function saveSmartPromptPrefs(prefs: TodayActionPrefs) {
  try {
    window.localStorage.setItem(getSmartPromptPrefKey(), JSON.stringify(prefs));
  } catch {
    // 本地偏好失败时不影响首页建议显示。
  }
}

function isActionSuppressed(actionId: string, prefs: TodayActionPrefs) {
  const value = prefs[actionId];
  if (value === "dismissed") return true;
  if (typeof value === "number") return Date.now() < value;
  return false;
}

function buildSnoozeUntil() {
  return Date.now() + 4 * 60 * 60 * 1000;
}

function getTodayActionPrefKey() {
  return `lifelog:today-actions:${toDateKey(new Date())}`;
}

function getSmartPromptPrefKey() {
  return `lifelog:smart-prompts:${toDateKey(new Date())}`;
}

function buildSmartPrompts({
  state,
  actualMemories,
  getPersonName,
  upcoming,
  onOpenPerson,
  onOpenPlace,
  onQuickMemory,
  promptPrefs
}: {
  state: ReturnType<typeof useLifeLog>["state"];
  actualMemories: MemoryEvent[];
  getPersonName: (id: string) => string;
  upcoming: Array<ReturnType<typeof getUpcomingAnniversaries>[number] & { planStatus: ReturnType<typeof buildUpcomingPlanStatus> }>;
  onOpenPerson: (personId: string) => void;
  onOpenPlace: (placeId: string) => void;
  onQuickMemory: (options?: OpenMemoryOptions) => void;
  promptPrefs: TodayActionPrefs;
}): SmartPrompt[] {
  const prompts: SmartPrompt[] = [
    buildAnniversaryPrepPrompt(upcoming, onOpenPerson),
    buildContactPrompt(state, actualMemories, onOpenPerson),
    buildProfilePrompt(state, onOpenPerson),
    buildFrequentPlacePrompt(state, actualMemories, getPersonName, onOpenPlace),
    buildRecordGapPrompt(actualMemories, onQuickMemory)
  ].filter((item): item is SmartPrompt => Boolean(item));

  return prompts
    .filter((prompt) => !isActionSuppressed(prompt.id, promptPrefs))
    .sort((left, right) => right.priority - left.priority)
    .slice(0, 1);
}

function buildAnniversaryPrepPrompt(
  upcoming: Array<ReturnType<typeof getUpcomingAnniversaries>[number] & { planStatus: ReturnType<typeof buildUpcomingPlanStatus> }>,
  onOpenPerson: (personId: string) => void
): SmartPrompt | null {
  const candidate = upcoming
    .filter((item) => item.days > 0 && item.days <= 14 && (item.planStatus.tone === "missing" || item.planStatus.tone === "urgent"))
    .sort((left, right) => left.days - right.days)[0];
  if (!candidate) return null;
  return {
    id: `anniversary-prep-${candidate.personId}-${candidate.title}-${candidate.date}`,
    icon: <Gift />,
    title: `${candidate.personName}的${candidate.title}还有 ${candidate.days} 天`,
    desc: "可以提前想一下安排、礼物或当天要记录的事。",
    meta: "纪念日",
    tone: candidate.days <= 3 ? "warm" : "cool",
    priority: candidate.days <= 3 ? 92 : 66 - candidate.days,
    onClick: () => onOpenPerson(candidate.personId)
  };
}

function buildContactPrompt(
  state: ReturnType<typeof useLifeLog>["state"],
  actualMemories: MemoryEvent[],
  onOpenPerson: (personId: string) => void
): SmartPrompt | null {
  const candidate = state.people
    .filter((person) => person.favorite)
    .map((person) => {
      const related = actualMemories
        .filter((memory) => memory.personIds.includes(person.id))
        .sort((left, right) => right.date.localeCompare(left.date));
      const latestDate = related[0]?.date || "";
      return {
        person,
        memoryCount: related.length,
        daysSinceLast: latestDate ? daysBetweenToday(latestDate) : null
      };
    })
    .filter((item) => item.memoryCount > 0 && item.daysSinceLast !== null && item.daysSinceLast >= 21)
    .sort((left, right) => (right.daysSinceLast || 0) - (left.daysSinceLast || 0))[0];

  if (!candidate || candidate.daysSinceLast === null) return null;
  return {
    id: `contact-${candidate.person.id}`,
    icon: <Users />,
    title: `${candidate.person.name} 已经 ${candidate.daysSinceLast} 天没有新记录`,
    desc: `上次共同回忆在 ${formatMonthDayOffset(candidate.daysSinceLast)}，可以回看一下最近的互动。`,
    meta: "人物",
    tone: "cool",
    priority: Math.min(80, candidate.daysSinceLast),
    onClick: () => onOpenPerson(candidate.person.id)
  };
}

function buildProfilePrompt(
  state: ReturnType<typeof useLifeLog>["state"],
  onOpenPerson: (personId: string) => void
): SmartPrompt | null {
  const candidate = state.people.find((person) =>
    person.favorite &&
    !person.preferences.length &&
    !person.dislikes.length &&
    (person.birthday || person.anniversaries.length > 0)
  );
  if (!candidate) return null;
  return {
    id: `profile-${candidate.id}`,
    icon: <Heart />,
    title: `${candidate.name} 还没有喜好档案`,
    desc: "补几条喜欢和避雷信息，之后准备礼物或约饭会更省心。",
    meta: "档案",
    tone: "cool",
    priority: 42,
    onClick: () => onOpenPerson(candidate.id)
  };
}

function buildFrequentPlacePrompt(
  state: ReturnType<typeof useLifeLog>["state"],
  actualMemories: MemoryEvent[],
  getPersonName: (id: string) => string,
  onOpenPlace: (placeId: string) => void
): SmartPrompt | null {
  const candidate = state.places
    .filter((place) => !place.favorite)
    .map((place) => ({
      place,
      stats: buildPlaceVisitStats(place.id, actualMemories, getPersonName)
    }))
    .filter((item) => item.stats.visitCount >= 3)
    .sort((left, right) => right.stats.visitCount - left.stats.visitCount || compareDateDesc(left.stats.latestDate, right.stats.latestDate))[0];

  if (!candidate) return null;
  return {
    id: `place-favorite-${candidate.place.id}`,
    icon: <MapPin />,
    title: `${buildPlaceDisplayName(candidate.place)} 去过 ${candidate.stats.visitCount} 次`,
    desc: candidate.stats.topPeople.length
      ? `常和 ${candidate.stats.topPeople.map((item) => item.label).slice(0, 2).join("、")} 一起去，可以考虑设为收藏。`
      : "这个地点已经多次出现，可以考虑设为收藏，之后更容易找到。",
    meta: "地点",
    tone: "warm",
    priority: 48 + candidate.stats.visitCount,
    onClick: () => onOpenPlace(candidate.place.id)
  };
}

function buildRecordGapPrompt(
  actualMemories: MemoryEvent[],
  onQuickMemory: (options?: OpenMemoryOptions) => void
): SmartPrompt | null {
  if (actualMemories.length < 5) return null;
  const latest = actualMemories.slice().sort((left, right) => right.date.localeCompare(left.date))[0];
  if (!latest) return null;
  const days = daysBetweenToday(latest.date);
  if (days < 10) return null;
  return {
    id: "record-gap",
    icon: <Sparkles />,
    title: `${days} 天没有新记录了`,
    desc: "不用补很多，先写一句最近值得留下的小事就够了。",
    meta: "记录",
    tone: "cool",
    priority: Math.min(45, days),
    onClick: () => onQuickMemory()
  };
}

function formatMonthDayOffset(daysAgo: number) {
  if (daysAgo <= 0) return "今天";
  if (daysAgo === 1) return "昨天";
  return `${daysAgo} 天前`;
}

function findDueMemoryPlan(memories: MemoryEvent[]) {
  const today = toDateKey(new Date());
  return memories
    .filter((memory) => isActiveMemoryPlan(memory) && /^\d{4}-\d{2}-\d{2}$/.test(memory.date) && memory.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
}

function buildDueMemoryPlanDesc(memory: MemoryEvent, ctx: ReturnType<typeof buildMemoryDisplayContext>) {
  const title = getMemoryDisplayTitle(memory, ctx);
  const relation = [ctx.personNames.join("、"), ctx.placeNames.join("、")].filter(Boolean).join(" · ");
  if (relation) return `${title} · ${relation}`;
  return title || "打开后可以补成实际发生的回忆。";
}

function findTodayAnniversaryPlanAction(anniversaryPlans: AnniversaryPlan[], people: ReturnType<typeof useLifeLog>["state"]["people"]) {
  const today = toDateKey(new Date());
  const plan = anniversaryPlans
    .filter((item) => item.targetDate === today && item.status !== "done" && item.status !== "skipped")
    .sort(compareTodayPlans)[0];
  if (!plan) return null;

  const person = people.find((item) => item.id === plan.personId);
  const done = plan.checklist.filter((item) => item.done).length;
  const total = plan.checklist.length;
  return {
    plan,
    title: `${person?.name || "某人"}的${formatAnniversaryPlanTargetTitle(plan)}就是今天`,
    desc: total ? `${plan.title} · 已完成 ${done}/${total} 项` : `${plan.title} · 今天确认安排`,
    meta: plan.status === "doing" ? "准备中" : "今日"
  };
}

function compareTodayPlans(left: AnniversaryPlan, right: AnniversaryPlan) {
  const leftScore = left.status === "doing" ? 1 : 0;
  const rightScore = right.status === "doing" ? 1 : 0;
  return rightScore - leftScore || right.updatedAt.localeCompare(left.updatedAt);
}

function buildUpcomingPlanStatus(
  plans: ReturnType<typeof useLifeLog>["state"]["anniversaryPlans"],
  item: ReturnType<typeof getUpcomingAnniversaries>[number]
) {
  const plan = findPlanForAnniversaryTarget(
    plans,
    item.personId,
    {
      title: item.title,
      date: item.kind === "milestone" ? item.sourceDate : item.date
    },
    item.kind === "milestone"
      ? {
        targetKind: "milestone",
        occurrenceYear: buildOccurrenceYear(item.date),
        targetDate: item.date,
        daysUntilTarget: item.days,
        milestoneDay: item.milestoneDay,
        milestoneLabel: item.milestoneLabel
      }
      : {
        targetKind: "annual",
        occurrenceYear: buildOccurrenceYear(item.date),
        targetDate: item.date,
        daysUntilTarget: item.days
      }
  );

  if (!plan) return { label: item.days <= 3 ? "临近未安排" : "未安排", tone: item.days <= 3 ? "urgent" : "missing" };
  if (plan.status === "done") return { label: "已完成", tone: "done" };
  if (plan.status === "skipped") return { label: "已跳过", tone: "muted" };

  const total = plan.checklist.length;
  const done = plan.checklist.filter((todo) => todo.done).length;
  const prefix = plan.status === "doing" ? "准备中" : "待准备";
  return {
    label: total ? `${prefix} ${done}/${total}` : prefix,
    tone: plan.status === "doing" ? "doing" : "todo"
  };
}

function buildOccurrenceYear(date: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const source = new Date(`${date}T00:00:00`);
  let target = new Date(today.getFullYear(), source.getMonth(), source.getDate());
  if (target < today) target = new Date(today.getFullYear() + 1, source.getMonth(), source.getDate());
  return target.getFullYear();
}

function navigateToReminderSource(
  path: string,
  onOpenPerson: (personId: string, hash?: string) => void,
  onOpenCalendar: () => void
) {
  const personMatch = path.match(/^\/people\/([^#/?]+)((?:\?[^#]*)?)(?:#anniversaries)?$/);
  if (personMatch) {
    onOpenPerson(personMatch[1], `${personMatch[2] || ""}${path.includes("#anniversaries") ? "#anniversaries" : ""}`);
    return;
  }
  onOpenCalendar();
}

function getUpcomingAnniversaryLinkTarget(item: ReturnType<typeof getUpcomingAnniversaries>[number]) {
  return {
    title: item.title,
    date: item.kind === "milestone" ? item.sourceDate : item.date
  };
}

function buildCurrentMonthScheduleItems({
  anniversaryPlans,
  memories,
  getPersonName,
  getPlaceName
}: {
  anniversaryPlans: AnniversaryPlan[];
  memories: MemoryEvent[];
  getPersonName: (id: string) => string;
  getPlaceName: (id: string) => string;
}): { items: MonthlyScheduleItem[]; total: number } {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();

  const anniversaryItems: MonthlyScheduleItem[] = anniversaryPlans
    .filter((plan) => {
      if (plan.status === "skipped") return false;
      const time = new Date(`${plan.targetDate}T00:00:00`).getTime();
      return time >= monthStart && time < nextMonthStart;
    })
    .map((plan) => ({
      id: `anniversary-plan-${plan.id}`,
      kind: "anniversary-plan",
      title: `${getPersonName(plan.personId)} · ${formatAnniversaryPlanTargetTitle(plan)}`,
      desc: plan.title,
      date: plan.targetDate,
      statusLabel: formatPlanStatus(plan),
      statusTone: plan.status,
      path: `/people/${plan.personId}${buildPersonAnniversarySuffix({ title: plan.anniversaryTitle, date: plan.anniversaryDate })}`,
      anniversaryKey: buildAnniversaryScheduleKey(plan.personId, plan.anniversaryTitle, plan.anniversaryDate, plan.targetDate),
      sortScore: getPlanSortScore(plan),
      updatedAt: plan.updatedAt
    }));

  const memoryPlanItems: MonthlyScheduleItem[] = memories
    .filter((memory) => {
      if (!isActiveMemoryPlan(memory) || !/^\d{4}-\d{2}-\d{2}$/.test(memory.date)) return false;
      const time = new Date(`${memory.date}T00:00:00`).getTime();
      return time >= monthStart && time < nextMonthStart;
    })
    .map((memory) => {
      const ctx = buildMemoryDisplayContext(memory, getPersonName, getPlaceName);
      const title = getMemoryDisplayTitle(memory, ctx);
      const relation = [ctx.personNames.join("、"), ctx.placeNames.join("、")].filter(Boolean).join(" · ");
      return {
        id: `memory-plan-${memory.id}`,
        kind: "memory-plan",
        title,
        desc: relation || memory.content || "日历计划",
        date: memory.date,
        statusLabel: memory.date < toDateKey(new Date()) ? "逾期" : memory.date === toDateKey(new Date()) ? "今日" : "计划",
        statusTone: memory.date < toDateKey(new Date()) ? "overdue" : memory.date === toDateKey(new Date()) ? "today" : "memory",
        path: `/memories/${memory.id}`,
        sortScore: memory.date <= toDateKey(new Date()) ? 4 : 2,
        updatedAt: memory.date
      };
    });

  const sorted = [...anniversaryItems, ...memoryPlanItems]
    .sort((left, right) => {
      const statusScore = right.sortScore - left.sortScore;
      return statusScore || left.date.localeCompare(right.date) || right.updatedAt.localeCompare(left.updatedAt);
    });

  return {
    items: sorted.slice(0, 4),
    total: sorted.length
  };
}

function isUpcomingCoveredByMonthlySchedule(
  item: ReturnType<typeof getUpcomingAnniversaries>[number],
  items: MonthlyScheduleItem[]
) {
  const sourceDate = item.kind === "milestone" ? item.sourceDate : item.date;
  const key = buildAnniversaryScheduleKey(item.personId, item.title, sourceDate, item.date);
  return items.some((plan) => plan.anniversaryKey === key);
}

function buildAnniversaryScheduleKey(personId: string, title: string, anniversaryDate: string, targetDate: string) {
  return [personId, title, anniversaryDate, targetDate].join("|");
}

function getPlanSortScore(plan: AnniversaryPlan) {
  if (plan.status === "doing") return 3;
  if (plan.status === "todo") return 2;
  if (plan.status === "done") return 1;
  return 0;
}

function formatPlanStatus(plan: AnniversaryPlan) {
  if (plan.status === "done") return "完成";
  if (plan.status === "doing") return "准备";
  return "待办";
}

function compareHomePlaceRows(
  left: { place: Place; visitStats: PlaceVisitStats },
  right: { place: Place; visitStats: PlaceVisitStats }
) {
  return (
    Number(right.place.favorite) - Number(left.place.favorite) ||
    compareDateDesc(left.visitStats.latestDate, right.visitStats.latestDate) ||
    right.visitStats.visitCount - left.visitStats.visitCount ||
    buildPlaceDisplayName(left.place).localeCompare(buildPlaceDisplayName(right.place), "zh-CN")
  );
}

function compareDateDesc(left: string, right: string) {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return right.localeCompare(left);
}

function buildHomePlaceSubtitle(place: Place) {
  return [place.category, place.city, place.area].filter(Boolean).join(" · ") || "未设置分类";
}

function daysBetweenToday(date: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${date}T00:00:00`);
  target.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - target.getTime()) / 86400000);
}

function countMemoriesInCurrentMonth(memories: MemoryEvent[]) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();

  return memories.filter((memory) => {
    const time = new Date(`${memory.date}T00:00:00`).getTime();
    return time >= monthStart && time < nextMonthStart;
  }).length;
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
