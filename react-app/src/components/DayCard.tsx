import type { Dispatch, SetStateAction } from "react";
import { Pin, ChevronRight } from "lucide-react";
import { dayStatus, lunarLabel, type Day } from "../domain";
import { tones, formatDate, yearsLabel, elapsedLabel } from "../dayMeta";
import { dayTransitionName } from "../listTransition";
import ReminderBell from "../ReminderBell";
import Icon from "./CategoryIcon";
export default function DayCard({
  day,
  today,
  highlightId,
  setHighlightId,
  togglePin,
  setError,
  setDetailId,
}: {
  day: Day;
  today: string;
  highlightId: string | null;
  setHighlightId: Dispatch<SetStateAction<string | null>>;
  togglePin: (day: Day) => Promise<void>;
  setError: (message: string) => void;
  setDetailId: (id: string) => void;
}) {
  const item = dayStatus(day, today);
  const years = yearsLabel(day, item);
  const elapsed = day.date < today ? elapsedLabel(day, item) : null;
  return (
    <li
      className={`day-card ${tones[day.category]}`}
      key={day.id}
      style={{
        viewTransitionName: dayTransitionName(day.id),
      }}
      data-id={day.id}
      data-highlight={highlightId === day.id || undefined}
      onAnimationEnd={(event) => {
        if (event.animationName === "day-highlight")
          setHighlightId((id) => (id === day.id ? null : id));
      }}
    >
      <div className="card-top">
        <span className="category-icon">
          <Icon category={day.category} />
        </span>
        <span className="card-category">
          {day.category}
          <ReminderBell day={day} />
        </span>
        <button
          className={`pin-button ${day.pinned ? "is-pinned" : ""}`}
          aria-label={`${day.pinned ? "取消置顶" : "置顶"}：${day.title}`}
          aria-pressed={day.pinned}
          onClick={() =>
            void togglePin(day).catch(() => setError("置顶更新失败，请重试。"))
          }
        >
          <Pin size={16} />
        </button>
      </div>
      <button
        className="card-main"
        aria-label={`查看：${day.title}`}
        onClick={() => setDetailId(day.id)}
      >
        <div className="card-copy">
          <h3>{day.title}</h3>
          <p className="card-date">
            <span>{formatDate(day.date)}</span>
            {day.repeat === "yearly" && (
              <span>
                {day.calendar === "lunar" ? lunarLabel(day.date) : "每年重复"}
              </span>
            )}
            {years && <span className="years-label">{years}</span>}
          </p>
        </div>
        <div className="card-count">
          <span>{item.label}</span>
          {item.delta !== 0 && (
            <>
              <strong>{item.count.toLocaleString()}</strong>
              <span>天</span>
            </>
          )}
        </div>
        <div className="card-bottom">
          <span>
            {day.repeat === "yearly"
              ? `下次 · ${formatDate(item.next)}`
              : day.note ||
                (item.delta < 0 ? "一起走过的时光" : "好好期待这一天")}
          </span>
          {elapsed && <span className="card-elapsed" title={elapsed}>{elapsed}</span>}
          <ChevronRight size={16} />
        </div>
      </button>
    </li>
  );
}
