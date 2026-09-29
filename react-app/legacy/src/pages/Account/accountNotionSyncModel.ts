import type { LifeLogState, NotionEntityType, NotionPageMapping, NotionSettings, NotionSyncHistoryEntry, NotionSyncQueueItem } from "../../types";
import { normalizeNotionId } from "../../utils/notionIds";
import {
  checkLifeLogNotionDatabaseSchemas,
  createLifeLogNotionDatabases,
  getNotionRuntimeInfo,
  repairLifeLogNotionDatabaseSchemas,
  testNotionConnection,
  type NotionAutoCreateResult,
  type NotionConnectionResult,
  type NotionRequestDiagnostic,
  type NotionRuntimeInfo,
  type NotionSchemaCheckResult,
  type NotionSchemaRepairResult
} from "../../utils/notionClient";
import type { NotionSyncSummary, NotionSyncTarget, NotionSyncTypeSummary } from "../../utils/notionSync";

export type DatabaseField = "peopleDatabaseId" | "placesDatabaseId" | "memoriesDatabaseId" | "plansDatabaseId";
export type SetupStepId = "integration" | "parent" | "database" | "test";
export type NotionPanelKey = "connection" | "sync" | "queue" | "history" | "advanced";
export type SetupStepState = "done" | "current" | "waiting" | "failed";
export type SetupPrimaryAction = "focus-token" | "focus-parent" | "create-databases" | "test-connection";
export type PreflightTone = "ok" | "warning" | "blocked" | "idle";
export type SyncPreviewTone = "ready" | "missing" | "empty";

export interface SetupStep {
  id: SetupStepId;
  index: string;
  title: string;
  desc: string;
  state: SetupStepState;
  actionLabel?: string;
  actionUrl?: string;
}

export interface SetupState {
  tone: "idle" | "connected" | "failed";
  badge: string;
  title: string;
  desc: string;
  primaryLabel: string;
  primaryAction: SetupPrimaryAction;
  primaryDisabled: boolean;
  primaryBusy: boolean;
  currentStepId: SetupStepId;
  steps: SetupStep[];
}

export interface NotionPreflightItem {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: PreflightTone;
}

export interface NotionSyncPreviewItem {
  entityType: NotionEntityType;
  label: string;
  databaseLabel: string;
  total: number;
  detail?: string;
  modeDetail?: string;
  mapped: number;
  pending: number;
  databaseId: string;
  tone: SyncPreviewTone;
}

export const databaseFields: Array<{ key: DatabaseField; label: string; placeholder: string }> = [
  { key: "peopleDatabaseId", label: "人物数据库", placeholder: "People database ID" },
  { key: "placesDatabaseId", label: "地点数据库", placeholder: "Places database ID" },
  { key: "memoriesDatabaseId", label: "记录数据库", placeholder: "Records database ID" },
  { key: "plansDatabaseId", label: "安排数据库", placeholder: "Plans database ID" }
];

export const NOTION_INTEGRATIONS_URL = "https://www.notion.so/profile/integrations";
export const NOTION_HOME_URL = "https://www.notion.so";

export function getNotionStatus(settings: NotionSettings, lastResult: NotionConnectionResult | null) {
  if (lastResult) {
    return {
      tone: lastResult.ok ? "connected" : "failed",
      title: lastResult.ok ? "Notion 已连接" : "Notion 连接失败",
      desc: lastResult.message
    } as const;
  }

  if (settings.lastConnectionStatus === "connected") {
    const workspace = settings.workspaceName || settings.workspaceBotName || "Notion";
    return {
      tone: "connected",
      title: "Notion 已连接",
      desc: `${workspace}${settings.lastConnectionTestAt ? ` · ${formatTestTime(settings.lastConnectionTestAt)}` : ""}`
    } as const;
  }

  if (settings.lastConnectionStatus === "failed") {
    return {
      tone: "failed",
      title: "上次连接失败",
      desc: settings.lastConnectionMessage || "请重新测试 Token 和数据库权限。"
    } as const;
  }

  if (settings.token) {
    return {
      tone: "idle",
      title: "Notion 配置待测试",
      desc: "Token 已填写，继续填写父页面 ID 后可自动创建数据库。"
    } as const;
  }

  return {
    tone: "idle",
    title: "连接 Notion",
    desc: "填写 Token 和父页面 ID 后，一键创建数据库并开始同步。"
  } as const;
}

export function buildNotionSetupState({
  settings,
  lastResult,
  lastCreate,
  isCreating,
  isTesting
}: {
  settings: NotionSettings;
  lastResult: NotionConnectionResult | null;
  lastCreate: NotionAutoCreateResult | null;
  isCreating: boolean;
  isTesting: boolean;
}): SetupState {
  const hasToken = Boolean(settings.token.trim());
  const hasParentPage = Boolean(normalizeNotionId(settings.parentPageId));
  const databaseCount = countConfiguredDatabases(settings);
  const hasAllDatabases = databaseCount === databaseFields.length;
  const createFailed = Boolean(lastCreate && !lastCreate.ok);
  const testFailed = Boolean(lastResult && !lastResult.ok);
  const testPassed = Boolean(lastResult?.ok || settings.lastConnectionStatus === "connected");
  const currentStep = !hasToken
    ? "token"
    : !hasParentPage
      ? "parent"
      : !hasAllDatabases
        ? "database"
        : !testPassed
          ? "test"
          : "done";
  const currentStepId: SetupStepId = currentStep === "token" ? "integration" : currentStep === "parent" ? "parent" : currentStep === "database" ? "database" : "test";

  const steps: SetupStep[] = [
    {
      id: "integration",
      index: "1",
      title: "创建 Integration",
      desc: hasToken ? "Token 已填写。" : "打开 Notion 集成页面，新建 Internal Integration，并复制 Secret。",
      state: hasToken ? "done" : currentStep === "token" ? "current" : "waiting",
      actionLabel: hasToken ? undefined : "打开",
      actionUrl: hasToken ? undefined : NOTION_INTEGRATIONS_URL
    },
    {
      id: "parent",
      index: "2",
      title: "准备父页面",
      desc: hasParentPage ? "父页面已填写。" : "在 Notion 新建空页面，把页面分享给刚创建的 Integration，再复制页面链接。",
      state: hasParentPage ? "done" : currentStep === "parent" ? "current" : "waiting",
      actionLabel: hasParentPage ? undefined : "打开",
      actionUrl: hasParentPage ? undefined : NOTION_HOME_URL
    },
    {
      id: "database",
      index: "3",
      title: "自动创建数据库",
      desc: hasAllDatabases
        ? `4 个数据库已配置。`
        : databaseCount
          ? `已配置 ${databaseCount}/4 个数据库，建议继续自动补齐。`
          : "LifeLog 会在父页面下创建人物、地点、记录和纪念日安排数据库。",
      state: hasAllDatabases ? "done" : createFailed ? "failed" : currentStep === "database" ? "current" : "waiting"
    },
    {
      id: "test",
      index: "4",
      title: "测试连接",
      desc: testPassed ? "连接可用，可以开始同步。" : testFailed ? lastResult?.message || "连接失败，请按诊断修正。" : "确认 Token、页面和数据库权限都可读取。",
      state: testPassed ? "done" : testFailed ? "failed" : currentStep === "test" ? "current" : "waiting"
    }
  ];

  if (!hasToken) {
    return {
      tone: "idle",
      badge: "第 1 步",
      title: "先填写 Notion Token",
      desc: "点击打开 Notion 集成页面，复制 Internal Integration Secret 后粘贴到下方。",
      primaryLabel: "填写 Token",
      primaryAction: "focus-token",
      primaryDisabled: false,
      primaryBusy: false,
      currentStepId,
      steps
    };
  }

  if (!hasParentPage) {
    return {
      tone: "idle",
      badge: "第 2 步",
      title: "填写 Notion 父页面",
      desc: "把一个空页面分享给 Integration，然后粘贴页面链接。数据库会自动建在这个页面下。",
      primaryLabel: "填写父页面",
      primaryAction: "focus-parent",
      primaryDisabled: false,
      primaryBusy: false,
      currentStepId,
      steps
    };
  }

  if (!hasAllDatabases) {
    return {
      tone: createFailed ? "failed" : "idle",
      badge: "第 3 步",
      title: createFailed ? "自动创建失败" : "自动创建 Notion 数据库",
      desc: createFailed
        ? lastCreate?.message || "请检查父页面是否已分享给 Integration。"
        : "不需要在 Notion 手动建表，点击后会生成中文字段数据库并保存 ID。",
      primaryLabel: isCreating ? "创建中" : "自动创建",
      primaryAction: "create-databases",
      primaryDisabled: isCreating,
      primaryBusy: isCreating,
      currentStepId,
      steps
    };
  }

  if (!testPassed) {
    return {
      tone: testFailed ? "failed" : "idle",
      badge: "第 4 步",
      title: testFailed ? "连接测试未通过" : "测试 Notion 连接",
      desc: testFailed ? lastResult?.message || "请按诊断信息修正权限。" : "确认 Integration、父页面和 4 个数据库都能正常访问。",
      primaryLabel: isTesting ? "测试中" : "测试连接",
      primaryAction: "test-connection",
      primaryDisabled: isTesting,
      primaryBusy: isTesting,
      currentStepId,
      steps
    };
  }

  return {
    tone: "connected",
    badge: "已完成",
    title: "连接已就绪",
    desc: "Token、父页面、数据库和连接测试都已通过。后续同步请在“数据同步”中操作。",
    primaryLabel: "重新测试",
    primaryAction: "test-connection",
    primaryDisabled: isTesting,
    primaryBusy: isTesting,
    currentStepId,
    steps
  };
}

export function countConfiguredDatabases(settings: NotionSettings) {
  return databaseFields.filter((field) => normalizeNotionId(String(settings[field.key] || ""))).length;
}

export function isNotionSetupComplete(settings: NotionSettings) {
  return Boolean(
    settings.token.trim() &&
      normalizeNotionId(settings.parentPageId) &&
      countConfiguredDatabases(settings) === databaseFields.length &&
      settings.lastConnectionStatus === "connected"
  );
}

export function buildNotionPreflight({
  settings,
  lastResult,
  lastDiagnostic,
  runtimeInfo
}: {
  settings: NotionSettings;
  lastResult: NotionConnectionResult | null;
  lastDiagnostic: NotionRequestDiagnostic | null;
  runtimeInfo: NotionRuntimeInfo;
}): NotionPreflightItem[] {
  const token = settings.token.trim();
  const parentPageId = normalizeNotionId(settings.parentPageId);
  const databaseCount = countConfiguredDatabases(settings);
  const tokenLooksValid = isLikelyNotionToken(token);
  const parentLooksValid = isLikelyNotionId(parentPageId);
  const connectionOk = Boolean(lastResult?.ok || settings.lastConnectionStatus === "connected");
  const connectionFailed = Boolean(lastResult && !lastResult.ok);

  return [
    {
      id: "token",
      label: "Token",
      value: token ? (tokenLooksValid ? "已填写" : "格式待确认") : "未填写",
      detail: token
        ? tokenLooksValid
          ? "已识别为 Notion Integration Secret。"
          : "仍可测试，但建议确认是否复制了完整 Secret。"
        : "先复制 Internal Integration Secret。",
      tone: token ? (tokenLooksValid ? "ok" : "warning") : "blocked"
    },
    {
      id: "parent",
      label: "父页面",
      value: parentPageId ? (parentLooksValid ? "已识别" : "格式待确认") : "未填写",
      detail: parentPageId
        ? parentLooksValid
          ? "已提取 32 位页面 ID。"
          : "建议直接粘贴 Notion 页面链接或标准页面 ID。"
        : "需要一个已分享给 Integration 的 Notion 页面。",
      tone: parentPageId ? (parentLooksValid ? "ok" : "warning") : "blocked"
    },
    {
      id: "databases",
      label: "数据库",
      value: `${databaseCount}/4`,
      detail: databaseCount === databaseFields.length
        ? "人物、地点、记录和安排数据库都已配置。"
        : databaseCount
          ? "已部分配置，建议点击自动创建补齐。"
          : "可由 LifeLog 自动创建中文字段数据库。",
      tone: databaseCount === databaseFields.length ? "ok" : databaseCount ? "warning" : "idle"
    },
    {
      id: "connection",
      label: "连接测试",
      value: connectionOk ? "已通过" : connectionFailed ? "未通过" : "待测试",
      detail: connectionOk
        ? "Notion 权限已通过最近一次验证。"
        : connectionFailed
          ? lastResult?.message || "请根据请求诊断修正配置。"
          : "数据库准备好后测试一次，确认权限可用。",
      tone: connectionOk ? "ok" : connectionFailed ? "blocked" : "idle"
    },
    {
      id: "runtime",
      label: "连接环境",
      value: formatNotionTransport(runtimeInfo.transport),
      detail: runtimeInfo.detail,
      tone: runtimeInfo.corsRisk ? "warning" : "ok"
    },
    {
      id: "request",
      label: "最近请求",
      value: lastDiagnostic
        ? lastDiagnostic.status
          ? `HTTP ${lastDiagnostic.status}`
          : lastDiagnostic.durationMs
            ? `${lastDiagnostic.durationMs} ms`
            : "有诊断"
        : "暂无",
      detail: lastDiagnostic
        ? lastDiagnostic.hint || `${lastDiagnostic.method} ${lastDiagnostic.path}`
        : "失败时这里会显示网络层、状态码和排查方向。",
      tone: lastDiagnostic ? "warning" : "idle"
    }
  ];
}

export function buildNotionSyncPreview({
  settings,
  mappings,
  state
}: {
  settings: NotionSettings;
  mappings: NotionPageMapping[];
  state: LifeLogState;
}): NotionSyncPreviewItem[] {
  const mappedByType = countMappingsByType(mappings);
  const definitions: Array<{
    entityType: NotionEntityType;
    label: string;
    databaseLabel: string;
    databaseId: string;
    total: number;
    detail?: string;
    modeDetail?: string;
  }> = [
    {
      entityType: "person",
      label: "人物",
      databaseLabel: "人物数据库",
      databaseId: normalizeNotionId(settings.peopleDatabaseId),
      total: state.people.length
    },
    {
      entityType: "place",
      label: "地点",
      databaseLabel: "地点数据库",
      databaseId: normalizeNotionId(settings.placesDatabaseId),
      total: state.places.length
    },
    {
      entityType: "memory",
      label: "记录",
      databaseLabel: "记录数据库",
      databaseId: normalizeNotionId(settings.memoriesDatabaseId),
      total: state.memories.length,
      detail: formatRecordSyncDetail(state.memories),
      modeDetail: settings.syncPageContent === false ? "仅同步数据库属性" : "同步数据库属性和页面正文"
    },
    {
      entityType: "anniversaryPlan",
      label: "安排",
      databaseLabel: "安排数据库",
      databaseId: normalizeNotionId(settings.plansDatabaseId),
      total: state.anniversaryPlans.length
    }
  ];

  return definitions.map((item) => {
    const mapped = Math.min(mappedByType[item.entityType] || 0, item.total);
    return {
      ...item,
      mapped,
      pending: Math.max(0, item.total - mapped),
      tone: !item.databaseId ? "missing" : item.total ? "ready" : "empty"
    };
  });
}

export function countMappingsByType(mappings: NotionPageMapping[]) {
  return mappings.reduce<Record<NotionEntityType, number>>(
    (acc, mapping) => {
      if (mapping.notionPageId && !mapping.lastError) acc[mapping.entityType] += 1;
      return acc;
    },
    { person: 0, place: 0, memory: 0, anniversaryPlan: 0 }
  );
}

export function formatSyncPreviewSummary(items: NotionSyncPreviewItem[]) {
  const configured = items.filter((item) => item.databaseId).length;
  const total = items.filter((item) => item.databaseId).reduce((sum, item) => sum + item.total, 0);
  const missing = items.length - configured;
  if (!configured) return "还没有配置可同步数据库";
  if (missing) return `${configured}/4 个数据库已配置，预计同步 ${total} 条`;
  return `4 个数据库已配置，预计同步 ${total} 条`;
}

export function formatSyncModeSummary(settings: NotionSettings) {
  return settings.syncPageContent === false
    ? "记录目前只写入 Notion 数据库属性；可在高级配置开启页面正文同步。"
    : "记录会同步到 Notion 数据库属性，并在页面内写入正文、原计划和关联信息。";
}

export function formatSyncPreviewDetail(item: NotionSyncPreviewItem) {
  if (!item.databaseId) return `${item.databaseLabel} 未配置，暂不会同步。`;
  const detail = [item.detail, item.modeDetail].filter(Boolean).join("，");
  const suffix = detail ? `（${detail}）` : "";
  if (!item.total) return "本地暂无内容，配置已就绪。";
  if (!item.mapped) return `${item.total} 条会首次写入 Notion${suffix}。`;
  if (!item.pending) return `${item.mapped} 条已有同步记录，本次会检查更新${suffix}。`;
  return `${item.mapped} 条已有同步记录，${item.pending} 条可能首次写入${suffix}。`;
}

export function formatRecordSyncDetail(memories: LifeLogState["memories"]) {
  const plans = memories.filter((memory) => memory.kind === "plan").length;
  const actual = memories.length - plans;
  if (!memories.length) return "";
  return `${actual} 条回忆，${plans} 条计划`;
}

export function buildTargetsForPreviewItem(item: NotionSyncPreviewItem, state: LifeLogState): NotionSyncTarget[] {
  if (item.entityType === "person") {
    return state.people.map((person) => ({ entityType: "person", entityId: person.id }));
  }
  if (item.entityType === "place") {
    return state.places.map((place) => ({ entityType: "place", entityId: place.id }));
  }
  if (item.entityType === "memory") {
    return state.memories.map((memory) => ({ entityType: "memory", entityId: memory.id }));
  }
  return state.anniversaryPlans.map((plan) => ({ entityType: "anniversaryPlan", entityId: plan.id }));
}

export function formatSyncTypeSummary(summary: NotionSyncTypeSummary | undefined) {
  if (!summary || !summary.total) return "无同步内容";
  if (summary.failed) return `成功 ${summary.synced}，失败 ${summary.failed}`;
  return `新增 ${summary.created}，更新 ${summary.updated}，跳过 ${summary.skipped}`;
}

export function formatFailedItemHint(message: string) {
  if (/Failed to fetch|NetworkError|CORS/i.test(message)) return `${message}。建议在 Android 真机或代理环境下重试。`;
  if (/401|unauthorized|token/i.test(message)) return `${message}。请检查 Token 是否完整、是否已保存最新配置。`;
  if (/403|permission|share/i.test(message)) return `${message}。请确认父页面和数据库已分享给 Integration。`;
  if (/404|not found|database/i.test(message)) return `${message}。请检查数据库 ID，或重新自动创建数据库。`;
  return message;
}

export function formatLastSyncTitle(summary: NotionSyncSummary) {
  if (!summary.total && summary.failed) return "同步未开始";
  if (summary.failed) return `同步完成，${summary.failed} 条失败`;
  if (!summary.synced && summary.skipped) return "已是最新";
  return "同步成功";
}

export function formatLastSyncSubtitle(summary: NotionSyncSummary) {
  return [
    summary.created ? `新增 ${summary.created}` : "",
    summary.updated ? `更新 ${summary.updated}` : "",
    summary.skipped ? `跳过 ${summary.skipped}` : "",
    summary.failed ? `失败 ${summary.failed}` : ""
  ].filter(Boolean).join(" · ") || "没有需要同步的内容";
}

export function buildRetryEntryFromSummary(summary: NotionSyncSummary): NotionSyncHistoryEntry {
  const now = new Date().toISOString();
  return {
    id: `last-sync-${now}`,
    startedAt: now,
    finishedAt: now,
    trigger: "retry",
    status: summary.failed ? "partial" : "success",
    targetLabel: "重试失败项",
    total: summary.total,
    synced: summary.synced,
    created: summary.created,
    updated: summary.updated,
    skipped: summary.skipped,
    failed: summary.failed,
    byType: summary.byType,
    messages: summary.messages,
    failedItems: summary.failedItems
  };
}

export function formatHistoryTitle(entry: NotionSyncHistoryEntry) {
  const triggerLabel = entry.trigger === "retry" ? "重试失败项" : entry.trigger === "single" ? "单条同步" : "同步全部";
  const statusLabel = entry.status === "success" ? "成功" : entry.status === "partial" ? "部分成功" : "失败";
  return `${entry.targetLabel || triggerLabel} · ${statusLabel}`;
}

export function formatNotionQueueSummary(items: NotionSyncQueueItem[]) {
  const failed = items.filter((item) => item.status === "failed").length;
  const syncing = items.filter((item) => item.status === "syncing").length;
  const pending = items.filter((item) => item.status === "pending").length;
  return [
    pending ? `${pending} 条待同步` : "",
    syncing ? `${syncing} 条同步中` : "",
    failed ? `${failed} 条失败待重试` : ""
  ].filter(Boolean).join(" · ") || "队列为空";
}

export function formatNotionQueueItemMeta(item: NotionSyncQueueItem) {
  const statusLabel = item.status === "failed" ? "失败待重试" : item.status === "syncing" ? "同步中" : "待同步";
  const attemptLabel = item.attempts ? `第 ${item.attempts} 次尝试` : "尚未尝试";
  return `${statusLabel} · ${attemptLabel} · ${formatTestTime(item.updatedAt)}`;
}

export function summarizePreflight(items: NotionPreflightItem[]) {
  const blocked = items.filter((item) => item.tone === "blocked").length;
  const warning = items.filter((item) => item.tone === "warning").length;
  if (blocked) return `${blocked} 项需要处理`;
  if (warning) return `${warning} 项建议确认`;
  return "连接条件正常";
}

export function isLikelyNotionToken(value: string) {
  if (!value) return false;
  return /^(secret|ntn)_[\w-]{12,}$/i.test(value);
}

export function isLikelyNotionId(value: string) {
  return /^[0-9a-f]{32}$/i.test(value);
}

export function extractConnectionDiagnostic(result: NotionConnectionResult) {
  if (result.ok) return null;
  return result.diagnostic || result.databases.find((item) => !item.ok && item.diagnostic)?.diagnostic || null;
}

export function extractCreateDiagnostic(result: NotionAutoCreateResult) {
  if (result.ok) return null;
  return result.diagnostic || result.databases.find((item) => !item.ok && item.diagnostic)?.diagnostic || null;
}

export function extractSchemaDiagnostic(result: NotionSchemaCheckResult | NotionSchemaRepairResult) {
  if (result.ok) return null;
  return result.diagnostic || result.databases.find((item) => !item.ok && item.diagnostic)?.diagnostic || null;
}

export function formatSchemaCheckValue(item: NotionSchemaCheckResult["databases"][number]) {
  if (!item.configured) return "未配置";
  if (item.errorKind) return "不可读取";
  if (item.ok) return "字段完整";
  if (item.conflicts.length) return `${item.conflicts.length} 个冲突`;
  if (item.missing.length) return `${item.missing.length} 个缺失`;
  return "待确认";
}

export function formatSchemaCheckDetail(item: NotionSchemaCheckResult["databases"][number]) {
  if (!item.configured) return "请先自动创建或手动填写数据库 ID。";
  if (item.errorKind) return item.message;
  if (item.ok) return item.title ? `${item.title} 可正常同步。` : "字段结构符合 LifeLog 同步要求。";
  if (item.conflicts.length) {
    const names = item.conflicts.slice(0, 3).map((issue) => `${issue.propertyName} 应为 ${issue.expectedType}`).join("、");
    return `${names}${item.conflicts.length > 3 ? " 等" : ""}；需在 Notion 手动处理。`;
  }
  if (item.missing.length) {
    const names = item.missing.slice(0, 4).map((issue) => issue.propertyName).join("、");
    return `缺少 ${names}${item.missing.length > 4 ? " 等字段" : ""}，可自动补齐。`;
  }
  return item.message;
}

export function formatNotionDiagnostic(diagnostic: NotionRequestDiagnostic) {
  return [
    "LifeLog Notion 请求诊断",
    "",
    `时间：${diagnostic.at}`,
    `平台：${diagnostic.platform}${diagnostic.native ? "（原生）" : "（Web）"}`,
    `传输：${formatNotionTransport(diagnostic.transport)}`,
    `请求：${diagnostic.method} ${diagnostic.path}`,
    `地址：${diagnostic.url}`,
    typeof diagnostic.durationMs === "number" ? `耗时：${diagnostic.durationMs} ms` : "",
    diagnostic.status ? `状态：HTTP ${diagnostic.status}` : "",
    diagnostic.errorName ? `错误类型：${diagnostic.errorName}` : "",
    diagnostic.errorMessage ? `错误消息：${diagnostic.errorMessage}` : "",
    diagnostic.hint ? `提示：${diagnostic.hint}` : "",
    diagnostic.errorStack ? ["", "Stack:", diagnostic.errorStack].join("\n") : ""
  ].filter(Boolean).join("\n");
}

export function formatNotionTransport(transport: NotionRuntimeInfo["transport"]) {
  if (transport === "capacitor-http") return "Android 原生";
  if (transport === "vite-proxy") return "Web 代理";
  return "Web 直连";
}

export function formatTestTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}
