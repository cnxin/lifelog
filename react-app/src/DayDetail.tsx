import { useState } from "react";
import { Pin, Pencil } from "lucide-react";
import Modal from "./Modal";
import { dayStatus, lunarLabel, type Day } from "./domain";
import { formatDate, icons, tones, yearsLabel } from "./dayMeta";
import ReminderBell from "./ReminderBell";
import { hasNativeNotifications } from "./notifications";
import { getReminderTime } from "./reminders";

export default function DayDetail({
  day,
  today,
  onClose,
  onEdit,
  onTogglePin,
}: {
  day: Day;
  today: string;
  onClose: () => void;
  onEdit: (day: Day) => void;
  onTogglePin: (day: Day) => Promise<void>;
}) {
  const status = dayStatus(day, today);
  const years = yearsLabel(day, status);
  const Icon = icons[day.category];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
        <div className="editor-footer detail-footer">
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
        </div>
      </div>
    </Modal>
  );
}
