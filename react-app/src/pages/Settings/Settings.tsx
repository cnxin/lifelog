import { BarChart3, Bell, BellOff, Check, ChevronDown, EyeOff, ExternalLink, GitMerge, HeartPulse, SlidersHorizontal, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import DateInput from "../../components/DateInput";
import GlassCard from "../../components/GlassCard";
import NumberStepper from "../../components/NumberStepper";
import TimePicker from "../../components/TimePicker";
import { useConfirm } from "../../context/ConfirmContext";
import { useLifeLog } from "../../context/LifeLogContext";
import { useToast } from "../../context/ToastContext";
import type { AnniversaryPlan, LifeLogState, MemoryEvent, Person, Place, ThemeStyle } from "../../types";
import { buildPlanAnniversaryPath, buildPlanRecordAnniversaryPath } from "../../utils/anniversaryLinks";
import { formatAnniversaryPlanTargetTitle, normalizeAnniversaryPlanTargetKind } from "../../utils/anniversaryPlans";
import { isMemoryPlan } from "../../utils/memoryDisplay";
import { getMemoryPlaceIds } from "../../utils/memoryPlaces";
import { buildPlaceDisplayName } from "../../utils/placeMeta";
import { previewUpcomingReminders } from "../../utils/reminderScheduler";
import ReminderSettings from "./ReminderSettings";

const themeOptions: Array<{
  value: ThemeStyle;
  label: string;
  desc: string;
}> = [
  {
    value: "classic",
    label: "原版",
    desc: "紫橙渐变"
  },
  {
    value: "cream",
    label: "奶油纸感",
    desc: "温柔米白"
  },
  {
    value: "mint",
    label: "薄荷留白",
    desc: "绿蓝清爽"
  },
  {
    value: "mist",
    label: "晨雾极简",
    desc: "冷灰极简"
  }
];

export function AppSettingsPanel() {
  return <SettingsContent sections={["visual", "reminders", "privacy", "defaults"]} />;
}

export function DataOrganizePanel() {
  return <SettingsContent sections={["overview", "health", "dedupe"]} />;
}

export default function Settings() {
  return <SettingsContent />;
}

type SettingsSection = "visual" | "overview" | "health" | "dedupe" | "reminders" | "privacy" | "defaults";
const REMINDER_DISMISS_PREFIX = "lifelog:reminder-center-dismissed:";

function SettingsContent({ sections }: { sections?: SettingsSection[] }) {
  const navigate = useNavigate();
  const {
    state,
    settings,
    reminderSettings,
    duplicatePlaceGroups,
    latestPlaceMerge,
    mergeAllDuplicatePlaces,
    undoLatestPlaceMerge,
    saveAnniversaryPlan,
    updateSettings
  } = useLifeLog();
  const confirm = useConfirm();
  const notify = useToast();
  const mergeLockRef = useRef(false);
  const undoLockRef = useRef(false);
  const [isMerging, setIsMerging] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [showReminders, setShowReminders] = useState(false);
  const [showDefaultAdvanced, setShowDefaultAdvanced] = useState(false);
  const [dismissedReminderIds, setDismissedReminderIds] = useState<string[]>(() => loadDismissedReminderIds());
  const [openPicker, setOpenPicker] = useState<"relationship" | "mood" | null>(null);
  const [pickerAnchor, setPickerAnchor] = useState({ top: 0, right: 0 });

  const relationshipOptions = ["朋友", "家人", "同事", "同学", "恋人", "其他"];
  const moodOptions = ["开心", "平静", "感动", "怀念", "疲惫", "焦虑", "日常"];

  const favoritePeopleCount = useMemo(
    () => state.people.filter((person) => person.favorite).length,
    [state.people]
  );
  const favoritePlacesCount = useMemo(
    () => state.places.filter((place) => place.favorite).length,
    [state.places]
  );
  const cityCount = useMemo(
    () => new Set(state.places.map((place) => place.city).filter(Boolean)).size,
    [state.places]
  );
  const strongCount = useMemo(
    () => duplicatePlaceGroups.filter((group) => group.strength === "strong").length,
    [duplicatePlaceGroups]
  );
  const healthReport = useMemo(() => buildDataHealthReport(state), [state]);
  const memoryStats = useMemo(() => buildRecordStats(state.memories), [state.memories]);
  const reminderCenterItems = useMemo(() => {
    const dismissed = new Set(dismissedReminderIds);
    return previewUpcomingReminders(state.people, state.memories, reminderSettings, { days: 30, limit: 12 })
      .filter((item) => !dismissed.has(String(item.id)));
  }, [dismissedReminderIds, reminderSettings, state.memories, state.people]);
  const duePlans = useMemo(() => buildDuePlanItems(state.anniversaryPlans, state.people), [state.anniversaryPlans, state.people]);
  const visibleSections = sections || ["visual", "overview", "health", "dedupe", "reminders", "privacy", "defaults"];
  const show = (section: SettingsSection) => visibleSections.includes(section);

  async function handleMergeAll() {
    if (mergeLockRef.current) return;
    mergeLockRef.current = true;
    setIsMerging(true);
    try {
      const mergedCount = await mergeAllDuplicatePlaces();
      await confirm({
        title: "合并完成",
        message: mergedCount ? `已合并 ${mergedCount} 条重复地点。` : "没有可自动合并的强重复地点。",
        confirmText: "好的",
        tone: "info"
      });
    } finally {
      mergeLockRef.current = false;
      setIsMerging(false);
    }
  }

  async function handleUndo() {
    if (undoLockRef.current) return;
    const accepted = await confirm({
      title: "撤销上次合并",
      message: "将恢复到上次地点合并前的状态。",
      confirmText: "确认撤销"
    });
    if (!accepted) return;

    undoLockRef.current = true;
    setIsUndoing(true);
    try {
      const reverted = await undoLatestPlaceMerge();
      await confirm({
        title: "撤销结果",
        message: reverted ? "已撤销上次地点合并。" : "没有可撤销的地点合并记录。",
        confirmText: "好的",
        tone: "info"
      });
    } finally {
      undoLockRef.current = false;
      setIsUndoing(false);
    }
  }

  function handleSettingsBlur<K extends keyof typeof settings>(key: K, value: string) {
    void updateSettings({
      [key]: value.trim()
    });
  }

  function togglePicker(type: "relationship" | "mood", element: HTMLButtonElement) {
    if (openPicker === type) {
      setOpenPicker(null);
      return;
    }

    const appContainer = element.closest(".app-container")?.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    setPickerAnchor({
      top: rect.bottom - (appContainer?.top || 0) + 8,
      right: (appContainer?.right || window.innerWidth) - rect.right
    });
    setOpenPicker(type);
  }

  function handlePickerSelect<K extends keyof typeof settings>(key: K, value: string) {
    setOpenPicker(null);
    void updateSettings({
      [key]: value
    });
  }

  function dismissReminder(id: number) {
    const key = getDismissedReminderKey();
    const next = Array.from(new Set([...dismissedReminderIds, String(id)]));
    localStorage.setItem(key, JSON.stringify(next));
    setDismissedReminderIds(next);
  }

  function restoreDismissedReminders() {
    localStorage.removeItem(getDismissedReminderKey());
    setDismissedReminderIds([]);
  }

  async function updatePlanStatus(plan: AnniversaryPlan, status: "done" | "skipped") {
    await saveAnniversaryPlan({
      ...plan,
      status,
      checklist: status === "done" ? plan.checklist.map((item) => ({ ...item, done: true })) : plan.checklist,
      updatedAt: new Date().toISOString()
    });
    notify({
      message: status === "done" ? "安排已完成" : "安排已跳过",
      tone: "success",
      actions: status === "done"
        ? [{
            label: "记录回忆",
            onClick: () => navigate(buildPlanRecordAnniversaryPath(plan))
          }]
        : undefined
    });
  }

  return (
    <>
      {show("visual") && <section className="section">
        <div className="section-header">
          <h2>
            <SlidersHorizontal /> 视觉风格
          </h2>
        </div>
        <div className="theme-selector-row">
          {themeOptions.map((option) => (
            <button
              className={`theme-option theme-option-${option.value} ${settings.themeStyle === option.value ? "active" : ""}`}
              type="button"
              key={option.value}
              aria-pressed={settings.themeStyle === option.value}
              onClick={() => void updateSettings({ themeStyle: option.value })}
            >
              <span className="theme-option-swatch" aria-hidden="true" />
              <strong>{option.label}</strong>
              <small>{option.desc}</small>
            </button>
          ))}
        </div>
        <p className="form-hint settings-section-hint">选择后会立即应用到全局页面和控件，并在刷新后保留。</p>
      </section>}

      {show("overview") && <section className="section">
        <div className="section-header">
          <h2>
            <BarChart3 /> 数据概览
          </h2>
        </div>
        <GlassCard className="insight-card">
          <div className="metric">
            <strong>{state.people.length}</strong>
            <span>人物</span>
          </div>
          <div className="metric">
            <strong>{state.places.length}</strong>
            <span>地点</span>
          </div>
          <div className="metric">
            <strong>{memoryStats.memories}</strong>
            <span>回忆</span>
          </div>
          <div className="metric">
            <strong>{memoryStats.plans}</strong>
            <span>计划</span>
          </div>
        </GlassCard>
        <GlassCard className="insight-card">
          <div className="metric">
            <strong>{favoritePeopleCount}</strong>
            <span>收藏人物</span>
          </div>
          <div className="metric">
            <strong>{favoritePlacesCount}</strong>
            <span>收藏地点</span>
          </div>
          <div className="metric">
            <strong>{cityCount}</strong>
            <span>去过的城市</span>
          </div>
        </GlassCard>
      </section>}

      {show("health") && <section className="section">
        <div className="section-header">
          <h2>
            <HeartPulse /> 资料体检
          </h2>
          <button className="see-all" onClick={() => navigate(healthReport.nextPath || "/people")}>
            去补全
          </button>
        </div>
        <GlassCard className="data-health-card">
          <div className="data-health-score">
            <strong>{healthReport.score}</strong>
            <span>完整度</span>
          </div>
          <div className="data-health-summary">
            <strong>{healthReport.title}</strong>
            <span>{healthReport.desc}</span>
          </div>
        </GlassCard>
        {healthReport.items.length > 0 ? (
          <div className="data-health-list">
            {healthReport.items.slice(0, 6).map((item) => (
              <button className="data-health-item glass-card" type="button" key={item.id} onClick={() => navigate(item.path)}>
                <span className={`data-health-icon ${item.tone}`}>{item.count}</span>
                <span className="data-health-copy">
                  <strong>{item.title}</strong>
                  <small>{item.desc}</small>
                </span>
                <em>{item.kind}</em>
              </button>
            ))}
          </div>
        ) : (
          <GlassCard className="empty">人物、地点、回忆和计划的核心字段都已经比较完整。</GlassCard>
        )}
      </section>}

      {show("dedupe") && <section className="section">
        <div className="section-header">
          <h2>
            <GitMerge /> 地点去重
          </h2>
        </div>
        {duplicatePlaceGroups.length > 0 ? (
          <>
            <GlassCard className="pref-block">
              <p className="memory-desc">
                发现 {duplicatePlaceGroups.length} 组疑似重复地点，其中 {strongCount} 组强重复可以自动合并。
              </p>
              {strongCount > 0 && (
                <button
                  className="category-pill active"
                  onClick={() => void handleMergeAll()}
                  disabled={isMerging}
                >
                  {isMerging ? "合并中…" : "一键合并强重复"}
                </button>
              )}
            </GlassCard>
            <div className="list">
              {duplicatePlaceGroups.map((group) => (
                <GlassCard className="detail-row" key={group.signature}>
                  <strong>{group.label}</strong>
                  <span>{group.placeIds.length} 条 · {group.strength === "strong" ? "强重复" : "弱重复"}</span>
                </GlassCard>
              ))}
            </div>
          </>
        ) : (
          <GlassCard className="empty">没有发现重复地点</GlassCard>
        )}
        {latestPlaceMerge && (
          <div className="settings-undo-row">
            <p className="form-hint">上次合并：{latestPlaceMerge.reason}</p>
            <button
              className="category-pill"
              onClick={() => void handleUndo()}
              disabled={isUndoing}
            >
              {isUndoing ? "撤销中…" : "撤销上次合并"}
            </button>
          </div>
        )}
      </section>}

      {show("reminders") && <section className="section">
        <div className="section-header">
          <h2>
            <Bell /> 提醒中心
          </h2>
          <button
            className="category-pill"
            onClick={() => setShowReminders(!showReminders)}
          >
            {showReminders ? "收起设置" : "提醒设置"}
          </button>
        </div>
        <GlassCard className="reminder-center-card">
          <div className="reminder-center-head">
            <div>
              <strong>未来 30 天</strong>
              <span>
                {reminderCenterItems.length || duePlans.length
                  ? `${duePlans.length + reminderCenterItems.length} 个待关注事项`
                  : dismissedReminderIds.length
                    ? `今天已忽略 ${dismissedReminderIds.length} 个提醒`
                    : "没有需要处理的提醒"}
              </span>
            </div>
            {dismissedReminderIds.length > 0 && (
              <button className="mini-action" type="button" onClick={restoreDismissedReminders}>
                恢复忽略
              </button>
            )}
          </div>
          {duePlans.length || reminderCenterItems.length ? (
            <div className="reminder-center-list">
              {duePlans.map((item) => (
                <div className="reminder-center-item action" key={item.plan.id}>
                  <span className="reminder-center-type">安排</span>
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.desc}</small>
                  </div>
                  <div className="reminder-center-actions">
                    <button className="mini-action" type="button" onClick={() => navigate(buildPlanAnniversaryPath(item.plan))}>
                      <ExternalLink size={13} />
                      查看
                    </button>
                    <button className="mini-action" type="button" onClick={() => void updatePlanStatus(item.plan, "done")}>
                      <Check size={13} />
                      完成并记录
                    </button>
                    <button className="mini-action" type="button" onClick={() => void updatePlanStatus(item.plan, "skipped")}>
                      <X size={13} />
                      跳过
                    </button>
                  </div>
                </div>
              ))}
              {reminderCenterItems.slice(0, 6).map((item) => (
                <div className="reminder-center-item" key={`${item.type}-${item.id}`}>
                  <span className="reminder-center-type">{item.type}</span>
                  <div>
                    <strong>{item.title}</strong>
                    <small>{formatReminderCenterDate(item.at)} · {item.body}</small>
                  </div>
                  <div className="reminder-center-actions">
                    <button
                      className="mini-action"
                      type="button"
                      onClick={() => navigate(item.sourcePath || "/calendar")}
                    >
                      <ExternalLink size={13} />
                      查看
                    </button>
                    <button
                      className="mini-action"
                      type="button"
                      onClick={() => dismissReminder(item.id)}
                    >
                      <BellOff size={13} />
                      忽略
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="form-hint">今天忽略的提醒只会在当天隐藏，明天会重新进入提醒中心。</p>
          )}
        </GlassCard>
        {showReminders && <ReminderSettings />}
      </section>}

      {show("privacy") && <section className="section">
        <div className="section-header">
          <h2>
            <EyeOff /> 隐私显示
          </h2>
        </div>
        <div className="privacy-setting-list">
          <GlassCard className="reminder-config-row privacy-setting-row">
            <div>
              <strong>隐私模式</strong>
              <span>模糊首页、列表和详情里的主要文字，适合公共场合临时打开。</span>
            </div>
            <label className="reminder-toggle">
              <input
                type="checkbox"
                checked={Boolean(settings.privacyMode)}
                onChange={(event) => void updateSettings({ privacyMode: event.target.checked })}
              />
              <span className="toggle-slider"></span>
            </label>
          </GlassCard>
          <GlassCard className="reminder-config-row privacy-setting-row">
            <div>
              <strong>隐藏照片缩略图</strong>
              <span>照片网格和地点照片会以柔和遮罩显示，点开前不暴露内容。</span>
            </div>
            <label className="reminder-toggle">
              <input
                type="checkbox"
                checked={Boolean(settings.hidePhotoThumbnails)}
                onChange={(event) => void updateSettings({ hidePhotoThumbnails: event.target.checked })}
              />
              <span className="toggle-slider"></span>
            </label>
          </GlassCard>
        </div>
      </section>}

      {show("defaults") && <section className="section">
        <div className="section-header">
          <h2>
            <SlidersHorizontal /> 默认值
          </h2>
        </div>
        <div className="list">
          <GlassCard className="detail-row settings-default-row">
            <strong>默认城市</strong>
            <input
              className="settings-default-input"
              defaultValue={settings.defaultCity}
              placeholder="杭州"
              onBlur={(event) => handleSettingsBlur("defaultCity", event.target.value)}
            />
          </GlassCard>
          <GlassCard className="detail-row settings-default-row">
            <strong>默认关系</strong>
            <div className="settings-picker">
              <button
                className="settings-picker-trigger"
                type="button"
                aria-expanded={openPicker === "relationship"}
                onClick={(event) => togglePicker("relationship", event.currentTarget)}
              >
                <span>{settings.defaultRelationship}</span>
                <ChevronDown />
              </button>
            </div>
          </GlassCard>
          <GlassCard className="detail-row settings-default-row">
            <strong>默认心情</strong>
            <div className="settings-picker">
              <button
                className="settings-picker-trigger"
                type="button"
                aria-expanded={openPicker === "mood"}
                onClick={(event) => togglePicker("mood", event.currentTarget)}
              >
                <span>{settings.defaultMood}</span>
                <ChevronDown />
              </button>
            </div>
          </GlassCard>
          <GlassCard className="settings-control-demo">
            <button className="settings-fold-head" type="button" onClick={() => setShowDefaultAdvanced((open) => !open)} aria-expanded={showDefaultAdvanced}>
              <span>
                <strong>高级显示预览</strong>
                <small>日期、时间、数字和开关控件样式</small>
              </span>
              <ChevronDown className={showDefaultAdvanced ? "rotate-open" : ""} />
            </button>
            {showDefaultAdvanced && (
              <div className="settings-control-demo-grid">
                <label className="settings-control-field">
                  <span>日期</span>
                  <DateInput label="Demo 日期" defaultValue="2026-05-08" />
                </label>
                <label className="settings-control-field">
                  <span>时间</span>
                  <TimePicker label="Demo 时间" value="09:00" onChange={() => undefined} />
                </label>
                <label className="settings-control-field">
                  <span>数字</span>
                  <NumberStepper min={1} max={30} defaultValue={7} label="Demo 数字" />
                </label>
                <div className="settings-control-field inline">
                  <span>开关</span>
                  <label className="reminder-toggle">
                    <input type="checkbox" defaultChecked />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>
            )}
          </GlassCard>
        </div>
        <p className="form-hint settings-section-hint">新建人物、地点和回忆时会使用这些默认值，修改后自动保存。</p>
      </section>}

      {openPicker && (
        <>
          <button
            className="settings-picker-backdrop"
            type="button"
            aria-label="关闭选项菜单"
            onClick={() => setOpenPicker(null)}
          />
          <div
            className="settings-picker-menu"
            style={{ top: pickerAnchor.top, right: pickerAnchor.right }}
          >
            {(openPicker === "relationship" ? relationshipOptions : moodOptions).map((option) => {
              const activeValue = openPicker === "relationship" ? settings.defaultRelationship : settings.defaultMood;
              return (
                <button
                  className={option === activeValue ? "active" : ""}
                  type="button"
                  key={option}
                  onClick={() =>
                    handlePickerSelect(openPicker === "relationship" ? "defaultRelationship" : "defaultMood", option)
                  }
                >
                  {option}
                </button>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

interface HealthItem {
  id: string;
  kind: string;
  title: string;
  desc: string;
  count: number;
  path: string;
  tone: "person" | "place" | "memory";
  severity: number;
}

function buildDataHealthReport(state: LifeLogState) {
  const actualMemories = state.memories.filter((memory) => !isMemoryPlan(memory));
  const items: HealthItem[] = [
    buildPeopleBirthdayHealth(state.people),
    buildPeoplePreferenceHealth(state.people),
    buildPlaceMapHealth(state.places),
    buildPlaceAddressHealth(state.places),
    buildPlacePhotoHealth(state.places),
    buildMemoryContentHealth(actualMemories),
    buildMemoryPeopleHealth(actualMemories),
    buildMemoryPlaceHealth(actualMemories),
    buildMemoryTagHealth(actualMemories)
  ].filter((item): item is HealthItem => Boolean(item && item.count > 0));

  const totalChecks =
    state.people.length * 2 +
    state.places.length * 3 +
    actualMemories.length * 4;
  const missingChecks = items.reduce((sum, item) => sum + item.count, 0);
  const score = totalChecks ? Math.max(0, Math.round(((totalChecks - missingChecks) / totalChecks) * 100)) : 100;
  const sortedItems = items.sort((left, right) => right.severity - left.severity || right.count - left.count);
  const nextItem = sortedItems[0];

  return {
    score,
    title: nextItem ? `还有 ${missingChecks} 项资料可补全` : "资料状态良好",
    desc: nextItem ? `优先处理：${nextItem.title}` : "继续记录新的回忆或计划即可。",
    nextPath: nextItem?.path || "",
    items: sortedItems
  };
}

function buildRecordStats(memories: MemoryEvent[]) {
  const plans = memories.filter(isMemoryPlan).length;
  return {
    memories: memories.length - plans,
    plans
  };
}

function buildPeopleBirthdayHealth(people: Person[]): HealthItem | null {
  const missing = people.filter((person) => !person.birthday);
  const first = missing[0];
  return first
    ? {
        id: "people-birthday",
        kind: "人物",
        title: `${missing.length} 位人物缺生日`,
        desc: `${first.name} 等人物补充后会进入日历和提醒。`,
        count: missing.length,
        path: `/people/${first.id}`,
        tone: "person",
        severity: 8
      }
    : null;
}

function buildPeoplePreferenceHealth(people: Person[]): HealthItem | null {
  const missing = people.filter((person) => !safeArray(person.preferences).length && !safeArray(person.dislikes).length);
  const first = missing[0];
  return first
    ? {
        id: "people-preferences",
        kind: "人物",
        title: `${missing.length} 位人物缺喜好`,
        desc: `${first.name} 等人物还没有偏好或禁忌记录。`,
        count: missing.length,
        path: `/people/${first.id}`,
        tone: "person",
        severity: 6
      }
    : null;
}

function buildPlaceMapHealth(places: Place[]): HealthItem | null {
  const missing = places.filter((place) => !place.mapUrl && !(place.latitude && place.longitude));
  const first = missing[0];
  return first
    ? {
        id: "place-map",
        kind: "地点",
        title: `${missing.length} 个地点缺地图入口`,
        desc: `${buildPlaceDisplayName(first)} 还不能直接打开高德。`,
        count: missing.length,
        path: `/places/${first.id}`,
        tone: "place",
        severity: 9
      }
    : null;
}

function buildPlaceAddressHealth(places: Place[]): HealthItem | null {
  const missing = places.filter((place) => !place.address && !place.mall && !place.area);
  const first = missing[0];
  return first
    ? {
        id: "place-address",
        kind: "地点",
        title: `${missing.length} 个地点缺位置层级`,
        desc: `${buildPlaceDisplayName(first)} 还没有地址、区域或商场信息。`,
        count: missing.length,
        path: `/places/${first.id}`,
        tone: "place",
        severity: 7
      }
    : null;
}

function buildPlacePhotoHealth(places: Place[]): HealthItem | null {
  const missing = places.filter((place) => !safeArray(place.photos).length);
  const first = missing[0];
  return first
    ? {
        id: "place-photos",
        kind: "地点",
        title: `${missing.length} 个地点缺照片`,
        desc: `${buildPlaceDisplayName(first)} 的详情页还没有照片。`,
        count: missing.length,
        path: `/places/${first.id}`,
        tone: "place",
        severity: 4
      }
    : null;
}

function buildMemoryContentHealth(memories: MemoryEvent[]): HealthItem | null {
  const missing = memories.filter((memory) => !safeText(memory.content).trim());
  const first = missing[0];
  return first
    ? {
        id: "memory-content",
        kind: "回忆",
        title: `${missing.length} 条回忆缺正文`,
        desc: `${first.title || "未命名回忆"} 还没有记录发生了什么。`,
        count: missing.length,
        path: `/memories/${first.id}`,
        tone: "memory",
        severity: 8
      }
    : null;
}

function buildMemoryPeopleHealth(memories: MemoryEvent[]): HealthItem | null {
  const missing = memories.filter((memory) => !safeArray(memory.personIds).length);
  const first = missing[0];
  return first
    ? {
        id: "memory-people",
        kind: "回忆",
        title: `${missing.length} 条回忆缺人物`,
        desc: `${first.title || "未命名回忆"} 还没有关联人物。`,
        count: missing.length,
        path: `/memories/${first.id}`,
        tone: "memory",
        severity: 7
      }
    : null;
}

function buildMemoryPlaceHealth(memories: MemoryEvent[]): HealthItem | null {
  const missing = memories.filter((memory) => !getMemoryPlaceIds(memory).length);
  const first = missing[0];
  return first
    ? {
        id: "memory-place",
        kind: "回忆",
        title: `${missing.length} 条回忆缺地点`,
        desc: `${first.title || "未命名回忆"} 还没有关联地点。`,
        count: missing.length,
        path: `/memories/${first.id}`,
        tone: "memory",
        severity: 7
      }
    : null;
}

function buildMemoryTagHealth(memories: MemoryEvent[]): HealthItem | null {
  const missing = memories.filter((memory) => memory.mood === "日常" && !safeArray(memory.tags).length);
  const first = missing[0];
  return first
    ? {
        id: "memory-tags",
        kind: "回忆",
        title: `${missing.length} 条回忆缺心情标签`,
        desc: `${first.title || "未命名回忆"} 还没有能帮助搜索的标签。`,
        count: missing.length,
        path: `/memories/${first.id}`,
        tone: "memory",
        severity: 5
      }
    : null;
}

function safeArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

function safeText(value: unknown) {
  return String(value || "");
}

function getDismissedReminderKey() {
  return `${REMINDER_DISMISS_PREFIX}${new Date().toISOString().slice(0, 10)}`;
}

function loadDismissedReminderIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(getDismissedReminderKey()) || "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function formatReminderCenterDate(value: Date) {
  return value.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function buildDuePlanItems(plans: AnniversaryPlan[], people: Person[]) {
  const today = new Date().toISOString().slice(0, 10);
  return plans
    .filter((plan) => plan.targetDate <= today && plan.status !== "done" && plan.status !== "skipped")
    .sort((left, right) => left.targetDate.localeCompare(right.targetDate))
    .slice(0, 6)
    .map((plan) => {
      const person = people.find((item) => item.id === plan.personId);
      const done = plan.checklist.filter((item) => item.done).length;
      const total = plan.checklist.length;
      return {
        plan,
        title: `${person?.name || "未关联人物"} · ${plan.title}`,
        desc: [
          plan.targetDate < today ? `已到期 ${plan.targetDate}` : "今天执行",
          normalizeAnniversaryPlanTargetKind(plan) === "milestone" ? formatAnniversaryPlanTargetTitle(plan) : "",
          total ? `待办 ${done}/${total}` : "暂无待办",
          plan.placeIds.length ? `关联地点 ${plan.placeIds.length}` : ""
        ].filter(Boolean).join(" · ")
      };
    });
}
