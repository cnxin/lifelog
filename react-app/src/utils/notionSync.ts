import type {
  AnniversaryPlan,
  LifeLogState,
  MemoryEvent,
  NotionEntityType,
  NotionPageMapping,
  NotionSettings,
  NotionSyncFailedItem,
  NotionSyncTypeStats,
  Person,
  Place,
  PreferenceGroup
} from "../types";
import { getMemoryPlaceIds } from "./memoryPlaces";
import { getMemoryKindLabel } from "./memoryDisplay";
import { normalizeNotionId } from "./notionIds";
import { buildPlaceDisplayName } from "./placeMeta";
import { notionRequest, testNotionConnection, type NotionFetch, type NotionRequestDiagnostic } from "./notionClient";

export interface NotionSyncSummary {
  total: number;
  synced: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  byType: Record<NotionEntityType, NotionSyncTypeSummary>;
  messages: string[];
  failedItems: NotionSyncFailedItem[];
  mappings: NotionPageMapping[];
  workspaceName: string;
  workspaceBotName: string;
  diagnostic?: NotionRequestDiagnostic;
}

export interface NotionSyncTypeSummary extends NotionSyncTypeStats {
}

export interface NotionSyncTarget {
  entityType: NotionEntityType;
  entityId: string;
}

export interface NotionSyncOptions {
  targets?: NotionSyncTarget[];
  connectionMode?: "full" | "targeted";
}

interface NotionSyncTypeSummaryBase {
  total: number;
  synced: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
}

type NotionPropertyValue = Record<string, unknown>;
type NotionProperties = Record<string, NotionPropertyValue>;

interface NotionSyncItem {
  entityType: NotionEntityType;
  entityId: string;
  label: string;
  databaseId: string;
  properties: NotionProperties;
}

interface NotionDatabaseSchema {
  id: string;
  title: string;
  properties: Record<string, { type?: string }>;
}

export async function syncLifeLogToNotion({
  state,
  settings,
  mappings,
  options,
  fetcher
}: {
  state: LifeLogState;
  settings: NotionSettings;
  mappings: NotionPageMapping[];
  options?: NotionSyncOptions;
  fetcher?: NotionFetch;
}): Promise<NotionSyncSummary> {
  const empty = buildEmptySummary();
  if (!settings.token.trim()) {
    return {
      ...empty,
      failed: 1,
      messages: ["请先填写 Notion Token。"]
    };
  }

  const shouldRunFullConnectionCheck = options?.connectionMode !== "targeted";
  let workspaceName = settings.workspaceName;
  let workspaceBotName = settings.workspaceBotName;
  if (shouldRunFullConnectionCheck) {
    const connection = await testNotionConnection(settings, fetcher);
    if (!connection.ok) {
      return {
        ...empty,
        failed: 1,
        workspaceName: connection.workspaceName,
        workspaceBotName: connection.workspaceBotName,
        messages: [connection.message],
        diagnostic: connection.diagnostic
      };
    }
    workspaceName = connection.workspaceName;
    workspaceBotName = connection.workspaceBotName;
  }

  const items = filterSyncItems(buildSyncItems(state, settings), options?.targets);
  const nextSummary: NotionSyncSummary = {
    ...empty,
    total: items.length,
    workspaceName,
    workspaceBotName,
    messages: []
  };

  if (!items.length) {
    return {
      ...nextSummary,
      messages: ["没有可同步内容。请先填写至少一个 Notion 数据库 ID。"]
    };
  }

  const mappingById = new Map(mappings.map((mapping) => [mapping.id, mapping]));
  const schemaCache = new Map<string, NotionDatabaseSchema>();

  for (const item of items) {
    const mappingId = buildNotionMappingId(item.entityType, item.entityId);
    const previousMapping = mappingById.get(mappingId);
    const hash = buildSyncHash(item.properties);
    const typeSummary = nextSummary.byType[item.entityType];
    typeSummary.total += 1;

    if (previousMapping?.notionPageId && previousMapping.lastSyncHash === hash && previousMapping.dataSourceId === item.databaseId) {
      nextSummary.skipped += 1;
      typeSummary.skipped += 1;
      continue;
    }

    const schemaResult = await getDatabaseSchema(settings, item.databaseId, schemaCache, fetcher);
    if (!schemaResult.schema) {
      nextSummary.failed += 1;
      typeSummary.failed += 1;
      if (!nextSummary.diagnostic) nextSummary.diagnostic = schemaResult.diagnostic;
      nextSummary.messages.push(`${item.label}：${schemaResult.message || "数据库不可读取。"}`);
      nextSummary.failedItems.push(buildFailedItem(item, schemaResult.message || "数据库不可读取。", previousMapping));
      continue;
    }

    const properties = filterProperties(item.properties, schemaResult.schema.properties);
    if (!Object.keys(properties).length) {
      nextSummary.failed += 1;
      typeSummary.failed += 1;
      nextSummary.messages.push(`${item.label}：Notion 数据库缺少可写字段。`);
      nextSummary.failedItems.push(buildFailedItem(item, "Notion 数据库缺少可写字段。", previousMapping));
      continue;
    }

    const syncResult = await upsertNotionPage({
      settings,
      databaseId: item.databaseId,
      pageId: previousMapping?.notionPageId,
      properties,
      fetcher
    });

    if (!syncResult.ok) {
      nextSummary.failed += 1;
      typeSummary.failed += 1;
      if (!nextSummary.diagnostic) nextSummary.diagnostic = syncResult.diagnostic;
      nextSummary.messages.push(`${item.label}：${syncResult.message}`);
      nextSummary.failedItems.push(buildFailedItem(item, syncResult.message, previousMapping));
      nextSummary.mappings.push({
        id: mappingId,
        entityType: item.entityType,
        entityId: item.entityId,
        dataSourceId: item.databaseId,
        notionPageId: previousMapping?.notionPageId,
        lastSyncHash: previousMapping?.lastSyncHash,
        lastSyncedAt: previousMapping?.lastSyncedAt,
        lastError: syncResult.message
      });
      continue;
    }

    const now = new Date().toISOString();
    nextSummary.synced += 1;
    typeSummary.synced += 1;
    if (syncResult.created) {
      nextSummary.created += 1;
      typeSummary.created += 1;
    } else {
      nextSummary.updated += 1;
      typeSummary.updated += 1;
    }
    nextSummary.mappings.push({
      id: mappingId,
      entityType: item.entityType,
      entityId: item.entityId,
      dataSourceId: item.databaseId,
      notionPageId: syncResult.pageId,
      lastSyncHash: hash,
      lastSyncedAt: now,
      lastError: ""
    });
  }

  if (!nextSummary.messages.length) {
    nextSummary.messages.push(`同步完成：新增 ${nextSummary.created}，更新 ${nextSummary.updated}，跳过 ${nextSummary.skipped}。`);
  }

  return nextSummary;
}

export function buildSyncItems(state: LifeLogState, settings: NotionSettings): NotionSyncItem[] {
  return [
    ...(settings.peopleDatabaseId ? state.people.map((person) => buildPersonItem(person, settings.peopleDatabaseId)) : []),
    ...(settings.placesDatabaseId ? state.places.map((place) => buildPlaceItem(place, settings.placesDatabaseId)) : []),
    ...(settings.memoriesDatabaseId ? state.memories.map((memory) => buildMemoryItem(memory, state, settings.memoriesDatabaseId)) : []),
    ...(settings.plansDatabaseId ? state.anniversaryPlans.map((plan) => buildPlanItem(plan, state, settings.plansDatabaseId)) : [])
  ];
}

function filterSyncItems(items: NotionSyncItem[], targets: NotionSyncTarget[] | undefined) {
  if (!targets?.length) return items;
  const targetIds = new Set(targets.map((target) => `${target.entityType}:${target.entityId}`));
  return items.filter((item) => targetIds.has(`${item.entityType}:${item.entityId}`));
}

export function buildPersonProperties(person: Person): NotionProperties {
  return cleanPropertiesWithAliases({
    名称: [titleProperty(person.name || "未命名人物"), "Name"],
    "LifeLog ID": richTextProperty(person.id),
    关系: [selectProperty(person.relationship), "Relationship"],
    生日: [dateProperty(person.birthday), "Birthday"],
    重点关注: [checkboxProperty(person.favorite), "Favorite"],
    喜好档案: [richTextProperty(formatGroups(person.preferences)), "Preferences"],
    禁忌雷区: [richTextProperty(formatGroups(person.dislikes)), "Dislikes"],
    备注: [richTextProperty(person.notes), "Notes"],
    更新时间: [dateProperty(new Date().toISOString()), "Updated At"]
  });
}

export function buildPlaceProperties(place: Place): NotionProperties {
  return cleanPropertiesWithAliases({
    名称: [titleProperty(buildPlaceDisplayName(place)), "Name"],
    "LifeLog ID": richTextProperty(place.id),
    分类: [selectProperty(place.category), "Category"],
    城市: [richTextProperty(place.city), "City"],
    区域: [richTextProperty(place.area), "Area"],
    商场: [richTextProperty(place.mall), "Mall"],
    门店名: [richTextProperty(place.storeName), "Store Name"],
    评分: [numberProperty(place.rating), "Rating"],
    地址: [richTextProperty(place.address), "Address"],
    地图链接: [urlProperty(place.mapUrl || place.sourceUrl), "Map URL"],
    标签: [multiSelectProperty(place.tags), "Tags"],
    收藏: [checkboxProperty(place.favorite), "Favorite"],
    更新时间: [dateProperty(new Date().toISOString()), "Updated At"]
  });
}

export function buildMemoryProperties(memory: MemoryEvent, state: LifeLogState): NotionProperties {
  const people = memory.personIds.map((id) => state.people.find((person) => person.id === id)?.name).filter(Boolean);
  const places = getMemoryPlaceIds(memory)
    .map((id) => state.places.find((place) => place.id === id))
    .filter((place): place is Place => Boolean(place))
    .map(buildPlaceDisplayName);
  return cleanPropertiesWithAliases({
    标题: [titleProperty(memory.title || `未命名${getMemoryKindLabel(memory)}`), "Name"],
    "LifeLog ID": richTextProperty(memory.id),
    类型: [selectProperty(memory.kind === "plan" ? "计划" : "回忆"), "Type"],
    日期: [dateProperty(memory.date), "Date"],
    心情: [selectProperty(memory.mood), "Mood"],
    内容: [richTextProperty(memory.content), "Content"],
    关联人物: [richTextProperty(people.join("、")), "People"],
    关联地点: [richTextProperty(places.join("、")), "Places"],
    标签: [multiSelectProperty(memory.tags), "Tags"],
    照片数量: [numberProperty(memory.photos.length), "Photo Count"],
    更新时间: [dateProperty(new Date().toISOString()), "Updated At"]
  });
}

export function buildPlanProperties(plan: AnniversaryPlan, state: LifeLogState): NotionProperties {
  const person = state.people.find((item) => item.id === plan.personId);
  const places = plan.placeIds
    .map((id) => state.places.find((place) => place.id === id))
    .filter((place): place is Place => Boolean(place))
    .map(buildPlaceDisplayName);
  return cleanPropertiesWithAliases({
    标题: [titleProperty(plan.title || plan.anniversaryTitle || "未命名安排"), "Name"],
    "LifeLog ID": richTextProperty(plan.id),
    人物: [richTextProperty(person?.name || ""), "Person"],
    纪念日: [richTextProperty(plan.anniversaryTitle), "Anniversary Title"],
    目标日期: [dateProperty(plan.targetDate), "Target Date"],
    状态: [selectProperty(plan.status), "Status"],
    预算: [richTextProperty(plan.budget), "Budget"],
    清单: [richTextProperty(plan.checklist.map((item) => `${item.done ? "[x]" : "[ ]"} ${item.text}`).join("\n")), "Checklist"],
    地点: [richTextProperty(places.join("、")), "Places"],
    关联回忆: [richTextProperty(plan.memoryId || ""), "Memory"],
    备注: [richTextProperty(plan.notes), "Notes"],
    更新时间: [dateProperty(plan.updatedAt || new Date().toISOString()), "Updated At"]
  });
}

async function getDatabaseSchema(
  settings: NotionSettings,
  databaseId: string,
  cache: Map<string, NotionDatabaseSchema>,
  fetcher?: NotionFetch
): Promise<{ schema: NotionDatabaseSchema | null; message?: string; diagnostic?: NotionRequestDiagnostic }> {
  const normalizedId = normalizeNotionId(databaseId);
  const cached = cache.get(normalizedId);
  if (cached) return { schema: cached };
  const response = await notionRequest(settings, `/databases/${encodeURIComponent(normalizedId)}`, { method: "GET" }, fetcher);
  if (!response.ok) {
    return {
      schema: null,
      message: response.message,
      diagnostic: response.diagnostic
    };
  }
  if (!isRecord(response.data)) {
    return {
      schema: null,
      message: "数据库返回结构异常。"
    };
  }
  const schema = {
    id: String(response.data.id || normalizedId),
    title: getTitleText(response.data.title),
    properties: isRecord(response.data.properties) ? normalizePropertySchema(response.data.properties) : {}
  };
  cache.set(normalizedId, schema);
  return { schema };
}

async function upsertNotionPage({
  settings,
  databaseId,
  pageId,
  properties,
  fetcher
}: {
  settings: NotionSettings;
  databaseId: string;
  pageId?: string;
  properties: NotionProperties;
  fetcher?: NotionFetch;
}): Promise<{ ok: true; pageId: string; created: boolean } | { ok: false; message: string; diagnostic?: NotionRequestDiagnostic }> {
  if (pageId) {
    const update = await notionRequest<{ id?: string }>(
      settings,
      `/pages/${encodeURIComponent(pageId)}`,
      { method: "PATCH", json: { properties } },
      fetcher
    );
    if (update.ok) return { ok: true, pageId: String(update.data.id || pageId), created: false };
    if (update.status !== 404) return { ok: false, message: update.message, diagnostic: update.diagnostic };
  }

  const create = await notionRequest<{ id?: string }>(
    settings,
    "/pages",
    {
      method: "POST",
      json: {
        parent: { database_id: normalizeNotionId(databaseId) },
        properties
      }
    },
    fetcher
  );
  if (!create.ok) return { ok: false, message: create.message, diagnostic: create.diagnostic };
  return { ok: true, pageId: String(create.data.id || ""), created: true };
}

function buildPersonItem(person: Person, databaseId: string): NotionSyncItem {
  return {
    entityType: "person",
    entityId: person.id,
    label: `人物 ${person.name}`,
    databaseId: normalizeNotionId(databaseId),
    properties: buildPersonProperties(person)
  };
}

function buildPlaceItem(place: Place, databaseId: string): NotionSyncItem {
  return {
    entityType: "place",
    entityId: place.id,
    label: `地点 ${buildPlaceDisplayName(place)}`,
    databaseId: normalizeNotionId(databaseId),
    properties: buildPlaceProperties(place)
  };
}

function buildMemoryItem(memory: MemoryEvent, state: LifeLogState, databaseId: string): NotionSyncItem {
  return {
    entityType: "memory",
    entityId: memory.id,
    label: `回忆 ${memory.title || memory.id}`,
    databaseId: normalizeNotionId(databaseId),
    properties: buildMemoryProperties(memory, state)
  };
}

function buildPlanItem(plan: AnniversaryPlan, state: LifeLogState, databaseId: string): NotionSyncItem {
  return {
    entityType: "anniversaryPlan",
    entityId: plan.id,
    label: `安排 ${plan.title || plan.anniversaryTitle || plan.id}`,
    databaseId: normalizeNotionId(databaseId),
    properties: buildPlanProperties(plan, state)
  };
}

function filterProperties(properties: NotionProperties, schema: NotionDatabaseSchema["properties"]) {
  const result: NotionProperties = {};
  for (const [key, value] of Object.entries(properties)) {
    const { propertyKey, propertyValue } = resolvePropertyAlias(key, value, schema);
    const schemaType = schema[propertyKey]?.type;
    if (!schemaType) continue;
    if (propertyValue[schemaType] !== undefined) {
      result[propertyKey] = propertyValue;
    }
  }
  return result;
}

function normalizePropertySchema(input: Record<string, unknown>) {
  const result: Record<string, { type?: string }> = {};
  for (const [key, value] of Object.entries(input)) {
    result[key] = isRecord(value) ? { type: String(value.type || "") } : {};
  }
  return result;
}

function cleanProperties(properties: NotionProperties) {
  return Object.fromEntries(Object.entries(properties).filter(([, value]) => value && Object.keys(value).length)) as NotionProperties;
}

function cleanPropertiesWithAliases(
  properties: Record<string, NotionPropertyValue | [NotionPropertyValue, ...string[]]>
) {
  const result: NotionProperties = {};
  for (const [key, value] of Object.entries(properties)) {
    const propertyValue = Array.isArray(value) ? value[0] : value;
    if (!propertyValue || !Object.keys(propertyValue).length) continue;
    result[key] = Array.isArray(value) ? { ...propertyValue, __aliases: value.slice(1) } : propertyValue;
  }
  return result;
}

function resolvePropertyAlias(
  key: string,
  value: NotionPropertyValue,
  schema: NotionDatabaseSchema["properties"]
) {
  const aliases = Array.isArray(value.__aliases) ? value.__aliases.map(String) : [];
  const propertyValue = { ...value };
  delete propertyValue.__aliases;
  const propertyKey = [key, ...aliases].find((name) => schema[name]?.type) || key;
  return { propertyKey, propertyValue };
}

function titleProperty(value: string): NotionPropertyValue {
  return { title: richText(value || "未命名") };
}

function richTextProperty(value: string | undefined): NotionPropertyValue {
  const text = truncateRichText(String(value || ""));
  return text ? { rich_text: richText(text) } : {};
}

function selectProperty(value: string | undefined): NotionPropertyValue {
  const name = truncateSelectName(String(value || "").trim());
  return name ? { select: { name } } : {};
}

function multiSelectProperty(values: string[] | undefined): NotionPropertyValue {
  const options = Array.from(new Set((values || []).map((value) => truncateSelectName(value)).filter(Boolean))).slice(0, 100);
  return options.length ? { multi_select: options.map((name) => ({ name })) } : {};
}

function checkboxProperty(value: boolean): NotionPropertyValue {
  return { checkbox: Boolean(value) };
}

function numberProperty(value: number | undefined): NotionPropertyValue {
  return Number.isFinite(Number(value)) ? { number: Number(value) } : {};
}

function dateProperty(value: string | undefined): NotionPropertyValue {
  const normalized = String(value || "").trim();
  return normalized ? { date: { start: normalized } } : {};
}

function urlProperty(value: string | undefined): NotionPropertyValue {
  const normalized = String(value || "").trim();
  return normalized ? { url: normalized } : {};
}

function richText(value: string) {
  return [{ type: "text", text: { content: truncateRichText(value) } }];
}

function truncateRichText(value: string) {
  return String(value || "").slice(0, 1900);
}

function truncateSelectName(value: string) {
  return String(value || "").trim().slice(0, 90);
}

function formatGroups(groups: PreferenceGroup[]) {
  return (groups || [])
    .map((group) => `${group.category}：${group.items.join("、")}`)
    .filter((line) => !line.endsWith("："))
    .join("\n");
}

function getTitleText(value: unknown) {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => {
      if (!isRecord(item)) return "";
      if (isRecord(item.text)) return String(item.text.content || "");
      return String(item.plain_text || "");
    })
    .join("");
}

function stableStringify(value: unknown) {
  return JSON.stringify(sortValue(value));
}

function buildSyncHash(properties: NotionProperties) {
  const stableProperties = { ...properties };
  delete stableProperties["更新时间"];
  delete stableProperties["Updated At"];
  return stableStringify(stableProperties);
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
}

function buildEmptySummary(): NotionSyncSummary {
  return {
    total: 0,
    synced: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    byType: buildEmptyTypeSummaries(),
    messages: [],
    failedItems: [],
    mappings: [],
    workspaceName: "",
    workspaceBotName: ""
  };
}

function buildEmptyTypeSummaries(): Record<NotionEntityType, NotionSyncTypeSummary> {
  return {
    person: buildEmptyTypeSummary(),
    place: buildEmptyTypeSummary(),
    memory: buildEmptyTypeSummary(),
    anniversaryPlan: buildEmptyTypeSummary()
  };
}

function buildEmptyTypeSummary(): NotionSyncTypeSummaryBase {
  return {
    total: 0,
    synced: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0
  };
}

function buildNotionMappingId(entityType: NotionEntityType, entityId: string) {
  return `${entityType}:${entityId}`;
}

function buildFailedItem(item: NotionSyncItem, message: string, previousMapping: NotionPageMapping | undefined): NotionSyncFailedItem {
  return {
    id: buildNotionMappingId(item.entityType, item.entityId),
    entityType: item.entityType,
    entityId: item.entityId,
    label: item.label,
    message,
    dataSourceId: item.databaseId,
    notionPageId: previousMapping?.notionPageId
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
