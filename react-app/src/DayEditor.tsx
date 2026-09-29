import { useEffect, useState, type FormEvent } from "react";
import { Cake, Heart, Hourglass, Trash2 } from "lucide-react";
import Modal, { useModalClose } from "./Modal";
import DatePicker from "./DatePicker";
import SegmentedControl from "./SegmentedControl";
import { categories, lunarLabel, validDate, type Day } from "./domain";

type EditorProps = {
  day: Day;
  existing: boolean;
  onClose: () => void;
  onSave: (day: Day) => Promise<void>;
  onDelete: () => Promise<void>;
};
export default function DayEditor(props: EditorProps) {
  const [dateOpen, setDateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title={props.existing ? "编辑这个日子" : "记下一个日子"}
      onClose={props.onClose}
      onCancel={dateOpen ? () => setDateOpen(false) : undefined}
      busy={busy}
    >
      <EditorForm
        {...props}
        dateOpen={dateOpen}
        setDateOpen={setDateOpen}
        busy={busy}
        setBusy={setBusy}
      />
    </Modal>
  );
}
function EditorForm({
  day,
  existing,
  onSave,
  onDelete,
  dateOpen,
  setDateOpen,
  busy,
  setBusy,
}: EditorProps & {
  dateOpen: boolean;
  setDateOpen: (value: boolean) => void;
  busy: boolean;
  setBusy: (value: boolean) => void;
}) {
  const requestClose = useModalClose();
  const [finished, setFinished] = useState(false);
  // Close only after the busy state has committed; manual closes stay blocked during writes.
  useEffect(() => {
    if (finished && !busy) requestClose();
  }, [finished, busy, requestClose]);
  const [draft, setDraft] = useState(day);
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
      setFinished(true);
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
      setFinished(true);
    } catch {
      setError("删除失败，记录仍然保留，请重试。");
    } finally {
      setBusy(false);
    }
  }
  return (
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
        <SegmentedControl
          label="分类"
          value={draft.category}
          options={categories.map((category) => {
            const Icon =
              category === "纪念日"
                ? Heart
                : category === "生日"
                  ? Cake
                  : Hourglass;
            return {
              value: category,
              label: category,
              icon: <Icon size={18} aria-hidden="true" />,
            };
          })}
          onChange={(category) => patch({ category })}
        />
        <DatePicker
          value={draft.date}
          onChange={(date) => patch({ date })}
          open={dateOpen}
          onOpenChange={setDateOpen}
        />
        <p className="field-help" id="date-help">
          {draft.calendar === "lunar" && validDate(draft.date)
            ? `对应${lunarLabel(draft.date)}。选择原始公历日期，之后按农历重复。`
            : "选择最初发生的日期，或你期待的未来日期。"}
        </p>
        <label className="check-row">
          <span>
            <strong id="repeat-label">每年重复</strong>
            <small id="repeat-help">生日、周年纪念日，自动计算下一次</small>
          </span>
          <input
            type="checkbox"
            aria-labelledby="repeat-label"
            aria-describedby="repeat-help"
            checked={draft.repeat === "yearly"}
            onChange={(event) =>
              patch({
                repeat: event.target.checked ? "yearly" : "none",
                calendar: event.target.checked ? draft.calendar : "solar",
              })
            }
          />
        </label>
        {draft.repeat === "yearly" && (
          <SegmentedControl
            className="repeat-calendar"
            label="重复历法"
            value={draft.calendar}
            options={[
              { value: "solar", label: "公历" },
              { value: "lunar", label: "农历" },
            ]}
            onChange={(calendar) => patch({ calendar })}
            description={
              draft.calendar === "solar"
                ? "2 月 29 日在非闰年按 2 月 28 日计算。"
                : "无对应闰月时按同名普通月计算；小月的三十按廿九计算。"
            }
          />
        )}
        <label>
          <span className="field-label">
            备注 <span className="optional">选填</span>
          </span>
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
            <strong id="pin-label">置顶这个日子</strong>
            <small id="pin-help">让重要的日子出现在前面</small>
          </span>
          <input
            type="checkbox"
            aria-labelledby="pin-label"
            aria-describedby="pin-help"
            checked={draft.pinned}
            onChange={(event) => patch({ pinned: event.target.checked })}
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
  );
}
