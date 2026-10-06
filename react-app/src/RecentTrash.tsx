import { useEffect, useState } from "react";
import { db, purgeTrash, type TrashEntry } from "./storage";
import type { Day } from "./domain";
import { deletedAgo } from "./trashMeta";
import { haptic } from "./haptics";

export default function RecentTrash({ days, busy, run, onRestore }: {
  days: Day[]; busy: boolean; run: (task: () => Promise<void>) => Promise<void>;
  onRestore: (id: string) => Promise<"restored" | "exists" | "missing">;
}) {
  const [trash, setTrash] = useState<TrashEntry[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let disposed = false;
    void db.trash.orderBy("deletedAt").reverse().toArray().then(entries => {
      if (!disposed) setTrash(entries);
    }).catch(() => { if (!disposed) setMessage("最近删除暂时无法读取，请关闭后重试。"); });
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [days]);
  return <section className="recent-trash" aria-labelledby="recent-trash-title">
    <h3 id="recent-trash-title">最近删除</h3>
    {trash.length ? <>
      <ul>{trash.map(entry => <li key={entry.id}>
        <div><strong>{entry.title}</strong><small>{entry.category} · 删除于 {deletedAgo(entry.deletedAt, now)}</small></div>
        <button type="button" className="secondary" disabled={busy} aria-label={`恢复：${entry.title}`} onClick={() => void run(async () => {
          void haptic("light");
          const result = await onRestore(entry.id);
          setTrash(await db.trash.orderBy("deletedAt").reverse().toArray());
          setMessage(result === "restored" ? "已恢复" : result === "exists"
            ? "列表已有相同日子，未覆盖；删除记录仍保留" : "这个日子已不在最近删除中");
        })}>恢复</button>
      </li>)}</ul>
      {confirm ? <div className="delete-confirm">
        <p>确定清空最近删除？清空后不能恢复。</p>
        <div className="button-row"><button type="button" className="secondary" disabled={busy} onClick={() => setConfirm(false)}>保留</button>
          <button type="button" className="danger" disabled={busy} onClick={() => void run(async () => {
            await purgeTrash(); setTrash([]); setConfirm(false); setMessage("最近删除已清空");
          })}>确认清空</button></div>
      </div> : <button type="button" className="delete-link" disabled={busy} onClick={() => setConfirm(true)}>清空最近删除</button>}
    </> : <p className="field-help">没有最近删除的日子</p>}
    {message && <p className="field-help" role="status">{message}</p>}
  </section>;
}
