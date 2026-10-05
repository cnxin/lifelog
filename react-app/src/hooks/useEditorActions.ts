import type { Day, Category } from "../domain";
import { db, saveDay } from "../storage";
import { haptic } from "../haptics";
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
  changed: (message: string, afterClose?: boolean) => Promise<void>;
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
  async function remove(id: string) {
    await db.days.delete(id);
    await changed("已删除这个日子", true);
  }
  return { add, togglePin, save, remove };
}
