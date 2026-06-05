import { CheckCircle2, ChevronDown, Cloud, Copy, Database, ExternalLink, Eye, EyeOff, KeyRound, RefreshCw, Trash2, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import GlassCard from "../../components/GlassCard";
import { useLifeLog } from "../../context/LifeLogContext";
import { useToast } from "../../context/ToastContext";
import type { NotionSettings } from "../../types";
import { copyTextToClipboard } from "../../utils/diagnostics";
import { openExternalUrl } from "../../utils/externalLinks";
import {
  createLifeLogNotionDatabases,
  testNotionConnection,
  type NotionAutoCreateResult,
  type NotionConnectionResult,
  type NotionRequestDiagnostic
} from "../../utils/notionClient";
import type { NotionSyncSummary } from "../../utils/notionSync";

type DatabaseField = "peopleDatabaseId" | "placesDatabaseId" | "memoriesDatabaseId" | "plansDatabaseId";

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

  useEffect(() => {
    setDraft(notionSettings);
  }, [notionSettings]);

  const status = useMemo(() => getNotionStatus(draft, lastResult), [draft, lastResult]);

  function patchDraft(patch: Partial<NotionSettings>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  async function handleSave() {
    await updateNotionSettings({
      ...draft,
      enabled: Boolean(draft.enabled && draft.token.trim())
    });
    notify({ message: "Notion 配置已保存", tone: "success" });
  }

  async function handleTestConnection() {
    if (isTesting) return;
    setIsTesting(true);
    try {
      const result = await testNotionConnection(draft);
      setLastResult(result);
      setLastDiagnostic(extractConnectionDiagnostic(result));
      await updateNotionSettings({
        ...draft,
        enabled: result.ok && Boolean(draft.enabled || draft.token.trim()),
        workspaceName: result.workspaceName,
        workspaceBotName: result.workspaceBotName,
        lastConnectionTestAt: new Date().toISOString(),
        lastConnectionStatus: result.ok ? "connected" : "failed",
        lastConnectionMessage: result.message
      });
      notify({
        message: result.ok ? "Notion 连接测试通过" : result.message,
        tone: result.ok ? "success" : "error",
        durationMs: result.ok ? 3600 : 6200
      });
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
          ...result.settingsPatch
        };
        setDraft(next);
        await updateNotionSettings(next);
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
      await updateNotionSettings({
        ...draft,
        enabled: Boolean(draft.enabled && draft.token.trim())
      });
      const result = await syncNotionAll();
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

        <div className="notion-guide-card">
          <div className="notion-guide-head">
            <strong>按这 4 步连接 Notion</strong>
            <span>第一次使用按顺序点，不需要自己建数据库。</span>
          </div>
          <div className="notion-guide-steps">
            <div className="notion-guide-step">
              <em>1</em>
              <div>
                <strong>创建 Integration</strong>
                <span>打开 Notion 集成页面，新建 Internal Integration，复制 Secret。</span>
              </div>
              <button className="mini-action" type="button" onClick={() => void openExternalUrl(NOTION_INTEGRATIONS_URL)}>
                <ExternalLink />
                打开
              </button>
            </div>
            <div className="notion-guide-step">
              <em>2</em>
              <div>
                <strong>新建一个空页面</strong>
                <span>在 Notion 新建页面，例如 LifeLog，同步数据库会放在这里。</span>
              </div>
              <button className="mini-action" type="button" onClick={() => void openExternalUrl(NOTION_HOME_URL)}>
                <ExternalLink />
                打开
              </button>
            </div>
            <div className="notion-guide-step">
              <em>3</em>
              <div>
                <strong>分享页面给 Integration</strong>
                <span>页面右上角 Share / Invite，选择刚刚创建的 Integration。</span>
              </div>
            </div>
            <div className="notion-guide-step">
              <em>4</em>
              <div>
                <strong>复制页面链接到下方</strong>
                <span>填入 Token 和页面链接后，点击“自动创建”。</span>
              </div>
            </div>
          </div>
        </div>

        <label className="notion-field">
          <span>
            <KeyRound /> Internal Integration Token
          </span>
          <div className="notion-token-input">
            <input
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
        </label>

        <label className="notion-field">
          <span>
            <Database /> Notion 父页面 ID
          </span>
          <input
            value={draft.parentPageId}
            placeholder="粘贴已分享给 Integration 的 Notion 页面链接或页面 ID"
            onChange={(event) => patchDraft({ parentPageId: event.target.value })}
          />
        </label>

        <div className="notion-auto-create-card">
          <div>
            <strong>自动准备 Notion 数据库</strong>
            <span>在父页面下创建中文字段的人物、地点、回忆和纪念日安排数据库，并自动保存 ID。</span>
          </div>
          <button className="mini-action add" type="button" onClick={() => void handleCreateDatabases()} disabled={isCreating || !draft.token.trim() || !draft.parentPageId.trim()}>
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
              <button className="mini-action" type="button" onClick={() => void handleCopyDiagnostic()}>
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
                <strong>请求</strong>
                {lastDiagnostic.method} {lastDiagnostic.path}
              </span>
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

        <div className="notion-sync-actions">
          <div className="notion-sync-primary-actions">
            <button className="mini-action add" type="button" onClick={() => void handleSyncAll()} disabled={isSyncing || !draft.token.trim()}>
              <RefreshCw className={isSyncing ? "spinning" : ""} />
              <span>{isSyncing ? "同步中" : "同步全部"}</span>
            </button>
            <button className="mini-action" type="button" onClick={() => void handleTestConnection()} disabled={isTesting}>
              <RefreshCw className={isTesting ? "spinning" : ""} />
              <span>{isTesting ? "测试中" : "测试连接"}</span>
            </button>
          </div>
          <div className="notion-sync-secondary-actions">
            <button className="mini-action" type="button" onClick={() => void handleSave()}>
              <CheckCircle2 />
              <span>保存配置</span>
            </button>
            {draft.token && (
              <button className="mini-action danger" type="button" onClick={() => void handleClearToken()}>
                <Trash2 />
                <span>清空 Token</span>
              </button>
            )}
          </div>
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
    `请求：${diagnostic.method} ${diagnostic.path}`,
    `地址：${diagnostic.url}`,
    diagnostic.status ? `状态：HTTP ${diagnostic.status}` : "",
    diagnostic.errorName ? `错误类型：${diagnostic.errorName}` : "",
    diagnostic.errorMessage ? `错误消息：${diagnostic.errorMessage}` : "",
    diagnostic.hint ? `提示：${diagnostic.hint}` : "",
    diagnostic.errorStack ? ["", "Stack:", diagnostic.errorStack].join("\n") : ""
  ].filter(Boolean).join("\n");
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
