import { useState } from "react";
import { Pin, Pencil, CalendarPlus } from "lucide-react";
import Modal from "./Modal";
import { dayStatus, lunarLabel, type Day } from "./domain";
import { formatDate, icons, tones, yearsLabel, elapsedLabel } from "./dayMeta";
import ReminderBell from "./ReminderBell";
import { hasNativeNotifications } from "./notifications";
import { getReminderTime } from "./reminders";
import { buildCalendarIntentPayload } from "./calendarIntent";
import { CalendarBridge, hasNativeCalendar } from "./calendarBridge";
import { haptic } from "./haptics";
import useNotices from "./hooks/useNotices";

export default function DayDetail({
  day,
  today,
  onClose,
  onEdit,
  onTogglePin,
  onDelete,
}: {
  day: Day;
  today: string;
  onClose: () => void;
  onEdit: (day: Day) => void;
  onTogglePin: (day: Day) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const status = dayStatus(day, today);
  const years = yearsLabel(day, status);
  const elapsed = day.date < today ? elapsedLabel(day, status) : null;
  const Icon = icons[day.category];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { notice, noticeVisible, onChanged } = useNotices();
  async function insertCalendar() {
    setBusy(true);
    setError("");
    void haptic("light");
    try {
      const result = await CalendarBridge.insert(buildCalendarIntentPayload(day, today));
      if (!result.ok) onChanged("此设备没有可用的日历应用", false);
    } catch {
      setError("无法打开系统日历，请稍后重试。");
    } finally { setBusy(false); }
  }
  async function pin() {
    setBusy(true);
    setError("");
    try {
      await onTogglePin(day);
    } catch {
      setError("置顶更新失败，请重试。");
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    void haptic("medium");
    setBusy(true);
    setError("");
    try { await onDelete(day.id); }
    catch { setError("删除失败，请重试。"); }
    finally { setBusy(false); }
  }
  return (
    <Modal
      title={day.title}
      eyebrow={day.category}
      onClose={onClose}
      busy={busy}
      className="detail-modal"
    >
      <div className={`day-detail ${tones[day.category]}`}>
        <span className="detail-category">
          <Icon size={20} aria-hidden="true" />
          {day.category}
          <ReminderBell day={day} />
        </span>
        <div className="detail-count">
          <span>{status.label}</span>
          {status.delta !== 0 && (
            <>
              <strong>{status.count.toLocaleString()}</strong>
              <span>天</span>
            </>
          )}
          {years && <p className="detail-years">{years}</p>}
          {elapsed && <p className="detail-elapsed">{elapsed.split(String(status.elapsed))[0]}<strong>{status.elapsed}</strong> 天</p>}
        </div>
        <div className="detail-dates">
          <p>公历 · {formatDate(day.date)}</p>
          {day.calendar === "lunar" && <p>{lunarLabel(day.date)}</p>}
          {day.repeat === "yearly" ? (
            <>
              <p>下次 · {formatDate(status.next)}</p>
              <p>每年{day.calendar === "lunar" ? "农历" : "公历"}重复</p>
            </>
          ) : (
            <p>
              {status.delta < 0
                ? `已经过去 ${status.count} 天`
                : status.delta === 0
                  ? "就是今天"
                  : `还有 ${status.count} 天`}
            </p>
          )}
        </div>
        <section className="detail-note" aria-label="备注">
          <p>{day.note || "还没有留下备注"}</p>
        </section>
        {hasNativeNotifications() && day.reminders.length > 0 && (
          <p className="detail-reminders">提醒 · {day.reminderTime ?? getReminderTime()} · {day.reminders.map(offset =>
            offset === 0 ? "当天" : `提前${offset}天`).join("、")}</p>
        )}
        {error && (
          <p role="alert" className="error-box">
            {error}
          </p>
        )}
        <div className={`editor-footer detail-footer${hasNativeCalendar() ? " detail-footer-native" : ""}`}>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => void pin()}
          >
            <Pin size={17} aria-hidden="true" />
            {day.pinned ? "取消置顶" : "置顶"}
          </button>
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={() => onEdit(day)}
          >
            <Pencil size={17} aria-hidden="true" />
            编辑
          </button>
          {hasNativeCalendar() && <button type="button" className="secondary calendar-insert" disabled={busy}
            onClick={() => void insertCalendar()}><CalendarPlus size={17} aria-hidden="true" />加入日历</button>}
        </div>
        {hasNativeCalendar() && day.repeat === "yearly" && day.calendar === "lunar" &&
          <p className="calendar-insert-help">农历日子不会在系统日历中自动按农历重复，每年需重新加入。</p>}
        <button type="button" className="delete-link" disabled={busy} onClick={() => void remove()}>删除这个日子</button>
        {hasNativeCalendar() && notice && <div className="toast" role="status" data-visible={noticeVisible}>{notice.message}</div>}
      </div>
    </Modal>
  );
}
