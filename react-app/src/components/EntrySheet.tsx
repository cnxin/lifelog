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
import { useConfirm } from "../context/ConfirmContext";
import { useLifeLog } from "../context/LifeLogContext";
import { useToast } from "../context/ToastContext";
import PlaceMergeWorkbench from "./PlaceMergeWorkbench";
import { PersonFields } from "./EntrySheet/PersonFields";
import { PlaceFields } from "./EntrySheet/PlaceFields";
import { MemoryFields } from "./EntrySheet/MemoryFields";
import { buildDraftFieldMap, type DraftFieldMap } from "./EntrySheet/draftValues";

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
  onSaved?: (result: { type: EntryType; id: string }) => void | Promise<void>;
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
  onSaved,
  onClose
}: EntrySheetProps) {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const notify = useToast();
  const { state, inspectPlaceSave, savePerson, savePlace, saveMemory, loadMemoryPhotos, settings } = useLifeLog();
  const [error, setError] = useState("");
  const [mergePreview, setMergePreview] = useState<PlaceMergePreview | null>(null);
  const [pendingPlaceFormData, setPendingPlaceFormData] = useState<FormData | null>(null);
  const submitLockRef = useRef(false);
  const closeLockRef = useRef(false);
  const initialFormFingerprintRef = useRef("");
  const formRef = useRef<HTMLFormElement | null>(null);
  const draftTimerRef = useRef<number | undefined>();
  const draftRestoredRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [availableDraft, setAvailableDraft] = useState<EntryFormDraft | null>(null);
  const [restoredDraftValues, setRestoredDraftValues] = useState<DraftFieldMap | undefined>();
  const [draftRestoreKey, setDraftRestoreKey] = useState(0);

  const editingItem = type ? findEditingItem(type, itemId, state) : undefined;
  const entrySessionKey = type
    ? JSON.stringify({
        type,
        itemId: itemId || "",
        memoryMode,
        initialDate: initialDate || "",
        initialPersonId: initialPersonId || "",
        initialPersonIds: (initialPersonIds || []).join("|"),
        initialPlaceId: initialPlaceId || "",
        initialPlaceIds: (initialPlaceIds || []).join("|"),
        initialPlaceDraft,
        initialPlaceShareReview
      })
    : "";
  const draftKey = type ? buildDraftKey(type, itemId, entrySessionKey) : "";
  const editingMemoryPhotoKey = type === "memory" ? ((editingItem as MemoryEvent | undefined)?.photos || []).join("|") : "";

  useEffect(() => {
    let active = true;
    if (type === "memory" && itemId) {
      loadMemoryPhotos(itemId, (editingItem as MemoryEvent | undefined)?.photos || []).then((loadedPhotos) => {
        if (!active) return;
        setPhotos(loadedPhotos);
        captureInitialFingerprint(loadedPhotos.length);
      });
    } else {
      setPhotos([]);
      captureInitialFingerprint(0);
    }
    return () => {
      active = false;
    };
  }, [type, itemId, editingMemoryPhotoKey]);

  useEffect(() => {
    if (!type) return;
    captureInitialFingerprint(type === "memory" && itemId ? photos.length : 0);
    setAvailableDraft(loadEntryDraft(draftKey));
    setRestoredDraftValues(undefined);
    setDraftRestoreKey(0);
    draftRestoredRef.current = false;
    return () => {
      if (draftTimerRef.current) window.clearTimeout(draftTimerRef.current);
    };
  }, [entrySessionKey]);

  useEffect(() => {
    if (!type) return;
    function handleRequestClose(event: Event) {
      event.preventDefault();
      void requestClose();
    }
    window.addEventListener("lifelog:request-close-entry-sheet", handleRequestClose);
    return () => window.removeEventListener("lifelog:request-close-entry-sheet", handleRequestClose);
  }, [type, photos.length]);

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

      const savedId = savedMemoryId || savedPersonId || savedPlaceId;
      if (savedId) await onSaved?.({ type: entryType, id: savedId });
      clearEntryDraft(draftKey);
      forceClose();
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

  function forceClose() {
    initialFormFingerprintRef.current = "";
    onClose();
  }

  function captureInitialFingerprint(photoCount: number) {
    if (draftRestoredRef.current) return;
    initialFormFingerprintRef.current = "";
    window.requestAnimationFrame(() => {
      if (draftRestoredRef.current) return;
      initialFormFingerprintRef.current = buildFormFingerprint(formRef.current, photoCount);
    });
  }

  async function requestClose() {
    if (closeLockRef.current) return;
    if (!hasUnsavedChanges(formRef.current, initialFormFingerprintRef.current, photos.length)) {
      forceClose();
      return;
    }

    closeLockRef.current = true;
    try {
      const accepted = await confirm({
        title: "放弃本次编辑？",
        message: "当前表单里有未保存的内容，关闭后这些输入不会保存。",
        confirmText: "放弃",
        cancelText: "继续编辑"
      });
      if (accepted) {
        clearEntryDraft(draftKey);
        forceClose();
      }
    } finally {
      closeLockRef.current = false;
    }
  }

  function scheduleDraftSave() {
    if (!draftKey || !formRef.current) return;
    if (draftTimerRef.current) window.clearTimeout(draftTimerRef.current);
    draftTimerRef.current = window.setTimeout(() => {
      if (!hasUnsavedChanges(formRef.current, initialFormFingerprintRef.current, photos.length)) return;
      saveEntryDraft(draftKey, formRef.current);
    }, 350);
  }

  function restoreDraft() {
    if (!availableDraft) return;
    draftRestoredRef.current = true;
    setRestoredDraftValues(buildDraftFieldMap(availableDraft.fields));
    setDraftRestoreKey((current) => current + 1);
    setAvailableDraft(null);
    window.setTimeout(() => {
      saveEntryDraft(draftKey, formRef.current);
    }, 0);
  }

  function discardDraft() {
    clearEntryDraft(draftKey);
    setAvailableDraft(null);
  }

  return (
    <div className="sheet">
      <div className="sheet-backdrop" onClick={() => void requestClose()} />
      <section className="sheet-panel">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <div>
            <p className="date-label">{current.kicker}</p>
            <h2>{itemId ? current.editTitle : current.addTitle}</h2>
          </div>
          <button className="sheet-close" aria-label="关闭" onClick={() => void requestClose()}>
            ×
          </button>
        </div>

        <form
          ref={formRef}
          className="form"
          onSubmit={handleSubmit}
          onChange={() => {
            if (error) setError("");
            scheduleDraftSave();
          }}
          onInput={scheduleDraftSave}
        >
          {error && <div className="form-error">{error}</div>}
          {availableDraft && (
            <div className="form-draft-card">
              <div>
                <strong>发现未保存草稿</strong>
                <span>{formatDraftTime(availableDraft.savedAt)}</span>
              </div>
              <div className="form-draft-actions">
                <button type="button" onClick={restoreDraft}>
                  恢复
                </button>
                <button type="button" onClick={discardDraft}>
                  丢弃
                </button>
              </div>
            </div>
          )}
          {entryType === "person" && (
            <PersonFields
              key={`person-${draftRestoreKey}`}
              person={editingItem as Person | undefined}
              isEditing={Boolean(itemId)}
              draftValues={restoredDraftValues}
            />
          )}
          {entryType === "place" && (
            <PlaceFields
              key={`place-${draftRestoreKey}`}
              place={editingItem as Place | undefined}
              initialPlaceDraft={initialPlaceDraft}
              initialShareReview={initialPlaceShareReview}
              isEditing={Boolean(itemId)}
              draftValues={restoredDraftValues}
            />
          )}
          {entryType === "memory" && (
            <MemoryFields
              key={`memory-${draftRestoreKey}`}
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
              draftValues={restoredDraftValues}
              onCreatePerson={async (name) => {
                const formData = new FormData();
                formData.set("name", name);
                formData.set("relationship", settings.defaultRelationship);
                formData.set("favorite", "false");
                return savePerson(formData);
              }}
              onCreatePlace={async (name) => {
                const formData = new FormData();
                formData.set("name", name);
                formData.set("city", settings.defaultCity);
                formData.set("category", "其他");
                formData.set("rating", "");
                formData.set("favorite", "false");
                return savePlace(formData, undefined, { skipDuplicateCheck: true });
              }}
            />
          )}

          <div className="submit-row">
            <button type="button" className="ghost-btn" onClick={() => void requestClose()}>
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
              forceClose();
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
              forceClose();
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
        { label: "补照片", onClick: () => navigate(`/memories/${savedMemoryId}?edit=photos`) }
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

function hasUnsavedChanges(form: HTMLFormElement | null, initialFingerprint: string, photoCount: number) {
  if (!form || !initialFingerprint) return false;
  return buildFormFingerprint(form, photoCount) !== initialFingerprint;
}

function buildFormFingerprint(form: HTMLFormElement | null, photoCount: number) {
  if (!form) return "";
  const data = new FormData(form);
  const entries = Array.from(data.entries())
    .map(([key, value]) => [key, typeof value === "string" ? value.trim() : value.name] as const)
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue));
  return JSON.stringify({ entries, photoCount });
}

interface EntryFormDraft {
  savedAt: string;
  fields: Array<{ name: string; value: string }>;
}

function buildDraftKey(type: EntryType, itemId: string | undefined, sessionKey: string) {
  const scope = itemId || hashString(sessionKey).toString(36);
  return `lifelog:entry-draft:${type}:${scope}`;
}

function saveEntryDraft(key: string, form: HTMLFormElement | null) {
  if (!form) return;
  try {
    const fields = Array.from(new FormData(form).entries())
      .filter(([, value]) => typeof value === "string")
      .map(([name, value]) => ({ name, value: String(value) }));
    window.localStorage.setItem(key, JSON.stringify({ savedAt: new Date().toISOString(), fields }));
  } catch {
    // 草稿恢复是兜底体验，保存失败不影响正常编辑。
  }
}

function loadEntryDraft(key: string): EntryFormDraft | null {
  if (!key || typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "null") as Partial<EntryFormDraft> | null;
    if (!parsed || typeof parsed.savedAt !== "string" || !Array.isArray(parsed.fields)) return null;
    const fields = parsed.fields
      .map((field) => ({
        name: String((field as { name?: unknown }).name || ""),
        value: String((field as { value?: unknown }).value || "")
      }))
      .filter((field) => field.name);
    return fields.length ? { savedAt: parsed.savedAt, fields } : null;
  } catch {
    return null;
  }
}

function clearEntryDraft(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function formatDraftTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "上次未保存内容";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}
