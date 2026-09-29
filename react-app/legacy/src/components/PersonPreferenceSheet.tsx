import { X } from "lucide-react";
import { useRef, useState } from "react";
import type { Person } from "../types";
import { parseGroups } from "../utils/text";
import { PreferenceGroupEditor } from "./EntrySheet/PersonFields";
import SheetPrimitive from "./motion/SheetPrimitive";

export type PersonPreferenceMode = "preferences" | "dislikes";

interface PersonPreferenceSheetProps {
  person: Person | null;
  mode: PersonPreferenceMode;
  onClose: () => void;
  onSave: (personId: string, patch: Pick<Person, "preferences" | "dislikes">) => Promise<void>;
}

export default function PersonPreferenceSheet({ person, mode, onClose, onSave }: PersonPreferenceSheetProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!person) return null;
  const editingPreferences = mode === "preferences";
  const title = editingPreferences ? "喜好档案" : "禁忌 / 雷区";

  async function handleSave() {
    if (!person) return;
    const form = formRef.current;
    if (!form) return;
    const formData = new FormData(form);
    setIsSaving(true);
    try {
      await onSave(person.id, {
        preferences: editingPreferences ? parseGroups(formData.get("preferences")) : person.preferences,
        dislikes: editingPreferences ? person.dislikes : parseGroups(formData.get("dislikes"))
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SheetPrimitive open onDismissRequest={onClose} className="person-preference-sheet" ariaLabel={title}>
        <div className="sheet-handle" data-sheet-drag-handle />
        <div className="sheet-header">
          <div>
            <h2>{title}</h2>
            <p>{person.name} · 标准标签编辑</p>
          </div>
          <button className="sheet-close pressable" aria-label="关闭" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>
        <form ref={formRef} className="form person-preference-form">
          {editingPreferences ? (
            <>
              <label>喜好档案</label>
              <PreferenceGroupEditor
                name="preferences"
                groups={person.preferences}
                defaults={[
                  { category: "颜色", items: ["蓝色", "黑色"] },
                  { category: "食物", items: ["火锅", "寿司"] },
                  { category: "饮品", items: ["美式咖啡"] }
                ]}
              />
            </>
          ) : (
            <>
              <label>禁忌 / 雷区</label>
              <PreferenceGroupEditor
                name="dislikes"
                danger
                groups={person.dislikes}
                defaults={[
                  { category: "过敏", items: ["花生"] },
                  { category: "口味", items: ["不吃辣"] }
                ]}
              />
            </>
          )}
        </form>
        <div className="submit-row">
          <button className="ghost-btn pressable" type="button" onClick={onClose}>
            取消
          </button>
          <button className="primary-btn pressable" type="button" onClick={() => void handleSave()} disabled={isSaving}>
            {isSaving ? "保存中…" : "保存"}
          </button>
        </div>
    </SheetPrimitive>
  );
}
