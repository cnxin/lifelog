import type { AnniversaryPlan, ID, LifeLogState, MemoryEvent, Person, Place } from "../types";
import { findPlaceDuplicateGroups } from "./placeDedup";
import { buildPlaceDisplayName } from "./placeMeta";
import { isRecord } from "./lifelogHelpers";
import { getMemoryPlaceIds } from "./memoryPlaces";

export interface BackupHealthGroup {
  id: string;
  title: string;
  status: "ok" | "warning" | "info";
  count: number;
  items: string[];
}

export interface BackupHealthReport {
  status: "ok" | "warning";
  people: number;
  places: number;
  memories: number;
  anniversaryPlans: number;
  photoRefs: number;
  attentionCount: number;
  issueCount: number;
  issues: string[];
  attentions: string[];
  groups: BackupHealthGroup[];
  duplicatePlaceGroups: number;
  strongDuplicatePlaceGroups: number;
}

export interface BackupHealthDetailItem {
  id: string;
  title: string;
  desc: string;
  path?: string;
  tone?: "warning" | "info";
}

export interface BackupHealthDetailGroup {
  id: string;
  title: string;
  status: BackupHealthGroup["status"];
  items: BackupHealthDetailItem[];
  emptyText: string;
}

export interface BackupImportPreview {
  schemaVersion: string;
  people: number;
  places: number;
  memories: number;
  anniversaryPlans: number;
  photos: number;
  peopleDelta: number | null;
  placesDelta: number | null;
  memoriesDelta: number | null;
  anniversaryPlansDelta: number | null;
  photosDelta: number | null;
  repairedPhotos: number;
  ignoredPhotos: number;
  missingPhotoRefs: number;
  extraPhotoRefs: number;
  exportedAt: string;
  appVersion: string;
  issueCount: number;
  issues: string[];
}

export function buildBackupHealthReport(state: LifeLogState): BackupHealthReport {
  const issues = collectStateIssues(state);
  const duplicatePlaceGroups = findPlaceDuplicateGroups(state.places);
  const strongDuplicatePlaceGroups = duplicatePlaceGroups.filter((group) => group.strength === "strong").length;
  const groups = buildHealthGroups(state, issues, {
    duplicatePlaceGroups: duplicatePlaceGroups.length,
    strongDuplicatePlaceGroups
  });
  const attentions = groups
    .filter((group) => group.id !== "integrity" && group.status !== "ok")
    .flatMap((group) => group.items.map((item) => `${group.title}：${item}`));
  return {
    status: issues.length ? "warning" : "ok",
    people: state.people.length,
    places: state.places.length,
    memories: state.memories.length,
    anniversaryPlans: state.anniversaryPlans.length,
    photoRefs: countMemoryPhotoRefs(state),
    attentionCount: attentions.length,
    issueCount: issues.length,
    issues,
    attentions,
    groups,
    duplicatePlaceGroups: duplicatePlaceGroups.length,
    strongDuplicatePlaceGroups
  };
}

export function buildBackupHealthDetailGroups(state: LifeLogState): BackupHealthDetailGroup[] {
  const integrityIssues = collectStateIssues(state);
  const duplicateGroups = findPlaceDuplicateGroups(state.places);
  const placeIdsInMemories = new Set(state.memories.flatMap(getMemoryPlaceIds));

  return [
    {
      id: "integrity",
      title: "关联完整性",
      status: integrityIssues.length ? "warning" : "ok",
      emptyText: "人物、地点、回忆和安排的关键关联正常。",
      items: integrityIssues.map((issue, index) => ({
        id: `integrity-${index}`,
        title: issue,
        desc: "建议先导出备份，再根据提示检查异常数据。",
        tone: "warning"
      }))
    },
    {
      id: "people",
      title: "人物资料",
      status: buildPeopleHealthDetailItems(state.people).length ? "info" : "ok",
      emptyText: "生日、喜好和雷区资料整体完整。",
      items: buildPeopleHealthDetailItems(state.people)
    },
    {
      id: "places",
      title: "地点质量",
      status: buildPlaceHealthDetailItems(state.places, duplicateGroups, placeIdsInMemories).length ? "info" : "ok",
      emptyText: "地点重复、地图入口和到访记录状态正常。",
      items: buildPlaceHealthDetailItems(state.places, duplicateGroups, placeIdsInMemories)
    },
    {
      id: "records",
      title: "回忆与安排",
      status: buildRecordHealthDetailItems(state).length ? "info" : "ok",
      emptyText: "回忆上下文和纪念日安排状态正常。",
      items: buildRecordHealthDetailItems(state)
    }
  ];
}

export function buildBackupImportPreview(input: Record<string, unknown>, currentState?: LifeLogState): BackupImportPreview {
  const sourceState = isRecord(input.data) ? input.data : input;
  const people = Array.isArray(sourceState.people) ? sourceState.people : [];
  const places = Array.isArray(sourceState.places) ? sourceState.places : [];
  const memories = Array.isArray(sourceState.memories) ? sourceState.memories : [];
  const anniversaryPlans = Array.isArray(sourceState.anniversaryPlans) ? sourceState.anniversaryPlans : [];
  const photos = Array.isArray(input.photos) ? input.photos : [];
  const photoReport = inspectBackupPhotoLinks(
    memories.map((item) => (isRecord(item) ? item : {})),
    photos.map((item) => (isRecord(item) ? item : {}))
  );

  const stateLike = {
    people: people.map((item) => (isRecord(item) ? item : {})),
    places: places.map((item) => (isRecord(item) ? item : {})),
    memories: memories.map((item) => (isRecord(item) ? item : {})),
    anniversaryPlans: anniversaryPlans.map((item) => (isRecord(item) ? item : {}))
  };
  const issues = collectRawStateIssues(stateLike);

  return {
    schemaVersion: String(input.schemaVersion || input.version || ""),
    people: people.length,
    places: places.length,
    memories: memories.length,
    anniversaryPlans: anniversaryPlans.length,
    photos: photos.length,
    peopleDelta: currentState ? people.length - currentState.people.length : null,
    placesDelta: currentState ? places.length - currentState.places.length : null,
    memoriesDelta: currentState ? memories.length - currentState.memories.length : null,
    anniversaryPlansDelta: currentState ? anniversaryPlans.length - currentState.anniversaryPlans.length : null,
    photosDelta: currentState ? photos.length - countMemoryPhotoRefs(currentState) : null,
    repairedPhotos: photoReport.repairedPhotos,
    ignoredPhotos: photoReport.ignoredPhotos,
    missingPhotoRefs: photoReport.missingPhotoRefs,
    extraPhotoRefs: photoReport.extraPhotoRefs,
    exportedAt: String(input.exportedAt || ""),
    appVersion: String(input.appVersion || ""),
    issueCount: issues.length + photoReport.issues.length,
    issues: [...issues, ...photoReport.issues]
  };
}

function collectStateIssues(state: LifeLogState) {
  return collectRawStateIssues({
    people: state.people,
    places: state.places,
    memories: state.memories,
    anniversaryPlans: state.anniversaryPlans
  });
}

function collectRawStateIssues(state: {
  people: Array<Record<string, unknown> | Person>;
  places: Array<Record<string, unknown> | Place>;
  memories: Array<Record<string, unknown> | MemoryEvent>;
  anniversaryPlans?: Array<Record<string, unknown> | AnniversaryPlan>;
}) {
  const issues: string[] = [];
  const personIds = collectIds(state.people, "人物", issues);
  const placeIds = collectIds(state.places, "地点", issues);
  const memoryIds = collectIds(state.memories, "回忆", issues);
  if (state.anniversaryPlans) collectIds(state.anniversaryPlans, "纪念日安排", issues);

  let missingPeopleRefs = 0;
  let missingPlaceRefs = 0;
  for (const memory of state.memories) {
    const rawPersonIds = Array.isArray(memory.personIds) ? memory.personIds : [];
    missingPeopleRefs += rawPersonIds.filter((id) => typeof id === "string" && !personIds.has(id)).length;

    const memoryPlaceIds = getMemoryPlaceIds({
      placeId: typeof memory.placeId === "string" ? memory.placeId : "",
      placeIds: Array.isArray(memory.placeIds) ? memory.placeIds.filter((id): id is string => typeof id === "string") : []
    });
    missingPlaceRefs += memoryPlaceIds.filter((placeId) => !placeIds.has(placeId)).length;
  }

  if (missingPeopleRefs) issues.push(`${missingPeopleRefs} 处回忆关联了不存在的人物`);
  if (missingPlaceRefs) issues.push(`${missingPlaceRefs} 处回忆关联了不存在的地点`);

  if (state.anniversaryPlans) {
    let missingPlanPeopleRefs = 0;
    let missingPlanPlaceRefs = 0;
    let missingPlanMemoryRefs = 0;
    for (const plan of state.anniversaryPlans) {
      const personId = typeof plan.personId === "string" ? plan.personId : "";
      if (personId && !personIds.has(personId)) missingPlanPeopleRefs += 1;

      const planPlaceIds = Array.isArray(plan.placeIds) ? plan.placeIds : [];
      missingPlanPlaceRefs += planPlaceIds.filter((id) => typeof id === "string" && !placeIds.has(id)).length;

      const memoryId = typeof plan.memoryId === "string" ? plan.memoryId : "";
      if (memoryId && !memoryIds.has(memoryId)) missingPlanMemoryRefs += 1;
    }
    if (missingPlanPeopleRefs) issues.push(`${missingPlanPeopleRefs} 条纪念日安排关联了不存在的人物`);
    if (missingPlanPlaceRefs) issues.push(`${missingPlanPlaceRefs} 处纪念日安排关联了不存在的地点`);
    if (missingPlanMemoryRefs) issues.push(`${missingPlanMemoryRefs} 条纪念日安排关联了不存在的回忆`);
  }

  return issues;
}

function buildHealthGroups(
  state: LifeLogState,
  integrityIssues: string[],
  duplicateStats: { duplicatePlaceGroups: number; strongDuplicatePlaceGroups: number }
): BackupHealthGroup[] {
  const peopleItems = [
    state.people.filter((person) => !person.birthday).length ? `${state.people.filter((person) => !person.birthday).length} 个人物缺少生日` : "",
    state.people.filter((person) => !person.preferences.length && !person.dislikes.length).length
      ? `${state.people.filter((person) => !person.preferences.length && !person.dislikes.length).length} 个人物还没有喜好或雷区`
      : "",
    countDuplicatePersonNames(state.people) ? `${countDuplicatePersonNames(state.people)} 组人物姓名可能重复` : ""
  ].filter(Boolean);

  const placeIdsInMemories = new Set(state.memories.flatMap(getMemoryPlaceIds));
  const placesWithoutVisit = state.places.filter((place) => !placeIdsInMemories.has(place.id)).length;
  const placesWithoutMap = state.places.filter((place) => !hasPlaceNavigation(place)).length;
  const placeItems = [
    duplicateStats.strongDuplicatePlaceGroups ? `${duplicateStats.strongDuplicatePlaceGroups} 组强重复地点可直接合并` : "",
    duplicateStats.duplicatePlaceGroups > duplicateStats.strongDuplicatePlaceGroups
      ? `${duplicateStats.duplicatePlaceGroups - duplicateStats.strongDuplicatePlaceGroups} 组疑似重复地点需要确认`
      : "",
    placesWithoutMap ? `${placesWithoutMap} 个地点缺少地图或平台入口` : "",
    placesWithoutVisit ? `${placesWithoutVisit} 个地点还没有到访记录` : ""
  ].filter(Boolean);

  const contextlessMemories = state.memories.filter((memory) => !memory.personIds.length && !getMemoryPlaceIds(memory).length).length;
  const emptyMemories = state.memories.filter((memory) => !memory.title.trim() && !memory.content.trim() && !memory.photos.length).length;
  const plansWithoutChecklist = state.anniversaryPlans.filter((plan) => !plan.checklist.length && !plan.notes && !plan.budget && !plan.placeIds.length).length;
  const donePlansWithoutMemory = state.anniversaryPlans.filter((plan) => plan.status === "done" && !plan.memoryId).length;
  const memoryItems = [
    contextlessMemories ? `${contextlessMemories} 条回忆没有关联人物或地点` : "",
    emptyMemories ? `${emptyMemories} 条回忆缺少标题、正文和照片` : "",
    plansWithoutChecklist ? `${plansWithoutChecklist} 条纪念日安排还没有具体内容` : "",
    donePlansWithoutMemory ? `${donePlansWithoutMemory} 条已完成安排还没有关联回忆` : ""
  ].filter(Boolean);

  return [
    {
      id: "integrity",
      title: "关联完整性",
      status: integrityIssues.length ? "warning" : "ok",
      count: integrityIssues.length,
      items: integrityIssues.length ? integrityIssues : ["人物、地点、回忆和安排的关键关联正常"]
    },
    {
      id: "people",
      title: "人物资料",
      status: peopleItems.length ? "info" : "ok",
      count: peopleItems.length,
      items: peopleItems.length ? peopleItems : ["生日、喜好和雷区资料整体完整"]
    },
    {
      id: "places",
      title: "地点质量",
      status: placeItems.length ? "info" : "ok",
      count: placeItems.length,
      items: placeItems.length ? placeItems : ["地点重复、地图入口和到访记录状态正常"]
    },
    {
      id: "records",
      title: "回忆与安排",
      status: memoryItems.length ? "info" : "ok",
      count: memoryItems.length,
      items: memoryItems.length ? memoryItems : ["回忆上下文和纪念日安排状态正常"]
    }
  ];
}

function buildPeopleHealthDetailItems(people: Person[]): BackupHealthDetailItem[] {
  const items: BackupHealthDetailItem[] = [];

  people
    .filter((person) => !person.birthday)
    .forEach((person) => {
      items.push({
        id: `birthday-${person.id}`,
        title: `${person.name} 缺少生日`,
        desc: "补充后会出现在首页、日历和提醒中。",
        path: `/people/${person.id}`
      });
    });

  people
    .filter((person) => !person.preferences.length && !person.dislikes.length)
    .forEach((person) => {
      items.push({
        id: `prefs-${person.id}`,
        title: `${person.name} 还没有喜好或雷区`,
        desc: "补充偏好、过敏、禁忌和送礼线索后，后续安排更好用。",
        path: `/people/${person.id}`
      });
    });

  buildDuplicatePersonNameGroups(people).forEach((group) => {
    items.push({
      id: `duplicate-person-${group.key}`,
      title: `${group.people.length} 个人物资料可能重复`,
      desc: group.people.map((person) => person.name).join("、"),
      path: "/people"
    });
  });

  return items;
}

function buildPlaceHealthDetailItems(
  places: Place[],
  duplicateGroups: ReturnType<typeof findPlaceDuplicateGroups>,
  placeIdsInMemories: Set<ID>
): BackupHealthDetailItem[] {
  const items: BackupHealthDetailItem[] = [];

  duplicateGroups.forEach((group) => {
    items.push({
      id: `duplicate-place-${group.signature}`,
      title: `${group.strength === "strong" ? "强重复" : "疑似重复"}地点：${group.label}`,
      desc: `${group.placeIds.length} 条记录 · ${group.reason}`,
      path: "/places",
      tone: group.strength === "strong" ? "warning" : "info"
    });
  });

  places
    .filter((place) => !hasPlaceNavigation(place))
    .forEach((place) => {
      items.push({
        id: `place-map-${place.id}`,
        title: `${buildPlaceDisplayName(place)} 缺少地图或平台入口`,
        desc: "补充高德、平台链接或坐标后，可以从详情页直接打开外部 App。",
        path: `/places/${place.id}`
      });
    });

  places
    .filter((place) => !placeIdsInMemories.has(place.id))
    .forEach((place) => {
      items.push({
        id: `place-visit-${place.id}`,
        title: `${buildPlaceDisplayName(place)} 还没有到访记录`,
        desc: "记录一次相关回忆后，地点统计和常去地点会更准确。",
        path: `/places/${place.id}`
      });
    });

  return items;
}

function buildRecordHealthDetailItems(state: LifeLogState): BackupHealthDetailItem[] {
  const items: BackupHealthDetailItem[] = [];
  const peopleById = new Map(state.people.map((person) => [person.id, person.name]));

  state.memories
    .filter((memory) => !memory.personIds.length && !getMemoryPlaceIds(memory).length)
    .forEach((memory) => {
      items.push({
        id: `memory-context-${memory.id}`,
        title: `${memory.title || memory.date} 没有关联人物或地点`,
        desc: "补充上下文后，人物详情、地点详情和搜索结果会更完整。",
        path: `/memories/${memory.id}`
      });
    });

  state.memories
    .filter((memory) => !memory.title.trim() && !memory.content.trim() && !memory.photos.length)
    .forEach((memory) => {
      items.push({
        id: `memory-empty-${memory.id}`,
        title: `${memory.date} 有一条空回忆`,
        desc: "建议补充标题、正文或照片，或者确认是否需要删除。",
        path: `/memories/${memory.id}`,
        tone: "warning"
      });
    });

  state.anniversaryPlans
    .filter((plan) => !plan.checklist.length && !plan.notes && !plan.budget && !plan.placeIds.length)
    .forEach((plan) => {
      items.push({
        id: `plan-empty-${plan.id}`,
        title: `${peopleById.get(plan.personId) || "某人"}的${plan.anniversaryTitle}安排还没有内容`,
        desc: `${plan.occurrenceYear} · 可补充待办、预算、地点或备注。`,
        path: `/people/${plan.personId}#anniversaries`
      });
    });

  state.anniversaryPlans
    .filter((plan) => plan.status === "done" && !plan.memoryId)
    .forEach((plan) => {
      items.push({
        id: `plan-memory-${plan.id}`,
        title: `${peopleById.get(plan.personId) || "某人"}的${plan.anniversaryTitle}已完成但未关联回忆`,
        desc: "关联当天回忆后，往年安排回看会更完整。",
        path: `/people/${plan.personId}#anniversaries`
      });
    });

  return items;
}

function hasPlaceNavigation(place: Place) {
  return Boolean(
    place.mapUrl ||
    place.sourceUrl ||
    place.platformLinks.length ||
    (typeof place.latitude === "number" && typeof place.longitude === "number")
  );
}

function countDuplicatePersonNames(people: Person[]) {
  const buckets = new Map<string, number>();
  people.forEach((person) => {
    const key = [person.name, person.nickname, person.relationship].map(normalizeText).filter(Boolean).join("|");
    if (!key) return;
    buckets.set(key, (buckets.get(key) || 0) + 1);
  });
  return Array.from(buckets.values()).filter((count) => count > 1).length;
}

function buildDuplicatePersonNameGroups(people: Person[]) {
  const buckets = new Map<string, Person[]>();
  people.forEach((person) => {
    const key = [person.name, person.nickname, person.relationship].map(normalizeText).filter(Boolean).join("|");
    if (!key) return;
    buckets.set(key, [...(buckets.get(key) || []), person]);
  });
  return Array.from(buckets.entries())
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({ key, people: group }));
}

function normalizeText(value?: string) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "");
}

function collectIds(
  items: Array<Record<string, unknown> | { id?: unknown }>,
  label: string,
  issues: string[]
) {
  const ids = new Set<string>();
  const duplicates = new Set<string>();
  let missing = 0;

  for (const item of items) {
    const id = typeof item.id === "string" ? item.id.trim() : "";
    if (!id) {
      missing += 1;
      continue;
    }
    if (ids.has(id)) duplicates.add(id);
    ids.add(id);
  }

  if (missing) issues.push(`${missing} 条${label}记录缺少 ID`);
  if (duplicates.size) issues.push(`${duplicates.size} 个${label} ID 重复`);
  return ids;
}

function countMemoryPhotoRefs(state: LifeLogState) {
  return state.memories.reduce((total, memory) => total + (memory.photos || []).length, 0);
}

function inspectBackupPhotoLinks(memories: Array<Record<string, unknown>>, photos: Array<Record<string, unknown>>) {
  const memoryIds = new Set(memories.map((memory) => (typeof memory.id === "string" ? memory.id : "")).filter(Boolean));
  const photoOwnerById = new Map<string, string>();
  const photoIdsInMemories = new Set<string>();
  let duplicatePhotoRefs = 0;

  memories.forEach((memory) => {
    const memoryId = typeof memory.id === "string" ? memory.id : "";
    const refs = Array.isArray(memory.photos) ? memory.photos : [];
    refs.forEach((photoId) => {
      if (typeof photoId !== "string" || !photoId) return;
      if (photoOwnerById.has(photoId)) duplicatePhotoRefs += 1;
      else if (memoryId) photoOwnerById.set(photoId, memoryId);
      photoIdsInMemories.add(photoId);
    });
  });

  const photoRecordIds = new Set<string>();
  const importablePhotoRecordIds = new Set<string>();
  let repairedPhotos = 0;
  let ignoredPhotos = 0;

  photos.forEach((photo) => {
    const photoId = typeof photo.id === "string" ? photo.id : "";
    const memoryId = typeof photo.memoryId === "string" ? photo.memoryId : "";
    if (photoId) photoRecordIds.add(photoId);
    if (photoId && photoOwnerById.has(photoId)) {
      importablePhotoRecordIds.add(photoId);
      return;
    }
    if (memoryIds.has(memoryId)) {
      if (photoId) importablePhotoRecordIds.add(photoId);
      return;
    }
    ignoredPhotos += 1;
  });

  photos.forEach((photo) => {
    const photoId = typeof photo.id === "string" ? photo.id : "";
    const memoryId = typeof photo.memoryId === "string" ? photo.memoryId : "";
    if (photoId && photoOwnerById.has(photoId) && !memoryIds.has(memoryId)) repairedPhotos += 1;
  });

  const missingPhotoRefs = Array.from(photoIdsInMemories).filter((photoId) => !photoRecordIds.has(photoId)).length;
  const extraPhotoRefs = Array.from(importablePhotoRecordIds).filter((photoId) => !photoIdsInMemories.has(photoId)).length;
  const issues: string[] = [];
  if (repairedPhotos) issues.push(`${repairedPhotos} 张照片的回忆归属将自动修复`);
  if (ignoredPhotos) issues.push(`${ignoredPhotos} 张照片没有可用回忆，将在导入时忽略`);
  if (missingPhotoRefs) issues.push(`${missingPhotoRefs} 个回忆照片引用缺少照片文件`);
  if (extraPhotoRefs) issues.push(`${extraPhotoRefs} 张照片未出现在回忆引用中，将自动补回关联`);
  if (duplicatePhotoRefs) issues.push(`${duplicatePhotoRefs} 个照片引用重复出现在多条回忆中`);

  return {
    repairedPhotos,
    ignoredPhotos,
    missingPhotoRefs,
    extraPhotoRefs,
    issues
  };
}
