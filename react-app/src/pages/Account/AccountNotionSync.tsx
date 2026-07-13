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

import type { SetupStepId, NotionPanelKey, NotionSyncPreviewItem } from "./accountNotionSyncModel";
import {
  databaseFields,
  NOTION_INTEGRATIONS_URL,
  NOTION_HOME_URL,
  getNotionStatus,
  buildNotionSetupState,
  countConfiguredDatabases,
  isNotionSetupComplete,
  buildNotionPreflight,
  buildNotionSyncPreview,
  formatSyncPreviewSummary,
  formatSyncModeSummary,
  formatSyncPreviewDetail,
  buildTargetsForPreviewItem,
  formatSyncTypeSummary,
  formatFailedItemHint,
  formatLastSyncTitle,
  formatLastSyncSubtitle,
  buildRetryEntryFromSummary,
  formatHistoryTitle,
  formatNotionQueueSummary,
  formatNotionQueueItemMeta,
  summarizePreflight,
  extractConnectionDiagnostic,
  extractCreateDiagnostic,
  extractSchemaDiagnostic,
  formatSchemaCheckValue,
  formatSchemaCheckDetail,
  formatNotionDiagnostic,
  formatNotionTransport,
  formatTestTime
} from "./accountNotionSyncModel";

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
                                  <span>在父页面下创建中文字段的人物、地点、记录和纪念日安排数据库，并自动保存 ID。</span>
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
                <div className="notion-sync-mode-note">
                  <Cloud />
                  <span>{formatSyncModeSummary(draft)}</span>
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
              <label className={`notion-option-switch ${draft.syncPageContent !== false ? "active" : ""}`}>
                <input
                  type="checkbox"
                  checked={draft.syncPageContent !== false}
                  onChange={(event) => patchDraft({ syncPageContent: event.target.checked })}
                />
                <span>
                  <strong>同步记录正文到页面内容</strong>
                  <small>开启后，记录会在 Notion 页面内生成正文、原计划和关联信息；重新同步只替换 LifeLog 同步区。</small>
                </span>
                <i aria-hidden="true" />
              </label>

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

