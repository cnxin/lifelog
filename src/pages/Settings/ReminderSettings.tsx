import { Bell, Clock, Calendar, Users, History } from "lucide-react";
import { useEffect, useState } from "react";
import GlassCard from "../../components/GlassCard";
import { useLifeLog } from "../../context/LifeLogContext";
import { notifyReminderPermissionChanged } from "../../hooks/useReminderScheduling";
import { checkNotificationPermission, requestNotificationPermission } from "../../utils/notificationPermissions";
import { sendTestNotification } from "../../utils/reminderScheduler";

export default function ReminderSettings() {
  const { reminderSettings, updateReminderSettings } = useLifeLog();
  const [hasPermission, setHasPermission] = useState(false);
  const [isCheckingPermission, setIsCheckingPermission] = useState(true);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);

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

  function handleNumberChange(key: keyof typeof reminderSettings, value: string) {
    const num = parseInt(value, 10);
    if (!isNaN(num)) {
      void updateReminderSettings({ [key]: num });
    }
  }

  function handleTimeChange(key: keyof typeof reminderSettings, value: string) {
    void updateReminderSettings({ [key]: value });
  }

  return (
    <div className="reminder-settings">
      <GlassCard className="pref-block">
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
      </GlassCard>

      <GlassCard className="reminder-config-block">
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
              <input
                type="number"
                min="1"
                max="30"
                value={reminderSettings.birthdayAdvanceDays}
                onChange={(e) => handleNumberChange("birthdayAdvanceDays", e.target.value)}
                className="reminder-number-input"
              />
            </div>
            <div className="reminder-config-row">
              <span>提醒时间</span>
              <input
                type="time"
                value={reminderSettings.birthdayTime}
                onChange={(e) => handleTimeChange("birthdayTime", e.target.value)}
                className="reminder-time-input"
              />
            </div>
          </div>
        )}
      </GlassCard>

      <GlassCard className="reminder-config-block">
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
              <input
                type="number"
                min="1"
                max="30"
                value={reminderSettings.anniversaryAdvanceDays}
                onChange={(e) => handleNumberChange("anniversaryAdvanceDays", e.target.value)}
                className="reminder-number-input"
              />
            </div>
            <div className="reminder-config-row">
              <span>提醒时间</span>
              <input
                type="time"
                value={reminderSettings.anniversaryTime}
                onChange={(e) => handleTimeChange("anniversaryTime", e.target.value)}
                className="reminder-time-input"
              />
            </div>
          </div>
        )}
      </GlassCard>

      <GlassCard className="reminder-config-block">
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
              <input
                type="number"
                min="7"
                max="90"
                value={reminderSettings.contactIntervalDays}
                onChange={(e) => handleNumberChange("contactIntervalDays", e.target.value)}
                className="reminder-number-input"
              />
            </div>
            <div className="reminder-config-row">
              <span>提醒时间</span>
              <input
                type="time"
                value={reminderSettings.contactTime}
                onChange={(e) => handleTimeChange("contactTime", e.target.value)}
                className="reminder-time-input"
              />
            </div>
          </div>
        )}
      </GlassCard>

      <GlassCard className="reminder-config-block">
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
              <input
                type="time"
                value={reminderSettings.memoryTime}
                onChange={(e) => handleTimeChange("memoryTime", e.target.value)}
                className="reminder-time-input"
              />
            </div>
          </div>
        )}
      </GlassCard>

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
