import { useState } from "react";
import type { Anniversary, Person, PreferenceGroup } from "../../types";
import { useLifeLog } from "../../context/LifeLogContext";
import { groupsToText, splitPreferenceItems } from "../../utils/text";
import DateInput from "../DateInput";
import SelectPicker from "../SelectPicker";

const RELATIONSHIP_OPTIONS = ["朋友", "家人", "同事", "同学", "恋人", "其他"].map((item) => ({ value: item, label: item }));
const BOOLEAN_OPTIONS = [
  { value: "true", label: "是" },
  { value: "false", label: "否" }
];

export function PersonFields({ person, isEditing }: { person?: Person; isEditing: boolean }) {
  if (!isEditing) return <QuickPersonFields />;

  const customAnniversaries = (person?.anniversaries || []).filter((item) => item.title !== "生日");

  return (
    <>
      <div className="form-row">
        <label>
          姓名
          <input name="name" defaultValue={person?.name} required />
        </label>
        <label>
          昵称
          <input name="nickname" defaultValue={person?.nickname || ""} />
        </label>
      </div>
      <div className="form-row">
        <label>
          关系
          <SelectPicker
            name="relationship"
            label="人物关系"
            defaultValue={person?.relationship || "朋友"}
            options={RELATIONSHIP_OPTIONS}
          />
        </label>
        <label>
          收藏
          <SelectPicker
            name="favorite"
            label="人物收藏"
            defaultValue={person?.favorite ? "true" : "false"}
            options={BOOLEAN_OPTIONS}
          />
        </label>
      </div>
      <BirthdayDateFields birthday={person?.birthday} />
      <p className="form-hint">只记录公历生日，农历日期会自动计算并显示。</p>
      <label>纪念日</label>
      <AnniversaryEditor anniversaries={customAnniversaries} />
      <label>
        喜好档案
      </label>
      <PreferenceGroupEditor
        name="preferences"
        groups={person?.preferences}
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
        defaults={[
          { category: "过敏", items: ["花生"] },
          { category: "口味", items: ["不吃辣"] }
        ]}
      />
      <label>
        备注
        <textarea name="notes" defaultValue={person?.notes} placeholder="记录一些重要细节，例如：喜欢喝美式，不吃香菜。" />
      </label>
    </>
  );
}

function BirthdayDateFields({ birthday }: { birthday?: string }) {
  const [birthdayValue, setBirthdayValue] = useState(birthday || "");
  const [year = "", month = "", day = ""] = birthdayValue.split("-");

  return (
    <label className="birthday-date-field">
      <span>生日</span>
      <DateInput label="生日" value={birthdayValue} onChange={setBirthdayValue} />
      <input type="hidden" name="birthdayYear" value={year} />
      <input type="hidden" name="birthdayMonth" value={month} />
      <input type="hidden" name="birthdayDay" value={day} />
    </label>
  );
}

function QuickPersonFields() {
  const { settings } = useLifeLog();

  return (
    <>
      <label>
        姓名
        <input name="name" placeholder="例如：王晓明" required autoFocus />
      </label>
      <label>
        关系
        <SelectPicker
          name="relationship"
          label="人物关系"
          defaultValue={settings.defaultRelationship}
          options={RELATIONSHIP_OPTIONS}
        />
      </label>
      <input type="hidden" name="favorite" value="false" />
      <input type="hidden" name="preferences" value="" />
      <input type="hidden" name="dislikes" value="" />
      <input type="hidden" name="anniversaries" value="[]" />
      <p className="form-hint">先记下这个人就可以，生日、喜好、禁忌和纪念日可以在详情页慢慢补。</p>
      <label>
        一句话备注
        <textarea name="notes" placeholder="例如：喜欢喝美式，不吃香菜。" />
      </label>
    </>
  );
}

interface AnniversaryRow {
  title: string;
  date: string;
}

function AnniversaryEditor({ anniversaries }: { anniversaries?: Anniversary[] }) {
  const [rows, setRows] = useState<AnniversaryRow[]>(
    anniversaries?.length
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
            <input
              aria-label="纪念日名称"
              placeholder="纪念日名称"
              value={row.title}
              onChange={(event) => updateRow(index, { title: event.target.value })}
            />
            <DateInput
              label="纪念日日期"
              value={row.date}
              onChange={(value) => updateRow(index, { date: value })}
            />
            <button type="button" className="mini-action danger" onClick={() => removeRow(index)}>
              删除
            </button>
          </div>
        );
      })}
      {incompleteCount > 0 && (
        <p className="form-hint danger">有 {incompleteCount} 条纪念日信息不完整，保存时会被忽略。</p>
      )}
      <button type="button" className="mini-action add" onClick={addRow}>
        添加纪念日
      </button>
      <p className="form-hint">纪念日同样只输入公历日期，详情页会自动显示农历日期。</p>
    </div>
  );
}

function PreferenceGroupEditor({
  name,
  groups,
  defaults,
  danger = false
}: {
  name: string;
  groups?: PreferenceGroup[];
  defaults: PreferenceGroup[];
  danger?: boolean;
}) {
  const [rows, setRows] = useState(() =>
    (groups?.length ? groups : defaults).map((group) => ({
      category: group.category,
      itemsText: group.items.join("、")
    }))
  );

  function updateRow(index: number, patch: Partial<{ category: string; itemsText: string }>) {
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
    setRows((current) => [...current, { category: "", itemsText: "" }]);
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  const groupsValue: PreferenceGroup[] = rows
    .map((row) => ({
      category: row.category.trim(),
      items: splitPreferenceItems(row.itemsText)
    }))
    .filter((row) => row.category && row.items.length);

  const incompleteCount = rows.filter((row) => {
    const hasCategory = row.category.trim();
    const hasItems = row.itemsText.trim();
    return (hasCategory && !hasItems) || (!hasCategory && hasItems);
  }).length;

  return (
    <div className={`pref-editor ${danger ? "danger" : ""}`}>
      <input type="hidden" name={name} value={groupsToText(groupsValue)} />
      {rows.map((row, index) => {
        const hasCategory = row.category.trim();
        const hasItems = row.itemsText.trim();
        const incomplete = (hasCategory && !hasItems) || (!hasCategory && hasItems);
        return (
          <div className={`pref-editor-row ${incomplete ? "incomplete" : ""}`} key={`${name}-${index}`}>
            <input
              aria-label="分类"
              placeholder="分类"
              value={row.category}
              onChange={(event) => updateRow(index, { category: event.target.value })}
            />
            <input
              aria-label="项目"
              placeholder="用顿号或分号分隔"
              value={row.itemsText}
              onChange={(event) => updateRow(index, { itemsText: event.target.value })}
            />
            <button type="button" className="mini-action danger" onClick={() => removeRow(index)}>
              删除
            </button>
          </div>
        );
      })}
      {incompleteCount > 0 && (
        <p className="form-hint danger">有 {incompleteCount} 条记录缺少{danger ? "禁忌" : "喜好"}分类或项目，保存时会被忽略。</p>
      )}
      <button type="button" className="mini-action add" onClick={addRow}>
        添加分类
      </button>
    </div>
  );
}
