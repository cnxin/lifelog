import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { MemoryEvent, Photo } from "../../types";
import { useLifeLog } from "../../context/LifeLogContext";
import { inferQuickMemory } from "../../utils/memoryInference";
import { deriveMemorySummary } from "../../utils/memoryDisplay";
import { buildDefaultQuickMemoryTitle, buildMemoryContentTemplates, buildQuickMemoryTemplateGroups } from "../../utils/quickMemoryContext";
import DateInput from "../DateInput";
import PersonPicker from "../PersonPicker";
import PlacePicker from "../PlacePicker";
import { PhotoUploader } from "../PhotoUploader";
import {
  getDraftValue,
  getDraftValues,
  hasDraftField,
  type DraftFieldMap
} from "./draftValues";

const MOOD_PRESETS = ["开心", "平静", "感动", "怀念", "疲惫", "焦虑"];
const QUICK_SCENE_PRESETS = [
  {
    id: "meal",
    label: "吃饭",
    title: "今天吃了一顿不错的饭",
    mood: "开心",
    content: "吃了什么：\n\n谁一起：\n\n下次想点：",
    tags: "吃饭、好吃、想再去"
  },
  {
    id: "date",
    label: "约会",
    title: "一次值得记住的见面",
    mood: "开心",
    content: "一起做了什么：\n\n印象最深的是：\n\n下次可以：",
    tags: "约会、见面、值得记住"
  },
  {
    id: "shopping",
    label: "逛街",
    title: "今天逛到一个不错的地方",
    mood: "平静",
    content: "逛了哪里：\n\n看到/买到：\n\n下次想去：",
    tags: "逛街、想再去"
  },
  {
    id: "chat",
    label: "聊天",
    title: "今天聊到一些值得记住的话",
    mood: "感动",
    content: "聊到的事：\n\nTA 的想法：\n\n我想记住：",
    tags: "聊天、相处"
  },
  {
    id: "trip",
    label: "出行",
    title: "一次小出行",
    mood: "开心",
    content: "去了哪里：\n\n路线/体验：\n\n下次注意：",
    tags: "出行、旅行"
  },
  {
    id: "gift",
    label: "礼物",
    title: "记录一个礼物线索",
    mood: "期待",
    content: "TA 提到/喜欢：\n\n适合的礼物：\n\n需要避开：",
    tags: "礼物、喜好"
  }
];
const STRUCTURED_MEMORY_TEMPLATES = [
  {
    label: "三段记录",
    content: "发生了什么：\n\n当时感受：\n\n下次注意："
  },
  {
    label: "地点体验",
    content: "环境：\n\n服务：\n\n推荐点：\n\n下次想试："
  },
  {
    label: "人物互动",
    content: "一起做了什么：\n\n聊到的事：\n\nTA 的偏好/雷区：\n\n下次可以："
  }
];

export function MemoryFields({
  memory,
  people,
  places,
  initialPersonIds = [],
  initialPlaceId,
  initialPlaceIds = [],
  initialDate,
  mode,
  photos,
  onPhotosChange,
  isSubmitting,
  draftValues,
  onCreatePerson,
  onCreatePlace
}: {
  memory?: MemoryEvent;
  people: Array<{ id: string; name: string }>;
  places: Array<{ id: string; name: string; storeName?: string; mall?: string; area?: string; city?: string; address?: string }>;
  initialPersonIds?: string[];
  initialPlaceId?: string;
  initialPlaceIds?: string[];
  initialDate?: string;
  mode: "quick" | "full";
  photos: Photo[];
  onPhotosChange: (photos: Photo[]) => void;
  isSubmitting: boolean;
  draftValues?: DraftFieldMap;
  onCreatePerson?: (name: string) => Promise<string>;
  onCreatePlace?: (name: string) => Promise<string>;
}) {
  const { settings, state } = useLifeLog();
  const draftPersonIds = getDraftValues(draftValues, "personIds").filter(Boolean);
  const draftPlaceIds = getDraftMemoryPlaceIds(draftValues);
  const selectedPersonIds = hasDraftField(draftValues, "personIds")
    ? draftPersonIds
    : memory?.personIds?.length
      ? memory.personIds
      : initialPersonIds.filter(Boolean);
  const selectedPlaceIds = hasDraftField(draftValues, "placeIds") || hasDraftField(draftValues, "placeId")
    ? draftPlaceIds
    : getInitialPlaceIds(memory, initialPlaceId, initialPlaceIds);
  const todayValue = new Date().toISOString().slice(0, 10);
  const inboxPrefill = !memory && mode === "quick" ? consumeQuickInboxPrefill() : "";
  const [quickDate, setQuickDate] = useState(getDraftValue(draftValues, "date", initialDate || todayValue));
  const [quickContent, setQuickContent] = useState(() =>
    getDraftValue(draftValues, "title") ||
    inboxPrefill ||
    (!memory && mode === "quick"
      ? buildDefaultQuickMemoryTitle({
          personNames: resolvePersonNames(initialPersonIds, people),
          placeName: resolvePlaceNames(getInitialPlaceIds(undefined, initialPlaceId, initialPlaceIds), places).join("、")
        })
      : "")
  );
  const [quickDetailsContent, setQuickDetailsContent] = useState(getDraftValue(draftValues, "content"));
  const [quickTags, setQuickTags] = useState(getDraftValue(draftValues, "tags"));
  const [activeSceneId, setActiveSceneId] = useState("");
  const [assistOpen, setAssistOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(() => hasRestoredQuickDetails(draftValues));
  const [quickPersonIds, setQuickPersonIds] = useState<string[]>(() => selectedPersonIds);
  const [quickPlaceIds, setQuickPlaceIds] = useState<string[]>(() => selectedPlaceIds);
  const [fullPlaceIds, setFullPlaceIds] = useState<string[]>(() => selectedPlaceIds);
  const [mood, setMood] = useState<string>(getDraftValue(draftValues, "mood", memory ? memory.mood : settings.defaultMood));
  const quickInferenceContent = detailsOpen ? quickDetailsContent : quickContent;
  const quickPreview = inferQuickMemory({
    rawTitle: quickContent,
    content: quickInferenceContent,
    people,
    places,
    fallbackDate: quickDate,
    selectedPersonIds: quickPersonIds,
    selectedPlaceId: quickPlaceIds[0] || ""
  });
  const previewPeople = quickPreview.personIds
    .map((personId) => people.find((person) => person.id === personId)?.name)
    .filter((name): name is string => Boolean(name));
  const previewPlaceIds = quickPlaceIds.length ? quickPlaceIds : [quickPreview.placeId].filter(Boolean);
  const previewPlaces = resolvePlaceNames(previewPlaceIds, places);
  const previewPlace = previewPlaces.join("、");
  const hasQuickContext = previewPeople.length > 0 || Boolean(previewPlace);
  const quickTemplateGroups = buildQuickMemoryTemplateGroups(previewPeople, previewPlace);
  const quickContentTemplates = buildMemoryContentTemplates(previewPeople, previewPlaces);
  const recommendedPersonIds = useMemo(() => getRecentRecommendedIds(state.memories, "person", selectedPersonIds), [selectedPersonIds, state.memories]);
  const recommendedPlaceIds = useMemo(() => getRecentRecommendedIds(state.memories, "place", selectedPlaceIds), [selectedPlaceIds, state.memories]);
  const previewTitle =
    deriveMemorySummary(
      {
        id: "",
        title: "",
        date: quickPreview.date,
        personIds: quickPreview.personIds,
        placeId: previewPlaceIds[0] || "",
        placeIds: previewPlaceIds,
        mood: "",
        content: quickInferenceContent,
        tags: [],
        photos: []
      },
      { personNames: previewPeople, placeName: previewPlace, placeNames: previewPlaces }
    );

  if (!memory && mode === "quick") {
    return (
      <>
        <div className="quick-record-intro">
          <strong>先留下这一刻</strong>
          <span>{hasQuickContext ? "已经带上相关人物或地点，写一句就能保存。" : "不知道怎么分类也没关系，先写一句发生了什么。"}</span>
        </div>
        <label>
          这件事
          <input
            name="title"
            value={quickContent}
            onChange={(event) => setQuickContent(event.target.value)}
            autoFocus
            placeholder="例如：和小林在湖边散步，聊到下次去看展"
          />
        </label>
        <button className="quick-detail-toggle subtle" type="button" onClick={() => setAssistOpen((open) => !open)}>
          {assistOpen ? "收起提示" : "不会写时点这里"}
          {assistOpen ? <ChevronUp /> : <ChevronDown />}
        </button>
        {assistOpen && (
          <div className="quick-assist-panel">
            {quickTemplateGroups.length > 0 && (
              <div className="quick-context-card compact">
                {hasQuickContext && (
                  <>
                    <span className="quick-context-eyebrow">已自动关联</span>
                    <div className="quick-context-list">
                      {previewPeople.map((name) => (
                        <span className="quick-context-token" key={`person-${name}`}>
                          人物 · {name}
                        </span>
                      ))}
                      {previewPlace && (
                        <span className="quick-context-token">
                          地点 · {previewPlace}
                        </span>
                      )}
                    </div>
                  </>
                )}
                {quickTemplateGroups.map((group) => (
                  <div className="quick-template-group" key={group.title}>
                    <span className="quick-context-eyebrow">{group.title}</span>
                    <div className="quick-template-grid">
                      {group.templates.map((template) => (
                        <button
                          type="button"
                          className={`quick-template-chip ${quickContent === template ? "active" : ""}`}
                          key={template}
                          onClick={() => setQuickContent(template)}
                        >
                          {template}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="quick-scene-strip" aria-label="快速记录场景">
              {QUICK_SCENE_PRESETS.map((scene) => (
                <button
                  type="button"
                  className={`quick-scene-chip ${activeSceneId === scene.id ? "active" : ""}`}
                  key={scene.id}
                  onClick={() => {
                    setActiveSceneId(scene.id);
                    setQuickContent(scene.title);
                    setMood(scene.mood);
                    setQuickTags(scene.tags);
                    setQuickDetailsContent((current) => current.trim() ? current : scene.content);
                  }}
                >
                  {scene.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <label className="inline-field">
          <span className="inline-field-label">发生日期</span>
          <DateInput name="date" label="发生日期" value={quickDate} onChange={setQuickDate} required />
        </label>
        <label>
          当时感觉
          <input
            name="mood"
            value={mood}
            onChange={(event) => setMood(event.target.value)}
            placeholder="开心、平静、感动，或自己写一个词"
          />
          <div className="mood-presets">
            {MOOD_PRESETS.map((preset) => (
              <button
                type="button"
                key={preset}
                className={`mood-preset-pill ${mood === preset ? "active" : ""}`}
                onClick={() => setMood(preset)}
              >
                {preset}
              </button>
            ))}
          </div>
        </label>
        <button className="quick-detail-toggle" type="button" onClick={() => setDetailsOpen((open) => !open)}>
          {detailsOpen ? "先收起来" : "补人物 / 地点 / 照片"}
          {detailsOpen ? <ChevronUp /> : <ChevronDown />}
        </button>
        {detailsOpen && (
          <div className="quick-detail-panel">
            <div className="form-row">
              <div>
                <span className="field-title">人物</span>
                <PersonPicker
                  people={people}
                  value={quickPersonIds}
                  onChange={setQuickPersonIds}
                  onCreate={onCreatePerson}
                  includeEmptyMarker
                  recommendedIds={recommendedPersonIds}
                />
              </div>
              <div>
                <span className="field-title">地点</span>
                <PlacePicker
                  places={places}
                  value={quickPlaceIds}
                  onChange={setQuickPlaceIds}
                  onCreate={onCreatePlace}
                  includeEmptyMarker
                  recommendedIds={recommendedPlaceIds}
                />
                <input type="hidden" name="placeId" value={quickPlaceIds[0] || ""} />
              </div>
            </div>
            <label>
              多写一点
              {quickContentTemplates.length > 0 && (
                <div className="content-template-grid">
                  {quickContentTemplates.map((template) => (
                    <button
                      type="button"
                      className="content-template-chip"
                      key={template}
                      onClick={() => setQuickDetailsContent((current) => appendTemplate(current, template))}
                    >
                      {template.split("\n")[0]}
                    </button>
                  ))}
                </div>
              )}
              <textarea
                name="content"
                value={quickDetailsContent}
                onChange={(event) => setQuickDetailsContent(event.target.value)}
                placeholder="可以写发生了什么、当时的感觉、下次想怎么做。"
              />
            </label>
            <div>
              <span className="field-title">照片</span>
              <PhotoUploader
                photos={photos}
                memoryId="temp"
                maxPhotos={9}
                onPhotosChange={onPhotosChange}
                disabled={isSubmitting}
              />
            </div>
            <label>
              小标签
              <input
                name="tags"
                value={quickTags}
                onChange={(event) => setQuickTags(event.target.value)}
                placeholder="日常、好吃、想再去、值得记住"
              />
            </label>
          </div>
        )}
        <div className="memory-preview" aria-live="polite">
          <span className="memory-preview-eyebrow">会这样留下来</span>
          <div className="memory-preview-row">
            <strong>这件事</strong>
            <span>{quickContent.trim() || previewTitle}</span>
          </div>
          <div className="memory-preview-row">
            <strong>日期</strong>
            <span>{formatPreviewDate(quickPreview.date)}</span>
          </div>
          <div className="memory-preview-row">
            <strong>人物</strong>
            <span>{previewPeople.length ? previewPeople.join("、") : "暂不关联"}</span>
          </div>
          <div className="memory-preview-row">
            <strong>地点</strong>
            <span>{previewPlace || "暂不关联"}</span>
          </div>
        </div>
        {!detailsOpen && <input type="hidden" name="content" value={quickContent} />}
        {!detailsOpen && quickPersonIds.map((personId) => <input key={personId} type="hidden" name="personIds" value={personId} />)}
        {!detailsOpen && <input type="hidden" name="placeId" value={quickPlaceIds[0] || ""} />}
        {!detailsOpen && quickPlaceIds.map((placeId) => <input key={placeId} type="hidden" name="placeIds" value={placeId} />)}
        {!detailsOpen && <input type="hidden" name="tags" value={quickTags} />}
        <input type="hidden" name="memoryMode" value="quick" />
        <p className="form-hint">人物、地点和照片都可以先不管，之后想起来再补也可以。</p>
      </>
    );
  }

  return (
    <>
      <label>
        标题
        <input
          name="title"
          defaultValue={getDraftValue(draftValues, "title", memory?.title === "新的回忆" ? "" : memory?.title || "")}
          placeholder="留空将自动按人物 / 地点生成摘要"
        />
      </label>
      <label className="inline-field">
        <span className="inline-field-label">日期</span>
        <DateInput
          name="date"
          label="回忆日期"
          defaultValue={getDraftValue(draftValues, "date", memory?.date || initialDate || todayValue)}
          required
        />
      </label>
      <label>
        心情
        <input
          name="mood"
          value={mood}
          onChange={(event) => setMood(event.target.value)}
          placeholder="一个词描述今天的心情"
        />
        <div className="mood-presets">
          {MOOD_PRESETS.map((preset) => (
            <button
              type="button"
              key={preset}
              className={`mood-preset-pill ${mood === preset ? "active" : ""}`}
              onClick={() => setMood(preset)}
            >
              {preset}
            </button>
          ))}
        </div>
      </label>
      <div>
        <span className="field-title">关联人物</span>
        <PersonPicker people={people} defaultSelected={selectedPersonIds} onCreate={onCreatePerson} includeEmptyMarker recommendedIds={recommendedPersonIds} />
      </div>
      <div>
        <span className="field-title">关联地点</span>
        <PlacePicker
          places={places}
          value={fullPlaceIds}
          onChange={setFullPlaceIds}
          onCreate={onCreatePlace}
          includeEmptyMarker
          recommendedIds={recommendedPlaceIds}
        />
        <input type="hidden" name="placeId" value={fullPlaceIds[0] || ""} />
        <p className="form-hint memory-place-hint">可关联多个地点，例如一次商场行程里去过的几家店。</p>
      </div>
      <label>
        内容
        <div className="content-template-grid">
          {STRUCTURED_MEMORY_TEMPLATES.map((template) => (
            <button
              type="button"
              className="content-template-chip strong"
              key={template.label}
              onClick={(event) => insertTemplateIntoSiblingTextarea(event.currentTarget, template.content)}
            >
              {template.label}
            </button>
          ))}
          {buildMemoryContentTemplates(
            resolvePersonNames(selectedPersonIds, people),
            resolvePlaceNames(fullPlaceIds, places)
          ).map((template) => (
            <button
              type="button"
              className="content-template-chip"
              key={template}
              onClick={(event) => insertTemplateIntoSiblingTextarea(event.currentTarget, template)}
            >
              {template.split("\n")[0]}
            </button>
          ))}
        </div>
        <textarea
          name="content"
          defaultValue={getDraftValue(draftValues, "content", memory?.content || "")}
          placeholder="可按“发生了什么 / 当时感受 / 下次注意”三段记录。"
        />
      </label>
      <div>
        <span className="field-title">照片</span>
        <PhotoUploader
          photos={photos}
          memoryId={memory?.id || "temp"}
          maxPhotos={9}
          onPhotosChange={onPhotosChange}
          disabled={isSubmitting}
        />
      </div>
      <label>
        标签
        <input
          name="tags"
          defaultValue={getDraftValue(draftValues, "tags", memory?.tags.join("，") || "")}
          placeholder="日常、值得记住；可用顿号、逗号或分号分隔"
        />
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

function resolvePersonNames(personIds: string[] = [], people: Array<{ id: string; name: string }>) {
  return personIds
    .filter(Boolean)
    .map((personId) => people.find((person) => person.id === personId)?.name || "")
    .filter(Boolean);
}

function resolvePlaceName(placeId: string | undefined, places: Array<{ id: string; name: string }>) {
  if (!placeId) return "";
  return places.find((place) => place.id === placeId)?.name || "";
}

function resolvePlaceNames(placeIds: string[], places: Array<{ id: string; name: string }>) {
  return placeIds
    .filter(Boolean)
    .map((placeId) => resolvePlaceName(placeId, places))
    .filter(Boolean);
}

function getInitialPlaceIds(memory: MemoryEvent | undefined, initialPlaceId: string | undefined, initialPlaceIds: string[] = []) {
  const ids = [...(memory?.placeIds || []), memory?.placeId || "", ...initialPlaceIds, initialPlaceId || ""]
    .map((id) => id.trim())
    .filter(Boolean);
  return Array.from(new Set(ids));
}

function getDraftMemoryPlaceIds(draftValues?: DraftFieldMap) {
  const ids = [
    ...getDraftValues(draftValues, "placeIds"),
    getDraftValue(draftValues, "placeId")
  ]
    .map((id) => id.trim())
    .filter(Boolean);
  return Array.from(new Set(ids));
}

function hasRestoredQuickDetails(draftValues?: DraftFieldMap) {
  if (!draftValues) return false;
  const title = getDraftValue(draftValues, "title").trim();
  const content = getDraftValue(draftValues, "content").trim();
  return (
    hasDraftField(draftValues, "tags") && Boolean(getDraftValue(draftValues, "tags").trim()) ||
    getDraftValues(draftValues, "personIds").length > 0 ||
    getDraftMemoryPlaceIds(draftValues).length > 0 ||
    Boolean(content && content !== title)
  );
}

function getRecentRecommendedIds(memories: MemoryEvent[], kind: "person" | "place", selectedIds: string[] = []) {
  const selected = new Set(selectedIds.filter(Boolean));
  const score = new Map<string, number>();
  memories
    .slice()
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 50)
    .forEach((memory, index) => {
      const ids = kind === "person" ? memory.personIds || [] : getInitialPlaceIds(memory, undefined, []);
      ids.forEach((id) => {
        if (!id || selected.has(id)) return;
        score.set(id, (score.get(id) || 0) + Math.max(1, 50 - index));
      });
    });
  return Array.from(score.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([id]) => id)
    .slice(0, 6);
}

function appendTemplate(current: string, template: string) {
  const trimmed = current.trim();
  if (!trimmed) return template;
  return `${current.replace(/\s*$/, "")}\n${template}`;
}

function insertTemplateIntoSiblingTextarea(button: HTMLButtonElement, template: string) {
  const label = button.closest("label");
  const textarea = label?.querySelector("textarea");
  if (!textarea) return;
  textarea.value = appendTemplate(textarea.value, template);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.focus();
}

function consumeQuickInboxPrefill() {
  if (typeof window === "undefined") return "";
  try {
    const value = window.localStorage.getItem("lifelog:quick-inbox-prefill") || "";
    window.localStorage.removeItem("lifelog:quick-inbox-prefill");
    return value;
  } catch {
    return "";
  }
}
