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
import { getWesternZodiacSign } from "./date";
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
type NotionBlock = Record<string, unknown>;
const NOTION_BLOCK_PAGE_SIZE = 100;
const NOTION_BLOCK_WRITE_BATCH_SIZE = 90;

interface NotionSyncItem {
  entityType: NotionEntityType;
  entityId: string;
  label: string;
  databaseId: string;
  properties: NotionProperties;
  blocks?: NotionBlock[];
}

interface NotionDatabaseSchema {
  id: string;
  title: string;
  properties: Record<string, { type?: string }>;
}

interface NotionBlockChildrenResponse {
  results?: unknown[];
  has_more?: boolean;
  next_cursor?: string | null;
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
    const hash = buildSyncHash({ properties: item.properties, blocks: item.blocks || [] });
    const typeSummary = nextSummary.byType[item.entityType];
    typeSummary.total += 1;

    if (previousMapping?.notionPageId && !previousMapping.lastError && previousMapping.lastSyncHash === hash && previousMapping.dataSourceId === item.databaseId) {
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
      blocks: item.blocks,
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
    ...(settings.memoriesDatabaseId ? state.memories.map((memory) => buildMemoryItem(memory, state, settings.memoriesDatabaseId, settings)) : []),
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
    星座: [selectProperty(getWesternZodiacSign(person.birthday)), "Zodiac"],
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
    原计划: [richTextProperty(memory.plannedContent || ""), "Planned Content"],
    关联人物: [richTextProperty(people.join("、")), "People"],
    关联地点: [richTextProperty(places.join("、")), "Places"],
    标签: [multiSelectProperty(memory.tags), "Tags"],
    照片数量: [numberProperty(memory.photos.length), "Photo Count"],
    更新时间: [dateProperty(new Date().toISOString()), "Updated At"]
  });
}

function buildMemoryPageBlocks(memory: MemoryEvent, state: LifeLogState): NotionBlock[] {
  const people = memory.personIds.map((id) => state.people.find((person) => person.id === id)?.name).filter(Boolean);
  const places = getMemoryPlaceIds(memory)
    .map((id) => state.places.find((place) => place.id === id))
    .filter((place): place is Place => Boolean(place))
    .map(buildPlaceDisplayName);
  const content = memory.content.trim();
  const plannedContent = memory.plannedContent?.trim() || "";
  const metaLines = [
    `类型：${getMemoryKindLabel(memory)}`,
    `日期：${memory.date || "未设置"}`,
    memory.mood ? `心情：${memory.mood}` : "",
    people.length ? `人物：${people.join("、")}` : "",
    places.length ? `地点：${places.join("、")}` : "",
    memory.tags.length ? `标签：${memory.tags.join("、")}` : "",
    memory.photos.length ? `照片数量：${memory.photos.length}` : ""
  ].filter(Boolean);

  return [
    calloutBlock("LifeLog 同步内容开始。重新同步时会替换这一段，下面手动新增的内容不会被覆盖。"),
    headingBlock("正文"),
    ...textBlocks(content || "还没有记录正文。"),
    ...(plannedContent ? [headingBlock("原计划"), ...textBlocks(plannedContent)] : []),
    headingBlock("关联信息"),
    ...textBlocks(metaLines.join("\n")),
    paragraphBlock("LifeLog 同步内容结束")
  ];
}

function calloutBlock(text: string): NotionBlock {
  return {
    object: "block",
    type: "callout",
    callout: {
      rich_text: richText(text),
      icon: { type: "emoji", emoji: "📝" }
    }
  };
}

function headingBlock(text: string): NotionBlock {
  return {
    object: "block",
    type: "heading_2",
    heading_2: {
      rich_text: richText(text)
    }
  };
}

function paragraphBlock(text: string): NotionBlock {
  return {
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: richText(text)
    }
  };
}

function textBlocks(value: string): NotionBlock[] {
  const normalized = value.trim();
  if (!normalized) return [];
  return splitNotionText(normalized).map(paragraphBlock);
}

function splitNotionText(value: string) {
  const chunks: string[] = [];
  let rest = value;
  const max = 1800;
  while (rest.length > max) {
    chunks.push(rest.slice(0, max));
    rest = rest.slice(max);
  }
  if (rest) chunks.push(rest);
  return chunks;
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
  blocks,
  fetcher
}: {
  settings: NotionSettings;
  databaseId: string;
  pageId?: string;
  properties: NotionProperties;
  blocks?: NotionBlock[];
  fetcher?: NotionFetch;
}): Promise<{ ok: true; pageId: string; created: boolean } | { ok: false; message: string; diagnostic?: NotionRequestDiagnostic }> {
  if (pageId) {
    const update = await notionRequest<{ id?: string }>(
      settings,
      `/pages/${encodeURIComponent(pageId)}`,
      { method: "PATCH", json: { properties } },
      fetcher
    );
    if (update.ok) {
      const nextPageId = String(update.data.id || pageId);
      if (blocks?.length) {
        const blockResult = await replaceLifeLogPageBlocks(settings, nextPageId, blocks, fetcher);
        if (!blockResult.ok) return blockResult;
      }
      return { ok: true, pageId: nextPageId, created: false };
    }
    if (update.status !== 404) return { ok: false, message: update.message, diagnostic: update.diagnostic };
  }

  const create = await notionRequest<{ id?: string }>(
    settings,
    "/pages",
    {
      method: "POST",
      json: {
        parent: { database_id: normalizeNotionId(databaseId) },
        properties,
        ...(blocks?.length ? { children: blocks.slice(0, NOTION_BLOCK_WRITE_BATCH_SIZE) } : {})
      }
    },
    fetcher
  );
  if (!create.ok) return { ok: false, message: create.message, diagnostic: create.diagnostic };
  const createdPageId = String(create.data.id || "");
  if (!createdPageId) return { ok: false, message: "Notion 创建页面后未返回页面 ID。" };
  if (blocks && blocks.length > NOTION_BLOCK_WRITE_BATCH_SIZE) {
    const append = await appendNotionPageBlocks(settings, createdPageId, blocks.slice(NOTION_BLOCK_WRITE_BATCH_SIZE), fetcher);
    if (!append.ok) return append;
  }
  return { ok: true, pageId: createdPageId, created: true };
}

async function replaceLifeLogPageBlocks(
  settings: NotionSettings,
  pageId: string,
  blocks: NotionBlock[],
  fetcher?: NotionFetch
): Promise<{ ok: true } | { ok: false; message: string; diagnostic?: NotionRequestDiagnostic }> {
  const existing = await listTopLevelBlockChildren(settings, pageId, fetcher);
  if (!existing.ok) return existing;

  const blocksToArchive = getLifeLogManagedBlockIds(existing.results);

  for (const blockId of blocksToArchive) {
    const archived = await notionRequest(
      settings,
      `/blocks/${encodeURIComponent(blockId)}`,
      { method: "PATCH", json: { archived: true } },
      fetcher
    );
    if (!archived.ok) return { ok: false, message: archived.message, diagnostic: archived.diagnostic };
  }

  return appendNotionPageBlocks(settings, pageId, blocks, fetcher);
}

async function listTopLevelBlockChildren(
  settings: NotionSettings,
  pageId: string,
  fetcher?: NotionFetch
): Promise<{ ok: true; results: unknown[] } | { ok: false; message: string; diagnostic?: NotionRequestDiagnostic }> {
  const results: unknown[] = [];
  let cursor = "";
  let pageCount = 0;

  do {
    const query = cursor
      ? `?page_size=${NOTION_BLOCK_PAGE_SIZE}&start_cursor=${encodeURIComponent(cursor)}`
      : `?page_size=${NOTION_BLOCK_PAGE_SIZE}`;
    const response = await notionRequest<NotionBlockChildrenResponse>(
      settings,
      `/blocks/${encodeURIComponent(pageId)}/children${query}`,
      { method: "GET" },
      fetcher
    );
    if (!response.ok) return { ok: false, message: response.message, diagnostic: response.diagnostic };

    if (Array.isArray(response.data.results)) results.push(...response.data.results);
    cursor = typeof response.data.next_cursor === "string" ? response.data.next_cursor : "";
    pageCount += 1;
    if (pageCount > 50) {
      return { ok: false, message: "Notion 页面块数量过多，暂时无法安全替换同步内容。" };
    }
    if (!response.data.has_more) break;
  } while (cursor);

  return { ok: true, results };
}

async function appendNotionPageBlocks(
  settings: NotionSettings,
  pageId: string,
  blocks: NotionBlock[],
  fetcher?: NotionFetch
): Promise<{ ok: true } | { ok: false; message: string; diagnostic?: NotionRequestDiagnostic }> {
  for (let index = 0; index < blocks.length; index += NOTION_BLOCK_WRITE_BATCH_SIZE) {
    const append = await notionRequest(
      settings,
      `/blocks/${encodeURIComponent(pageId)}/children`,
      { method: "PATCH", json: { children: blocks.slice(index, index + NOTION_BLOCK_WRITE_BATCH_SIZE) } },
      fetcher
    );
    if (!append.ok) return { ok: false, message: append.message, diagnostic: append.diagnostic };
  }
  return { ok: true };
}

function getLifeLogManagedBlockIds(blocks: unknown[]) {
  const ids: string[] = [];
  let insideManagedRange = false;
  for (const block of blocks) {
    if (!isRecord(block)) continue;
    const text = getBlockPlainText(block);
    const id = String(block.id || "");
    if (text.includes("LifeLog 同步内容开始")) insideManagedRange = true;
    if (insideManagedRange && id) ids.push(id);
    if (insideManagedRange && text.includes("LifeLog 同步内容结束")) break;
  }
  return ids;
}

function getBlockPlainText(block: Record<string, unknown>) {
  const type = String(block.type || "");
  const body = isRecord(block[type]) ? block[type] : {};
  const richText = Array.isArray(body.rich_text) ? body.rich_text : [];
  return richText
    .map((item) => isRecord(item) ? String(item.plain_text || "") : "")
    .join("");
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

function buildMemoryItem(memory: MemoryEvent, state: LifeLogState, databaseId: string, settings: NotionSettings): NotionSyncItem {
  return {
    entityType: "memory",
    entityId: memory.id,
    label: `回忆 ${memory.title || memory.id}`,
    databaseId: normalizeNotionId(databaseId),
    properties: buildMemoryProperties(memory, state),
    blocks: settings.syncPageContent === false ? undefined : buildMemoryPageBlocks(memory, state)
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
  return { rich_text: text ? richText(text) : [] };
}

function selectProperty(value: string | undefined): NotionPropertyValue {
  const name = truncateSelectName(String(value || "").trim());
  return { select: name ? { name } : null };
}

function multiSelectProperty(values: string[] | undefined): NotionPropertyValue {
  const options = Array.from(new Set((values || []).map((value) => truncateSelectName(value)).filter(Boolean))).slice(0, 100);
  return { multi_select: options.map((name) => ({ name })) };
}

function checkboxProperty(value: boolean): NotionPropertyValue {
  return { checkbox: Boolean(value) };
}

function numberProperty(value: number | undefined): NotionPropertyValue {
  return { number: Number.isFinite(Number(value)) ? Number(value) : null };
}

function dateProperty(value: string | undefined): NotionPropertyValue {
  const normalized = String(value || "").trim();
  return { date: normalized ? { start: normalized } : null };
}

function urlProperty(value: string | undefined): NotionPropertyValue {
  const normalized = String(value || "").trim();
  return { url: normalized || null };
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

function buildSyncHash(payload: { properties: NotionProperties; blocks?: NotionBlock[] }) {
  const stableProperties = { ...payload.properties };
  delete stableProperties["更新时间"];
  delete stableProperties["Updated At"];
  return stableStringify({
    properties: stableProperties,
    blocks: payload.blocks || []
  });
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
