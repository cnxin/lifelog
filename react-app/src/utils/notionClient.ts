import { Capacitor, CapacitorHttp } from "@capacitor/core";
import type { NotionSettings } from "../types";
import { normalizeNotionId } from "./notionIds";

export type NotionConnectionErrorKind =
  | "missing-token"
  | "unauthorized"
  | "forbidden"
  | "not-found"
  | "rate-limited"
  | "network"
  | "invalid-response"
  | "unknown";

export interface NotionDatabaseProbe {
  key: "people" | "places" | "memories" | "plans";
  label: string;
  databaseId: string;
  ok: boolean;
  title?: string;
  message: string;
  errorKind?: NotionConnectionErrorKind;
  diagnostic?: NotionRequestDiagnostic;
}

type NotionDatabaseTarget = Pick<NotionDatabaseProbe, "key" | "label" | "databaseId">;

export interface NotionConnectionResult {
  ok: boolean;
  errorKind?: NotionConnectionErrorKind;
  message: string;
  workspaceName: string;
  workspaceBotName: string;
  databases: NotionDatabaseProbe[];
  diagnostic?: NotionRequestDiagnostic;
}

export interface NotionDatabaseCreateResult {
  key: NotionDatabaseProbe["key"];
  label: string;
  ok: boolean;
  databaseId?: string;
  title?: string;
  message: string;
  errorKind?: NotionConnectionErrorKind;
  diagnostic?: NotionRequestDiagnostic;
}

export interface NotionAutoCreateResult {
  ok: boolean;
  message: string;
  settingsPatch: Partial<NotionSettings>;
  databases: NotionDatabaseCreateResult[];
  diagnostic?: NotionRequestDiagnostic;
}

export type NotionDatabaseSchemaIssueKind = "missing" | "conflict";

export interface NotionDatabaseSchemaIssue {
  kind: NotionDatabaseSchemaIssueKind;
  propertyName: string;
  expectedType: string;
  actualType?: string;
}

export interface NotionDatabaseSchemaCheck {
  key: NotionDatabaseProbe["key"];
  label: string;
  databaseId: string;
  configured: boolean;
  ok: boolean;
  repairable: boolean;
  title?: string;
  message: string;
  missing: NotionDatabaseSchemaIssue[];
  conflicts: NotionDatabaseSchemaIssue[];
  errorKind?: NotionConnectionErrorKind;
  diagnostic?: NotionRequestDiagnostic;
}

export interface NotionSchemaCheckResult {
  ok: boolean;
  repairable: boolean;
  message: string;
  databases: NotionDatabaseSchemaCheck[];
  diagnostic?: NotionRequestDiagnostic;
}

export interface NotionSchemaRepairResult {
  ok: boolean;
  repaired: number;
  message: string;
  databases: NotionDatabaseSchemaCheck[];
  diagnostic?: NotionRequestDiagnostic;
}

export interface NotionRequestDiagnostic {
  at: string;
  platform: string;
  native: boolean;
  transport: NotionRuntimeInfo["transport"];
  method: string;
  path: string;
  url: string;
  durationMs?: number;
  status?: number;
  errorName?: string;
  errorMessage?: string;
  errorStack?: string;
  hint?: string;
}

export interface NotionRuntimeInfo {
  platform: string;
  native: boolean;
  transport: "capacitor-http" | "vite-proxy" | "browser-fetch";
  apiBase: string;
  corsRisk: boolean;
  detail: string;
}

export interface NotionFetchResponseLike {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

export type NotionFetch = (input: string, init: RequestInit) => Promise<NotionFetchResponseLike>;
export type NotionRequestResult<T = unknown> =
  | { ok: true; status: number; data: T }
  | { ok: false; status?: number; errorKind: NotionConnectionErrorKind; message: string; data?: unknown; diagnostic?: NotionRequestDiagnostic };

const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_DEV_PROXY_BASE = "/api/notion/v1";

export async function testNotionConnection(
  settings: NotionSettings,
  fetcher: NotionFetch = notionFetch
): Promise<NotionConnectionResult> {
  const token = settings.token.trim();
  if (!token) {
    return {
      ok: false,
      errorKind: "missing-token",
      message: "请先填写 Notion Internal Integration Token。",
      workspaceName: "",
      workspaceBotName: "",
      databases: []
    };
  }

  const userResult = await notionRequest(settings, "/users/me", { method: "GET" }, fetcher);
  if (!userResult.ok) {
    return {
      ok: false,
      errorKind: userResult.errorKind,
      message: userResult.message,
      workspaceName: "",
      workspaceBotName: "",
      databases: [],
      diagnostic: userResult.diagnostic
    };
  }

  const user = normalizeNotionUser(userResult.data);
  const databaseTargets = getConfiguredDatabases(settings);
  const databases: NotionDatabaseProbe[] = [];
  for (const target of databaseTargets) {
    const result = await probeNotionDataTarget(settings, target.databaseId, fetcher);
    if (result.ok) {
      databases.push({
        ...target,
        ok: true,
        title: getDataContainerTitle(result.data),
        message: "数据库可读取，权限正常。"
      });
    } else {
      databases.push({
        ...target,
        ok: false,
        errorKind: result.errorKind,
        message: result.message,
        diagnostic: result.diagnostic
      });
    }
  }

  const failed = databases.filter((item) => !item.ok);
  return {
    ok: failed.length === 0,
    errorKind: failed[0]?.errorKind,
    message: buildConnectionMessage(user, databases, failed),
    workspaceName: user.workspaceName,
    workspaceBotName: user.name,
    databases,
    diagnostic: failed[0]?.diagnostic
  };
}

export function buildNotionHeaders(settings: Pick<NotionSettings, "token" | "apiVersion">): HeadersInit {
  return {
    Authorization: `Bearer ${settings.token.trim()}`,
    "Content-Type": "application/json",
    "Notion-Version": settings.apiVersion || "2022-06-28"
  };
}

export async function notionRequest<T = unknown>(
  settings: Pick<NotionSettings, "token" | "apiVersion">,
  path: string,
  init: RequestInit & { json?: unknown } = {},
  fetcher: NotionFetch = notionFetch
): Promise<NotionRequestResult<T>> {
  const headers = {
    ...buildNotionHeaders(settings),
    ...(init.headers || {})
  };
  const requestInit: RequestInit = {
    ...init,
    headers,
    body: init.json === undefined ? init.body : JSON.stringify(init.json)
  };
  delete (requestInit as RequestInit & { json?: unknown }).json;
  const requestUrl = buildNotionRequestUrl(path);
  const startedAt = nowMs();

  try {
    const response = await fetcher(requestUrl, requestInit);
    let data: unknown = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const errorMessage = getApiMessage(data) || `HTTP ${response.status}`;
      const diagnostic = buildNotionRequestDiagnostic(path, requestUrl, requestInit, {
        durationMs: elapsedMs(startedAt),
        status: response.status,
        errorName: "NotionHttpError",
        errorMessage,
        hint: getHttpDiagnosticHint(response.status)
      });
      console.warn("Notion request failed", diagnostic);
      return {
        ok: false,
        status: response.status,
        data,
        diagnostic,
        ...getConnectionErrorMessage(response.status, data)
      };
    }

    return {
      ok: true,
      status: response.status,
      data: data as T
    };
  } catch (error) {
    const errorDetail = normalizeErrorDetail(error);
    const diagnostic = buildNotionRequestDiagnostic(path, requestUrl, requestInit, {
      durationMs: elapsedMs(startedAt),
      errorName: errorDetail.name,
      errorMessage: errorDetail.message,
      errorStack: errorDetail.stack,
      hint: getNetworkDiagnosticHint()
    });
    console.warn("Notion request failed", diagnostic);
    return {
      ok: false,
      errorKind: "network",
      message: errorDetail.message ? `网络请求失败：${errorDetail.message}` : "网络请求失败，请检查当前网络或稍后重试。",
      diagnostic
    };
  }
}

export function getNotionRuntimeInfo(): NotionRuntimeInfo {
  const native = getIsNativePlatform();
  const devProxy = shouldUseNotionDevProxy();
  if (native) {
    return {
      platform: getRuntimePlatform(native),
      native,
      transport: "capacitor-http",
      apiBase: NOTION_API_BASE,
      corsRisk: false,
      detail: "Android 真机会通过 Capacitor 原生网络请求访问 Notion API。"
    };
  }
  if (devProxy) {
    return {
      platform: getRuntimePlatform(native),
      native,
      transport: "vite-proxy",
      apiBase: NOTION_DEV_PROXY_BASE,
      corsRisk: false,
      detail: "Web 测试会通过本地 Vite 代理访问 Notion API，避免浏览器 CORS 拦截。"
    };
  }
  return {
    platform: getRuntimePlatform(native),
    native,
    transport: "browser-fetch",
    apiBase: NOTION_API_BASE,
    corsRisk: true,
    detail: "当前 Web 环境会直连 Notion API，浏览器可能因为 CORS 拦截导致请求失败。"
  };
}

export async function probeNotionDataTarget(
  settings: Pick<NotionSettings, "token" | "apiVersion">,
  targetId: string,
  fetcher: NotionFetch = notionFetch
): Promise<NotionRequestResult> {
  const id = normalizeNotionId(targetId);
  return notionRequest(settings, `/databases/${encodeURIComponent(id)}`, { method: "GET" }, fetcher);
}

export async function createLifeLogNotionDatabases(
  settings: NotionSettings,
  fetcher: NotionFetch = notionFetch
): Promise<NotionAutoCreateResult> {
  const token = settings.token.trim();
  const parentPageId = normalizeNotionId(settings.parentPageId);
  if (!token) {
    return {
      ok: false,
      message: "请先填写 Notion Token。",
      settingsPatch: {},
      databases: []
    };
  }
  if (!parentPageId) {
    return {
      ok: false,
      message: "请填写一个已分享给 Integration 的 Notion 父页面 ID。",
      settingsPatch: {},
      databases: []
    };
  }

  const pageCheck = await notionRequest(settings, `/pages/${encodeURIComponent(parentPageId)}`, { method: "GET" }, fetcher);
  if (!pageCheck.ok) {
    return {
      ok: false,
      message: pageCheck.errorKind === "not-found"
        ? "父页面不可读取，请确认页面已经分享给这个 Integration。"
        : pageCheck.message,
      settingsPatch: {},
      databases: [],
      diagnostic: pageCheck.diagnostic
    };
  }

  const definitions = buildLifeLogDatabaseDefinitions();
  const results: NotionDatabaseCreateResult[] = [];
  const patch: Partial<NotionSettings> = {};

  for (const definition of definitions) {
    const existingId = normalizeNotionId(String(settings[definition.settingKey] || ""));
    if (existingId) {
      results.push({
        key: definition.key,
        label: definition.label,
        ok: true,
        databaseId: existingId,
        title: definition.title,
        message: "已存在，跳过创建。"
      });
      continue;
    }

    const response = await notionRequest<{ id?: string }>(
      settings,
      "/databases",
      {
        method: "POST",
        json: {
          parent: { type: "page_id", page_id: parentPageId },
          title: [{ type: "text", text: { content: definition.title } }],
          properties: definition.properties
        }
      },
      fetcher
    );

    if (!response.ok) {
      results.push({
        key: definition.key,
        label: definition.label,
        ok: false,
        title: definition.title,
        message: response.message,
        errorKind: response.errorKind,
        diagnostic: response.diagnostic
      });
      continue;
    }

    const databaseId = normalizeNotionId(String(response.data.id || ""));
    patch[definition.settingKey] = databaseId;
    results.push({
      key: definition.key,
      label: definition.label,
      ok: true,
      databaseId,
      title: definition.title,
      message: "已创建。"
    });
  }

  const failed = results.filter((item) => !item.ok);
  return {
    ok: failed.length === 0,
    message: failed.length
      ? `已创建 ${results.length - failed.length} 个数据库，失败 ${failed.length} 个。`
      : "LifeLog Notion 数据库已准备好。",
    settingsPatch: {
      ...patch,
      parentPageId,
      enabled: failed.length === 0
    },
    databases: results,
    diagnostic: failed[0]?.diagnostic
  };
}

export async function checkLifeLogNotionDatabaseSchemas(
  settings: NotionSettings,
  fetcher: NotionFetch = notionFetch
): Promise<NotionSchemaCheckResult> {
  const token = settings.token.trim();
  if (!token) {
    return {
      ok: false,
      repairable: false,
      message: "请先填写 Notion Token。",
      databases: []
    };
  }

  const databases: NotionDatabaseSchemaCheck[] = [];
  for (const definition of buildLifeLogDatabaseDefinitions()) {
    const databaseId = normalizeNotionId(String(settings[definition.settingKey] || ""));
    if (!databaseId) {
      databases.push({
        key: definition.key,
        label: definition.label,
        databaseId: "",
        configured: false,
        ok: false,
        repairable: false,
        message: "未配置数据库 ID。",
        missing: [],
        conflicts: []
      });
      continue;
    }

    const result = await probeNotionDataTarget(settings, databaseId, fetcher);
    if (!result.ok) {
      databases.push({
        key: definition.key,
        label: definition.label,
        databaseId,
        configured: true,
        ok: false,
        repairable: false,
        message: result.message,
        missing: [],
        conflicts: [],
        errorKind: result.errorKind,
        diagnostic: result.diagnostic
      });
      continue;
    }

    databases.push(buildSchemaCheckFromDatabase(definition, databaseId, result.data));
  }

  const failed = databases.filter((item) => !item.ok);
  const repairable = databases.some((item) => item.repairable);
  return {
    ok: failed.length === 0,
    repairable,
    message: buildSchemaCheckMessage(databases),
    databases,
    diagnostic: failed.find((item) => item.diagnostic)?.diagnostic
  };
}

export async function repairLifeLogNotionDatabaseSchemas(
  settings: NotionSettings,
  fetcher: NotionFetch = notionFetch
): Promise<NotionSchemaRepairResult> {
  const before = await checkLifeLogNotionDatabaseSchemas(settings, fetcher);
  if (!before.databases.length) {
    return {
      ok: false,
      repaired: 0,
      message: before.message,
      databases: before.databases,
      diagnostic: before.diagnostic
    };
  }

  let repaired = 0;
  let diagnostic = before.diagnostic;
  const definitions = buildLifeLogDatabaseDefinitions();

  for (const database of before.databases) {
    if (!database.repairable || !database.missing.length) continue;
    const definition = definitions.find((item) => item.key === database.key);
    if (!definition) continue;

    const properties = Object.fromEntries(
      database.missing
        .map((issue) => [issue.propertyName, definition.properties[issue.propertyName]])
        .filter(([, schema]) => Boolean(schema))
    );
    if (!Object.keys(properties).length) continue;

    const response = await notionRequest(
      settings,
      `/databases/${encodeURIComponent(database.databaseId)}`,
      {
        method: "PATCH",
        json: { properties }
      },
      fetcher
    );

    if (!response.ok) {
      diagnostic = response.diagnostic || diagnostic;
      return {
        ok: false,
        repaired,
        message: `${database.label}字段补齐失败：${response.message}`,
        databases: before.databases,
        diagnostic
      };
    }
    repaired += database.missing.length;
  }

  const after = await checkLifeLogNotionDatabaseSchemas(settings, fetcher);
  return {
    ok: after.ok,
    repaired,
    message: repaired
      ? after.ok
        ? `已补齐 ${repaired} 个字段，数据库结构正常。`
        : `已补齐 ${repaired} 个字段，仍有项目需要处理。`
      : before.repairable
        ? "没有可自动补齐的字段。"
        : before.message,
    databases: after.databases,
    diagnostic: after.diagnostic || diagnostic
  };
}

export function getConnectionErrorMessage(status: number, body: unknown): {
  errorKind: NotionConnectionErrorKind;
  message: string;
} {
  const apiMessage = getApiMessage(body);
  if (status === 401) {
    return {
      errorKind: "unauthorized",
      message: apiMessage || "Token 无效或已失效，请重新复制 Notion Integration Secret。"
    };
  }
  if (status === 403) {
    return {
      errorKind: "forbidden",
      message: apiMessage || "权限不足，请确认目标页面或数据库已经分享给这个 Integration。"
    };
  }
  if (status === 404) {
    return {
      errorKind: "not-found",
      message: apiMessage || "数据库不存在或没有共享权限，请检查数据库 ID。"
    };
  }
  if (status === 429) {
    return {
      errorKind: "rate-limited",
      message: apiMessage || "Notion 请求过快，请稍后再测试。"
    };
  }
  return {
    errorKind: "unknown",
    message: apiMessage || `Notion 返回异常状态：${status}。`
  };
}

function buildNotionRequestDiagnostic(
  path: string,
  url: string,
  init: RequestInit,
  detail: Partial<Pick<NotionRequestDiagnostic, "durationMs" | "status" | "errorName" | "errorMessage" | "errorStack" | "hint">>
): NotionRequestDiagnostic {
  const runtime = getNotionRuntimeInfo();
  return {
    at: new Date().toISOString(),
    platform: runtime.platform,
    native: runtime.native,
    transport: runtime.transport,
    method: String(init.method || "GET").toUpperCase(),
    path,
    url,
    ...detail,
    errorStack: detail.errorStack ? truncateText(detail.errorStack, 1200) : undefined
  };
}

function buildNotionRequestUrl(path: string) {
  if (shouldUseNotionDevProxy()) return `${NOTION_DEV_PROXY_BASE}${path}`;
  return `${NOTION_API_BASE}${path}`;
}

function normalizeErrorDetail(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name || "Error",
      message: error.message || "",
      stack: error.stack || ""
    };
  }
  if (isRecord(error)) {
    return {
      name: String(error.name || "UnknownError"),
      message: String(error.message || error.error || ""),
      stack: String(error.stack || "")
    };
  }
  return {
    name: "UnknownError",
    message: String(error || ""),
    stack: ""
  };
}

function getHttpDiagnosticHint(status: number) {
  if (status === 401) return "Notion 已返回 401，优先检查 Integration Secret 是否完整、是否复制了新的 Secret。";
  if (status === 403) return "Notion 已返回 403，优先检查目标父页面或数据库是否分享给当前 Integration。";
  if (status === 404) return "Notion 已返回 404，优先检查页面/数据库 ID 是否正确，以及是否已分享给 Integration。";
  if (status === 429) return "Notion 已返回 429，请等待一会儿再重试。";
  return "请求已到达 Notion，但返回了异常状态；可以复制诊断继续排查。";
}

function getNetworkDiagnosticHint() {
  if (getIsNativePlatform()) {
    return "Android 原生网络请求失败，可能是网络、DNS、代理、证书或 Notion API 可达性问题。";
  }
  if (shouldUseNotionDevProxy()) {
    return "Web 开发环境已走本地 Notion 代理；如果仍失败，请检查 Vite dev server 是否已重启，以及本机是否能访问 api.notion.com。";
  }
  return "Web 端直连 Notion API 很可能被浏览器 CORS 拦截；请优先用 Android 真机测试，或后续接代理/OAuth。";
}

function shouldUseNotionDevProxy() {
  if (getIsNativePlatform()) return false;
  try {
    return typeof __NOTION_DEV_PROXY__ !== "undefined" && __NOTION_DEV_PROXY__;
  } catch {
    return false;
  }
}

function getIsNativePlatform() {
  try {
    return typeof Capacitor.isNativePlatform === "function" && Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function getRuntimePlatform(native: boolean) {
  try {
    const capacitor = Capacitor as typeof Capacitor & { getPlatform?: () => string };
    if (typeof capacitor.getPlatform === "function") return capacitor.getPlatform();
  } catch {
    // Ignore platform probe failures; the request diagnostic still has native/web.
  }
  if (typeof navigator !== "undefined") return navigator.platform || "web";
  return native ? "native" : "node";
}

function truncateText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function nowMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") return performance.now();
  return Date.now();
}

function elapsedMs(startedAt: number) {
  return Math.max(0, Math.round(nowMs() - startedAt));
}

function getConfiguredDatabases(settings: NotionSettings): NotionDatabaseTarget[] {
  const targets: NotionDatabaseTarget[] = [
    { key: "people", label: "人物", databaseId: settings.peopleDatabaseId },
    { key: "places", label: "地点", databaseId: settings.placesDatabaseId },
    { key: "memories", label: "回忆", databaseId: settings.memoriesDatabaseId },
    { key: "plans", label: "纪念日安排", databaseId: settings.plansDatabaseId }
  ];

  return targets
    .map((item) => ({ ...item, databaseId: normalizeNotionId(item.databaseId) }))
    .filter((item) => item.databaseId);
}

function buildLifeLogDatabaseDefinitions(): Array<{
  key: NotionDatabaseProbe["key"];
  label: string;
  title: string;
  settingKey: "peopleDatabaseId" | "placesDatabaseId" | "memoriesDatabaseId" | "plansDatabaseId";
  properties: Record<string, unknown>;
}> {
  return [
    {
      key: "people",
      label: "人物",
      title: "LifeLog 人物",
      settingKey: "peopleDatabaseId",
      properties: {
        名称: titleSchema(),
        "LifeLog ID": richTextSchema(),
        关系: selectSchema(),
        生日: dateSchema(),
        重点关注: checkboxSchema(),
        喜好档案: richTextSchema(),
        禁忌雷区: richTextSchema(),
        备注: richTextSchema(),
        更新时间: dateSchema()
      }
    },
    {
      key: "places",
      label: "地点",
      title: "LifeLog 地点",
      settingKey: "placesDatabaseId",
      properties: {
        名称: titleSchema(),
        "LifeLog ID": richTextSchema(),
        分类: selectSchema(),
        城市: richTextSchema(),
        区域: richTextSchema(),
        商场: richTextSchema(),
        门店名: richTextSchema(),
        评分: numberSchema(),
        地址: richTextSchema(),
        地图链接: urlSchema(),
        标签: multiSelectSchema(),
        收藏: checkboxSchema(),
        更新时间: dateSchema()
      }
    },
    {
      key: "memories",
      label: "回忆",
      title: "LifeLog 回忆",
      settingKey: "memoriesDatabaseId",
      properties: {
        标题: titleSchema(),
        "LifeLog ID": richTextSchema(),
        日期: dateSchema(),
        心情: selectSchema(),
        内容: richTextSchema(),
        关联人物: richTextSchema(),
        关联地点: richTextSchema(),
        标签: multiSelectSchema(),
        照片数量: numberSchema(),
        更新时间: dateSchema()
      }
    },
    {
      key: "plans",
      label: "纪念日安排",
      title: "LifeLog 纪念日安排",
      settingKey: "plansDatabaseId",
      properties: {
        标题: titleSchema(),
        "LifeLog ID": richTextSchema(),
        人物: richTextSchema(),
        纪念日: richTextSchema(),
        目标日期: dateSchema(),
        状态: selectSchema(),
        预算: richTextSchema(),
        清单: richTextSchema(),
        地点: richTextSchema(),
        关联回忆: richTextSchema(),
        备注: richTextSchema(),
        更新时间: dateSchema()
      }
    }
  ];
}

function buildSchemaCheckFromDatabase(
  definition: ReturnType<typeof buildLifeLogDatabaseDefinitions>[number],
  databaseId: string,
  data: unknown
): NotionDatabaseSchemaCheck {
  const properties = getDatabaseProperties(data);
  const missing: NotionDatabaseSchemaIssue[] = [];
  const conflicts: NotionDatabaseSchemaIssue[] = [];

  Object.entries(definition.properties).forEach(([propertyName, schema]) => {
    const expectedType = getSchemaPropertyType(schema);
    const actualType = getExistingPropertyType(properties[propertyName]);
    if (!expectedType) return;
    if (!actualType) {
      missing.push({
        kind: "missing",
        propertyName,
        expectedType
      });
      return;
    }
    if (actualType !== expectedType) {
      conflicts.push({
        kind: "conflict",
        propertyName,
        expectedType,
        actualType
      });
    }
  });

  const ok = missing.length === 0 && conflicts.length === 0;
  return {
    key: definition.key,
    label: definition.label,
    databaseId,
    configured: true,
    ok,
    repairable: missing.length > 0,
    title: getDataContainerTitle(data),
    message: ok
      ? "字段完整。"
      : conflicts.length
        ? `缺少 ${missing.length} 个字段，${conflicts.length} 个字段类型不一致。`
        : `缺少 ${missing.length} 个字段，可一键补齐。`,
    missing,
    conflicts
  };
}

function getDatabaseProperties(data: unknown): Record<string, unknown> {
  if (!isRecord(data) || !isRecord(data.properties)) return {};
  return data.properties;
}

function getSchemaPropertyType(schema: unknown) {
  if (!isRecord(schema)) return "";
  return Object.keys(schema)[0] || "";
}

function getExistingPropertyType(property: unknown) {
  if (!isRecord(property)) return "";
  return String(property.type || "");
}

function buildSchemaCheckMessage(databases: NotionDatabaseSchemaCheck[]) {
  if (!databases.length) return "请先填写 Notion Token。";
  const unconfigured = databases.filter((item) => !item.configured).length;
  const unreadable = databases.filter((item) => item.configured && item.errorKind).length;
  const missing = databases.reduce((sum, item) => sum + item.missing.length, 0);
  const conflicts = databases.reduce((sum, item) => sum + item.conflicts.length, 0);

  if (!unconfigured && !unreadable && !missing && !conflicts) return "4 个 Notion 数据库字段结构正常。";
  if (conflicts) return `发现 ${conflicts} 个字段类型冲突，需要在 Notion 手动处理或重新建库。`;
  if (missing) return `发现 ${missing} 个缺失字段，可以一键补齐。`;
  if (unreadable) return `${unreadable} 个数据库不可读取，请先检查权限。`;
  return `${unconfigured} 个数据库尚未配置。`;
}

function titleSchema() {
  return { title: {} };
}

function richTextSchema() {
  return { rich_text: {} };
}

function selectSchema() {
  return { select: {} };
}

function multiSelectSchema() {
  return { multi_select: {} };
}

function dateSchema() {
  return { date: {} };
}

function checkboxSchema() {
  return { checkbox: {} };
}

function numberSchema() {
  return { number: { format: "number" } };
}

function urlSchema() {
  return { url: {} };
}

async function notionFetch(input: string, init: RequestInit): Promise<NotionFetchResponseLike> {
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.request({
      url: input,
      method: init.method || "GET",
      headers: headersToRecord(init.headers),
      data: init.body ? parseRequestBody(init.body) : undefined,
      responseType: "json"
    });
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      async json() {
        return response.data;
      }
    };
  }

  return fetch(input, init);
}

function headersToRecord(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return headers as Record<string, string>;
}

function parseRequestBody(body: BodyInit) {
  if (typeof body !== "string") return body;
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

function normalizeNotionUser(data: unknown) {
  const record = isRecord(data) ? data : {};
  const bot = isRecord(record.bot) ? record.bot : {};
  return {
    name: String(record.name || "Notion Integration"),
    workspaceName: String(bot.workspace_name || "")
  };
}

function getDataContainerTitle(data: unknown) {
  if (!isRecord(data) || !Array.isArray(data.title)) return "";
  return data.title
    .map((item) => {
      if (!isRecord(item)) return "";
      if (isRecord(item.text)) return String(item.text.content || "");
      return String(item.plain_text || "");
    })
    .filter(Boolean)
    .join("");
}

function buildConnectionMessage(
  user: { name: string; workspaceName: string },
  databases: NotionDatabaseProbe[],
  failed: NotionDatabaseProbe[]
) {
  if (!databases.length) {
    return `Token 可用，已连接${user.workspaceName ? `到 ${user.workspaceName}` : "到 Notion"}。继续填写数据库 ID 后可测试权限。`;
  }
  if (!failed.length) {
    return `连接成功，${databases.length} 个数据库都可以读取。`;
  }
  return `Token 可用，但 ${failed.length}/${databases.length} 个数据库不可读取：${failed.map((item) => item.label).join("、")}。`;
}

function getApiMessage(body: unknown) {
  if (!isRecord(body)) return "";
  return String(body.message || "").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
