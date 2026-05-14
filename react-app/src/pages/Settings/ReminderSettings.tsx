import { Bell, Clock, Calendar, Users, History } from "lucide-react";
import { useEffect, useState } from "react";
import GlassCard from "../../components/GlassCard";
import NumberStepper from "../../components/NumberStepper";
import TimePicker from "../../components/TimePicker";
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

  function handleNumberChange(key: keyof typeof reminderSettings, value: number) {
    void updateReminderSettings({ [key]: value });
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
              <TimePicker
                label="回忆回顾提醒时间"
                value={reminderSettings.memoryTime}
                onChange={(value) => handleTimeChange("memoryTime", value)}
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
