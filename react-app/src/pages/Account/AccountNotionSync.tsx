import { AlertCircle, CheckCircle2, ChevronDown, Cloud, Copy, Database, ExternalLink, Eye, EyeOff, KeyRound, RefreshCw, Trash2, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import GlassCard from "../../components/GlassCard";
import { useLifeLog } from "../../context/LifeLogContext";
import { useToast } from "../../context/ToastContext";
import type { LifeLogState, NotionEntityType, NotionPageMapping, NotionSettings, NotionSyncHistoryEntry, NotionSyncQueueItem } from "../../types";
import { copyTextToClipboard } from "../../utils/diagnostics";
import { openExternalUrl } from "../../utils/externalLinks";
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

type DatabaseField = "peopleDatabaseId" | "placesDatabaseId" | "memoriesDatabaseId" | "plansDatabaseId";
type SetupStepId = "integration" | "parent" | "database" | "test";
type NotionPanelKey = "connection" | "sync" | "queue" | "history" | "advanced";
type SetupStepState = "done" | "current" | "waiting" | "failed";
type SetupPrimaryAction = "focus-token" | "focus-parent" | "create-databases" | "test-connection";
type PreflightTone = "ok" | "warning" | "blocked" | "idle";
type SyncPreviewTone = "ready" | "missing" | "empty";

interface SetupStep {
  id: SetupStepId;
  index: string;
  title: string;
  desc: string;
  state: SetupStepState;
  actionLabel?: string;
  actionUrl?: string;
}

interface SetupState {
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

interface NotionPreflightItem {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: PreflightTone;
}

interface NotionSyncPreviewItem {
  entityType: NotionEntityType;
  label: string;
  databaseLabel: string;
  total: number;
  mapped: number;
  pending: number;
  databaseId: string;
  tone: SyncPreviewTone;
}

const databaseFields: Array<{ key: DatabaseField; label: string; placeholder: string }> = [
  { key: "peopleDatabaseId", label: "人物数据库", placeholder: "People database ID" },
  { key: "placesDatabaseId", label: "地点数据库", placeholder: "Places database ID" },
  { key: "memoriesDatabaseId", label: "回忆数据库", placeholder: "Memories database ID" },
  { key: "plansDatabaseId", label: "安排数据库", placeholder: "Plans database ID" }
];

const NOTION_INTEGRATIONS_URL = "https://www.notion.so/profile/integrations";
const NOTION_HOME_URL = "https://www.notion.so";

export default function AccountNotionSync() {
  const { state, notionSettings, notionPageMappings, notionSyncHistory, notionSyncQueue, updateNotionSettings, syncNotionAll, syncNotionTargets, retryFailedNotionItems, retryNotionQueueItems } = useLifeLog();
  const notify = useToast();
  const [draft, setDraft] = useState(notionSettings);
  const [showToken, setShowToken] = useState(false);
  const initialConnectionOpen = !isNotionSetupComplete(notionSettings);
  const [activeSetupStep, setActiveSetupStep] = useState<SetupStepId | null>(null);
  const [openPanels, setOpenPanels] = useState<Record<NotionPanelKey, boolean>>({
    connection: initialConnectionOpen,
    sync: false,
    queue: false,
    history: false,
    advanced: false
  });
  const [isTesting, setIsTesting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRetryingQueue, setIsRetryingQueue] = useState(false);
  const [isCheckingSchema, setIsCheckingSchema] = useState(false);
  const [isRepairingSchema, setIsRepairingSchema] = useState(false);
  const [lastResult, setLastResult] = useState<NotionConnectionResult | null>(null);
  const [lastCreate, setLastCreate] = useState<NotionAutoCreateResult | null>(null);
  const [lastSync, setLastSync] = useState<NotionSyncSummary | null>(null);
  const [showLastSyncDetails, setShowLastSyncDetails] = useState(false);
  const [schemaCheck, setSchemaCheck] = useState<NotionSchemaCheckResult | null>(null);
  const [lastDiagnostic, setLastDiagnostic] = useState<NotionRequestDiagnostic | null>(null);
  const tokenInputRef = useRef<HTMLInputElement>(null);
  const parentInputRef = useRef<HTMLInputElement>(null);
  const runtimeInfo = useMemo(() => getNotionRuntimeInfo(), []);

  useEffect(() => {
    setDraft(notionSettings);
  }, [notionSettings]);

  const status = useMemo(() => getNotionStatus(draft, lastResult), [draft, lastResult]);
  const setup = useMemo(
    () => buildNotionSetupState({ settings: draft, lastResult, lastCreate, isCreating, isTesting }),
    [draft, isCreating, isTesting, lastCreate, lastResult]
  );
  const preflight = useMemo(
    () => buildNotionPreflight({ settings: draft, lastResult, lastDiagnostic, runtimeInfo }),
    [draft, lastDiagnostic, lastResult, runtimeInfo]
  );
  const syncPreview = useMemo(
    () => buildNotionSyncPreview({ settings: draft, mappings: notionPageMappings, state }),
    [draft, notionPageMappings, state]
  );
  const setupComplete = setup.tone === "connected";
  const selectedSetupStep = activeSetupStep || setup.currentStepId;
  const queueNeedsAttention = notionSyncQueue.some((item) => item.status === "failed" || item.status === "pending");
  const queuePanelSummary = notionSyncQueue.length ? formatNotionQueueSummary(notionSyncQueue) : "没有待处理队列";

  useEffect(() => {
    setActiveSetupStep(null);
  }, [setup.currentStepId]);

  useEffect(() => {
    if (!setupComplete) {
      setOpenPanels((current) => ({ ...current, connection: true }));
    }
  }, [setupComplete]);

  useEffect(() => {
    if (queueNeedsAttention) {
      setOpenPanels((current) => ({ ...current, queue: true }));
    }
  }, [queueNeedsAttention]);

  function patchDraft(patch: Partial<NotionSettings>) {
    const shouldResetResult = [
      "token",
      "parentPageId",
      "peopleDatabaseId",
      "placesDatabaseId",
      "memoriesDatabaseId",
      "plansDatabaseId"
    ].some((key) => Object.prototype.hasOwnProperty.call(patch, key));
    setDraft((current) => ({
      ...current,
      ...patch,
      ...(shouldResetResult
        ? {
            workspaceName: "",
            workspaceBotName: "",
            lastConnectionStatus: "idle" as const,
            lastConnectionMessage: "",
            lastConnectionTestAt: undefined
          }
        : {})
    }));
    if (shouldResetResult) {
      setLastResult(null);
      setLastCreate(null);
      setLastSync(null);
      setSchemaCheck(null);
      setLastDiagnostic(null);
    }
  }

  async function handleSave() {
    await updateNotionSettings({
      ...draft,
      enabled: Boolean(draft.enabled && draft.token.trim())
    });
    notify({ message: "Notion 配置已保存", tone: "success" });
  }

  async function handleTestConnection(settingsOverride?: NotionSettings, options?: { successMessage?: string; failurePrefix?: string; silent?: boolean }) {
    if (isTesting) return;
    const settingsToTest = settingsOverride || draft;
    setIsTesting(true);
    try {
      const result = await testNotionConnection(settingsToTest);
      setLastResult(result);
      setLastDiagnostic(extractConnectionDiagnostic(result));
      await updateNotionSettings({
        ...settingsToTest,
        enabled: result.ok && Boolean(settingsToTest.enabled || settingsToTest.token.trim()),
        workspaceName: result.workspaceName,
        workspaceBotName: result.workspaceBotName,
        lastConnectionTestAt: new Date().toISOString(),
        lastConnectionStatus: result.ok ? "connected" : "failed",
        lastConnectionMessage: result.message
      });
      if (!options?.silent) {
        notify({
          message: result.ok ? options?.successMessage || "Notion 连接测试通过" : `${options?.failurePrefix || ""}${result.message}`,
          tone: result.ok ? "success" : "error",
          durationMs: result.ok ? 3600 : 6200
        });
      }
      if (result.ok) {
        void handleCheckSchemas({ settingsOverride: settingsToTest, silent: true });
      }
      return result;
    } finally {
      setIsTesting(false);
    }
  }

  async function handleCreateDatabases() {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const result = await createLifeLogNotionDatabases(draft);
      setLastCreate(result);
      setLastDiagnostic(extractCreateDiagnostic(result));
      if (Object.keys(result.settingsPatch).length) {
        const next = {
          ...draft,
          ...result.settingsPatch,
          lastConnectionStatus: "idle" as const,
          lastConnectionMessage: ""
        };
        setDraft(next);
        await updateNotionSettings(next);
        if (result.ok) {
          await handleTestConnection(next, {
            successMessage: "Notion 数据库已创建，连接测试通过",
            failurePrefix: "数据库已创建，但连接测试未通过："
          });
          return;
        }
      }
      notify({
        message: result.message,
        tone: result.ok ? "success" : "error",
        durationMs: result.ok ? 4600 : 7200
      });
    } finally {
      setIsCreating(false);
    }
  }

  async function handleSyncAll() {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const nextSettings = {
        ...draft,
        enabled: Boolean(draft.enabled && draft.token.trim())
      };
      await updateNotionSettings({
        ...nextSettings
      });
      const result = await syncNotionAll(nextSettings);
      setLastSync(result);
      setShowLastSyncDetails(Boolean(result.failed));
      setLastDiagnostic(result.diagnostic || null);
      notify({
        message: result.failed
          ? `Notion 同步完成，失败 ${result.failed} 条`
          : `Notion 同步完成：新增 ${result.created}，更新 ${result.updated}，跳过 ${result.skipped}`,
        tone: result.failed ? "error" : "success",
        durationMs: result.failed ? 7000 : 5200
      });
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleCheckSchemas(options?: { settingsOverride?: NotionSettings; silent?: boolean }) {
    if (isCheckingSchema) return;
    const settingsToCheck = options?.settingsOverride || draft;
    setIsCheckingSchema(true);
    try {
      const result = await checkLifeLogNotionDatabaseSchemas(settingsToCheck);
      setSchemaCheck(result);
      setLastDiagnostic(extractSchemaDiagnostic(result));
      if (!options?.silent) {
        notify({
          message: result.message,
          tone: result.ok ? "success" : result.repairable ? "info" : "error",
          durationMs: result.ok ? 3600 : 6200
        });
      }
      return result;
    } finally {
      setIsCheckingSchema(false);
    }
  }

  async function handleRepairSchemas() {
    if (isRepairingSchema || !draft.token.trim()) return;
    setIsRepairingSchema(true);
    try {
      const result = await repairLifeLogNotionDatabaseSchemas(draft);
      setSchemaCheck({
        ok: result.ok,
        repairable: result.databases.some((item) => item.repairable),
        message: result.message,
        databases: result.databases,
        diagnostic: result.diagnostic
      });
      setLastDiagnostic(extractSchemaDiagnostic(result));
      notify({
        message: result.message,
        tone: result.ok ? "success" : "info",
        durationMs: result.ok ? 4200 : 6800
      });
    } finally {
      setIsRepairingSchema(false);
    }
  }

  async function handleSyncPreviewItem(item: NotionSyncPreviewItem) {
    if (isSyncing || !draft.token.trim() || !item.databaseId || !item.total) return;
    setIsSyncing(true);
    try {
      const result = await syncNotionTargets(buildTargetsForPreviewItem(item, state), {
        trigger: "single",
        targetLabel: `同步${item.label}`,
        settingsOverride: draft
      });
      setLastSync(result);
      setShowLastSyncDetails(Boolean(result.failed));
      setLastDiagnostic(result.diagnostic || null);
      notify({
        message: result.failed
          ? `${item.label}同步完成，失败 ${result.failed} 条`
          : `${item.label}同步完成：新增 ${result.created}，更新 ${result.updated}，跳过 ${result.skipped}`,
        tone: result.failed ? "error" : "success",
        durationMs: result.failed ? 7000 : 5200
      });
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleRetryFailed(entry: NotionSyncHistoryEntry) {
    if (isSyncing || !entry.failedItems.length) return;
    setIsSyncing(true);
    try {
      const result = await retryFailedNotionItems(entry.failedItems, draft);
      setLastSync(result);
      setShowLastSyncDetails(Boolean(result.failed));
      setLastDiagnostic(result.diagnostic || null);
      notify({
        message: result.failed
          ? `Notion 重试完成，仍失败 ${result.failed} 条`
          : `Notion 重试完成：新增 ${result.created}，更新 ${result.updated}，跳过 ${result.skipped}`,
        tone: result.failed ? "error" : "success",
        durationMs: result.failed ? 7000 : 5200
      });
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleRetryQueue(ids?: string[]) {
    if (isRetryingQueue || !draft.token.trim()) return;
    setIsRetryingQueue(true);
    try {
      const result = await retryNotionQueueItems(ids);
      if (!result) {
        notify({ message: "没有需要重试的 Notion 队列项", tone: "info" });
        return;
      }
      setLastSync(result);
      setShowLastSyncDetails(Boolean(result.failed));
      setLastDiagnostic(result.diagnostic || null);
      notify({
        message: result.failed
          ? `Notion 队列重试完成，仍失败 ${result.failed} 条`
          : `Notion 队列已同步 ${result.synced} 条`,
        tone: result.failed ? "error" : "success",
        durationMs: result.failed ? 7000 : 4200
      });
    } finally {
      setIsRetryingQueue(false);
    }
  }

  async function handlePrimarySetupAction() {
    if (setup.primaryAction === "focus-token") {
      setOpenPanels((current) => ({ ...current, connection: true }));
      setActiveSetupStep("integration");
      window.setTimeout(() => tokenInputRef.current?.focus(), 0);
      return;
    }
    if (setup.primaryAction === "focus-parent") {
      setOpenPanels((current) => ({ ...current, connection: true }));
      setActiveSetupStep("parent");
      window.setTimeout(() => parentInputRef.current?.focus(), 0);
      return;
    }
    if (setup.primaryAction === "create-databases") {
      await handleCreateDatabases();
      return;
    }
    if (setup.primaryAction === "test-connection") {
      await handleTestConnection();
      return;
    }
  }

  function togglePanel(panel: NotionPanelKey) {
    setOpenPanels((current) => ({ ...current, [panel]: !current[panel] }));
  }

  function renderFoldPanel({
    id,
    title,
    summary,
    icon,
    children,
    tone = "default"
  }: {
    id: NotionPanelKey;
    title: string;
    summary: string;
    icon: ReactNode;
    children: ReactNode;
    tone?: "default" | "success" | "warning" | "danger";
  }) {
    const open = openPanels[id];
    return (
      <section className={`notion-fold-panel ${tone} ${open ? "open" : ""}`}>
        <button className="notion-fold-toggle" type="button" onClick={() => togglePanel(id)} aria-expanded={open}>
          <span className="notion-fold-icon">{icon}</span>
          <span className="notion-fold-title">
            <strong>{title}</strong>
            <small>{summary}</small>
          </span>
          <ChevronDown />
        </button>
        {open ? <div className="notion-fold-body">{children}</div> : null}
      </section>
    );
  }

  async function handleClearToken() {
    const next = {
      ...draft,
      enabled: false,
      token: "",
      workspaceName: "",
      workspaceBotName: "",
      lastConnectionStatus: "idle" as const,
      lastConnectionMessage: ""
    };
    setDraft(next);
    setLastResult(null);
    setLastDiagnostic(null);
    await updateNotionSettings(next);
    notify({ message: "已清空 Notion Token", tone: "success" });
  }

  async function handleCopyDiagnostic() {
    if (!lastDiagnostic) return;
    const copied = await copyTextToClipboard(formatNotionDiagnostic(lastDiagnostic));
    notify({
      message: copied ? "Notion 诊断信息已复制" : "复制失败，请手动截图诊断信息",
      tone: copied ? "success" : "error"
    });
  }

  return (
    <section className="section">
      <div className="section-header">
        <h2>
          <Cloud /> Notion 同步
        </h2>
        <span className="section-chip">实验功能</span>
      </div>
      <GlassCard className={`notion-sync-card ${status.tone}`}>
        <div className="notion-sync-head">
          <div className="notion-sync-title">
            {status.tone === "connected" ? <CheckCircle2 /> : status.tone === "failed" ? <XCircle /> : <Cloud />}
            <div>
              <strong>{status.title}</strong>
              <span>{status.desc}</span>
            </div>
          </div>
          <label className="reminder-toggle" aria-label="启用 Notion 同步">
            <input
              type="checkbox"
              checked={Boolean(draft.enabled)}
              onChange={(event) => patchDraft({ enabled: event.target.checked })}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className="notion-sync-note">
          <span>实验版在线同步。只需要 Token 和一个父页面 ID，LifeLog 会自动创建中文数据库，再把本地记录单向同步到 Notion。</span>
        </div>

        {renderFoldPanel({
          id: "connection",
          title: "连接配置",
          summary: setupComplete ? "已连接，可按需展开修改" : `${setup.badge} · ${setup.title}`,
          icon: <KeyRound />,
          tone: setup.tone === "connected" ? "success" : setup.tone === "failed" ? "danger" : "default",
          children: (
            <>
              <div className={`notion-setup-panel ${setup.tone}`}>
                <div className="notion-setup-current">
                  <span>{setup.badge}</span>
                  <strong>{setup.title}</strong>
                  <p>{setup.desc}</p>
                </div>
                <button
                  className="notion-button notion-button-primary notion-setup-primary"
                  type="button"
                  onClick={() => void handlePrimarySetupAction()}
                  disabled={setup.primaryDisabled}
                >
                  <RefreshCw className={setup.primaryBusy ? "spinning" : ""} />
                  {setup.primaryLabel}
                </button>
              </div>

              <div className="notion-task-flow" aria-label="Notion 连接步骤">
                {setup.steps.map((step) => {
                  const isOpen = selectedSetupStep === step.id;
                  return (
                    <article className={`notion-task-card ${step.state} ${isOpen ? "open" : ""}`} key={step.id}>
                      <button className="notion-task-head" type="button" onClick={() => setActiveSetupStep(isOpen ? null : step.id)} aria-expanded={isOpen}>
                        <div className="notion-step-marker">
                          {step.state === "done" ? <CheckCircle2 /> : step.state === "failed" ? <XCircle /> : <em>{step.index}</em>}
                        </div>
                        <div className="notion-step-body">
                          <strong>{step.title}</strong>
                          <span>{step.desc}</span>
                        </div>
                        <ChevronDown />
                      </button>
                      {isOpen ? (
                        <div className="notion-task-body">
                          {step.id === "integration" ? (
                            <>
                              <div className="notion-task-actions">
                                <button className="notion-button notion-button-link" type="button" onClick={() => void openExternalUrl(NOTION_INTEGRATIONS_URL)}>
                                  <ExternalLink />
                                  打开 Notion 集成
                                </button>
                                <button className="notion-button notion-button-ghost compact" type="button" onClick={() => void handleSave()}>
                                  <CheckCircle2 />
                                  保存
                                </button>
                              </div>
                              <label className="notion-field">
                                <span>
                                  <KeyRound /> Internal Integration Token
                                </span>
                                <div className="notion-token-input">
                                  <input
                                    ref={tokenInputRef}
                                    type={showToken ? "text" : "password"}
                                    value={draft.token}
                                    placeholder="secret_xxx"
                                    autoComplete="off"
                                    onChange={(event) => patchDraft({ token: event.target.value })}
                                  />
                                  <button type="button" onClick={() => setShowToken((current) => !current)} aria-label={showToken ? "隐藏 Token" : "显示 Token"}>
                                    {showToken ? <EyeOff /> : <Eye />}
                                  </button>
                                </div>
                                <small className="notion-field-hint">从 Notion Integration 的 Internal Integration Secret 复制，建议只保存在本机。</small>
                              </label>
                            </>
                          ) : null}

                          {step.id === "parent" ? (
                            <>
                              <div className="notion-task-actions">
                                <button className="notion-button notion-button-link" type="button" onClick={() => void openExternalUrl(NOTION_HOME_URL)}>
                                  <ExternalLink />
                                  打开 Notion
                                </button>
                                <button className="notion-button notion-button-ghost compact" type="button" onClick={() => void handleSave()}>
                                  <CheckCircle2 />
                                  保存
                                </button>
                              </div>
                              <label className="notion-field">
                                <span>
                                  <Database /> Notion 父页面
                                </span>
                                <input
                                  ref={parentInputRef}
                                  value={draft.parentPageId}
                                  placeholder="粘贴已分享给 Integration 的 Notion 页面链接或页面 ID"
                                  onChange={(event) => patchDraft({ parentPageId: event.target.value })}
                                />
                                <small className="notion-field-hint">可以直接粘贴完整页面链接，LifeLog 会自动提取页面 ID。</small>
                              </label>
                              {normalizeNotionId(draft.parentPageId) ? <p className="notion-inline-hint">已识别页面 ID：{normalizeNotionId(draft.parentPageId)}</p> : null}
                            </>
                          ) : null}

                          {step.id === "database" ? (
                            <>
                              <div className="notion-auto-create-card">
                                <div>
                                  <strong>自动准备 Notion 数据库</strong>
                                  <span>在父页面下创建中文字段的人物、地点、回忆和纪念日安排数据库，并自动保存 ID。</span>
                                  <small>当前已配置 {countConfiguredDatabases(draft)}/4 个数据库。</small>
                                </div>
                                <button className="notion-button notion-button-primary compact" type="button" onClick={() => void handleCreateDatabases()} disabled={isCreating || !draft.token.trim() || !draft.parentPageId.trim()}>
                                  <RefreshCw className={isCreating ? "spinning" : ""} />
                                  {isCreating ? "创建中" : "自动创建"}
                                </button>
                              </div>
                              {lastCreate?.databases.length ? (
                                <div className="notion-probe-list">
                                  {lastCreate.databases.map((item) => (
                                    <div className={`notion-probe-item ${item.ok ? "ok" : "failed"}`} key={item.key}>
                                      <strong>{item.label}</strong>
                                      <span>{item.ok ? `${item.title || "数据库"} · ${item.message}` : item.message}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </>
                          ) : null}

                          {step.id === "test" ? (
                            <>
                              <div className="notion-preflight-panel compact">
                                <div className="notion-preflight-head">
                                  <strong>连接体检</strong>
                                  <span>{summarizePreflight(preflight)}</span>
                                </div>
                                <div className="notion-preflight-grid">
                                  {preflight.map((item) => (
                                    <div className={`notion-preflight-item ${item.tone}`} key={item.id}>
                                      <span>
                                        {item.tone === "ok" ? <CheckCircle2 /> : item.tone === "blocked" ? <XCircle /> : <AlertCircle />}
                                        {item.label}
                                      </span>
                                      <strong>{item.value}</strong>
                                      <small>{item.detail}</small>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className={`notion-schema-panel compact ${schemaCheck?.ok ? "ok" : schemaCheck?.repairable ? "warning" : schemaCheck ? "blocked" : "idle"}`}>
                                <div className="notion-schema-head">
                                  <div>
                                    <strong>数据库字段体检</strong>
                                    <span>{schemaCheck ? schemaCheck.message : "检查 4 个数据库是否具备 LifeLog 需要的中文字段。"}</span>
                                  </div>
                                  <div className="notion-schema-actions">
                                    <button
                                      className="notion-button notion-button-ghost compact"
                                      type="button"
                                      onClick={() => void handleCheckSchemas()}
                                      disabled={isCheckingSchema || isRepairingSchema || !draft.token.trim()}
                                    >
                                      <RefreshCw className={isCheckingSchema ? "spinning" : ""} />
                                      {isCheckingSchema ? "检查中" : "检查字段"}
                                    </button>
                                    {schemaCheck?.repairable ? (
                                      <button
                                        className="notion-button notion-button-primary compact"
                                        type="button"
                                        onClick={() => void handleRepairSchemas()}
                                        disabled={isCheckingSchema || isRepairingSchema || !draft.token.trim()}
                                      >
                                        <RefreshCw className={isRepairingSchema ? "spinning" : ""} />
                                        {isRepairingSchema ? "补齐中" : "一键补齐"}
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                                {schemaCheck ? (
                                  <div className="notion-schema-grid compact">
                                    {schemaCheck.databases.map((item) => (
                                      <div className={`notion-schema-item ${item.ok ? "ok" : item.repairable ? "warning" : "blocked"}`} key={item.key}>
                                        <span>{item.label}</span>
                                        <strong>{formatSchemaCheckValue(item)}</strong>
                                        <small>{formatSchemaCheckDetail(item)}</small>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                              </div>

                              <div className="notion-task-actions">
                                <button className="notion-button notion-button-primary" type="button" onClick={() => void handleTestConnection()} disabled={isTesting || !draft.token.trim()}>
                                  <RefreshCw className={isTesting ? "spinning" : ""} />
                                  {isTesting ? "测试中" : "测试连接"}
                                </button>
                              </div>

                              {lastResult?.databases.length ? (
                                <div className="notion-probe-list">
                                  {lastResult.databases.map((item) => (
                                    <div className={`notion-probe-item ${item.ok ? "ok" : "failed"}`} key={item.key}>
                                      <strong>{item.label}</strong>
                                      <span>{item.ok ? item.title || "可读取" : item.message}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : notionSettings.lastConnectionMessage ? (
                                <p className="notion-last-message">
                                  上次测试：{notionSettings.lastConnectionMessage}
                                  {notionSettings.lastConnectionTestAt ? ` · ${formatTestTime(notionSettings.lastConnectionTestAt)}` : ""}
                                </p>
                              ) : null}
                            </>
                          ) : null}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </>
          )
        })}

        {renderFoldPanel({
          id: "sync",
          title: "数据同步",
          summary: formatSyncPreviewSummary(syncPreview),
          icon: <RefreshCw />,
          tone: setupComplete ? "success" : "default",
          children: (
            <>
              <div className="notion-sync-preview">
                <div className="notion-sync-preview-head">
                  <div>
                    <strong>同步预览</strong>
                    <span>{formatSyncPreviewSummary(syncPreview)}</span>
                  </div>
                  {notionSettings.lastFullSyncAt ? <em>上次同步 {formatTestTime(notionSettings.lastFullSyncAt)}</em> : null}
                </div>
                <div className="notion-sync-preview-grid">
                  {syncPreview.map((item) => (
                    <div className={`notion-sync-preview-item ${item.tone}`} key={item.entityType}>
                      <span>{item.label}</span>
                      <strong>{item.databaseId ? item.total : "未配置"}</strong>
                      <small>{formatSyncPreviewDetail(item)}</small>
                      <button
                        className="notion-button notion-button-ghost compact"
                        type="button"
                        onClick={() => void handleSyncPreviewItem(item)}
                        disabled={isSyncing || !draft.token.trim() || !item.databaseId || !item.total}
                      >
                        <RefreshCw className={isSyncing ? "spinning" : ""} />
                        同步此类
                      </button>
                    </div>
                  ))}
                </div>
                <button className="notion-button notion-button-primary" type="button" onClick={() => void handleSyncAll()} disabled={isSyncing || !draft.token.trim()}>
                  <RefreshCw className={isSyncing ? "spinning" : ""} />
                  <span>{isSyncing ? "同步中" : "同步全部"}</span>
                </button>
              </div>

              {lastSync && (
                <div className={`notion-sync-result ${lastSync.failed ? "failed" : "ok"}`}>
                  <div className="notion-sync-result-head">
                    <div>
                      <strong>{formatLastSyncTitle(lastSync)}</strong>
                      <span>{formatLastSyncSubtitle(lastSync)}</span>
                    </div>
                    {lastSync.failedItems.length ? (
                      <button className="notion-button notion-button-ghost compact" type="button" onClick={() => void handleRetryFailed(buildRetryEntryFromSummary(lastSync))} disabled={isSyncing || !draft.token.trim()}>
                        <RefreshCw className={isSyncing ? "spinning" : ""} />
                        重试失败项
                      </button>
                    ) : null}
                  </div>
                  <div className="notion-sync-result-metrics">
                    <span>
                      <strong>{lastSync.synced}</strong>
                      已同步
                    </span>
                    <span>
                      <strong>{lastSync.created}</strong>
                      新增
                    </span>
                    <span>
                      <strong>{lastSync.updated}</strong>
                      更新
                    </span>
                    <span>
                      <strong>{lastSync.skipped}</strong>
                      跳过
                    </span>
                    <span>
                      <strong>{lastSync.failed}</strong>
                      失败
                    </span>
                  </div>
                  <div className="notion-sync-result-toolbar">
                    <button className="notion-button notion-button-ghost compact" type="button" onClick={() => setShowLastSyncDetails((open) => !open)}>
                      <ChevronDown className={showLastSyncDetails ? "rotate-open" : ""} />
                      {showLastSyncDetails ? "收起明细" : lastSync.failedItems.length ? "查看失败原因" : "查看同步明细"}
                    </button>
                  </div>
                  {showLastSyncDetails && (
                    <>
                      <div className="notion-sync-type-grid">
                        {syncPreview.map((item) => (
                          <div className="notion-sync-type-item" key={item.entityType}>
                            <span>{item.label}</span>
                            <strong>{formatSyncTypeSummary(lastSync.byType[item.entityType])}</strong>
                          </div>
                        ))}
                      </div>
                      {lastSync.failedItems.length ? (
                        <div className="notion-sync-failed-list">
                          <strong>需要处理的失败项</strong>
                          {lastSync.failedItems.slice(0, 5).map((item) => (
                            <div className="notion-sync-failed-item" key={item.id}>
                              <span>{item.label}</span>
                              <small>{formatFailedItemHint(item.message)}</small>
                            </div>
                          ))}
                          {lastSync.failedItems.length > 5 ? <em>还有 {lastSync.failedItems.length - 5} 条失败项，可点击重试失败项后继续查看队列。</em> : null}
                        </div>
                      ) : (
                        <ul>
                          {lastSync.messages.slice(0, 3).map((message) => (
                            <li key={message}>{message}</li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )
        })}

        {renderFoldPanel({
          id: "queue",
          title: "自动同步队列",
          summary: queuePanelSummary,
          icon: <RefreshCw />,
          tone: queueNeedsAttention ? "warning" : "default",
          children: notionSyncQueue.length ? (
            <div className="notion-queue-panel">
              <div className="notion-queue-head">
                <div>
                  <strong>待处理队列</strong>
                  <span>{formatNotionQueueSummary(notionSyncQueue)}</span>
                </div>
                <button
                  className="notion-button notion-button-ghost compact"
                  type="button"
                  onClick={() => void handleRetryQueue()}
                  disabled={isRetryingQueue || !draft.token.trim() || !notionSyncQueue.some((item) => item.status === "pending" || item.status === "failed")}
                >
                  <RefreshCw className={isRetryingQueue ? "spinning" : ""} />
                  立即同步
                </button>
              </div>
              <div className="notion-queue-list">
                {notionSyncQueue.slice(0, 5).map((item) => (
                  <div className={`notion-queue-item ${item.status}`} key={item.id}>
                    <div>
                      <strong>{item.targetLabel}</strong>
                      <span>{formatNotionQueueItemMeta(item)}</span>
                      {item.lastError ? <small>{item.lastError}</small> : null}
                    </div>
                    {item.status === "failed" ? (
                      <button className="notion-button notion-button-ghost compact" type="button" onClick={() => void handleRetryQueue([item.id])} disabled={isRetryingQueue || !draft.token.trim()}>
                        重试
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="notion-empty-note">当前没有待同步或失败的队列项。</p>
          )
        })}

        {renderFoldPanel({
          id: "history",
          title: "同步历史",
          summary: notionSyncHistory.length ? `最近 ${Math.min(notionSyncHistory.length, 3)} 次` : "暂无同步历史",
          icon: <Database />,
          children: notionSyncHistory.length ? (
            <div className="notion-history-panel">
              <div className="notion-history-list">
                {notionSyncHistory.slice(0, 3).map((entry) => (
                  <div className={`notion-history-item ${entry.status}`} key={entry.id}>
                    <div className="notion-history-main">
                      <strong>{formatHistoryTitle(entry)}</strong>
                      <span>
                        {formatTestTime(entry.finishedAt)} · 新增 {entry.created} · 更新 {entry.updated} · 跳过 {entry.skipped} · 失败 {entry.failed}
                      </span>
                      {entry.failedItems.length ? (
                        <small>{entry.failedItems.slice(0, 3).map((item) => `${item.label}：${item.message}`).join("；")}</small>
                      ) : null}
                    </div>
                    {entry.failedItems.length ? (
                      <button className="notion-button notion-button-ghost compact" type="button" onClick={() => void handleRetryFailed(entry)} disabled={isSyncing || !draft.token.trim()}>
                        <RefreshCw className={isSyncing ? "spinning" : ""} />
                        重试
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="notion-empty-note">同步完成后会在这里记录结果和失败项。</p>
          )
        })}

        {renderFoldPanel({
          id: "advanced",
          title: "高级配置",
          summary: "手动数据库 ID、请求诊断和清空 Token",
          icon: <Database />,
          children: (
            <>
              <div className="notion-database-grid">
                {databaseFields.map((field) => (
                  <label className="notion-field" key={field.key}>
                    <span>
                      <Database /> {field.label}
                    </span>
                    <input
                      value={draft[field.key]}
                      placeholder={field.placeholder}
                      onChange={(event) => patchDraft({ [field.key]: event.target.value })}
                    />
                  </label>
                ))}
              </div>

              {lastDiagnostic && (
                <div className="notion-diagnostic-card">
                  <div className="notion-diagnostic-head">
                    <strong>请求诊断</strong>
                    <button className="notion-button notion-button-ghost compact" type="button" onClick={() => void handleCopyDiagnostic()}>
                      <Copy />
                      复制
                    </button>
                  </div>
                  <div className="notion-diagnostic-grid">
                    <span>
                      <strong>平台</strong>
                      {lastDiagnostic.platform}{lastDiagnostic.native ? " · 原生" : " · Web"}
                    </span>
                    <span>
                      <strong>传输</strong>
                      {formatNotionTransport(lastDiagnostic.transport)}
                    </span>
                    <span>
                      <strong>请求</strong>
                      {lastDiagnostic.method} {lastDiagnostic.path}
                    </span>
                    {typeof lastDiagnostic.durationMs === "number" ? (
                      <span>
                        <strong>耗时</strong>
                        {lastDiagnostic.durationMs} ms
                      </span>
                    ) : null}
                    {lastDiagnostic.status ? (
                      <span>
                        <strong>状态</strong>
                        HTTP {lastDiagnostic.status}
                      </span>
                    ) : null}
                    {lastDiagnostic.errorName || lastDiagnostic.errorMessage ? (
                      <span>
                        <strong>错误</strong>
                        {[lastDiagnostic.errorName, lastDiagnostic.errorMessage].filter(Boolean).join(": ")}
                      </span>
                    ) : null}
                  </div>
                  {lastDiagnostic.hint ? <p>{lastDiagnostic.hint}</p> : null}
                </div>
              )}

              <div className="notion-sync-actions notion-utility-actions">
                <button className="notion-button notion-button-ghost" type="button" onClick={() => void handleSave()}>
                  <CheckCircle2 />
                  <span>保存配置</span>
                </button>
                <button className="notion-button notion-button-ghost" type="button" onClick={() => void handleTestConnection()} disabled={isTesting || !draft.token.trim()}>
                  <RefreshCw className={isTesting ? "spinning" : ""} />
                  <span>{isTesting ? "测试中" : "测试连接"}</span>
                </button>
                {draft.token && (
                  <button className="notion-button notion-button-danger" type="button" onClick={() => void handleClearToken()}>
                    <Trash2 />
                    <span>清空 Token</span>
                  </button>
                )}
              </div>
            </>
          )
        })}
      </GlassCard>
    </section>
  );
}

function getNotionStatus(settings: NotionSettings, lastResult: NotionConnectionResult | null) {
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

function buildNotionSetupState({
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
          : "LifeLog 会在父页面下创建人物、地点、回忆和纪念日安排数据库。",
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

function countConfiguredDatabases(settings: NotionSettings) {
  return databaseFields.filter((field) => normalizeNotionId(String(settings[field.key] || ""))).length;
}

function isNotionSetupComplete(settings: NotionSettings) {
  return Boolean(
    settings.token.trim() &&
      normalizeNotionId(settings.parentPageId) &&
      countConfiguredDatabases(settings) === databaseFields.length &&
      settings.lastConnectionStatus === "connected"
  );
}

function buildNotionPreflight({
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
        ? "人物、地点、回忆和安排数据库都已配置。"
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

function buildNotionSyncPreview({
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
      label: "回忆",
      databaseLabel: "回忆数据库",
      databaseId: normalizeNotionId(settings.memoriesDatabaseId),
      total: state.memories.length
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

function countMappingsByType(mappings: NotionPageMapping[]) {
  return mappings.reduce<Record<NotionEntityType, number>>(
    (acc, mapping) => {
      if (mapping.notionPageId && !mapping.lastError) acc[mapping.entityType] += 1;
      return acc;
    },
    { person: 0, place: 0, memory: 0, anniversaryPlan: 0 }
  );
}

function formatSyncPreviewSummary(items: NotionSyncPreviewItem[]) {
  const configured = items.filter((item) => item.databaseId).length;
  const total = items.filter((item) => item.databaseId).reduce((sum, item) => sum + item.total, 0);
  const missing = items.length - configured;
  if (!configured) return "还没有配置可同步数据库";
  if (missing) return `${configured}/4 个数据库已配置，预计同步 ${total} 条`;
  return `4 个数据库已配置，预计同步 ${total} 条`;
}

function formatSyncPreviewDetail(item: NotionSyncPreviewItem) {
  if (!item.databaseId) return `${item.databaseLabel} 未配置，暂不会同步。`;
  if (!item.total) return "本地暂无内容，配置已就绪。";
  if (!item.mapped) return `${item.total} 条会首次写入 Notion。`;
  if (!item.pending) return `${item.mapped} 条已有同步记录，本次会检查更新。`;
  return `${item.mapped} 条已有同步记录，${item.pending} 条可能首次写入。`;
}

function buildTargetsForPreviewItem(item: NotionSyncPreviewItem, state: LifeLogState): NotionSyncTarget[] {
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

function formatSyncTypeSummary(summary: NotionSyncTypeSummary | undefined) {
  if (!summary || !summary.total) return "无同步内容";
  if (summary.failed) return `成功 ${summary.synced}，失败 ${summary.failed}`;
  return `新增 ${summary.created}，更新 ${summary.updated}，跳过 ${summary.skipped}`;
}

function formatFailedItemHint(message: string) {
  if (/Failed to fetch|NetworkError|CORS/i.test(message)) return `${message}。建议在 Android 真机或代理环境下重试。`;
  if (/401|unauthorized|token/i.test(message)) return `${message}。请检查 Token 是否完整、是否已保存最新配置。`;
  if (/403|permission|share/i.test(message)) return `${message}。请确认父页面和数据库已分享给 Integration。`;
  if (/404|not found|database/i.test(message)) return `${message}。请检查数据库 ID，或重新自动创建数据库。`;
  return message;
}

function formatLastSyncTitle(summary: NotionSyncSummary) {
  if (!summary.total && summary.failed) return "同步未开始";
  if (summary.failed) return `同步完成，${summary.failed} 条失败`;
  if (!summary.synced && summary.skipped) return "已是最新";
  return "同步成功";
}

function formatLastSyncSubtitle(summary: NotionSyncSummary) {
  return [
    summary.created ? `新增 ${summary.created}` : "",
    summary.updated ? `更新 ${summary.updated}` : "",
    summary.skipped ? `跳过 ${summary.skipped}` : "",
    summary.failed ? `失败 ${summary.failed}` : ""
  ].filter(Boolean).join(" · ") || "没有需要同步的内容";
}

function buildRetryEntryFromSummary(summary: NotionSyncSummary): NotionSyncHistoryEntry {
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

function formatHistoryTitle(entry: NotionSyncHistoryEntry) {
  const triggerLabel = entry.trigger === "retry" ? "重试失败项" : entry.trigger === "single" ? "单条同步" : "同步全部";
  const statusLabel = entry.status === "success" ? "成功" : entry.status === "partial" ? "部分成功" : "失败";
  return `${entry.targetLabel || triggerLabel} · ${statusLabel}`;
}

function formatNotionQueueSummary(items: NotionSyncQueueItem[]) {
  const failed = items.filter((item) => item.status === "failed").length;
  const syncing = items.filter((item) => item.status === "syncing").length;
  const pending = items.filter((item) => item.status === "pending").length;
  return [
    pending ? `${pending} 条待同步` : "",
    syncing ? `${syncing} 条同步中` : "",
    failed ? `${failed} 条失败待重试` : ""
  ].filter(Boolean).join(" · ") || "队列为空";
}

function formatNotionQueueItemMeta(item: NotionSyncQueueItem) {
  const statusLabel = item.status === "failed" ? "失败待重试" : item.status === "syncing" ? "同步中" : "待同步";
  const attemptLabel = item.attempts ? `第 ${item.attempts} 次尝试` : "尚未尝试";
  return `${statusLabel} · ${attemptLabel} · ${formatTestTime(item.updatedAt)}`;
}

function summarizePreflight(items: NotionPreflightItem[]) {
  const blocked = items.filter((item) => item.tone === "blocked").length;
  const warning = items.filter((item) => item.tone === "warning").length;
  if (blocked) return `${blocked} 项需要处理`;
  if (warning) return `${warning} 项建议确认`;
  return "连接条件正常";
}

function isLikelyNotionToken(value: string) {
  if (!value) return false;
  return /^(secret|ntn)_[\w-]{12,}$/i.test(value);
}

function isLikelyNotionId(value: string) {
  return /^[0-9a-f]{32}$/i.test(value);
}

function extractConnectionDiagnostic(result: NotionConnectionResult) {
  if (result.ok) return null;
  return result.diagnostic || result.databases.find((item) => !item.ok && item.diagnostic)?.diagnostic || null;
}

function extractCreateDiagnostic(result: NotionAutoCreateResult) {
  if (result.ok) return null;
  return result.diagnostic || result.databases.find((item) => !item.ok && item.diagnostic)?.diagnostic || null;
}

function extractSchemaDiagnostic(result: NotionSchemaCheckResult | NotionSchemaRepairResult) {
  if (result.ok) return null;
  return result.diagnostic || result.databases.find((item) => !item.ok && item.diagnostic)?.diagnostic || null;
}

function formatSchemaCheckValue(item: NotionSchemaCheckResult["databases"][number]) {
  if (!item.configured) return "未配置";
  if (item.errorKind) return "不可读取";
  if (item.ok) return "字段完整";
  if (item.conflicts.length) return `${item.conflicts.length} 个冲突`;
  if (item.missing.length) return `${item.missing.length} 个缺失`;
  return "待确认";
}

function formatSchemaCheckDetail(item: NotionSchemaCheckResult["databases"][number]) {
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

function formatNotionDiagnostic(diagnostic: NotionRequestDiagnostic) {
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

function formatNotionTransport(transport: NotionRuntimeInfo["transport"]) {
  if (transport === "capacitor-http") return "Android 原生";
  if (transport === "vite-proxy") return "Web 代理";
  return "Web 直连";
}

function formatTestTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}
