import { useNavigate } from "react-router-dom";
import { useState } from "react";
import type { FormEvent } from "react";
import type { EntryType, LifeLogState, MemoryEvent, Person, Place, PreferenceGroup } from "../types";
import { useLifeLog } from "../context/LifeLogContext";
import { groupsToText } from "../utils/text";

interface EntrySheetProps {
  type: EntryType | null;
  itemId?: string;
  onClose: () => void;
}

const meta: Record<EntryType, { addTitle: string; editTitle: string; kicker: string; redirect: string }> = {
  person: { addTitle: "新增人物", editTitle: "编辑人物", kicker: "记录一个重要的人", redirect: "/people" },
  place: { addTitle: "新增地点", editTitle: "编辑地点", kicker: "保存一个值得记住的地点", redirect: "/places" },
  memory: { addTitle: "新增回忆", editTitle: "编辑回忆", kicker: "把人物和地点连接起来", redirect: "/memories" }
};

export default function EntrySheet({ type, itemId, onClose }: EntrySheetProps) {
  const navigate = useNavigate();
  const { state, savePerson, savePlace, saveMemory } = useLifeLog();
  const [error, setError] = useState("");

  if (!type) return null;

  const entryType = type;
  const current = meta[entryType];
  const editingItem = findEditingItem(entryType, itemId, state);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const validationError = validateForm(entryType, formData);

    if (validationError) {
      setError(validationError);
      return;
    }

    if (entryType === "person") await savePerson(formData, itemId);
    if (entryType === "place") await savePlace(formData, itemId);
    if (entryType === "memory") await saveMemory(formData, itemId);

    onClose();
    navigate(current.redirect);
  }

  return (
    <div className="sheet">
      <div className="sheet-backdrop" onClick={onClose} />
      <section className="sheet-panel">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <div>
            <p className="date-label">{current.kicker}</p>
            <h2>{itemId ? current.editTitle : current.addTitle}</h2>
          </div>
          <button className="sheet-close" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </div>

        <form className="form" onSubmit={handleSubmit}>
          {error && <div className="form-error">{error}</div>}
          {entryType === "person" && <PersonFields person={editingItem as Person | undefined} />}
          {entryType === "place" && <PlaceFields place={editingItem as Place | undefined} />}
          {entryType === "memory" && (
            <MemoryFields
              memory={editingItem as MemoryEvent | undefined}
              people={state.people}
              places={state.places}
            />
          )}

          <div className="submit-row">
            <button type="button" className="ghost-btn" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="primary-btn">
              保存
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function validateForm(type: EntryType, formData: FormData) {
  if (type === "person" && !String(formData.get("name") || "").trim()) {
    return "请填写姓名。";
  }

  if (type === "place" && !String(formData.get("name") || "").trim()) {
    return "请填写地点名称。";
  }

  if (type === "memory") {
    if (!String(formData.get("title") || "").trim()) return "请填写回忆标题。";
    if (!String(formData.get("date") || "").trim()) return "请选择回忆日期。";
  }

  return "";
}

function findEditingItem(type: EntryType, itemId: string | undefined, state: LifeLogState) {
  if (!itemId) return undefined;
  if (type === "person") return state.people.find((person) => person.id === itemId);
  if (type === "place") return state.places.find((place) => place.id === itemId);
  return state.memories.find((memory) => memory.id === itemId);
}

function PersonFields({ person }: { person?: Person }) {
  const [birthdayYear = "", birthdayMonth = "", birthdayDay = ""] = (person?.birthday || "").split("-");

  return (
    <>
      <div className="form-row">
        <label>
          姓名
          <input name="name" defaultValue={person?.name || "小蓝"} required />
        </label>
        <label>
          昵称
          <input name="nickname" defaultValue={person?.nickname || ""} />
        </label>
      </div>
      <div className="form-row">
        <label>
          关系
          <input name="relationship" defaultValue={person?.relationship || "朋友"} />
        </label>
        <label>
          收藏
          <select name="favorite" defaultValue={person?.favorite ? "true" : "false"}>
            <option value="true">是</option>
            <option value="false">否</option>
          </select>
        </label>
      </div>
      <div className="birthday-editor compact">
        <label>
          年
          <input name="birthdayYear" type="number" min="1" max="9999" defaultValue={birthdayYear} placeholder="1999" />
        </label>
        <label>
          月
          <input name="birthdayMonth" type="number" min="1" max="12" defaultValue={birthdayMonth} placeholder="04" />
        </label>
        <label>
          日
          <input name="birthdayDay" type="number" min="1" max="31" defaultValue={birthdayDay} placeholder="15" />
        </label>
      </div>
      <p className="form-hint">只记录公历生日，农历日期会自动计算并显示。</p>
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
        <textarea name="notes" defaultValue={person?.notes || "这里记录一些重要细节。"} />
      </label>
    </>
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
  const [rows, setRows] = useState<PreferenceGroup[]>(groups?.length ? groups : defaults);

  function updateRow(index: number, patch: Partial<PreferenceGroup>) {
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
    setRows((current) => [...current, { category: "", items: [] }]);
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  return (
    <div className={`pref-editor ${danger ? "danger" : ""}`}>
      <input type="hidden" name={name} value={groupsToText(rows)} />
      {rows.map((row, index) => (
        <div className="pref-editor-row" key={`${name}-${index}`}>
          <input
            aria-label="分类"
            placeholder="分类"
            value={row.category}
            onChange={(event) => updateRow(index, { category: event.target.value })}
          />
          <input
            aria-label="项目"
            placeholder="用逗号分隔多个项目"
            value={row.items.join("，")}
            onChange={(event) =>
              updateRow(index, {
                items: event.target.value
                  .split(/[，,]/)
                  .map((item) => item.trim())
                  .filter(Boolean)
              })
            }
          />
          <button type="button" className="mini-action danger" onClick={() => removeRow(index)}>
            删除
          </button>
        </div>
      ))}
      <button type="button" className="mini-action add" onClick={addRow}>
        添加分类
      </button>
    </div>
  );
}

function PlaceFields({ place }: { place?: Place }) {
  return (
    <>
      <div className="form-row">
        <label>
          国家
          <input name="country" defaultValue={place?.country || "中国"} />
        </label>
        <label>
          城市
          <input name="city" defaultValue={place?.city || "杭州"} />
        </label>
      </div>
      <div className="form-row">
        <label>
          商场 / 商圈
          <input name="area" defaultValue={place?.area || "万达广场"} />
        </label>
        <label>
          店家 / 分店
          <input name="storeName" defaultValue={place?.storeName || "湖滨店"} />
        </label>
      </div>
      <div className="form-row">
        <label>
          地点名称
          <input name="name" defaultValue={place?.name || "新餐厅"} required />
        </label>
        <label>
          分类
          <input name="category" defaultValue={place?.category || "餐厅"} />
        </label>
      </div>
      <label>
        详细地址
        <input name="address" defaultValue={place?.address || ""} placeholder="例如：杭州市上城区湖滨银泰 B1" />
      </label>
      <div className="form-row">
        <label>
          纬度
          <input name="latitude" type="number" step="0.000001" defaultValue={place?.latitude || ""} />
        </label>
        <label>
          经度
          <input name="longitude" type="number" step="0.000001" defaultValue={place?.longitude || ""} />
        </label>
      </div>
      <div className="form-row">
        <label>
          评分
          <input name="rating" type="number" step="0.1" defaultValue={place?.rating || 4.5} />
        </label>
        <label>
          收藏
          <select name="favorite" defaultValue={place?.favorite ? "true" : "false"}>
            <option value="true">是</option>
            <option value="false">否</option>
          </select>
        </label>
      </div>
      <label>
        地图 / 定位链接
        <input name="mapUrl" defaultValue={place?.mapUrl || ""} placeholder="高德、百度、Google Maps 等链接" />
      </label>
      <label>
        参考链接 / 攻略链接
        <input name="sourceUrl" defaultValue={place?.sourceUrl || ""} placeholder="官网、攻略、笔记或圆周旅迹链接" />
      </label>
      <label>
        描述
        <textarea name="desc" defaultValue={place?.desc || "适合约会或聚餐。"} />
      </label>
      <label>
        标签，逗号分隔
        <input name="tags" defaultValue={place?.tags.join("，") || "安静，推荐"} />
      </label>
    </>
  );
}

function MemoryFields({
  memory,
  people,
  places
}: {
  memory?: MemoryEvent;
  people: Array<{ id: string; name: string }>;
  places: Array<{ id: string; name: string }>;
}) {
  return (
    <>
      <label>
        标题
        <input name="title" defaultValue={memory?.title || "新的回忆"} required />
      </label>
      <div className="form-row">
        <label>
          日期
          <input name="date" type="date" defaultValue={memory?.date || new Date().toISOString().slice(0, 10)} required />
        </label>
        <label>
          心情
          <input name="mood" defaultValue={memory?.mood || "开心"} />
        </label>
      </div>
      <label>
        关联人物
        <select name="personId" defaultValue={memory?.personIds[0] || people[0]?.id || ""}>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        关联地点
        <select name="placeId" defaultValue={memory?.placeId || places[0]?.id || ""}>
          {places.map((place) => (
            <option key={place.id} value={place.id}>
              {place.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        内容
        <textarea name="content" defaultValue={memory?.content || "记录今天发生的事，以及下次要注意什么。"} />
      </label>
      <label>
        标签，逗号分隔
        <input name="tags" defaultValue={memory?.tags.join("，") || "日常，值得记住"} />
      </label>
    </>
  );
}
