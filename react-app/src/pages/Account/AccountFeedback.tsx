import { ClipboardList, ExternalLink, MessageSquareText } from "lucide-react";
import { useMemo } from "react";
import GlassCard from "../../components/GlassCard";
import { useLifeLog } from "../../context/LifeLogContext";
import { useToast } from "../../context/ToastContext";
import { buildBackupHealthReport } from "../../utils/backupHealth";
import { buildDiagnosticsPayload, copyTextToClipboard, formatDiagnosticsText } from "../../utils/diagnostics";
import { openExternalUrl } from "../../utils/externalLinks";

const ISSUE_URL = "https://github.com/cnxin/lifelog/issues/new";

export default function AccountFeedback() {
  const { state } = useLifeLog();
  const notify = useToast();
  const healthReport = useMemo(() => buildBackupHealthReport(state), [state]);
  const diagnostics = useMemo(() => {
    const payload = buildDiagnosticsPayload(state, healthReport);
    return formatDiagnosticsText(payload);
  }, [healthReport, state]);

  async function handleCopyDiagnostics() {
    const copied = await copyTextToClipboard(diagnostics);
    notify({
      message: copied ? "诊断信息已复制，可粘贴到反馈里" : "复制失败，请手动选择诊断信息",
      tone: copied ? "success" : "error"
    });
  }

  return (
    <section className="section">
      <div className="section-header">
        <h2>
          <MessageSquareText /> 反馈诊断
        </h2>
      </div>
      <GlassCard className="feedback-card">
        <div className="feedback-card-head">
          <ClipboardList />
          <div>
            <strong>反馈时附带诊断信息</strong>
            <span>只包含版本、设备、数据数量和备份健康状态，不会导出具体人物、地点或记录正文。</span>
          </div>
        </div>
        <div className="feedback-diagnostics-preview">
          <span>版本和数据概况</span>
          <strong>
            {state.people.length} 人物 · {state.places.length} 地点 · {healthReport.memories} 回忆 · {healthReport.memoryPlans} 计划
          </strong>
          <small>
            备份健康：{healthReport.status === "ok" ? "正常" : `${healthReport.issueCount} 个问题`}
          </small>
        </div>
        <div className="feedback-actions">
          <button className="mini-action add" type="button" onClick={() => void handleCopyDiagnostics()}>
            复制诊断信息
          </button>
          <button className="mini-action" type="button" onClick={() => void openExternalUrl(ISSUE_URL)}>
            <ExternalLink size={14} />
            打开 GitHub 反馈
          </button>
        </div>
      </GlassCard>
    </section>
  );
}
