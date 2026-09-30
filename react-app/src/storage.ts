import Dexie, { type Table } from "dexie";
import { extractLegacy, validateDay, type Day, MAX_RECORDS } from "./domain";

class DaysDatabase extends Dexie {
  days!: Table<Day, string>;
  constructor() {
    // Never upgrade or mutate the original LifeLogDatabase.
    super("LifeLogDays");
    this.version(1).stores({ days: "id, date, category" });
    // Normalize old records without a schema upgrade or rewriting their data.
    this.days.hook("reading", day => day === undefined ? undefined : validateDay(day));
  }
}
export const db = new DaysDatabase();
export async function mergeDays(days: Day[]): Promise<number> {
  const validated = days.map(validateDay);
  return db.transaction("rw", db.days, async () => {
    const ids = new Set(await db.days.toCollection().primaryKeys());
    const additions = validated.filter((day) => !ids.has(day.id));
    if (ids.size + additions.length > MAX_RECORDS)
      throw new Error("最多支持 10,000 个日子，请先整理现有记录。");
    await db.days.bulkAdd(additions);
    return additions.length;
  });
}
export async function saveDay(day: Day): Promise<void> {
  const normalized = validateDay(day);
  await db.transaction("rw", db.days, async () => {
    if (!(await db.days.get(day.id)) && (await db.days.count()) >= MAX_RECORDS)
      throw new Error("最多支持 10,000 个日子。");
    await db.days.put(normalized);
  });
}
export async function readLegacyDays() {
  const people = await new Promise<unknown[] | null>((resolve, reject) => {
    const request = indexedDB.open("LifeLogDatabase");
    let absent = false;
    request.onupgradeneeded = () => {
      absent = true;
      request.transaction?.abort();
    };
    request.onerror = () =>
      absent
        ? resolve(null)
        : reject(new Error("无法读取旧数据库，请先从旧版导出 JSON 备份。"));
    request.onblocked = () =>
      reject(new Error("请先关闭其他 LifeLog 窗口再试。"));
    request.onsuccess = () => {
      const old = request.result;
      if (!old.objectStoreNames.contains("people")) {
        old.close();
        resolve(null);
        return;
      }
      const transaction = old.transaction("people", "readonly");
      const read = transaction.objectStore("people").getAll();
      read.onsuccess = () => resolve(read.result);
      read.onerror = () => reject(read.error);
      transaction.oncomplete = transaction.onabort = () => old.close();
    };
  });
  if (people?.length) return extractLegacy({ people });
  const previous = localStorage.getItem("lifelog-react-state-v1");
  return previous
    ? extractLegacy(JSON.parse(previous))
    : { days: [], skipped: 0 };
}
