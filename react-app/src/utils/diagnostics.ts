import { APP_VERSION } from "../constants/version";
import type { LifeLogState } from "../types";
import type { BackupHealthReport } from "./backupHealth";
import { isMemoryPlan } from "./memoryDisplay";
import { getUxMetricsSummary, type UxMetricsSummary } from "./uxMetrics";

export interface DiagnosticsPayload {
  appVersion: string;
  generatedAt: string;
  userAgent: string;
  platform: string;
  language: string;
  screen: string;
  counts: {
    people: number;
    places: number;
    memories: number;
    memoryPlans: number;
    photoRefs: number;
  };
  backupHealth: {
    status: BackupHealthReport["status"];
    issueCount: number;
    issues: string[];
  };
  uxMetrics: UxMetricsSummary;
}

export function buildDiagnosticsPayload(state: LifeLogState, healthReport: BackupHealthReport): DiagnosticsPayload {
  return {
    appVersion: APP_VERSION,
    generatedAt: new Date().toISOString(),
    userAgent: typeof navigator === "undefined" ? "unknown" : navigator.userAgent,
    platform: typeof navigator === "undefined" ? "unknown" : navigator.platform,
    language: typeof navigator === "undefined" ? "unknown" : navigator.language,
    screen: typeof window === "undefined" ? "unknown" : `${window.screen.width}x${window.screen.height}`,
    counts: {
      people: state.people.length,
      places: state.places.length,
      memories: state.memories.filter((memory) => !isMemoryPlan(memory)).length,
      memoryPlans: state.memories.filter(isMemoryPlan).length,
      photoRefs: state.memories.reduce((total, memory) => total + (memory.photos || []).length, 0)
    },
    backupHealth: {
      status: healthReport.status,
      issueCount: healthReport.issueCount,
      issues: healthReport.issues
    },
    uxMetrics: getUxMetricsSummary()
  };
}

export function formatDiagnosticsText(payload: DiagnosticsPayload) {
  return [
    "LifeLog 反馈诊断信息",
    "",
    `版本：${payload.appVersion}`,
    `生成时间：${payload.generatedAt}`,
    `设备：${payload.platform}`,
    `语言：${payload.language}`,
    `屏幕：${payload.screen}`,
    `浏览器：${payload.userAgent}`,
    "",
    "数据概况：",
    `- 人物：${payload.counts.people}`,
    `- 地点：${payload.counts.places}`,
    `- 回忆：${payload.counts.memories}`,
    `- 计划：${payload.counts.memoryPlans}`,
    `- 照片引用：${payload.counts.photoRefs}`,
    "",
    "备份健康：",
    `- 状态：${payload.backupHealth.status}`,
    `- 问题数：${payload.backupHealth.issueCount}`,
    ...payload.backupHealth.issues.map((issue) => `- ${issue}`),
    "",
    "本地 UX 聚合：",
    `- 日期桶：${payload.uxMetrics.dayCount}`,
    `- 总样本：${payload.uxMetrics.totalSamples}`,
    `- 记录流程：${payload.uxMetrics.eventCounts.record_flow}`,
    `- 照片处理：${payload.uxMetrics.eventCounts.photo_process}`,
    `- 搜索流程：${payload.uxMetrics.eventCounts.search_flow}`,
    `- 首页区块：${payload.uxMetrics.eventCounts.home_section}`,
    `- 新用户步骤：${payload.uxMetrics.eventCounts.onboarding_step}`,
    `- 智能提示：${payload.uxMetrics.eventCounts.smart_prompt}`
  ].join("\n");
}

export async function copyTextToClipboard(text: string) {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  return copied;
}
