import { useNavigate } from "react-router-dom";
import { useRef, useState, useEffect } from "react";
import type { FormEvent } from "react";
import type {
  EntryType,
  LifeLogState,
  MemoryEvent,
  Person,
  Photo,
  Place,
  PlaceMergePreview
} from "../types";
import type { PlaceDraft } from "../utils/placeShareParser";
import { useLifeLog } from "../context/LifeLogContext";
import { useToast } from "../context/ToastContext";
import PlaceMergeWorkbench from "./PlaceMergeWorkbench";
import { PersonFields } from "./EntrySheet/PersonFields";
import { PlaceFields } from "./EntrySheet/PlaceFields";
import { MemoryFields } from "./EntrySheet/MemoryFields";

interface EntrySheetProps {
  type: EntryType | null;
  itemId?: string;
  initialPersonId?: string;
  initialPersonIds?: string[];
  initialPlaceId?: string;
  initialPlaceIds?: string[];
  initialPlaceDraft?: Partial<Place>;
  initialPlaceShareReview?: PlaceDraft;
  memoryMode?: "quick" | "full";
  initialDate?: string;
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
  initialPersonIds,
  initialPlaceId,
  initialPlaceIds,
  initialPlaceDraft,
  initialPlaceShareReview,
  memoryMode = "full",
  initialDate,
  onClose
}: EntrySheetProps) {
  const navigate = useNavigate();
  const notify = useToast();
  const { state, inspectPlaceSave, savePerson, savePlace, saveMemory, loadMemoryPhotos } = useLifeLog();
  const [error, setError] = useState("");
  const [mergePreview, setMergePreview] = useState<PlaceMergePreview | null>(null);
  const [pendingPlaceFormData, setPendingPlaceFormData] = useState<FormData | null>(null);
  const submitLockRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);

  const editingItem = type ? findEditingItem(type, itemId, state) : undefined;

  useEffect(() => {
    if (type === "memory" && itemId) {
      loadMemoryPhotos(itemId, (editingItem as MemoryEvent | undefined)?.photos || []).then(setPhotos);
    } else {
      setPhotos([]);
    }
  }, [type, itemId, editingItem, loadMemoryPhotos]);

  if (!type) return null;

  const entryType = type;
  const current = meta[entryType];
  const submitText = !itemId && (entryType === "person" || entryType === "place") ? "创建" : "保存";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setIsSubmitting(true);

    try {
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
      if (entryType === "memory") {
        const memoryId = itemId || `m_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        const photosToSave = photos.map(p => ({ ...p, memoryId }));
        formData.set("memoryId", memoryId);
        savedMemoryId = await saveMemory(formData, itemId, photosToSave);
      }

      onClose();
      notify(buildSaveToast({
        type: entryType,
        isEditing: Boolean(itemId),
        savedPersonId,
        savedPlaceId,
        savedMemoryId,
        navigate
      }));
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
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

        <form className="form" onSubmit={handleSubmit} onChange={() => error && setError("")}>
          {error && <div className="form-error">{error}</div>}
          {entryType === "person" && (
            <PersonFields person={editingItem as Person | undefined} isEditing={Boolean(itemId)} />
          )}
          {entryType === "place" && (
            <PlaceFields
              place={editingItem as Place | undefined}
              initialPlaceDraft={initialPlaceDraft}
              initialShareReview={initialPlaceShareReview}
              isEditing={Boolean(itemId)}
            />
          )}
          {entryType === "memory" && (
            <MemoryFields
              memory={editingItem as MemoryEvent | undefined}
              people={state.people}
              places={state.places}
              initialPersonIds={initialPersonIds || [initialPersonId || ""].filter(Boolean)}
              initialPlaceId={initialPlaceId}
              initialPlaceIds={initialPlaceIds}
              initialDate={initialDate}
              mode={memoryMode}
              photos={photos}
              onPhotosChange={setPhotos}
              isSubmitting={isSubmitting}
            />
          )}

          <div className="submit-row">
            <button type="button" className="ghost-btn" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="primary-btn" disabled={isSubmitting}>
              {isSubmitting ? `${submitText}中…` : submitText}
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
              notify({ message: getSaveFeedback("place", Boolean(itemId)), tone: "success" });
              if (!itemId) navigate(`/places/${savedId}`);
            }}
            onConfirm={async (nextPreview) => {
              const savedId = await savePlace(pendingPlaceFormData, itemId, {
                mergeTargetId: nextPreview.canonical.id,
                mergePreviewOverride: nextPreview,
              });
              setMergePreview(null);
              setPendingPlaceFormData(null);
              onClose();
              notify({ message: "地点已合并并保存", tone: "success" });
              if (!itemId) navigate(`/places/${savedId}`);
            }}
          />
        )}
      </section>
    </div>
  );
}

function buildSaveToast({
  type,
  isEditing,
  savedPersonId,
  savedPlaceId,
  savedMemoryId,
  navigate
}: {
  type: EntryType;
  isEditing: boolean;
  savedPersonId: string;
  savedPlaceId: string;
  savedMemoryId: string;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const message = getSaveFeedback(type, isEditing);
  if (type === "person" && savedPersonId) {
    return {
      message,
      tone: "success" as const,
      actionLabel: "查看",
      onAction: () => navigate(`/people/${savedPersonId}`)
    };
  }
  if (type === "place" && savedPlaceId) {
    return {
      message,
      tone: "success" as const,
      actionLabel: "查看",
      onAction: () => navigate(`/places/${savedPlaceId}`)
    };
  }
  if (type === "memory" && savedMemoryId) {
    return {
      message,
      tone: "success" as const,
      actions: [
        { label: "查看", onClick: () => navigate(`/memories/${savedMemoryId}`) },
        { label: "补照片", onClick: () => navigate(`/memories/${savedMemoryId}?edit=photos`) },
        { label: "再记", onClick: () => navigate(`/memories/${savedMemoryId}?add=related`) }
      ]
    };
  }
  return {
    message,
    tone: "success" as const
  };
}

function getSaveFeedback(type: EntryType, isEditing: boolean) {
  if (type === "person") return isEditing ? "人物资料已更新" : "人物已保存";
  if (type === "place") return isEditing ? "地点资料已更新" : "地点已保存";
  return isEditing ? "回忆已更新" : "回忆已保存";
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
      const title = String(formData.get("title") || "").trim();
      const content = String(formData.get("content") || "").trim();
      if (!title && !content) return "请先写下今天发生了什么。";
      return "";
    }
    if (!String(formData.get("date") || "").trim()) return "请选择回忆日期。";
    if (!String(formData.get("content") || "").trim()) return "请填写回忆内容。";
  }

  return "";
}

function findEditingItem(type: EntryType, itemId: string | undefined, state: LifeLogState) {
  if (!itemId) return undefined;
  if (type === "person") return state.people.find((person) => person.id === itemId);
  if (type === "place") return state.places.find((place) => place.id === itemId);
  return state.memories.find((memory) => memory.id === itemId);
}
