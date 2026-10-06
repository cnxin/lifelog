import type { Day, Category } from "../domain";
import { db, saveDay, deleteDay, restoreDay } from "../storage";
import { haptic } from "../haptics";
import type { NoticeAction } from "./useNotices";
export default function useEditorActions({
  today,
  filter,
  query,
  calendarDate,
  detailId,
  setEditor,
  setFilter,
  setQuery,
  setFocusId,
  changed,
}: {
  today: string;
  filter: "全部" | Category;
  query: string;
  calendarDate: string | null;
  detailId: string | null;
  setEditor: (day: Day | null) => void;
  setFilter: (filter: "全部" | Category) => void;
  setQuery: (query: string) => void;
  setFocusId: (id: string) => void;
  changed: (message: string, afterClose?: boolean, action?: NoticeAction) => Promise<void>;
}) {
  function add(category: Category = "纪念日", selectedDate = today) {
    setEditor({
      id: crypto.randomUUID(),
      title: "",
      date: selectedDate,
      category,
      repeat: category === "生日" ? "yearly" : "none",
      calendar: "solar",
      note: "",
      pinned: false,
      reminders: [],
    });
  }

  async function togglePin(day: Day) {
    await saveDay({ ...day, pinned: !day.pinned });
    void haptic("light");
    await changed(day.pinned ? "已取消置顶" : "已置顶，移到最前");
  }

  async function save(day: Day) {
    await saveDay(day);
    await changed("这个日子，记下了。", true);
    // Reveal a saved record if the current category/search would hide it.
    if (filter !== "全部" && filter !== day.category) setFilter("全部");
    if (
      !`${day.title} ${day.note}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase())
    )
      setQuery("");
    // Calendar-origin edits return to the agenda, not the home list.
    if (!calendarDate && !detailId) setFocusId(day.id);
  }
  async function restore(id: string) {
    const result = await restoreDay(id);
    if (result === "restored") {
      const day = await db.days.get(id);
      if (day && filter !== "全部" && filter !== day.category) setFilter("全部");
      if (day && !`${day.title} ${day.note}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
        setQuery("");
    }
    await changed(result === "restored" ? "已恢复" : result === "exists"
      ? "列表已有相同日子，未覆盖；删除记录仍保留" : "这个日子已不在最近删除中");
    if (result === "restored") setFocusId(id);
    return result;
  }
  async function remove(id: string, afterClose = true) {
    const entry = await deleteDay(id);
    if (!entry) throw new Error("这个日子已被删除。");
    await changed(`已删除「${entry.title}」`, afterClose, { label: "撤销", run: async () => {
      try { await restore(id); }
      catch { await changed("恢复失败，请在最近删除中重试。"); }
    } });
  }
  return { add, togglePin, save, remove, restore };
}
