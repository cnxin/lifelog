import { useNavigate } from "react-router-dom";
import { useState } from "react";
import type { FormEvent } from "react";
import type {
  Anniversary,
  EntryType,
  LifeLogState,
  MemoryEvent,
  Person,
  Place,
  PlaceMergePreview,
  PreferenceGroup
} from "../types";
import { useLifeLog } from "../context/LifeLogContext";
import type { PlaceDraft } from "../utils/placeShareParser";
import { emptyPlaceDraft, parsePlaceShare } from "../utils/placeShareParser";
import { createPlatformLink } from "../utils/placeLinks";
import { getPlacePlatformLink } from "../utils/placeMeta";
import { groupsToText, splitPreferenceItems } from "../utils/text";
import { inferQuickMemory } from "../utils/memoryInference";
import PlaceMergeWorkbench from "./PlaceMergeWorkbench";

interface EntrySheetProps {
  type: EntryType | null;
  itemId?: string;
  initialPersonId?: string;
  initialPlaceId?: string;
  memoryMode?: "quick" | "full";
  onClose: () => void;
}

const meta: Record<EntryType, { addTitle: string; editTitle: string; kicker: string; redirect: string }> = {
  person: { addTitle: "新增人物", editTitle: "编辑人物", kicker: "记录一个重要的人", redirect: "/people" },
  place: { addTitle: "新增地点", editTitle: "编辑地点", kicker: "保存一个值得记住的地点", redirect: "/places" },
  memory: { addTitle: "新增回忆", editTitle: "编辑回忆", kicker: "把人物和地点连接起来", redirect: "/memories" }
};

export default function EntrySheet({
  type,
  itemId,
  initialPersonId,
  initialPlaceId,
  memoryMode = "full",
  onClose
}: EntrySheetProps) {
  const navigate = useNavigate();
  const { state, inspectPlaceSave, savePerson, savePlace, saveMemory } = useLifeLog();
  const [error, setError] = useState("");
  const [mergePreview, setMergePreview] = useState<PlaceMergePreview | null>(null);
  const [pendingPlaceFormData, setPendingPlaceFormData] = useState<FormData | null>(null);

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

    let savedPersonId = "";
    let savedPlaceId = "";
    let savedMemoryId = "";
    if (entryType === "person") savedPersonId = await savePerson(formData, itemId);
    if (entryType === "place") {
      const inspection = inspectPlaceSave(formData, itemId);
      if (inspection.resolution === "confirm-merge" && inspection.preview) {
        setPendingPlaceFormData(formData);
        setMergePreview(inspection.preview);
        return;
      }

      savedPlaceId = await savePlace(formData, itemId);
    }
    if (entryType === "memory") savedMemoryId = await saveMemory(formData, itemId);

    onClose();
    if (entryType === "person" && !itemId && savedPersonId) {
      navigate(`/people/${savedPersonId}`);
      return;
    }
    if (entryType === "place" && !itemId && savedPlaceId) {
      navigate(`/places/${savedPlaceId}`);
      return;
    }
    if (entryType === "memory" && !itemId && savedMemoryId) {
      navigate(`/memories/${savedMemoryId}`);
      return;
    }
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
          {entryType === "person" && (
            <PersonFields person={editingItem as Person | undefined} isEditing={Boolean(itemId)} />
          )}
          {entryType === "place" && <PlaceFields place={editingItem as Place | undefined} isEditing={Boolean(itemId)} />}
          {entryType === "memory" && (
            <MemoryFields
              memory={editingItem as MemoryEvent | undefined}
              people={state.people}
              places={state.places}
              initialPersonId={initialPersonId}
              initialPlaceId={initialPlaceId}
              mode={memoryMode}
            />
          )}

          <div className="submit-row">
            <button type="button" className="ghost-btn" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="primary-btn">
              {!itemId && (entryType === "person" || entryType === "place") ? "创建" : "保存"}
            </button>
          </div>
        </form>

        {entryType === "place" && mergePreview && pendingPlaceFormData && (
          <PlaceMergeWorkbench
            preview={mergePreview}
            title="合并预览"
            confirmLabel="合并到已有地点"
            allowKeepBoth
            keepBothLabel="保留为新地点"
            onCancel={() => {
              setMergePreview(null);
              setPendingPlaceFormData(null);
            }}
            onKeepBoth={async () => {
              const savedId = await savePlace(pendingPlaceFormData, itemId, { skipDuplicateCheck: true });
              setMergePreview(null);
              setPendingPlaceFormData(null);
              onClose();
              navigate(`/places/${savedId}`);
            }}
            onConfirm={async (nextPreview) => {
              const savedId = await savePlace(pendingPlaceFormData, itemId, {
                mergeTargetId: nextPreview.canonical.id,
                mergePreviewOverride: nextPreview,
              });
              setMergePreview(null);
              setPendingPlaceFormData(null);
              onClose();
              navigate(`/places/${savedId}`);
            }}
          />
        )}
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
    const memoryMode = String(formData.get("memoryMode") || "");
    if (memoryMode === "quick") {
      if (!String(formData.get("content") || "").trim()) return "请先写下今天发生了什么。";
      return "";
    }
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

function PersonFields({ person, isEditing }: { person?: Person; isEditing: boolean }) {
  if (!isEditing) return <QuickPersonFields />;

  const [birthdayYear = "", birthdayMonth = "", birthdayDay = ""] = (person?.birthday || "").split("-");
  const customAnniversaries = (person?.anniversaries || []).filter((item) => item.title !== "生日");

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
        <textarea name="notes" defaultValue={person?.notes || "这里记录一些重要细节。"} />
      </label>
    </>
  );
}

function QuickPersonFields() {
  return (
    <>
      <label>
        姓名
        <input name="name" placeholder="例如：王晓明" required autoFocus />
      </label>
      <label>
        关系
        <input name="relationship" defaultValue="朋友" placeholder="朋友、家人、同事..." />
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

  return (
    <div className="anniversary-editor">
      <input type="hidden" name="anniversaries" value={JSON.stringify(payload)} />
      {rows.map((row, index) => (
        <div className="anniversary-editor-row" key={`anniversary-${index}`}>
          <input
            aria-label="纪念日名称"
            placeholder="纪念日名称"
            value={row.title}
            onChange={(event) => updateRow(index, { title: event.target.value })}
          />
          <input
            aria-label="纪念日日期"
            type="date"
            value={row.date}
            onChange={(event) => updateRow(index, { date: event.target.value })}
          />
          <button type="button" className="mini-action danger" onClick={() => removeRow(index)}>
            删除
          </button>
        </div>
      ))}
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

  return (
    <div className={`pref-editor ${danger ? "danger" : ""}`}>
      <input type="hidden" name={name} value={groupsToText(groupsValue)} />
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
            placeholder="用顿号或分号分隔"
            value={row.itemsText}
            onChange={(event) => updateRow(index, { itemsText: event.target.value })}
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

function PlaceFields({ place, isEditing }: { place?: Place; isEditing: boolean }) {
  if (!isEditing) return <QuickPlaceFields />;

  return (
    <>
      <div className="form-row">
        <label>
          国家
          <input name="country" defaultValue={place?.country || "中国"} />
        </label>
        <label>
          省 / 州
          <input name="province" defaultValue={place?.province || ""} placeholder="例如：浙江省" />
        </label>
      </div>
      <div className="form-row">
        <label>
          城市
          <input name="city" defaultValue={place?.city || "杭州"} />
        </label>
        <label>
          区 / 商圈
          <input name="area" defaultValue={place?.area || "上城区"} placeholder="例如：上城区、柯桥区、湖滨商圈" />
        </label>
      </div>
      <div className="form-row">
        <label>
          商场 / 园区 / 景区
          <input name="mall" defaultValue={place?.mall || ""} placeholder="例如：湖滨银泰、万达广场、玉兰国际" />
        </label>
        <label>
          店铺 / 场所
          <input name="storeName" defaultValue={place?.storeName || "湖滨店"} placeholder="分店、楼层、影厅、景点入口等" />
        </label>
      </div>
      <p className="form-hint">层级按国家 / 省 / 市 / 商场 / 店铺记录；地点名称填主名称，商场和店铺分开更清晰。</p>
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
        高德分享链接
        <input name="mapUrl" defaultValue={place?.mapUrl || ""} placeholder="粘贴高德分享链接，详情页可直接打开高德" />
      </label>
      <label>
        参考链接 / 攻略链接
        <input name="sourceUrl" defaultValue={place?.sourceUrl || ""} placeholder="官网、攻略、笔记或圆周旅迹链接" />
      </label>
      <label>
        美团店铺链接
        <input
          name="platformLinks"
          defaultValue={extractMeituanLinkText(place)}
          placeholder="粘贴美团店铺链接，详情页可直接打开美团 App"
        />
      </label>
      <label>
        照片链接
        <textarea
          name="photos"
          defaultValue={(place?.photos || []).join("\n")}
          placeholder="每行一个图片链接，可以先粘贴高德或其他来源的图片 URL"
        />
      </label>
      <p className="form-hint">详情页会展示前 3 张照片；链接失效时会自动隐藏。</p>
      <label>
        描述
        <textarea name="desc" defaultValue={place?.desc || "适合约会或聚餐。"} />
      </label>
      <input type="hidden" name="latitude" value={place?.latitude || ""} />
      <input type="hidden" name="longitude" value={place?.longitude || ""} />
      <label>
        标签，逗号分隔
        <input name="tags" defaultValue={place?.tags.join("，") || "安静，推荐"} />
      </label>
    </>
  );
}

function QuickPlaceFields() {
  const [shareText, setShareText] = useState("");
  const [draft, setDraft] = useState<PlaceDraft>(() => emptyPlaceDraft());
  const [message, setMessage] = useState("");

  function applyShareText() {
    const parsed = parsePlaceShare(shareText);
    setDraft((current) => ({ ...current, ...parsed }));
    setMessage(
      parsed.confidence
        ? `已识别 ${parsed.confidence}%：${parsed.sourceType === "generic" ? "普通文本" : parsed.sourceType}`
        : "没有识别到明确地点，可以先手动填写。"
    );
  }

  function updateDraft(patch: Partial<PlaceDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  return (
    <>
      <div className="share-import">
        <label>
          粘贴地图 / 点评分享
          <textarea
            value={shareText}
            onChange={(event) => setShareText(event.target.value)}
            placeholder="粘贴高德、美团、大众点评分享文本或链接"
          />
        </label>
        <button type="button" className="mini-action add" onClick={applyShareText}>
          识别分享
        </button>
        {message && <p className="form-hint">{message}</p>}
        {draft.name && (
          <div className="import-preview">
            <span>{draft.sourceType === "generic" ? "文本" : draft.sourceType}</span>
            <strong>{draft.name}</strong>
            <small>{[draft.province, draft.city, draft.mall || draft.address].filter(Boolean).join(" · ") || "可继续补充城市和地址"}</small>
          </div>
        )}
      </div>

      <div className="form-row">
        <label>
          地点名称
          <input
            name="name"
            value={draft.name}
            onChange={(event) => updateDraft({ name: event.target.value })}
            placeholder="例如：九月里·自由花园餐厅"
            required
          />
        </label>
        <label>
          类型
          <input
            name="category"
            value={draft.category}
            onChange={(event) => updateDraft({ category: event.target.value })}
            placeholder="餐厅、酒店、景点..."
          />
        </label>
      </div>
      <div className="form-row">
        <label>
          省 / 州
          <input
            name="province"
            value={draft.province}
            onChange={(event) => updateDraft({ province: event.target.value })}
            placeholder="例如：浙江省"
          />
        </label>
        <label>
          城市
          <input
            name="city"
            value={draft.city}
            onChange={(event) => updateDraft({ city: event.target.value })}
            placeholder="例如：绍兴"
          />
        </label>
      </div>
      <div className="form-row">
        <label>
          区 / 商圈
          <input
            name="area"
            value={draft.area}
            onChange={(event) => updateDraft({ area: event.target.value })}
            placeholder="例如：柯桥区"
          />
        </label>
        <label>
          商场 / 园区
          <input
            name="mall"
            value={draft.mall}
            onChange={(event) => updateDraft({ mall: event.target.value })}
            placeholder="例如：玉兰国际"
          />
        </label>
      </div>
      <label>
        店铺 / 场所
        <input
          name="storeName"
          value={draft.storeName}
          onChange={(event) => updateDraft({ storeName: event.target.value })}
          placeholder="例如：玉兰国际店、B1 店、IMAX 厅"
        />
      </label>
      <label>
        地址
        <input
          name="address"
          value={draft.address}
          onChange={(event) => updateDraft({ address: event.target.value })}
          placeholder="可以先空着，后续再补"
        />
      </label>
      <label>
        备注
        <textarea
          name="desc"
          value={draft.desc}
          onChange={(event) => updateDraft({ desc: event.target.value })}
          placeholder="例如：朋友推荐，想下次去试试。"
        />
      </label>

      <input type="hidden" name="country" value={draft.country || "中国"} />
      <input type="hidden" name="rating" value="4" />
      <input type="hidden" name="favorite" value="false" />
      <input type="hidden" name="latitude" value={draft.latitude} />
      <input type="hidden" name="longitude" value={draft.longitude} />
      <input type="hidden" name="mapUrl" value={draft.mapUrl} />
      <input type="hidden" name="sourceUrl" value={draft.sourceUrl} />
      <input type="hidden" name="platformLinks" value={extractMeituanLinkTextFromDraft(draft)} />
      <input type="hidden" name="photos" value={draft.photos} />
      <input type="hidden" name="tags" value={draft.tags} />
      <p className="form-hint">先保存核心信息即可，区域、分店、高德链接、美团链接和照片可以在详情页继续编辑。</p>
    </>
  );
}

function MemoryFields({
  memory,
  people,
  places,
  initialPersonId,
  initialPlaceId,
  mode
}: {
  memory?: MemoryEvent;
  people: Array<{ id: string; name: string }>;
  places: Array<{ id: string; name: string }>;
  initialPersonId?: string;
  initialPlaceId?: string;
  mode: "quick" | "full";
}) {
  const selectedPersonIds = memory?.personIds.length ? memory.personIds : [initialPersonId || people[0]?.id || ""].filter(Boolean);
  const todayValue = new Date().toISOString().slice(0, 10);
  const [quickContent, setQuickContent] = useState("");
  const [quickPersonId, setQuickPersonId] = useState(initialPersonId || "");
  const [quickPlaceId, setQuickPlaceId] = useState(initialPlaceId || "");
  const quickPreview = inferQuickMemory({
    content: quickContent,
    people,
    places,
    fallbackDate: todayValue,
    selectedPersonIds: quickPersonId ? [quickPersonId] : [],
    selectedPlaceId: quickPlaceId
  });
  const previewPeople = quickPreview.personIds
    .map((personId) => people.find((person) => person.id === personId)?.name)
    .filter(Boolean);
  const previewPlace = places.find((place) => place.id === quickPreview.placeId)?.name || "";

  if (!memory && mode === "quick") {
    return (
      <>
        <label>
          今天发生了什么
          <textarea
            name="content"
            value={quickContent}
            onChange={(event) => setQuickContent(event.target.value)}
            autoFocus
            placeholder="例如：今天和小明在湖滨吃火锅，番茄锅不错，下次提前排号。"
          />
        </label>
        <div className="form-row">
          <label>
            人物
            <select name="personIds" value={quickPersonId} onChange={(event) => setQuickPersonId(event.target.value)}>
              <option value="">自动识别或暂不关联</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            地点
            <select name="placeId" value={quickPlaceId} onChange={(event) => setQuickPlaceId(event.target.value)}>
              <option value="">自动识别或暂不关联</option>
              {places.map((place) => (
                <option key={place.id} value={place.id}>
                  {place.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="memory-preview" aria-live="polite">
          <span className="memory-preview-eyebrow">保存预览</span>
          <div className="memory-preview-row">
            <strong>标题</strong>
            <span>{quickPreview.title}</span>
          </div>
          <div className="memory-preview-row">
            <strong>日期</strong>
            <span>{formatPreviewDate(quickPreview.date)}</span>
          </div>
          <div className="memory-preview-row">
            <strong>人物</strong>
            <span>{previewPeople.length ? previewPeople.join("、") : "未识别"}</span>
          </div>
          <div className="memory-preview-row">
            <strong>地点</strong>
            <span>{previewPlace || "未识别"}</span>
          </div>
        </div>
        <input type="hidden" name="title" value="" />
        <input type="hidden" name="date" value={todayValue} />
        <input type="hidden" name="memoryMode" value="quick" />
        <input type="hidden" name="mood" value="日常" />
        <input type="hidden" name="tags" value="快速记录" />
        <p className="form-hint">可以手动选择，也可以留空；保存时会按上方预览自动生成标题、日期和关联信息。</p>
      </>
    );
  }

  return (
    <>
      <label>
        标题
        <input name="title" defaultValue={memory?.title || "新的回忆"} required />
      </label>
      <div className="form-row">
        <label>
          日期
          <input name="date" type="date" defaultValue={memory?.date || todayValue} required />
        </label>
        <label>
          心情
          <input name="mood" defaultValue={memory?.mood || "开心"} />
        </label>
      </div>
      <div>
        <span className="field-title">关联人物</span>
        <div className="choice-grid">
          {people.map((person) => (
            <label className="choice-item" key={person.id}>
              <input
                name="personIds"
                type="checkbox"
                value={person.id}
                defaultChecked={selectedPersonIds.includes(person.id)}
              />
              <span>{person.name}</span>
            </label>
          ))}
        </div>
        {!people.length && <p className="form-hint">还没有人物，可以先保存回忆，后续再关联。</p>}
      </div>
      <label>
        关联地点
        <select name="placeId" defaultValue={memory?.placeId || initialPlaceId || places[0]?.id || ""}>
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

function formatPreviewDate(date: string) {
  if (!date) return "未识别";
  return new Date(`${date}T00:00:00`).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function extractMeituanLinkText(place?: Place) {
  if (!place) return "";
  return getPlacePlatformLink(place, "meituan")?.url || "";
}

function extractMeituanLinkTextFromDraft(draft: PlaceDraft) {
  if (draft.platformLinks.trim()) return draft.platformLinks;
  const link = createPlatformLink(draft.sourceUrl, draft.sourceType === "meituan" ? "美团" : "");
  if (!link || link.platform !== "meituan") return "";
  return `美团 | ${link.url}`;
}
