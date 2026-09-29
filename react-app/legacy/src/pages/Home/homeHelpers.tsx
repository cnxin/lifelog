import { Calendar, CheckCircle2, Gift, Heart, MapPin, Sparkles, Users } from "lucide-react";
import type { MouseEvent } from "react";
import type { AnniversaryPlan, MemoryEvent, Place } from "../../types";
import { buildPersonAnniversarySuffix } from "../../utils/anniversaryLinks";
import { findPlanForAnniversaryTarget, formatAnniversaryPlanTargetTitle } from "../../utils/anniversaryPlans";
import { formatMonthDay, getUpcomingAnniversaries } from "../../utils/date";
import { buildMemoryDisplayContext, getMemoryDisplayTitle, isActiveMemoryPlan } from "../../utils/memoryDisplay";
import { buildPlaceDisplayName } from "../../utils/placeMeta";
import { buildPlaceVisitStats, type PlaceVisitStats } from "../../utils/placeVisitStats";
import { previewUpcomingReminders } from "../../utils/reminderScheduler";
import type { useLifeLog } from "../../context/LifeLogContext";
import type { SmartPromptMetricCategory } from "../../utils/uxMetrics";
import type { SmartPromptCategoryPreferences } from "../../hooks/useUserPreferences";

export interface FlashbackItem {
  kind: string;
  badge: string;
  title: string;
  desc: string;
  memory: MemoryEvent;
}

export function buildOnThisDayMemories(
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

export function getMemoryPlaceIdsForHome(memory: MemoryEvent) {
  return Array.from(new Set([...(memory.placeIds || []), memory.placeId || ""].filter(Boolean)));
}

export function buildOnThisDayQuickPrefill(
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

export function saveQuickInboxPrefill(value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("lifelog:quick-inbox-prefill", value);
  } catch {
    // Ignore storage failures; quick record can still open normally.
  }
}

export interface TodayAction {
  id: string;
  icon: JSX.Element;
  title: string;
  desc: string;
  meta?: string;
  tone?: "warm" | "cool";
  canDismiss?: boolean;
  onClick: () => void;
}

export type TodayActionPrefs = Record<string, number | "dismissed">;

export interface SmartPrompt {
  id: string;
  category: SmartPromptMetricCategory;
  icon: JSX.Element;
  title: string;
  desc: string;
  meta: string;
  tone?: "warm" | "cool";
  priority: number;
  onClick: () => void;
}

export interface OpenMemoryOptions {
  personIds?: string[];
  placeIds?: string[];
  initialDate?: string;
  pendingPlanId?: string | null;
}

export interface MonthlyScheduleItem {
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

export function buildTodayActions({
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

export function handleActionTool(event: MouseEvent<HTMLButtonElement>, handler: () => void) {
  event.stopPropagation();
  handler();
}

export function loadTodayActionPrefs(): TodayActionPrefs {
  if (typeof window === "undefined") return {};
  try {
    const stored = window.localStorage.getItem(getTodayActionPrefKey());
    return stored ? JSON.parse(stored) as TodayActionPrefs : {};
  } catch {
    return {};
  }
}

export function saveTodayActionPrefs(prefs: TodayActionPrefs) {
  try {
    window.localStorage.setItem(getTodayActionPrefKey(), JSON.stringify(prefs));
  } catch {
    // 本地偏好失败时不影响首页主流程。
  }
}

export function loadSmartPromptPrefs(): TodayActionPrefs {
  if (typeof window === "undefined") return {};
  try {
    const stored = window.localStorage.getItem(getSmartPromptPrefKey());
    return stored ? JSON.parse(stored) as TodayActionPrefs : {};
  } catch {
    return {};
  }
}

export function saveSmartPromptPrefs(prefs: TodayActionPrefs) {
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

export function buildSnoozeUntil() {
  return Date.now() + 4 * 60 * 60 * 1000;
}

function getTodayActionPrefKey() {
  return `lifelog:today-actions:${toDateKey(new Date())}`;
}

function getSmartPromptPrefKey() {
  return `lifelog:smart-prompts:${toDateKey(new Date())}`;
}

export function buildSmartPrompts({
  state,
  actualMemories,
  getPersonName,
  upcoming,
  onOpenPerson,
  onOpenPlace,
  onQuickMemory,
  promptPrefs,
  promptCategories
}: {
  state: ReturnType<typeof useLifeLog>["state"];
  actualMemories: MemoryEvent[];
  getPersonName: (id: string) => string;
  upcoming: Array<ReturnType<typeof getUpcomingAnniversaries>[number] & { planStatus: ReturnType<typeof buildUpcomingPlanStatus> }>;
  onOpenPerson: (personId: string) => void;
  onOpenPlace: (placeId: string) => void;
  onQuickMemory: (options?: OpenMemoryOptions) => void;
  promptPrefs: TodayActionPrefs;
  promptCategories?: SmartPromptCategoryPreferences;
}): SmartPrompt[] {
  const prompts: SmartPrompt[] = [
    buildAnniversaryPrepPrompt(upcoming, onOpenPerson),
    buildContactPrompt(state, actualMemories, onOpenPerson),
    buildProfilePrompt(state, onOpenPerson),
    buildFrequentPlacePrompt(state, actualMemories, getPersonName, onOpenPlace),
    buildRecordGapPrompt(actualMemories, onQuickMemory)
  ].filter((item): item is SmartPrompt => Boolean(item));

  return prompts
    .filter((prompt) => promptCategories?.[prompt.category] !== false)
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
    category: "anniversary",
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
    category: "contact",
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
    category: "profile",
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
    category: "place",
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
    category: "record-gap",
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

export function buildUpcomingPlanStatus(
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

export function getUpcomingAnniversaryLinkTarget(item: ReturnType<typeof getUpcomingAnniversaries>[number]) {
  return {
    title: item.title,
    date: item.kind === "milestone" ? item.sourceDate : item.date
  };
}

export function buildCurrentMonthScheduleItems({
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

export function isUpcomingCoveredByMonthlySchedule(
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

export function compareHomePlaceRows(
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

export function buildHomePlaceSubtitle(place: Place) {
  return [place.category, place.city, place.area].filter(Boolean).join(" · ") || "未设置分类";
}

function daysBetweenToday(date: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${date}T00:00:00`);
  target.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - target.getTime()) / 86400000);
}

export function countMemoriesInCurrentMonth(memories: MemoryEvent[]) {
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
