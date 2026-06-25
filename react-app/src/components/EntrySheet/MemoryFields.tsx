import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { MemoryEvent, Photo } from "../../types";
import { useLifeLog } from "../../context/LifeLogContext";
import { inferQuickMemory } from "../../utils/memoryInference";
import { deriveMemorySummary, isMemoryPlan } from "../../utils/memoryDisplay";
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
  memoryKindOverride,
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
  memoryKindOverride?: MemoryEvent["kind"];
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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [quickPersonIds, setQuickPersonIds] = useState<string[]>(() => selectedPersonIds);
  const [quickPlaceIds, setQuickPlaceIds] = useState<string[]>(() => selectedPlaceIds);
  const [fullPlaceIds, setFullPlaceIds] = useState<string[]>(() => selectedPlaceIds);
  const [mood, setMood] = useState<string>(getDraftValue(draftValues, "mood", memory ? memory.mood : settings.defaultMood));
  const [fullTitle, setFullTitle] = useState(() =>
    getDraftValue(draftValues, "title", memory?.title === "新的回忆" ? "" : memory?.title || "")
  );
  const [fullContent, setFullContent] = useState(() => getDraftValue(draftValues, "content", memory?.content || ""));
  const [fullTags, setFullTags] = useState(() => getDraftValue(draftValues, "tags", memory?.tags.join("，") || ""));
  const [fullAdvancedOpen, setFullAdvancedOpen] = useState(() => hasRestoredFullAdvanced(draftValues));
  const quickTone = getQuickDateTone(quickDate, todayValue);
  const quickCopy = getQuickMemoryCopy(quickTone);
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
          <strong>{quickCopy.title}</strong>
          <span>{hasQuickContext ? quickCopy.contextHint : quickCopy.emptyHint}</span>
        </div>
        <label>
          {quickCopy.titleLabel}
          <input
            name="title"
            value={quickContent}
            onChange={(event) => setQuickContent(event.target.value)}
            autoFocus
            placeholder={quickCopy.titlePlaceholder}
          />
        </label>
        <label className="inline-field">
          <span className="inline-field-label">{quickCopy.dateLabel}</span>
          <DateInput name="date" label={quickCopy.dateLabel} value={quickDate} onChange={setQuickDate} required />
        </label>
        <div className="memory-core-pickers">
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
        <button
          className="quick-detail-toggle"
          type="button"
          onClick={() => {
            setDetailsOpen((open) => {
              if (!open && !quickDetailsContent.trim()) setQuickDetailsContent(quickContent);
              return !open;
            });
          }}
        >
          {detailsOpen ? "收起更多" : "更多设置"}
          {detailsOpen ? <ChevronUp /> : <ChevronDown />}
        </button>
        {detailsOpen && (
          <div className="quick-detail-panel memory-advanced-panel">
            <label>
              {quickCopy.moodLabel}
              <input
                name="mood"
                value={mood}
                onChange={(event) => setMood(event.target.value)}
                placeholder={quickCopy.moodPlaceholder}
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
                placeholder={quickCopy.contentPlaceholder}
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
        {!detailsOpen && (
          <>
            <input type="hidden" name="mood" value={mood} />
            <input type="hidden" name="content" value={quickContent} />
            <input type="hidden" name="tags" value={quickTags} />
          </>
        )}
        <div className={`memory-preview compact ${previewOpen ? "open" : ""}`} aria-live="polite">
          <button className="memory-preview-summary" type="button" onClick={() => setPreviewOpen((open) => !open)}>
            <span>
              <strong>{quickCopy.previewEyebrow}</strong>
              <small>{formatPreviewDate(quickPreview.date)} · {previewPeople.length ? previewPeople.join("、") : "暂不关联人物"} · {previewPlace || "暂不关联地点"}</small>
            </span>
            <em>{previewOpen ? "收起" : "查看"}</em>
            <ChevronDown />
          </button>
          {previewOpen && (
            <div className="memory-preview-detail">
              <div className="memory-preview-row">
                <strong>{quickCopy.previewTitleLabel}</strong>
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
          )}
        </div>
        <input type="hidden" name="memoryMode" value="quick" />
        <input type="hidden" name="memoryKind" value={quickTone === "future" ? "plan" : "memory"} />
        <p className="form-hint">{quickCopy.footerHint}</p>
      </>
    );
  }

  return (
    <>
      <label className="inline-field">
        <span className="inline-field-label">日期</span>
        <DateInput
          name="date"
          label="记录日期"
          defaultValue={getDraftValue(draftValues, "date", memory?.date || initialDate || todayValue)}
          required
        />
      </label>
      <label>
        内容
        <textarea
          name="content"
          value={fullContent}
          onChange={(event) => setFullContent(event.target.value)}
          placeholder="写下发生了什么、当时感受，或之后想补充的细节。"
        />
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
      </div>
      <button className="quick-detail-toggle" type="button" onClick={() => setFullAdvancedOpen((open) => !open)}>
        {fullAdvancedOpen ? "收起更多" : "更多设置"}
        {fullAdvancedOpen ? <ChevronUp /> : <ChevronDown />}
      </button>
      {fullAdvancedOpen && (
        <div className="quick-detail-panel memory-advanced-panel">
          <label>
            标题
            <input
              name="title"
              value={fullTitle}
              onChange={(event) => setFullTitle(event.target.value)}
              placeholder="留空将自动按人物 / 地点生成摘要"
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
            <span className="field-title">写作模板</span>
            <div className="content-template-grid">
              {STRUCTURED_MEMORY_TEMPLATES.map((template) => (
                <button
                  type="button"
                  className="content-template-chip strong"
                  key={template.label}
                  onClick={() => setFullContent((current) => appendTemplate(current, template.content))}
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
                  onClick={() => setFullContent((current) => appendTemplate(current, template))}
                >
                  {template.split("\n")[0]}
                </button>
              ))}
            </div>
          </div>
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
              value={fullTags}
              onChange={(event) => setFullTags(event.target.value)}
              placeholder="日常、值得记住；可用顿号、逗号或分号分隔"
            />
          </label>
          <p className="form-hint memory-place-hint">一次行程可以关联多个地点，例如商场里去过的几家店。</p>
        </div>
      )}
      {!fullAdvancedOpen && (
        <>
          <input type="hidden" name="title" value={fullTitle} />
          <input type="hidden" name="mood" value={mood} />
          <input type="hidden" name="tags" value={fullTags} />
        </>
      )}
      <input type="hidden" name="memoryKind" value={memoryKindOverride || (memory?.kind === "plan" ? "plan" : "memory")} />
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

function getQuickDateTone(dateKey: string, todayKey: string): "past" | "today" | "future" {
  const delta = diffDateKeys(dateKey, todayKey);
  if (delta > 0) return "future";
  if (delta === 0) return "today";
  return "past";
}

function getQuickMemoryCopy(tone: "past" | "today" | "future") {
  if (tone === "future") {
    return {
      title: "先安排这一天",
      contextHint: "已经带上相关人物或地点，先写一句计划，之后可以再补实际发生的事。",
      emptyHint: "未来的日子更适合先写计划、约定或想做的事。",
      titleLabel: "计划内容",
      titlePlaceholder: "例如：周六和小林去看展，顺路试试那家甜品店",
      dateLabel: "计划日期",
      moodLabel: "期待程度",
      moodPlaceholder: "期待、重要、待确认，或自己写一个词",
      detailToggle: "补人物 / 地点 / 准备事项",
      contentPlaceholder: "可以写计划做什么、需要准备什么、到时想注意什么。",
      previewEyebrow: "会这样安排",
      previewTitleLabel: "计划",
      footerHint: "未来计划会先作为这一天的记录保存，到了当天或之后可以再补照片和实际回忆。"
    };
  }

  if (tone === "today") {
    return {
      title: "记录今天这一刻",
      contextHint: "已经带上相关人物或地点，写一句就能保存。",
      emptyHint: "不知道怎么分类也没关系，先写一句今天发生了什么。",
      titleLabel: "这件事",
      titlePlaceholder: "例如：和小林在湖边散步，聊到下次去看展",
      dateLabel: "发生日期",
      moodLabel: "当时感觉",
      moodPlaceholder: "开心、平静、感动，或自己写一个词",
      detailToggle: "补人物 / 地点 / 照片",
      contentPlaceholder: "可以写发生了什么、当时的感觉、下次想怎么做。",
      previewEyebrow: "会这样留下来",
      previewTitleLabel: "这件事",
      footerHint: "人物、地点和照片都可以先不管，之后想起来再补也可以。"
    };
  }

  return {
    title: "补上那一天",
    contextHint: "已经带上相关人物或地点，补一句当时发生的事就能保存。",
    emptyHint: "过去的日子可以先补一句，之后再慢慢补细节。",
    titleLabel: "当时的事",
    titlePlaceholder: "例如：那天和小林在湖边散步，聊到下次去看展",
    dateLabel: "发生日期",
    moodLabel: "当时感觉",
    moodPlaceholder: "开心、平静、感动，或自己写一个词",
    detailToggle: "补人物 / 地点 / 照片",
    contentPlaceholder: "可以写当时发生了什么、有什么感觉、现在想补充什么。",
    previewEyebrow: "会这样补记",
    previewTitleLabel: "当时的事",
    footerHint: "补记可以先保存关键一句，照片、人物和地点之后再补。"
  };
}

function diffDateKeys(targetDateKey: string, baseDateKey: string) {
  return Math.round((dateKeyToUtcTime(targetDateKey) - dateKeyToUtcTime(baseDateKey)) / 86400000);
}

function dateKeyToUtcTime(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return 0;
  return Date.UTC(year, month - 1, day);
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

function hasRestoredFullAdvanced(draftValues?: DraftFieldMap) {
  if (!draftValues) return false;
  return (
    hasDraftField(draftValues, "title") && Boolean(getDraftValue(draftValues, "title").trim()) ||
    hasDraftField(draftValues, "mood") && Boolean(getDraftValue(draftValues, "mood").trim()) ||
    hasDraftField(draftValues, "tags") && Boolean(getDraftValue(draftValues, "tags").trim())
  );
}

function getRecentRecommendedIds(memories: MemoryEvent[], kind: "person" | "place", selectedIds: string[] = []) {
  const selected = new Set(selectedIds.filter(Boolean));
  const score = new Map<string, number>();
  memories
    .slice()
    .filter((memory) => !isMemoryPlan(memory))
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
