import { Check, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { Anniversary, AnniversaryPlan, AnniversaryPlanStatus, AnniversaryPlanTodo, Person, Place } from "../types";
import { formatDaysUntilLabel } from "../utils/date";
import PlacePicker from "./PlacePicker";

interface AnniversaryPlanSheetProps {
  person: Person;
  anniversary: Anniversary;
  occurrenceYear: number;
  targetDate: string;
  daysUntilTarget: number;
  plan?: AnniversaryPlan;
  places: Place[];
  onClose: () => void;
  onSave: (plan: AnniversaryPlan) => Promise<void>;
  onDelete?: (planId: string) => Promise<void>;
  onCreateMemory: (plan: AnniversaryPlan) => void;
}

const statusOptions: Array<{ value: AnniversaryPlanStatus; label: string }> = [
  { value: "todo", label: "未开始" },
  { value: "doing", label: "准备中" },
  { value: "done", label: "已完成" },
  { value: "skipped", label: "跳过" }
];

const reminderOptions = [14, 7, 3, 1, 0];

export default function AnniversaryPlanSheet({
  person,
  anniversary,
  occurrenceYear,
  targetDate,
  daysUntilTarget,
  plan,
  places,
  onClose,
  onSave,
  onDelete,
  onCreateMemory
}: AnniversaryPlanSheetProps) {
  const [title, setTitle] = useState(plan?.title || `${person.name} · ${anniversary.title}安排`);
  const [status, setStatus] = useState<AnniversaryPlanStatus>(plan?.status || "todo");
  const [budget, setBudget] = useState(plan?.budget || "");
  const [notes, setNotes] = useState(plan?.notes || "");
  const [placeIds, setPlaceIds] = useState<string[]>(plan?.placeIds || []);
  const [reminderDaysBefore, setReminderDaysBefore] = useState<number[]>(plan?.reminderDaysBefore || [7, 1]);
  const [checklist, setChecklist] = useState<AnniversaryPlanTodo[]>(() =>
    plan?.checklist?.length ? plan.checklist : buildDefaultTodos(anniversary.title)
  );
  const [newTodo, setNewTodo] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const progress = useMemo(() => {
    if (!checklist.length) return "还没有待办";
    const done = checklist.filter((item) => item.done).length;
    return `${done} / ${checklist.length} 项完成`;
  }, [checklist]);

  function toggleReminder(days: number) {
    setReminderDaysBefore((current) =>
      current.includes(days)
        ? current.filter((item) => item !== days)
        : [...current, days].sort((left, right) => right - left)
    );
  }

  function addTodo() {
    const text = newTodo.trim();
    if (!text) return;
    setChecklist((current) => [
      ...current,
      { id: `todo_${Date.now()}_${Math.random().toString(16).slice(2)}`, text, done: false }
    ]);
    setNewTodo("");
  }

  function updateTodo(id: string, patch: Partial<AnniversaryPlanTodo>) {
    setChecklist((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function removeTodo(id: string) {
    setChecklist((current) => current.filter((item) => item.id !== id));
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      await onSave({
        id: plan?.id || `ap_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        personId: person.id,
        anniversaryTitle: anniversary.title,
        anniversaryDate: anniversary.date,
        occurrenceYear,
        targetDate,
        status,
        title: title.trim() || `${person.name} · ${anniversary.title}安排`,
        notes: notes.trim(),
        budget: budget.trim(),
        checklist: checklist.filter((item) => item.text.trim()).map((item) => ({ ...item, text: item.text.trim() })),
        placeIds,
        reminderDaysBefore,
        memoryId: plan?.memoryId,
        createdAt: plan?.createdAt || now,
        updatedAt: now
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="sheet anniversary-plan-sheet">
      <button className="sheet-backdrop" type="button" aria-label="关闭安排" onClick={onClose} />
      <section className="sheet-panel">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <div>
            <p className="date-label">{formatDaysUntilLabel(daysUntilTarget)} · {targetDate}</p>
            <h2>{anniversary.title}安排</h2>
          </div>
          <button className="sheet-close" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="form anniversary-plan-form">
          <label>
            安排标题
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：生日晚餐和礼物准备" />
          </label>

          <div className="plan-status-row" role="group" aria-label="安排状态">
            {statusOptions.map((option) => (
              <button
                type="button"
                key={option.value}
                className={status === option.value ? "active" : ""}
                onClick={() => setStatus(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="anniversary-plan-progress">
            <strong>{progress}</strong>
            <span>{person.name} · {anniversary.title} · {occurrenceYear}</span>
          </div>

          <div className="plan-checklist">
            {checklist.map((item) => (
              <div className="plan-check-item" key={item.id}>
                <button
                  type="button"
                  className={item.done ? "done" : ""}
                  aria-label={item.done ? "标记未完成" : "标记完成"}
                  onClick={() => updateTodo(item.id, { done: !item.done })}
                >
                  {item.done && <Check />}
                </button>
                <input
                  value={item.text}
                  onChange={(event) => updateTodo(item.id, { text: event.target.value })}
                  placeholder="待办事项"
                />
                <button type="button" className="plan-remove-todo" aria-label="删除待办" onClick={() => removeTodo(item.id)}>
                  <Trash2 />
                </button>
              </div>
            ))}
            <div className="plan-add-todo">
              <input
                value={newTodo}
                onChange={(event) => setNewTodo(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addTodo();
                  }
                }}
                placeholder="添加一个待办"
              />
              <button type="button" onClick={addTodo}>
                <Plus />
              </button>
            </div>
          </div>

          <label>
            预算 / 礼物线索
            <input value={budget} onChange={(event) => setBudget(event.target.value)} placeholder="例如：300 元内，偏实用" />
          </label>

          <div>
            <span className="field-title">关联地点</span>
            <PlacePicker places={places} value={placeIds} onChange={setPlaceIds} />
          </div>

          <div>
            <span className="field-title">提醒节点</span>
            <div className="plan-reminder-row">
              {reminderOptions.map((days) => (
                <button
                  type="button"
                  key={days}
                  className={reminderDaysBefore.includes(days) ? "active" : ""}
                  onClick={() => toggleReminder(days)}
                >
                  {days === 0 ? "当天" : `提前${days}天`}
                </button>
              ))}
            </div>
          </div>

          <label>
            计划备注
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="记录餐厅、礼物、时间安排或注意事项" />
          </label>

          <div className="submit-row">
            {plan && onDelete ? (
              <button type="button" className="ghost-btn danger-text" onClick={() => onDelete(plan.id)}>
                删除
              </button>
            ) : (
              <button type="button" className="ghost-btn" onClick={onClose}>
                取消
              </button>
            )}
            <button type="button" className="ghost-btn" disabled={!plan} onClick={() => plan && onCreateMemory(plan)}>
              记录回忆
            </button>
            <button type="button" className="primary-btn" disabled={isSaving} onClick={handleSave}>
              {isSaving ? "保存中..." : "保存安排"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function buildDefaultTodos(title: string): AnniversaryPlanTodo[] {
  const base = title === "生日"
    ? ["确认当天时间", "准备礼物或心意", "预订吃饭 / 活动地点"]
    : ["确认纪念日安排", "准备想说的话或小礼物", "记录当天回忆"];

  return base.map((text, index) => ({
    id: `todo_default_${index}`,
    text,
    done: false
  }));
}
