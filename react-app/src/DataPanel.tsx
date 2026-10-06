import { useRef, useState } from "react";
import {
  Download,
  Upload,
  Database,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import Modal from "./Modal";
import { exportBackup } from "./backup";
import { parseBackup, type Day } from "./domain";
import { readLegacyDays, mergeDays } from "./storage";
import TimePicker from "./TimePicker";
import { hasNativeNotifications } from "./notifications";
import { getReminderTime, setReminderTime } from "./reminders";
import RecentTrash from "./RecentTrash";

type Pending = ReturnType<typeof parseBackup>;
export default function DataPanel({
  days,
  onClose,
  onImported,
  onRestore,
}: {
  days: Day[];
  onClose: () => void;
  onImported: () => Promise<void>;
  onRestore: (id: string) => Promise<"restored" | "exists" | "missing">;
}) {
  const file = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [time, setTime] = useState(getReminderTime);
  const [timeOpen, setTimeOpen] = useState(false);
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await task();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败，请重试。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="数据与备份" onClose={onClose} busy={busy} onCancel={timeOpen ? () => setTimeOpen(false) : undefined}>
      <div className="privacy-note">
        <ShieldCheck size={22} />
        <div>
          <strong>只属于你的日子</strong>
          <p>
            数据保存在当前设备，不需要账号，也不会上传到服务器。清除浏览器数据或卸载前，请先导出备份。
          </p>
        </div>
      </div>
      {hasNativeNotifications() && <section className="reminder-time">
        <p className="field-help">未单独设置的提醒使用此时间</p>
        <TimePicker value={time} open={timeOpen} onOpenChange={setTimeOpen} disabled={busy}
          onChange={value => {
            try { setReminderTime(value); setTime(value); }
            catch { setError("提醒时间保存失败，请重试。"); }
          }} />
      </section>}
      <div className="data-actions">
        <button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              setMessage(await exportBackup(days));
            })
          }
        >
          <Download />
          <span>
            <strong>导出备份</strong>
            <small>保存全部 {days.length} 个日子为 JSON 文件</small>
          </span>
          <ArrowRight size={18} />
        </button>
        <button disabled={busy} onClick={() => file.current?.click()}>
          <Upload />
          <span>
            <strong>导入备份</strong>
            <small>支持新版备份与旧版 LifeLog JSON</small>
          </span>
          <ArrowRight size={18} />
        </button>
        <button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const result = await readLegacyDays();
              setPending({ ...result, legacy: true });
            })
          }
        >
          <Database />
          <span>
            <strong>从本机旧版迁移</strong>
            <small>只读取生日、纪念日，不修改旧数据</small>
          </span>
          <ArrowRight size={18} />
        </button>
      </div>
      <input
        ref={file}
        className="sr-only"
        tabIndex={-1}
        type="file"
        accept=".json,application/json"
        aria-label="选择备份文件"
        onChange={(event) => {
          const selected = event.target.files?.[0];
          event.target.value = "";
          if (!selected) return;
          void run(async () => {
            setPending(null);
            if (selected.size > 128 * 1024 * 1024)
              throw new Error("文件超过 128 MB，请从旧版导出不含照片的备份。");
            setPending(parseBackup(JSON.parse(await selected.text())));
          });
        }}
      />
      {pending && (
        <section className="import-preview">
          <h3>找到 {pending.days.length} 个日子</h3>
          <p>
            只添加新记录，相同 ID 的记录保留当前版本，不覆盖你的修改。
            {pending.skipped > 0 &&
              `另有 ${pending.skipped} 条无效旧记录已跳过。`}
          </p>
          {pending.legacy && (
            <p>
              只迁移人物生日与年度纪念日，不导入照片、回忆、地点、待办或里程碑。若未找到数据，请在原设备导出
              JSON 再导入。
            </p>
          )}
          <div className="button-row">
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setPending(null)}
            >
              取消
            </button>
            <button
              className="primary"
              disabled={busy || !pending.days.length}
              onClick={() =>
                void run(async () => {
                  const count = await mergeDays(pending.days);
                  await onImported();
                  setPending(null);
                  setMessage(
                    `导入完成：新增 ${count} 个日子，已有记录没有被覆盖。`,
                  );
                })
              }
            >
              {busy ? "正在导入…" : "确认合并导入"}
            </button>
          </div>
        </section>
      )}
      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="success-box" role="status">
          {message}
        </p>
      )}
      <RecentTrash days={days} busy={busy} run={run} onRestore={onRestore} />
      <p className="data-footnote">
        LifeLog · 日子 / 轻量版
        <br />
        专注记录与倒数，暂不提供系统通知和云同步。
        <br />
        新版备份仅包含日子，请另行保留旧版完整备份。
      </p>
    </Modal>
  );
}
