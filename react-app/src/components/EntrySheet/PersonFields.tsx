import { useState, type KeyboardEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Anniversary, Person, PreferenceGroup } from "../../types";
import { useLifeLog } from "../../context/LifeLogContext";
import { groupsToText, splitPreferenceItems } from "../../utils/text";
import DateInput from "../DateInput";
import SelectPicker from "../SelectPicker";
import {
  getDraftJson,
  getDraftValue,
  hasDraftField,
  type DraftFieldMap
} from "./draftValues";

const RELATIONSHIP_OPTIONS = ["朋友", "家人", "同事", "同学", "恋人", "其他"].map((item) => ({ value: item, label: item }));
const BOOLEAN_OPTIONS = [
  { value: "true", label: "是" },
  { value: "false", label: "否" }
];

export function PersonFields({
  person,
  isEditing,
  draftValues
}: {
  person?: Person;
  isEditing: boolean;
  draftValues?: DraftFieldMap;
}) {
  if (!isEditing) return <QuickPersonFields draftValues={draftValues} />;

  const customAnniversaries = (person?.anniversaries || []).filter((item) => item.title !== "生日");

  return (
    <>
      <div className="form-row">
        <label>
          姓名
          <input name="name" defaultValue={getDraftValue(draftValues, "name", person?.name || "")} required />
        </label>
        <label>
          昵称
          <input name="nickname" defaultValue={getDraftValue(draftValues, "nickname", person?.nickname || "")} />
        </label>
      </div>
      <div className="form-row">
        <label>
          关系
          <SelectPicker
            name="relationship"
            label="人物关系"
            defaultValue={getDraftValue(draftValues, "relationship", person?.relationship || "朋友")}
            options={RELATIONSHIP_OPTIONS}
          />
        </label>
        <label>
          收藏
          <SelectPicker
            name="favorite"
            label="人物收藏"
            defaultValue={getDraftValue(draftValues, "favorite", person?.favorite ? "true" : "false")}
            options={BOOLEAN_OPTIONS}
          />
        </label>
      </div>
      <BirthdayDateFields birthday={person?.birthday} draftValues={draftValues} />
      <p className="form-hint">只记录公历生日，农历日期会自动计算并显示。</p>
      <label>纪念日</label>
      <AnniversaryEditor anniversaries={customAnniversaries} draftValues={draftValues} />
      <label>
        喜好档案
      </label>
      <PreferenceGroupEditor
        name="preferences"
        groups={person?.preferences}
        draftValues={draftValues}
        defaults={[
          { category: "颜色", items: ["蓝色", "黑色"] },
          { category: "食物", items: ["火锅", "寿司"] },
          { category: "饮品", items: ["美式咖啡"] }
        ]}
      />
      <label>禁忌 / 雷区</label>
      <PreferenceGroupEditor
        name="dislikes"
        danger
        groups={person?.dislikes}
        draftValues={draftValues}
        defaults={[
          { category: "过敏", items: ["花生"] },
          { category: "口味", items: ["不吃辣"] }
        ]}
      />
      <label>
        备注
        <textarea
          name="notes"
          defaultValue={getDraftValue(draftValues, "notes", person?.notes || "")}
          placeholder="记录一些重要细节，例如：喜欢喝美式，不吃香菜。"
        />
      </label>
    </>
  );
}

function BirthdayDateFields({ birthday, draftValues }: { birthday?: string; draftValues?: DraftFieldMap }) {
  const draftBirthday = buildDraftDate(
    getDraftValue(draftValues, "birthdayYear", ""),
    getDraftValue(draftValues, "birthdayMonth", ""),
    getDraftValue(draftValues, "birthdayDay", "")
  );
  const [birthdayValue, setBirthdayValue] = useState(draftBirthday || birthday || "");
  const [year = "", month = "", day = ""] = birthdayValue.split("-");

  return (
    <label className="birthday-date-field">
      生日
      <DateInput label="生日" value={birthdayValue} onChange={setBirthdayValue} />
      <input type="hidden" name="birthdayYear" value={year} />
      <input type="hidden" name="birthdayMonth" value={month} />
      <input type="hidden" name="birthdayDay" value={day} />
    </label>
  );
}

function QuickPersonFields({ draftValues }: { draftValues?: DraftFieldMap }) {
  const { settings } = useLifeLog();

  return (
    <>
      <label>
        姓名
        <input name="name" defaultValue={getDraftValue(draftValues, "name")} placeholder="例如：王晓明" required autoFocus />
      </label>
      <label>
        关系
        <SelectPicker
          name="relationship"
          label="人物关系"
          defaultValue={getDraftValue(draftValues, "relationship", settings.defaultRelationship)}
          options={RELATIONSHIP_OPTIONS}
        />
      </label>
      <input type="hidden" name="favorite" value={getDraftValue(draftValues, "favorite", "false")} />
      <input type="hidden" name="preferences" value="" />
      <input type="hidden" name="dislikes" value="" />
      <input type="hidden" name="anniversaries" value="[]" />
      <p className="form-hint">先记下这个人就可以，生日、喜好、禁忌和纪念日可以在详情页慢慢补。</p>
      <label>
        一句话备注
        <textarea name="notes" defaultValue={getDraftValue(draftValues, "notes")} placeholder="例如：喜欢喝美式，不吃香菜。" />
      </label>
    </>
  );
}

interface AnniversaryRow {
  title: string;
  date: string;
}

interface PreferenceEditorRow {
  category: string;
  items: string[];
  draftItem: string;
}

function AnniversaryEditor({ anniversaries, draftValues }: { anniversaries?: Anniversary[]; draftValues?: DraftFieldMap }) {
  const draftAnniversaries = getDraftJson<AnniversaryRow[] | null>(draftValues, "anniversaries", null);
  const [rows, setRows] = useState<AnniversaryRow[]>(
    draftAnniversaries
      ? draftAnniversaries.map((item) => ({
        title: item.title,
        date: item.date
      }))
      : anniversaries?.length
      ? anniversaries.map((item) => ({
        title: item.title,
        date: item.date
      }))
      : []
  );

  function updateRow(index: number, patch: Partial<AnniversaryRow>) {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((current) => [...current, { title: "", date: "" }]);
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  const payload = rows
    .map((row) => ({
      title: row.title.trim(),
      date: row.date
    }))
    .filter((row) => row.title && row.date);

  const incompleteCount = rows.filter((row) => (row.title.trim() && !row.date) || (!row.title.trim() && row.date)).length;

  return (
    <div className="anniversary-editor">
      <input type="hidden" name="anniversaries" value={JSON.stringify(payload)} />
      {rows.map((row, index) => {
        const incomplete = (row.title.trim() && !row.date) || (!row.title.trim() && row.date);
        return (
          <div className={`anniversary-editor-row ${incomplete ? "incomplete" : ""}`} key={`anniversary-${index}`}>
            <div className="anniversary-field">
              <span className="pref-field-label">名称</span>
              <input
                aria-label="纪念日名称"
                placeholder="纪念日名称"
                value={row.title}
                onChange={(event) => updateRow(index, { title: event.target.value })}
              />
            </div>
            <div className="anniversary-date-field">
              <span className="pref-field-label">日期</span>
              <DateInput
                label="纪念日日期"
                value={row.date}
                onChange={(value) => updateRow(index, { date: value })}
              />
            </div>
            <button
              type="button"
              className="pref-row-remove anniversary-row-remove"
              aria-label="删除此纪念日"
              title="删除此纪念日"
              onClick={() => removeRow(index)}
            >
              <Trash2 size={16} />
            </button>
          </div>
        );
      })}
      {incompleteCount > 0 && (
        <p className="form-hint danger">有 {incompleteCount} 条纪念日信息不完整，保存时会被忽略。</p>
      )}
      <button type="button" className="mini-action add" onClick={addRow}>
        <Plus size={16} />
        添加纪念日
      </button>
      <p className="form-hint">纪念日同样只输入公历日期，详情页会自动显示农历日期。</p>
    </div>
  );
}

export function PreferenceGroupEditor({
  name,
  groups,
  defaults,
  draftValues,
  danger = false
}: {
  name: string;
  groups?: PreferenceGroup[];
  defaults: PreferenceGroup[];
  draftValues?: DraftFieldMap;
  danger?: boolean;
}) {
  const [rows, setRows] = useState(() =>
    (hasDraftField(draftValues, name) ? parseDraftGroups(getDraftValue(draftValues, name)) : (groups ?? defaults)).map((group) => ({
      category: group.category,
      items: [...group.items],
      draftItem: ""
    }))
  );

  function updateRow(index: number, patch: Partial<PreferenceEditorRow>) {
    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index
          ? {
            ...row,
            ...patch
          }
          : row
      )
    );
  }

  function addRow() {
    setRows((current) => [...current, { category: "", items: [], draftItem: "" }]);
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  function addDraftItems(index: number) {
    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index
          ? {
            ...row,
            items: mergePreferenceItems(row.items, splitPreferenceItems(row.draftItem)),
            draftItem: ""
          }
          : row
      )
    );
  }

  function removeItem(rowIndex: number, itemIndex: number) {
    setRows((current) =>
      current.map((row, index) =>
        index === rowIndex
          ? {
            ...row,
            items: row.items.filter((_, currentItemIndex) => currentItemIndex !== itemIndex)
          }
          : row
      )
    );
  }

  function handleItemKeyDown(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (!["Enter", "、", ";", "；"].includes(event.key)) return;
    event.preventDefault();
    addDraftItems(index);
  }

  const groupsValue: PreferenceGroup[] = rows
    .map((row) => ({
      category: row.category.trim(),
      items: mergePreferenceItems(row.items, splitPreferenceItems(row.draftItem))
    }))
    .filter((row) => row.category && row.items.length);

  const incompleteCount = rows.filter((row) => {
    const hasCategory = row.category.trim();
    const hasItems = row.items.length || splitPreferenceItems(row.draftItem).length;
    return (hasCategory && !hasItems) || (!hasCategory && hasItems);
  }).length;

  return (
    <div className={`pref-editor ${danger ? "danger" : ""}`}>
      <input type="hidden" name={name} value={groupsToText(groupsValue)} />
      {rows.map((row, index) => {
        const hasCategory = row.category.trim();
        const hasItems = row.items.length || splitPreferenceItems(row.draftItem).length;
        const incomplete = (hasCategory && !hasItems) || (!hasCategory && hasItems);
        return (
          <div className={`pref-editor-row ${incomplete ? "incomplete" : ""}`} key={`${name}-${index}`}>
            <div className="pref-row-header">
              <div className="pref-category-field">
                <span className="pref-field-label">分类</span>
                <input
                  aria-label="分类"
                  placeholder={danger ? "过敏" : "颜色"}
                  value={row.category}
                  onChange={(event) => updateRow(index, { category: event.target.value })}
                />
              </div>
              <button
                type="button"
                className="pref-row-remove"
                aria-label="删除此分类"
                title="删除此分类"
                onClick={() => removeRow(index)}
              >
                <Trash2 size={16} />
              </button>
            </div>
            {row.items.length > 0 && (
              <div className="pref-chip-list" aria-label={`${danger ? "禁忌" : "喜好"}项目`}>
                {row.items.map((item, itemIndex) => (
                  <span className={`pref-chip ${danger ? "danger" : ""}`} key={`${name}-${index}-${item}`}>
                    <span className="pref-chip-text">{item}</span>
                    <button type="button" aria-label={`删除${item}`} onClick={() => removeItem(index, itemIndex)}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="pref-item-input-row">
              <input
                aria-label="新增项目"
                placeholder={danger ? "新增雷区，如：花生、不吃辣" : "新增喜好，如：蓝色、火锅"}
                value={row.draftItem}
                onBlur={() => addDraftItems(index)}
                onChange={(event) => updateRow(index, { draftItem: event.target.value })}
                onKeyDown={(event) => handleItemKeyDown(event, index)}
              />
              <button type="button" className="mini-action add" onClick={() => addDraftItems(index)}>
                <Plus size={14} />
                添加项目
              </button>
            </div>
          </div>
        );
      })}
      {incompleteCount > 0 && (
        <p className="form-hint danger">有 {incompleteCount} 条记录缺少{danger ? "禁忌" : "喜好"}分类或项目，保存时会被忽略。</p>
      )}
      <button type="button" className="mini-action add" onClick={addRow}>
        <Plus size={16} />
        添加分类
      </button>
      <p className="form-hint">
        输入内容后点击“添加项目”生成标签，可点标签上的 × 删除；多个项目可用“、”或“；”一次性添加。不添加任何分类时，保存后会保持为空。
      </p>
    </div>
  );
}

function mergePreferenceItems(currentItems: string[], nextItems: string[]) {
  const seen = new Set<string>();
  return [...currentItems, ...nextItems]
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
}

function buildDraftDate(year: string, month: string, day: string) {
  if (!year || !month || !day) return "";
  return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function parseDraftGroups(value: string): PreferenceGroup[] {
  return value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [category, rawItems = ""] = line.split(/[:：]/);
      return {
        category: category.trim(),
        items: splitPreferenceItems(rawItems)
      };
    })
    .filter((group) => group.category && group.items.length);
}
