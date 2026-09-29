import { Calendar, ChevronDown, Clock, Heart, History, MapPin, PenLine, Search, Sparkles, Star, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import AvatarFace from "../../components/AvatarFace";
import EntrySheet from "../../components/EntrySheet";
import GlassCard from "../../components/GlassCard";
import MemoryCard from "../../components/MemoryCard";
import OnboardingChecklist from "../../components/OnboardingChecklist";
import { useLifeLog } from "../../context/LifeLogContext";
import { useHomeLayout } from "../../hooks/useHomeLayout";
import { useOnboardingProgress } from "../../hooks/useOnboardingProgress";
import { getBooleanPreference, useUserPreferences } from "../../hooks/useUserPreferences";
import type { EntryType } from "../../types";
import { buildPersonAnniversarySuffix } from "../../utils/anniversaryLinks";
import { formatLunarDate, formatMonthDay, getUpcomingAnniversaries } from "../../utils/date";
import { buildMemoryDisplayContext, isMemoryPlan } from "../../utils/memoryDisplay";
import { buildPlaceDisplayName } from "../../utils/placeMeta";
import { buildPlaceVisitStats } from "../../utils/placeVisitStats";
import {
  buildCurrentMonthScheduleItems,
  buildHomePlaceSubtitle,
  buildOnThisDayMemories,
  buildOnThisDayQuickPrefill,
  buildSnoozeUntil,
  buildSmartPrompts,
  buildTodayActions,
  buildUpcomingPlanStatus,
  compareHomePlaceRows,
  countMemoriesInCurrentMonth,
  getMemoryPlaceIdsForHome,
  getUpcomingAnniversaryLinkTarget,
  handleActionTool,
  isUpcomingCoveredByMonthlySchedule,
  loadSmartPromptPrefs,
  loadTodayActionPrefs,
  saveQuickInboxPrefill,
  saveSmartPromptPrefs,
  saveTodayActionPrefs,
  type FlashbackItem,
  type OpenMemoryOptions,
  type SmartPrompt,
  type TodayActionPrefs
} from "./homeHelpers";
import { recordUxMetric, type HomeMetricSection } from "../../utils/uxMetrics";
import { seedData } from "../../data/seedData";

const DEMO_PERSON_IDS = new Set(seedData.people.map((person) => person.id));
const DEMO_PLACE_IDS = new Set(seedData.places.map((place) => place.id));
const DEMO_MEMORY_IDS = new Set(seedData.memories.map((memory) => memory.id));

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
  const [onboardingDeferred, setOnboardingDeferred] = useState(false);
  const shownSmartPromptIdsRef = useRef(new Set<string>());
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
  const userPersonCount = state.people.filter((person) => !DEMO_PERSON_IDS.has(person.id)).length;
  const userPlaceCount = state.places.filter((place) => !DEMO_PLACE_IDS.has(place.id)).length;
  const userMemoryCount = actualMemories.filter((memory) => !DEMO_MEMORY_IDS.has(memory.id)).length;
  const onboarding = useOnboardingProgress({
    memoryCount: userMemoryCount,
    personCount: userPersonCount,
    totalRecords: userPersonCount + userPlaceCount + userMemoryCount
  });
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
      promptPrefs: smartPromptPrefs,
      promptCategories: prefs.smartPromptCategories
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

  useEffect(() => {
    const prompt = smartPrompts[0];
    if (!prompt || shownSmartPromptIdsRef.current.has(prompt.id)) return;
    shownSmartPromptIdsRef.current.add(prompt.id);
    recordUxMetric({ event: "smart_prompt", category: prompt.category, outcome: "shown" });
  }, [smartPrompts[0]?.id]);

  function toggleHomeSection(section: HomeMetricSection, current: boolean, setOpen: (value: boolean) => void) {
    const next = !current;
    setOpen(next);
    recordUxMetric({ event: "home_section", section, action: next ? "open" : "close" });
  }
  function updateActionPref(actionId: string, mode: "snooze" | "dismiss") {
    const next: TodayActionPrefs = {
      ...actionPrefs,
      [actionId]: mode === "snooze" ? buildSnoozeUntil() : "dismissed"
    };
    setActionPrefs(next);
    saveTodayActionPrefs(next);
  }
  function updateSmartPromptPref(prompt: SmartPrompt, mode: "snooze" | "dismiss") {
    const next: TodayActionPrefs = {
      ...smartPromptPrefs,
      [prompt.id]: mode === "snooze" ? buildSnoozeUntil() : "dismissed"
    };
    setSmartPromptPrefs(next);
    saveSmartPromptPrefs(next);
    recordUxMetric({ event: "smart_prompt", category: prompt.category, outcome: mode });
  }

  function openSmartPrompt(prompt: SmartPrompt) {
    recordUxMetric({ event: "smart_prompt", category: prompt.category, outcome: "open" });
    prompt.onClick();
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

      {onboarding.visible && !onboardingDeferred && (
        <section className="section" style={{ order: 0 }}>
          <OnboardingChecklist
            completedCount={onboarding.completedCount}
            stepStates={onboarding.stepStates}
            onStartMemory={() => openQuickMemory()}
            onStartPerson={() => setEntrySheetType("person")}
            onOpenBackup={() => navigate("/account", { state: { accountTab: "data" } })}
            onSkipStep={onboarding.skipStep}
            onLater={() => setOnboardingDeferred(true)}
          />
        </section>
      )}

      {todayActions.length > 0 && (
        <section className="section" style={{ order: homeLayout.getSectionOrder("todayQueue") }}>
          <GlassCard className={`today-queue-card ${todayQueueOpen ? "open" : ""}`}>
            <button className="today-queue-summary" type="button" onClick={() => toggleHomeSection("todayQueue", todayQueueOpen, setTodayQueueOpen)}>
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
            <button className="home-smart-prompt-main" type="button" onClick={() => openSmartPrompt(smartPrompts[0])}>
              <span className="home-smart-prompt-icon">{smartPrompts[0].icon}</span>
              <span className="home-smart-prompt-copy">
                <strong>{smartPrompts[0].title}</strong>
                <small>{smartPrompts[0].desc}</small>
              </span>
              <em>{smartPrompts[0].meta}</em>
            </button>
            <span className="home-smart-prompt-tools">
              <button type="button" onClick={(event) => handleActionTool(event, () => updateSmartPromptPref(smartPrompts[0], "snooze"))}>
                稍后
              </button>
              <button type="button" onClick={(event) => handleActionTool(event, () => updateSmartPromptPref(smartPrompts[0], "dismiss"))}>
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
            <button className="today-queue-summary" type="button" onClick={() => toggleHomeSection("taskQueue", taskQueueOpen, setTaskQueueOpen)}>
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
          <button className="see-all home-library-toggle" type="button" onClick={() => toggleHomeSection("homeLibrary", homeLibraryOpen, setHomeLibraryOpen)}>
            {homeLibraryOpen ? "收起" : "展开"}
            <ChevronDown />
          </button>
        </div>
        <button className="home-library-strip glass-card" type="button" onClick={() => toggleHomeSection("homeLibrary", homeLibraryOpen, setHomeLibraryOpen)}>
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
                      <AvatarFace name={person.name} className="fav-avatar" />
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

