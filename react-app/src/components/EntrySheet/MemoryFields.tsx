import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { MemoryEvent, Photo } from "../../types";
import { useLifeLog } from "../../context/LifeLogContext";
import { inferQuickMemory } from "../../utils/memoryInference";
import { deriveMemorySummary } from "../../utils/memoryDisplay";
import DateInput from "../DateInput";
import PersonPicker from "../PersonPicker";
import { PhotoUploader } from "../PhotoUploader";
import SelectPicker from "../SelectPicker";

const MOOD_PRESETS = ["开心", "平静", "感动", "怀念", "疲惫", "焦虑"];

export function MemoryFields({
  memory,
  people,
  places,
  initialPersonId,
  initialPlaceId,
  mode,
  photos,
  onPhotosChange,
  isSubmitting
}: {
  memory?: MemoryEvent;
  people: Array<{ id: string; name: string }>;
  places: Array<{ id: string; name: string }>;
  initialPersonId?: string;
  initialPlaceId?: string;
  mode: "quick" | "full";
  photos: Photo[];
  onPhotosChange: (photos: Photo[]) => void;
  isSubmitting: boolean;
}) {
  const { settings } = useLifeLog();
  const selectedPersonIds = memory?.personIds?.length ? memory.personIds : [initialPersonId || people[0]?.id || ""].filter(Boolean);
  const todayValue = new Date().toISOString().slice(0, 10);
  const [quickContent, setQuickContent] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [quickPersonId, setQuickPersonId] = useState(initialPersonId || "");
  const [quickPlaceId, setQuickPlaceId] = useState(initialPlaceId || "");
  const [mood, setMood] = useState<string>(memory ? memory.mood : settings.defaultMood);
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
    .filter((name): name is string => Boolean(name));
  const previewPlace = places.find((place) => place.id === quickPreview.placeId)?.name || "";
  const previewTitle =
    deriveMemorySummary(
      {
        id: "",
        title: "",
        date: quickPreview.date,
        personIds: quickPreview.personIds,
        placeId: quickPreview.placeId,
        mood: "",
        content: quickContent,
        tags: [],
        photos: []
      },
      { personNames: previewPeople, placeName: previewPlace }
    );

  if (!memory && mode === "quick") {
    return (
      <>
        <div className="quick-record-intro">
          <strong>先记下来，之后再补细节</strong>
          <span>只需要一句标题，日期和心情会自动带上默认值。</span>
        </div>
        <label>
          回忆标题
          <input
            name="title"
            value={quickContent}
            onChange={(event) => setQuickContent(event.target.value)}
            autoFocus
            placeholder="例如：和小林在湖边散步"
          />
        </label>
        <label className="inline-field">
          <span className="inline-field-label">日期</span>
          <DateInput name="date" label="回忆日期" defaultValue={todayValue} required />
        </label>
        <label>
          心情
          <input
            name="mood"
            value={mood}
            onChange={(event) => setMood(event.target.value)}
            placeholder="今天的感觉"
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
          {detailsOpen ? "收起补充细节" : "补充人物、地点、正文和照片"}
          {detailsOpen ? <ChevronUp /> : <ChevronDown />}
        </button>
        {detailsOpen && (
          <div className="quick-detail-panel">
            <div className="form-row">
              <label>
                人物
                <SelectPicker
                  name="personIds"
                  label="关联人物"
                  value={quickPersonId}
                  onChange={setQuickPersonId}
                  placeholder="暂不选择"
                  options={[
                    { value: "", label: "暂不选择" },
                    ...people.map((person) => ({ value: person.id, label: person.name }))
                  ]}
                />
              </label>
              <label>
                地点
                <SelectPicker
                  name="placeId"
                  label="关联地点"
                  value={quickPlaceId}
                  onChange={setQuickPlaceId}
                  placeholder="暂不选择"
                  options={[
                    { value: "", label: "暂不选择" },
                    ...places.map((place) => ({ value: place.id, label: place.name }))
                  ]}
                />
              </label>
            </div>
            <label>
              正文
              <textarea
                name="content"
                placeholder="补充发生了什么，或下次要注意什么。"
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
              标签
              <input name="tags" placeholder="日常、值得记住；可用顿号、逗号或分号分隔" />
            </label>
          </div>
        )}
        <div className="memory-preview" aria-live="polite">
          <span className="memory-preview-eyebrow">保存预览</span>
          <div className="memory-preview-row">
            <strong>标题</strong>
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
        {!detailsOpen && <input type="hidden" name="personIds" value="" />}
        {!detailsOpen && <input type="hidden" name="placeId" value="" />}
        {!detailsOpen && <input type="hidden" name="tags" value="" />}
        <input type="hidden" name="memoryMode" value="quick" />
        <p className="form-hint">人物、地点和照片都可以先不填，保存后再从回忆详情里慢慢补。</p>
      </>
    );
  }

  return (
    <>
      <label>
        标题
        <input
          name="title"
          defaultValue={memory?.title === "新的回忆" ? "" : memory?.title || ""}
          placeholder="留空将自动按人物 / 地点生成摘要"
        />
      </label>
      <label className="inline-field">
        <span className="inline-field-label">日期</span>
        <DateInput name="date" label="回忆日期" defaultValue={memory?.date || todayValue} required />
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
        <PersonPicker people={people} defaultSelected={selectedPersonIds} />
      </div>
      <label>
        关联地点
        <SelectPicker
          name="placeId"
          label="关联地点"
          defaultValue={memory?.placeId || initialPlaceId || ""}
          placeholder="无地点"
          options={[
            { value: "", label: "无" },
            ...places.map((place) => ({ value: place.id, label: place.name }))
          ]}
        />
      </label>
      <label>
        内容
        <textarea
          name="content"
          defaultValue={memory?.content || ""}
          placeholder="记录今天发生的事，以及下次要注意什么。"
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
          defaultValue={memory?.tags.join("，") || ""}
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
