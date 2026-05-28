import { Calendar, Clock, Heart, History, Inbox, MapPin, PenLine, Sparkles, Star, Users } from "lucide-react";
import { MouseEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import EntrySheet from "../../components/EntrySheet";
import GlassCard from "../../components/GlassCard";
import MemoryCard from "../../components/MemoryCard";
import { useLifeLog } from "../../context/LifeLogContext";
import type { AnniversaryPlan, EntryType, MemoryEvent, Place } from "../../types";
import { formatLunarDate, formatMonthDay, getUpcomingAnniversaries, todayLabel } from "../../utils/date";
import { buildMemoryDisplayContext } from "../../utils/memoryDisplay";
import { buildPlaceDisplayName } from "../../utils/placeMeta";
import { buildPlaceVisitStats, type PlaceVisitStats } from "../../utils/placeVisitStats";
import { previewUpcomingReminders } from "../../utils/reminderScheduler";
import { initials } from "../../utils/text";

export default function Home() {
  const navigate = useNavigate();
  const { state, reminderSettings, getPersonName, getPlaceName } = useLifeLog();
  const [entrySheetType, setEntrySheetType] = useState<EntryType | null>(null);
  const [initialMemoryPersonIds, setInitialMemoryPersonIds] = useState<string[]>([]);
  const [initialMemoryPlaceIds, setInitialMemoryPlaceIds] = useState<string[]>([]);
  const [inboxText, setInboxText] = useState(() => loadQuickInboxDraft());
  const [actionPrefs, setActionPrefs] = useState<TodayActionPrefs>(() => loadTodayActionPrefs());
  const upcoming = getUpcomingAnniversaries(state.people)
    .filter((item) => item.days >= 0 && item.days <= 30)
    .slice(0, 4)
    .map((item) => ({
      ...item,
      planStatus: buildUpcomingPlanStatus(state.anniversaryPlans, item)
    }));
  const favorites = state.people.filter((person) => person.favorite).slice(0, 3);
  const recent = [...state.memories].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const featuredPlaces = useMemo(
    () =>
      state.places
        .map((place) => ({ place, visitStats: buildPlaceVisitStats(place.id, state.memories, getPersonName) }))
        .sort(compareHomePlaceRows)
        .slice(0, 3),
    [getPersonName, state.memories, state.places]
  );
  const monthlyMemoryCount = countMemoriesInCurrentMonth(state.memories);
  const flashbacks = buildFlashbacks(state.memories, getPersonName, getPlaceName).slice(0, 4);

  useEffect(() => {
    saveQuickInboxDraft(inboxText);
  }, [inboxText]);

  function openQuickMemory(personIds: string[] = [], placeIds: string[] = []) {
    setInitialMemoryPersonIds(personIds);
    setInitialMemoryPlaceIds(placeIds);
    setEntrySheetType("memory");
  }

  function openInboxMemory() {
    const text = inboxText.trim();
    if (!text) {
      openQuickMemory();
      return;
    }

    setInitialMemoryPersonIds([]);
    setInitialMemoryPlaceIds([]);
    setInboxText("");
    setEntrySheetType("memory");
    window.localStorage.setItem("lifelog:quick-inbox-prefill", text);
    clearQuickInboxDraft();
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
    onAddMemoryForPerson: (personId) => {
      openQuickMemory([personId]);
    },
    actionPrefs
  });
  const hasRealTodayActions = todayActions.length > 0;

  function updateActionPref(actionId: string, mode: "snooze" | "dismiss") {
    const next: TodayActionPrefs = {
      ...actionPrefs,
      [actionId]: mode === "snooze" ? buildSnoozeUntil() : "dismissed"
    };
    setActionPrefs(next);
    saveTodayActionPrefs(next);
  }

  return (
    <>
      <section className="section home-hero-section">
        <div className="home-hero-copy">
          <span>{todayLabel()}</span>
          <h1>今天的 LifeLog</h1>
          <p>快速回看最近的人、地点和回忆，从一件小事开始继续记录。</p>
        </div>
        <GlassCard className="insight-card home-overview-card">
          <div className="metric">
            <strong>{state.people.length}</strong>
            <span>人物</span>
          </div>
          <div className="metric">
            <strong>{state.places.length}</strong>
            <span>地点</span>
          </div>
          <div className="metric">
            <strong>{state.memories.length}</strong>
            <span>回忆</span>
          </div>
          <div className="metric metric-wide">
            <strong>{monthlyMemoryCount}</strong>
            <span>本月新增回忆</span>
          </div>
        </GlassCard>
      </section>

      <section className="section">
        <GlassCard className="quick-inbox-card">
          <div className="quick-inbox-head">
            <span className="quick-memory-icon">
              <Inbox />
            </span>
            <div>
              <strong>快速记录收件箱</strong>
              <span>先把一句话放进来，保存后再慢慢整理人物、地点和标签。</span>
            </div>
          </div>
          <div className="quick-inbox-input">
            <textarea
              value={inboxText}
              onChange={(event) => setInboxText(event.target.value)}
              placeholder="例如：今天和小林在湖滨吃了晚饭，聊到下次去看展"
            />
            <button type="button" onClick={openInboxMemory}>
              <PenLine />
              {inboxText.trim() ? "整理成回忆" : "快速记录"}
            </button>
          </div>
        </GlassCard>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>
            <Sparkles /> 今日行动
          </h2>
          {hasRealTodayActions ? (
            <button className="see-all" onClick={() => openQuickMemory()}>
              记录
            </button>
          ) : (
            <button className="see-all" onClick={() => navigate("/calendar")}>
              日历
            </button>
          )}
        </div>
        <div className={hasRealTodayActions ? "today-action-list" : "today-action-empty"}>
          {hasRealTodayActions ? todayActions.map((action) => (
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
          )) : (
            <GlassCard className="home-empty-card compact">
              <strong>今天没有必须处理的事项</strong>
              <span>提醒、联系和纪念日安排都暂时不用处理。可以直接记录新回忆，或去日历看看未来安排。</span>
            </GlassCard>
          )}
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>
            <Calendar /> 纪念日与安排
          </h2>
          <button className="see-all" onClick={() => navigate("/calendar")}>
            查看
          </button>
        </div>
        {upcoming.length > 0 ? (
          <div className="anniversary-scroll-wrapper">
            <div className="anniversary-scroll">
              {upcoming.map((item, index) => (
                <button
                  key={`${item.personName}-${item.title}`}
                  className={`anniversary-card glass-card ${index % 2 ? "secondary" : ""}`}
                  onClick={() => navigate(`/people/${item.personId}#anniversaries`)}
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
        ) : (
          <GlassCard className="home-empty-card">
            <strong>未来 30 天暂无纪念日</strong>
            <span>补充人物生日或纪念日后，这里会显示即将到来的安排。</span>
            <button onClick={() => setEntrySheetType("person")}>添加人物</button>
          </GlassCard>
        )}
      </section>

      {tasks.length > 0 && (
        <section className="section">
          <div className="section-header">
            <h2>
              <Sparkles /> 待补全
            </h2>
          </div>
          <div className="task-grid">
            {tasks.slice(0, 4).map((task) => (
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
        </section>
      )}

      <section className="section">
        <div className="section-header">
          <h2>
            <Users /> 收藏的人
          </h2>
          <button className="see-all" onClick={() => navigate("/people")}>
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
            <span>把重要的人设为收藏后，首页会优先显示 TA。</span>
            <button onClick={() => navigate("/people")}>去看看人物</button>
          </GlassCard>
        )}
      </section>

      <section className="section">
        <div className="section-header">
          <h2>
            <MapPin /> 常去地点
          </h2>
          <button className="see-all" onClick={() => navigate("/places")}>
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
            <span>添加餐厅、景点或常去的地方后，首页会显示最近到访。</span>
            <button onClick={() => setEntrySheetType("place")}>添加地点</button>
          </GlassCard>
        )}
      </section>

      <section className="section">
        <div className="section-header">
          <h2>
            <Clock /> 最近回忆
          </h2>
          <button className="see-all" onClick={() => navigate("/memories")}>
            全部
          </button>
        </div>
        {recent.length > 0 ? (
          <div className="list">
            {recent.map((memory) => {
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
          <GlassCard className="home-empty-card">
            <strong>还没有记录回忆</strong>
            <span>从今天发生的一件小事开始，建立你的第一条 LifeLog。</span>
            <div className="home-empty-actions">
              <button
                onClick={() => {
                  openQuickMemory();
                }}
              >
                记录一条回忆
              </button>
              <button onClick={() => setEntrySheetType("place")}>添加地点</button>
            </div>
          </GlassCard>
        )}
      </section>

      {flashbacks.length > 0 && (
        <section className="section">
          <div className="section-header">
            <h2>
              <History /> 回忆闪回
            </h2>
            <button className="see-all" onClick={() => navigate("/memories")}>
              全部
            </button>
          </div>
          <div className="flashback-list">
            {flashbacks.map((item) => (
              <button className="flashback-card glass-card" type="button" key={`${item.kind}-${item.memory.id}`} onClick={() => navigate(`/memories/${item.memory.id}`)}>
                <span>{item.badge}</span>
                <strong>{item.title}</strong>
                <small>{item.desc}</small>
              </button>
            ))}
          </div>
        </section>
      )}
      <EntrySheet
        type={entrySheetType}
        memoryMode={entrySheetType === "memory" ? "quick" : "full"}
        initialPersonIds={entrySheetType === "memory" ? initialMemoryPersonIds : []}
        initialPlaceIds={entrySheetType === "memory" ? initialMemoryPlaceIds : []}
        onClose={() => {
          setEntrySheetType(null);
          setInitialMemoryPersonIds([]);
          setInitialMemoryPlaceIds([]);
        }}
      />
    </>
  );
}

interface FlashbackItem {
  kind: string;
  badge: string;
  title: string;
  desc: string;
  memory: MemoryEvent;
}

function buildFlashbacks(
  memories: MemoryEvent[],
  getPersonName: (id: string) => string,
  getPlaceName: (id: string) => string
): FlashbackItem[] {
  const today = new Date();
  const month = today.getMonth();
  const day = today.getDate();
  const currentYear = today.getFullYear();
  const byKey = new Map<string, FlashbackItem>();

  memories
    .filter((memory) => {
      const date = new Date(`${memory.date}T00:00:00`);
      return date.getFullYear() < currentYear && date.getMonth() === month && date.getDate() === day;
    })
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 2)
    .forEach((memory) => {
      const years = currentYear - new Date(`${memory.date}T00:00:00`).getFullYear();
      byKey.set(memory.id, {
        kind: "on-this-day",
        badge: `${years} 年前`,
        title: memory.title || "往年今日",
        desc: buildMemoryContextLine(memory, getPersonName, getPlaceName) || memory.content || "有一条旧回忆可以回看。",
        memory
      });
    });

  [...memories]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(3, 16)
    .forEach((memory) => {
      if (byKey.size >= 4 || byKey.has(memory.id)) return;
      byKey.set(memory.id, {
        kind: "recent-context",
        badge: formatMonthDay(memory.date),
        title: memory.title || "最近的旧回忆",
        desc: buildMemoryContextLine(memory, getPersonName, getPlaceName) || memory.content || "可以重新打开看看细节。",
        memory
      });
    });

  return Array.from(byKey.values());
}

function buildMemoryContextLine(memory: MemoryEvent, getPersonName: (id: string) => string, getPlaceName: (id: string) => string) {
  const ctx = buildMemoryDisplayContext(memory, getPersonName, getPlaceName);
  return [ctx.personNames.join("、"), ctx.placeNames.join("、")].filter(Boolean).join(" · ");
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

function buildTodayActions({
  state,
  reminderSettings,
  getPersonName,
  getPlaceName,
  onOpenMemory,
  onOpenPerson,
  onOpenCalendar,
  onAddMemoryForPerson,
  actionPrefs
}: {
  state: ReturnType<typeof useLifeLog>["state"];
  reminderSettings: ReturnType<typeof useLifeLog>["reminderSettings"];
  getPersonName: (id: string) => string;
  getPlaceName: (id: string) => string;
  onOpenMemory: (memoryId: string) => void;
  onOpenPerson: (personId: string, hash?: string) => void;
  onOpenCalendar: () => void;
  onAddMemoryForPerson: (personId: string) => void;
  actionPrefs: TodayActionPrefs;
}): TodayAction[] {
  const actions: TodayAction[] = [];
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
      onClick: () => onOpenPerson(todayPlanAction.plan.personId, "#anniversaries")
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

  const personToContact = findPersonToContact(state.people, state.memories);
  if (personToContact) {
    actions.push({
      id: `contact-${personToContact.personId}`,
      icon: <Users />,
      title: `和 ${personToContact.name} 补一条互动`,
      desc: personToContact.daysSinceContact === null ? "还没有共同回忆，可以从第一次互动开始。" : `距离上次记录已经 ${personToContact.daysSinceContact} 天。`,
      meta: "联系",
      tone: "warm",
      canDismiss: true,
      onClick: () => onAddMemoryForPerson(personToContact.personId)
    });
  }

  const todayMemory = findOnThisDayMemory(state.memories);
  if (todayMemory) {
    const ctx = buildMemoryDisplayContext(todayMemory, getPersonName, getPlaceName);
    actions.push({
      id: `on-this-day-${todayMemory.id}`,
      icon: <History />,
      title: `${new Date().getFullYear() - new Date(`${todayMemory.date}T00:00:00`).getFullYear()} 年前的今天`,
      desc: ctx.personNames.length || ctx.placeNames.length ? [ctx.personNames.join("、"), ctx.placeNames.join("、")].filter(Boolean).join(" · ") : todayMemory.content || "有一条旧回忆可以回看。",
      meta: formatMonthDay(todayMemory.date),
      tone: "cool",
      canDismiss: true,
      onClick: () => onOpenMemory(todayMemory.id)
    });
  }

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

function loadQuickInboxDraft() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("lifelog:quick-inbox-draft") || "";
}

function saveQuickInboxDraft(value: string) {
  if (typeof window === "undefined") return;
  try {
    const text = value.trim();
    if (text) {
      window.localStorage.setItem("lifelog:quick-inbox-draft", value);
    } else {
      clearQuickInboxDraft();
    }
  } catch {
    // 草稿只是辅助恢复，不影响首页记录流程。
  }
}

function clearQuickInboxDraft() {
  try {
    window.localStorage.removeItem("lifelog:quick-inbox-draft");
  } catch {
    // 忽略本地草稿清理失败。
  }
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
    title: `${person?.name || "某人"}的${plan.anniversaryTitle}就是今天`,
    desc: total ? `${plan.title} · 已完成 ${done}/${total} 项` : `${plan.title} · 今天确认安排`,
    meta: plan.status === "doing" ? "准备中" : "今日"
  };
}

function compareTodayPlans(left: AnniversaryPlan, right: AnniversaryPlan) {
  const leftScore = left.status === "doing" ? 1 : 0;
  const rightScore = right.status === "doing" ? 1 : 0;
  return rightScore - leftScore || right.updatedAt.localeCompare(left.updatedAt);
}

function findPersonToContact(people: Array<{ id: string; name: string; favorite: boolean }>, memories: MemoryEvent[]) {
  const candidates = people.map((person) => {
    const latestMemory = memories
      .filter((memory) => (memory.personIds || []).includes(person.id))
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    const daysSinceContact = latestMemory ? daysBetweenToday(latestMemory.date) : null;
    return {
      personId: person.id,
      name: person.name,
      score: (person.favorite ? 1000 : 0) + (daysSinceContact ?? 365),
      daysSinceContact
    };
  });

  return candidates
    .filter((item) => item.daysSinceContact === null || item.daysSinceContact >= 21)
    .sort((a, b) => b.score - a.score)[0];
}

function buildUpcomingPlanStatus(
  plans: ReturnType<typeof useLifeLog>["state"]["anniversaryPlans"],
  item: ReturnType<typeof getUpcomingAnniversaries>[number]
) {
  const plan = plans.find((candidate) =>
    candidate.personId === item.personId &&
    candidate.anniversaryTitle === item.title &&
    candidate.anniversaryDate === item.date &&
    candidate.occurrenceYear === buildOccurrenceYear(item.date)
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
  const personMatch = path.match(/^\/people\/([^#/?]+)(?:#anniversaries)?$/);
  if (personMatch) {
    onOpenPerson(personMatch[1], path.includes("#anniversaries") ? "#anniversaries" : "");
    return;
  }
  onOpenCalendar();
}

function findOnThisDayMemory(memories: MemoryEvent[]) {
  const today = new Date();
  const month = today.getMonth();
  const day = today.getDate();

  return memories
    .filter((memory) => {
      const date = new Date(`${memory.date}T00:00:00`);
      return date.getFullYear() < today.getFullYear() && date.getMonth() === month && date.getDate() === day;
    })
    .sort((a, b) => b.date.localeCompare(a.date))[0];
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
