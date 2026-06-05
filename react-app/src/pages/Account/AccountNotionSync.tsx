import { AlertCircle, CheckCircle2, ChevronDown, Cloud, Copy, Database, ExternalLink, Eye, EyeOff, KeyRound, RefreshCw, Trash2, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import GlassCard from "../../components/GlassCard";
import { useLifeLog } from "../../context/LifeLogContext";
import { useToast } from "../../context/ToastContext";
import type { NotionSettings } from "../../types";
import { copyTextToClipboard } from "../../utils/diagnostics";
import { openExternalUrl } from "../../utils/externalLinks";
import { normalizeNotionId } from "../../utils/notionIds";
import {
  createLifeLogNotionDatabases,
  getNotionRuntimeInfo,
  testNotionConnection,
  type NotionAutoCreateResult,
  type NotionConnectionResult,
  type NotionRequestDiagnostic,
  type NotionRuntimeInfo
} from "../../utils/notionClient";
import type { NotionSyncSummary } from "../../utils/notionSync";

type DatabaseField = "peopleDatabaseId" | "placesDatabaseId" | "memoriesDatabaseId" | "plansDatabaseId";
type SetupStepState = "done" | "current" | "waiting" | "failed";
type SetupPrimaryAction = "focus-token" | "focus-parent" | "create-databases" | "test-connection" | "sync-all";
type PreflightTone = "ok" | "warning" | "blocked" | "idle";

interface SetupStep {
  id: string;
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
  steps: SetupStep[];
}

interface NotionPreflightItem {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: PreflightTone;
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
  const { notionSettings, updateNotionSettings, syncNotionAll } = useLifeLog();
  const notify = useToast();
  const [draft, setDraft] = useState(notionSettings);
  const [showToken, setShowToken] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<NotionConnectionResult | null>(null);
  const [lastCreate, setLastCreate] = useState<NotionAutoCreateResult | null>(null);
  const [lastSync, setLastSync] = useState<NotionSyncSummary | null>(null);
  const [lastDiagnostic, setLastDiagnostic] = useState<NotionRequestDiagnostic | null>(null);
  const tokenInputRef = useRef<HTMLInputElement>(null);
  const parentInputRef = useRef<HTMLInputElement>(null);
  const runtimeInfo = useMemo(() => getNotionRuntimeInfo(), []);

  useEffect(() => {
    setDraft(notionSettings);
  }, [notionSettings]);

  const status = useMemo(() => getNotionStatus(draft, lastResult), [draft, lastResult]);
  const setup = useMemo(
    () => buildNotionSetupState({ settings: draft, lastResult, lastCreate, lastSync, isCreating, isTesting, isSyncing }),
    [draft, isCreating, isSyncing, isTesting, lastCreate, lastResult, lastSync]
  );
  const preflight = useMemo(
    () => buildNotionPreflight({ settings: draft, lastResult, lastDiagnostic, runtimeInfo }),
    [draft, lastDiagnostic, lastResult, runtimeInfo]
  );

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

  async function handlePrimarySetupAction() {
    if (setup.primaryAction === "focus-token") {
      tokenInputRef.current?.focus();
      return;
    }
    if (setup.primaryAction === "focus-parent") {
      parentInputRef.current?.focus();
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
    await handleSyncAll();
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

        <div className="notion-setup-steps" aria-label="Notion 连接步骤">
          {setup.steps.map((step) => (
            <div className={`notion-setup-step ${step.state}`} key={step.id}>
              <div className="notion-step-marker">
                {step.state === "done" ? <CheckCircle2 /> : step.state === "failed" ? <XCircle /> : <em>{step.index}</em>}
              </div>
              <div className="notion-step-body">
                <strong>{step.title}</strong>
                <span>{step.desc}</span>
              </div>
              {step.actionLabel && step.actionUrl ? (
                <button className="notion-button notion-button-link" type="button" onClick={() => void openExternalUrl(step.actionUrl!)}>
                  <ExternalLink />
                  {step.actionLabel}
                </button>
              ) : null}
            </div>
          ))}
        </div>

        <div className="notion-preflight-panel">
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

        <div className="notion-input-panel">
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
        </div>

        <div className="notion-auto-create-card">
          <div>
            <strong>自动准备 Notion 数据库</strong>
            <span>在父页面下创建中文字段的人物、地点、回忆和纪念日安排数据库，并自动保存 ID。</span>
            {normalizeNotionId(draft.parentPageId) ? <small>已识别页面 ID：{normalizeNotionId(draft.parentPageId)}</small> : null}
          </div>
          <button className="notion-button notion-button-primary compact" type="button" onClick={() => void handleCreateDatabases()} disabled={isCreating || !draft.token.trim() || !draft.parentPageId.trim()}>
            <RefreshCw className={isCreating ? "spinning" : ""} />
            {isCreating ? "创建中" : "自动创建"}
          </button>
        </div>

        <button
          className={`notion-advanced-toggle ${showAdvanced ? "open" : ""}`}
          type="button"
          onClick={() => setShowAdvanced((current) => !current)}
        >
          <span>高级手动配置</span>
          <ChevronDown />
        </button>

        {showAdvanced && (
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
        )}

        {lastCreate?.databases.length ? (
          <div className="notion-probe-list">
            {lastCreate.databases.map((item) => (
              <div className={`notion-probe-item ${item.ok ? "ok" : "failed"}`} key={item.key}>
                <strong>{item.label}</strong>
                <span>{item.ok ? `${item.title || "数据库"} · ${item.message}` : item.message}</span>
              </div>
            ))}
          </div>
        ) : lastResult?.databases.length ? (
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

        {lastSync && (
          <div className={`notion-sync-result ${lastSync.failed ? "failed" : "ok"}`}>
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
            <ul>
              {lastSync.messages.slice(0, 4).map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
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
          <button className="notion-button notion-button-primary" type="button" onClick={() => void handleSyncAll()} disabled={isSyncing || !draft.token.trim()}>
            <RefreshCw className={isSyncing ? "spinning" : ""} />
            <span>{isSyncing ? "同步中" : "同步全部"}</span>
          </button>
          {draft.token && (
            <button className="notion-button notion-button-danger" type="button" onClick={() => void handleClearToken()}>
              <Trash2 />
              <span>清空 Token</span>
            </button>
          )}
        </div>
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
  lastSync,
  isCreating,
  isTesting,
  isSyncing
}: {
  settings: NotionSettings;
  lastResult: NotionConnectionResult | null;
  lastCreate: NotionAutoCreateResult | null;
  lastSync: NotionSyncSummary | null;
  isCreating: boolean;
  isTesting: boolean;
  isSyncing: boolean;
}): SetupState {
  const hasToken = Boolean(settings.token.trim());
  const hasParentPage = Boolean(normalizeNotionId(settings.parentPageId));
  const databaseCount = countConfiguredDatabases(settings);
  const hasAllDatabases = databaseCount === databaseFields.length;
  const createFailed = Boolean(lastCreate && !lastCreate.ok);
  const testFailed = Boolean(lastResult && !lastResult.ok);
  const testPassed = Boolean(lastResult?.ok || settings.lastConnectionStatus === "connected");
  const syncDone = Boolean(lastSync && !lastSync.failed && lastSync.synced + lastSync.skipped > 0);
  const currentStep = !hasToken
    ? "token"
    : !hasParentPage
      ? "parent"
      : !hasAllDatabases
        ? "database"
        : !testPassed
          ? "test"
          : "sync";

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
    },
    {
      id: "sync",
      index: "5",
      title: "同步本地记录",
      desc: syncDone
        ? `最近同步：${lastSync?.synced || 0} 条已同步，${lastSync?.skipped || 0} 条跳过。`
        : "把本机人物、地点、回忆和纪念日安排单向写入 Notion。",
      state: syncDone ? "done" : currentStep === "sync" ? "current" : "waiting"
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
      steps
    };
  }

  return {
    tone: lastSync?.failed ? "failed" : "connected",
    badge: "第 5 步",
    title: lastSync ? "可以继续同步" : "连接已就绪",
    desc: lastSync
      ? `上次同步：新增 ${lastSync.created}，更新 ${lastSync.updated}，跳过 ${lastSync.skipped}，失败 ${lastSync.failed}。`
      : "现在可以把本地数据单向同步到 Notion。",
    primaryLabel: isSyncing ? "同步中" : "同步全部",
    primaryAction: "sync-all",
    primaryDisabled: isSyncing,
    primaryBusy: isSyncing,
    steps
  };
}

function countConfiguredDatabases(settings: NotionSettings) {
  return databaseFields.filter((field) => normalizeNotionId(String(settings[field.key] || ""))).length;
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
