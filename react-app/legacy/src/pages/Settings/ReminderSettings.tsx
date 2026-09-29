import { Bell, Clock, Calendar, Users, History, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import GlassCard from "../../components/GlassCard";
import ListRow from "../../components/ListRow";
import NumberStepper from "../../components/NumberStepper";
import TimePicker from "../../components/TimePicker";
import { useLifeLog } from "../../context/LifeLogContext";
import { notifyReminderPermissionChanged } from "../../hooks/useReminderScheduling";
import { checkNotificationPermission, requestNotificationPermission } from "../../utils/notificationPermissions";
import { previewReminderSchedule, previewUpcomingReminders, sendTestNotification } from "../../utils/reminderScheduler";
import { isSmartPromptCategoryEnabled, useUserPreferences } from "../../hooks/useUserPreferences";
import { recordUxMetric, type SmartPromptMetricCategory } from "../../utils/uxMetrics";

export default function ReminderSettings() {
  const { state, reminderSettings, updateReminderSettings } = useLifeLog();
  const { prefs, updatePreference } = useUserPreferences();
  const [hasPermission, setHasPermission] = useState(false);
  const [isCheckingPermission, setIsCheckingPermission] = useState(true);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const schedulePreview = previewReminderSchedule(state.people, state.memories, reminderSettings);
  const upcomingReminders = previewUpcomingReminders(state.people, state.memories, reminderSettings);

  useEffect(() => {
    checkNotificationPermission()
      .then(setHasPermission)
      .finally(() => setIsCheckingPermission(false));
  }, []);

  async function handleRequestPermission() {
    setIsRequestingPermission(true);
    try {
      const granted = await requestNotificationPermission();
      setHasPermission(granted);
      notifyReminderPermissionChanged();
    } finally {
      setIsRequestingPermission(false);
    }
  }

  async function handleTestNotification() {
    setIsSendingTest(true);
    try {
      await sendTestNotification();
    } finally {
      setTimeout(() => setIsSendingTest(false), 3000);
    }
  }

  function handleToggle(key: keyof typeof reminderSettings) {
    void updateReminderSettings({
      [key]: !reminderSettings[key]
    });
  }

  function handleNumberChange(key: keyof typeof reminderSettings, value: number) {
    void updateReminderSettings({ [key]: value });
  }

  function handleTimeChange(key: keyof typeof reminderSettings, value: string) {
    void updateReminderSettings({ [key]: value });
  }

  function handleSmartPromptCategory(category: SmartPromptMetricCategory) {
    const enabled = isSmartPromptCategoryEnabled(prefs, category);
    updatePreference("smartPromptCategories", {
      ...prefs.smartPromptCategories,
      [category]: !enabled
    });
    if (enabled) {
      recordUxMetric({ event: "smart_prompt", category, outcome: "reduce" });
    }
  }

  return (
    <div className="reminder-settings">
      <ListRow className="pref-block">
        <div className="reminder-permission-status">
          <Bell size={20} />
          <div>
            <strong>通知权限</strong>
            {isCheckingPermission ? (
              <span className="permission-status checking">检查中...</span>
            ) : hasPermission ? (
              <span className="permission-status granted">已授权 ✓</span>
            ) : (
              <span className="permission-status denied">未授权 ✗</span>
            )}
          </div>
        </div>
        {!hasPermission && !isCheckingPermission && (
          <button
            className="category-pill active"
            onClick={handleRequestPermission}
            disabled={isRequestingPermission}
          >
            {isRequestingPermission ? "请求中..." : "启用通知"}
          </button>
        )}
      </ListRow>

      <GlassCard className={`reminder-schedule-summary ${hasPermission ? "ready" : "blocked"}`}>
        <div className="reminder-schedule-summary-head">
          <Clock size={18} />
          <div>
            <strong>{hasPermission ? "提醒调度状态" : "提醒已配置但不会调度"}</strong>
            <span>
              {schedulePreview.enabledTypes.length
                ? schedulePreview.enabledTypes.join("、")
                : "未启用任何提醒类型"}
            </span>
          </div>
        </div>
        <div className="reminder-schedule-metrics">
          <span>
            <strong>{schedulePreview.scheduledCount}</strong>
            预计调度
          </span>
          <span>
            <strong>{schedulePreview.totalGenerated}</strong>
            生成提醒
          </span>
          <span>
            <strong>{schedulePreview.nextAt ? formatReminderDate(schedulePreview.nextAt) : "无"}</strong>
            下次提醒
          </span>
        </div>
        <p>
          {hasPermission
            ? schedulePreview.capped
              ? "系统最多保留 64 条待触发提醒，超出的提醒会在后续重新调度时补上。"
              : "保存设置后会自动重新调度本地通知。"
            : "请先启用通知权限，否则这些提醒只会保存在设置中，不会触发系统通知。"}
        </p>
        <div className="reminder-upcoming-list">
          <strong>未来 7 天预览</strong>
          {upcomingReminders.length ? (
            upcomingReminders.map((item) => (
              <div className="reminder-upcoming-item" key={`${item.type}-${item.id}`}>
                <span>{item.type}</span>
                <div>
                  <strong>{item.title}</strong>
                  <small>{formatReminderDate(item.at)} · {item.body}</small>
                </div>
              </div>
            ))
          ) : (
            <p>未来 7 天没有会触发的提醒。</p>
          )}
        </div>
      </GlassCard>

      <ListRow className="smart-prompt-settings-block">
        <div className="smart-prompt-settings-head">
          <Sparkles size={18} />
          <div>
            <strong>首页轻提示</strong>
            <span>只控制现有建议类别，不影响系统通知</span>
          </div>
        </div>
        <div className="smart-prompt-category-list">
          {smartPromptCategoryOptions.map((option) => (
            <label className="smart-prompt-category" key={option.id}>
              <span>
                <strong>{option.label}</strong>
                <small>{option.desc}</small>
              </span>
              <span className="reminder-toggle">
                <input
                  type="checkbox"
                  checked={isSmartPromptCategoryEnabled(prefs, option.id)}
                  onChange={() => handleSmartPromptCategory(option.id)}
                />
                <span className="toggle-slider" aria-hidden="true" />
              </span>
            </label>
          ))}
        </div>
      </ListRow>

      <div className="content-list reminder-config-list">
      <ListRow className="reminder-config-block">
        <div className="reminder-config-header">
          <Calendar size={18} />
          <strong>生日提醒</strong>
          <label className="reminder-toggle">
            <input
              type="checkbox"
              checked={reminderSettings.birthdayEnabled}
              onChange={() => handleToggle("birthdayEnabled")}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
        {reminderSettings.birthdayEnabled && (
          <div className="reminder-config-details">
            <div className="reminder-config-row">
              <span>提前天数</span>
              <NumberStepper
                min={1}
                max={30}
                value={reminderSettings.birthdayAdvanceDays}
                label="生日提前天数"
                onChange={(value) => handleNumberChange("birthdayAdvanceDays", value)}
              />
            </div>
            <div className="reminder-config-row">
              <span>提醒时间</span>
              <TimePicker
                label="生日提醒时间"
                value={reminderSettings.birthdayTime}
                onChange={(value) => handleTimeChange("birthdayTime", value)}
              />
            </div>
          </div>
        )}
      </ListRow>

      <ListRow className="reminder-config-block">
        <div className="reminder-config-header">
          <History size={18} />
          <strong>纪念日提醒</strong>
          <label className="reminder-toggle">
            <input
              type="checkbox"
              checked={reminderSettings.anniversaryEnabled}
              onChange={() => handleToggle("anniversaryEnabled")}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
        {reminderSettings.anniversaryEnabled && (
          <div className="reminder-config-details">
            <div className="reminder-config-row">
              <span>提前天数</span>
              <NumberStepper
                min={1}
                max={30}
                value={reminderSettings.anniversaryAdvanceDays}
                label="纪念日提前天数"
                onChange={(value) => handleNumberChange("anniversaryAdvanceDays", value)}
              />
            </div>
            <div className="reminder-config-row">
              <span>提醒时间</span>
              <TimePicker
                label="纪念日提醒时间"
                value={reminderSettings.anniversaryTime}
                onChange={(value) => handleTimeChange("anniversaryTime", value)}
              />
            </div>
          </div>
        )}
      </ListRow>

      <ListRow className="reminder-config-block">
        <div className="reminder-config-header">
          <Users size={18} />
          <strong>定期联系提醒</strong>
          <label className="reminder-toggle">
            <input
              type="checkbox"
              checked={reminderSettings.contactEnabled}
              onChange={() => handleToggle("contactEnabled")}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
        {reminderSettings.contactEnabled && (
          <div className="reminder-config-details">
            <div className="reminder-config-row">
              <span>间隔天数</span>
              <NumberStepper
                min={7}
                max={90}
                value={reminderSettings.contactIntervalDays}
                label="联系间隔天数"
                onChange={(value) => handleNumberChange("contactIntervalDays", value)}
              />
            </div>
            <div className="reminder-config-row">
              <span>提醒时间</span>
              <TimePicker
                label="定期联系提醒时间"
                value={reminderSettings.contactTime}
                onChange={(value) => handleTimeChange("contactTime", value)}
              />
            </div>
          </div>
        )}
      </ListRow>

      <ListRow className="reminder-config-block">
        <div className="reminder-config-header">
          <Clock size={18} />
          <strong>回忆回顾提醒</strong>
          <label className="reminder-toggle">
            <input
              type="checkbox"
              checked={reminderSettings.memoryEnabled}
              onChange={() => handleToggle("memoryEnabled")}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
        {reminderSettings.memoryEnabled && (
          <div className="reminder-config-details">
            <div className="reminder-config-row">
              <span>提醒时间</span>
              <TimePicker
                label="回忆回顾提醒时间"
                value={reminderSettings.memoryTime}
                onChange={(value) => handleTimeChange("memoryTime", value)}
              />
            </div>
          </div>
        )}
      </ListRow>
      </div>

      {hasPermission && (
        <button
          className="category-pill"
          onClick={handleTestNotification}
          disabled={isSendingTest}
        >
          {isSendingTest ? "已发送，请等待 3 秒..." : "发送测试通知"}
        </button>
      )}
    </div>
  );
}

const smartPromptCategoryOptions: Array<{ id: SmartPromptMetricCategory; label: string; desc: string }> = [
  { id: "anniversary", label: "纪念日准备", desc: "临近纪念日但还没有安排" },
  { id: "contact", label: "久未联系", desc: "重要人物较久没有新记录" },
  { id: "profile", label: "档案补全", desc: "重要人物缺少喜好信息" },
  { id: "place", label: "常去地点", desc: "多次到访但尚未收藏" },
  { id: "record-gap", label: "记录间隔", desc: "一段时间没有留下新记录" }
];

function formatReminderDate(date: Date) {
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}
