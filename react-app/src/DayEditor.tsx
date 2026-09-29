import { useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import Modal from "./Modal";
import { categories, lunarLabel, validDate, type Day } from "./domain";

export default function DayEditor({
  day,
  existing,
  onClose,
  onSave,
  onDelete,
}: {
  day: Day;
  existing: boolean;
  onClose: () => void;
  onSave: (day: Day) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(day);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const patch = (value: Partial<Day>) =>
    setDraft((prev) => ({ ...prev, ...value }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave({ ...draft, title: draft.title.trim() });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败，请重试。");
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    setError("");
    try {
      await onDelete();
      onClose();
    } catch {
      setError("删除失败，记录仍然保留，请重试。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={existing ? "编辑这个日子" : "记下一个日子"}
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={submit}>
        <fieldset disabled={busy} className="editor-fields">
          <label>
            日子名称
            <input
              autoFocus
              required
              maxLength={80}
              value={draft.title}
              placeholder="比如：我们在一起的日子"
              onChange={(e) => patch({ title: e.target.value })}
            />
          </label>
          <label>
            分类
            <select
              value={draft.category}
              onChange={(e) =>
                patch({ category: e.target.value as Day["category"] })
              }
            >
              {categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>
          <label>
            日期
            <input
              type="date"
              required
              min="1901-01-01"
              max="2099-12-31"
              value={draft.date}
              onChange={(e) => patch({ date: e.target.value })}
              aria-describedby="date-help"
            />
          </label>
          <p className="field-help" id="date-help">
            {draft.calendar === "lunar" && validDate(draft.date)
              ? `对应${lunarLabel(draft.date)}。选择原始公历日期，之后按农历重复。`
              : "选择最初发生的日期，或你期待的未来日期。"}
          </p>
          <label className="check-row">
            <span>
              <strong>每年重复</strong>
              <small>生日、周年纪念日，自动计算下一次</small>
            </span>
            <input
              type="checkbox"
              checked={draft.repeat === "yearly"}
              onChange={(e) =>
                patch({
                  repeat: e.target.checked ? "yearly" : "none",
                  calendar: e.target.checked ? draft.calendar : "solar",
                })
              }
            />
          </label>
          {draft.repeat === "yearly" && (
            <>
              <label>
                重复历法
                <select
                  value={draft.calendar}
                  onChange={(e) =>
                    patch({ calendar: e.target.value as Day["calendar"] })
                  }
                >
                  <option value="solar">公历</option>
                  <option value="lunar">农历</option>
                </select>
              </label>
              <p className="field-help">
                {draft.calendar === "solar"
                  ? "2 月 29 日在非闰年按 2 月 28 日计算。"
                  : "无对应闰月时按同名普通月计算；小月的三十按廿九计算。"}
              </p>
            </>
          )}
          <label>
            备注 <span className="optional">选填</span>
            <textarea
              rows={3}
              maxLength={2000}
              value={draft.note}
              placeholder="留一句话给这个特别的日子…"
              onChange={(e) => patch({ note: e.target.value })}
            />
          </label>
          <label className="check-row">
            <span>
              <strong>置顶这个日子</strong>
              <small>让重要的日子出现在前面</small>
            </span>
            <input
              type="checkbox"
              checked={draft.pinned}
              onChange={(e) => patch({ pinned: e.target.checked })}
            />
          </label>
        </fieldset>
        {error && (
          <p role="alert" className="error-box">
            {error}
          </p>
        )}
        {confirmDelete ? (
          <div className="delete-confirm">
            <p>确定删除「{day.title}」？删除后不能撤销。</p>
            <div className="button-row">
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => setConfirmDelete(false)}
              >
                保留
              </button>
              <button
                type="button"
                className="danger"
                disabled={busy}
                onClick={() => void remove()}
              >
                确认删除
              </button>
            </div>
          </div>
        ) : (
          <div className="editor-footer">
            {existing && (
              <button
                type="button"
                className="delete-button"
                disabled={busy}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={17} />
                删除
              </button>
            )}
            <button type="submit" className="primary" disabled={busy}>
              {busy ? "正在保存…" : existing ? "保存修改" : "记下这个日子"}
            </button>
          </div>
        )}
      </form>
    </Modal>
  );
}
