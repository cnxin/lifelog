import { Check, Copy, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { Anniversary, AnniversaryPlan, AnniversaryPlanStatus, AnniversaryPlanTargetKind, AnniversaryPlanTodo, Person, Place } from "../types";
import { formatDaysUntilLabel } from "../utils/date";
import PlacePicker from "./PlacePicker";

interface AnniversaryPlanSheetProps {
  person: Person;
  anniversary: Anniversary;
  occurrenceYear: number;
  targetKind?: AnniversaryPlanTargetKind;
  milestoneDay?: number;
  milestoneLabel?: string;
  targetDate: string;
  daysUntilTarget: number;
  plan?: AnniversaryPlan;
  historicalPlans?: AnniversaryPlan[];
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

interface PlanTemplate {
  id: string;
  label: string;
  title: string;
  budget: string;
  notes: string;
  reminderDaysBefore: number[];
  todos: string[];
}

const planTemplates: PlanTemplate[] = [
  {
    id: "birthday",
    label: "生日",
    title: "生日晚餐和祝福准备",
    budget: "礼物、餐厅和蛋糕预算待定",
    notes: "确认时间、餐厅、礼物和是否需要提前预订。",
    reminderDaysBefore: [14, 7, 1],
    todos: ["确认当天时间", "挑选礼物", "预订餐厅或蛋糕", "当天记录回忆"]
  },
  {
    id: "gift",
    label: "送礼",
    title: "礼物准备",
    budget: "按喜好和实用性筛选",
    notes: "结合喜好档案和雷区，记录备选礼物与购买渠道。",
    reminderDaysBefore: [7, 3, 1],
    todos: ["查看喜好和雷区", "列出礼物备选", "购买或下单", "准备包装和祝福语"]
  },
  {
    id: "milestone",
    label: "节点",
    title: "天数节点纪念",
    budget: "小礼物、照片或当天活动预算待定",
    notes: "适合 100 天、365 天、1000 天这类节点，记录想完成的小仪式和当天回忆。",
    reminderDaysBefore: [7, 3, 0],
    todos: ["确认纪念方式", "准备照片或小礼物", "安排当天时间", "当天记录回忆"]
  },
  {
    id: "dinner",
    label: "聚餐",
    title: "聚餐安排",
    budget: "餐厅和交通预算待定",
    notes: "记录餐厅候选、预约时间、同行人员和注意事项。",
    reminderDaysBefore: [7, 3, 0],
    todos: ["确定人数和时间", "选择并预订地点", "确认交通和集合方式", "聚餐后记录回忆"]
  },
  {
    id: "trip",
    label: "出行",
    title: "纪念日出行计划",
    budget: "交通、住宿和餐饮预算待定",
    notes: "记录路线、预约、天气和需要携带的物品。",
    reminderDaysBefore: [14, 7, 3, 1],
    todos: ["确定目的地和日期", "预订交通或住宿", "准备行程清单", "整理当天照片和回忆"]
  }
];

export default function AnniversaryPlanSheet({
  person,
  anniversary,
  occurrenceYear,
  targetKind = "annual",
  milestoneDay,
  milestoneLabel,
  targetDate,
  daysUntilTarget,
  plan,
  historicalPlans = [],
  places,
  onClose,
  onSave,
  onDelete,
  onCreateMemory
}: AnniversaryPlanSheetProps) {
  const targetTitle = milestoneLabel ? `${anniversary.title}${milestoneLabel}` : anniversary.title;
  const targetMeta = targetKind === "milestone" ? targetDate : String(occurrenceYear);
  const [title, setTitle] = useState(plan?.title || `${person.name} · ${targetTitle}安排`);
  const [status, setStatus] = useState<AnniversaryPlanStatus>(plan?.status || "todo");
  const [budget, setBudget] = useState(plan?.budget || "");
  const [notes, setNotes] = useState(plan?.notes || "");
  const [placeIds, setPlaceIds] = useState<string[]>(plan?.placeIds || []);
  const [reminderDaysBefore, setReminderDaysBefore] = useState<number[]>(plan?.reminderDaysBefore || [7, 1]);
  const [checklist, setChecklist] = useState<AnniversaryPlanTodo[]>(() => plan?.checklist || []);
  const [newTodo, setNewTodo] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const reusablePlan = useMemo(
    () =>
      historicalPlans
        .filter((item) => item.occurrenceYear < occurrenceYear)
        .sort((left, right) => right.occurrenceYear - left.occurrenceYear)[0],
    [historicalPlans, occurrenceYear]
  );

  const progress = useMemo(() => {
    if (!checklist.length) return "还没有待办";
    const done = checklist.filter((item) => item.done).length;
    return `${done} / ${checklist.length} 项完成`;
  }, [checklist]);
  const doneCount = checklist.filter((item) => item.done).length;
  const canRunPlan = Boolean(plan);
  const canCompletePlan = checklist.length ? doneCount === checklist.length : Boolean(notes.trim() || budget.trim() || placeIds.length);

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

  function reuseHistoricalPlan(source: AnniversaryPlan) {
    setTitle(`${person.name} · ${targetTitle}安排`);
    setStatus("todo");
    setBudget(source.budget);
    setNotes(source.notes);
    setPlaceIds(source.placeIds);
    setReminderDaysBefore(source.reminderDaysBefore);
    setChecklist(
      source.checklist.map((item) => ({
        id: `todo_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        text: item.text,
        done: false
      }))
    );
  }

  function applyTemplate(template: PlanTemplate) {
    setTitle(`${person.name} · ${template.title}`);
    setStatus("todo");
    setBudget(template.budget);
    setNotes(template.notes);
    setReminderDaysBefore(template.reminderDaysBefore);
    setChecklist(
      template.todos.map((text) => ({
        id: `todo_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        text,
        done: false
      }))
    );
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
        targetKind,
        milestoneDay: targetKind === "milestone" ? milestoneDay : undefined,
        milestoneLabel: targetKind === "milestone" ? milestoneLabel : undefined,
        targetDate,
        status,
        title: title.trim() || `${person.name} · ${targetTitle}安排`,
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

  async function saveWithPatch(patch: Partial<AnniversaryPlan>) {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const nextPlan: AnniversaryPlan = {
        id: plan?.id || `ap_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        personId: person.id,
        anniversaryTitle: anniversary.title,
        anniversaryDate: anniversary.date,
        occurrenceYear,
        targetKind,
        milestoneDay: targetKind === "milestone" ? milestoneDay : undefined,
        milestoneLabel: targetKind === "milestone" ? milestoneLabel : undefined,
        targetDate,
        status,
        title: title.trim() || `${person.name} · ${targetTitle}安排`,
        notes: notes.trim(),
        budget: budget.trim(),
        checklist: checklist.filter((item) => item.text.trim()).map((item) => ({ ...item, text: item.text.trim() })),
        placeIds,
        reminderDaysBefore,
        memoryId: plan?.memoryId,
        createdAt: plan?.createdAt || now,
        updatedAt: now,
        ...patch
      };
      await onSave(nextPlan);
      setStatus(nextPlan.status);
      setChecklist(nextPlan.checklist);
    } finally {
      setIsSaving(false);
    }
  }

  async function markDoing() {
    await saveWithPatch({ status: "doing" });
  }

  async function markAllTodosDone() {
    const nextChecklist = checklist.map((item) => ({ ...item, done: true }));
    setChecklist(nextChecklist);
    await saveWithPatch({ status: "doing", checklist: nextChecklist });
  }

  async function completePlan() {
    const nextChecklist = checklist.map((item) => ({ ...item, done: true }));
    setChecklist(nextChecklist);
    await saveWithPatch({ status: "done", checklist: nextChecklist });
  }

  return (
    <div className="sheet anniversary-plan-sheet">
      <button className="sheet-backdrop" type="button" aria-label="关闭安排" onClick={onClose} />
      <section className="sheet-panel">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <div>
            <p className="date-label">{formatDaysUntilLabel(daysUntilTarget)} · {targetDate}</p>
            <h2>{targetTitle}安排</h2>
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
            <span>{person.name} · {targetTitle} · {targetMeta}</span>
          </div>

          {canRunPlan && (
            <div className={`plan-run-card ${status}`}>
              <div>
                <strong>{status === "done" ? "安排已完成" : daysUntilTarget === 0 ? "今天执行安排" : "安排执行闭环"}</strong>
                <span>
                  {checklist.length
                    ? `已完成 ${doneCount}/${checklist.length} 项，完成后可以直接记录回忆。`
                    : "没有待办时，可先确认备注、预算或地点，再标记完成。"}
                </span>
              </div>
              <div className="plan-run-actions">
                {status === "todo" && (
                  <button type="button" onClick={() => void markDoing()}>
                    开始准备
                  </button>
                )}
                {checklist.length > 0 && doneCount < checklist.length && (
                  <button type="button" onClick={() => void markAllTodosDone()}>
                    全部勾选
                  </button>
                )}
                <button type="button" disabled={!canCompletePlan} onClick={() => void completePlan()}>
                  标记完成
                </button>
                <button type="button" onClick={() => onCreateMemory(plan!)}>
                  记录回忆
                </button>
              </div>
            </div>
          )}

          {reusablePlan && (
            <button className="plan-reuse-button" type="button" onClick={() => reuseHistoricalPlan(reusablePlan)}>
              <Copy />
              复用 {reusablePlan.occurrenceYear} 年安排
            </button>
          )}

          <div>
            <span className="field-title">安排模板</span>
            <div className="plan-template-row">
              {planTemplates.map((template) => (
                <button type="button" key={template.id} onClick={() => applyTemplate(template)}>
                  {template.label}
                </button>
              ))}
            </div>
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
