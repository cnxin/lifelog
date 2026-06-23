import { AlertCircle, Clock, ExternalLink, LoaderCircle, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLifeLog } from "../context/LifeLogContext";
import { useToast } from "../context/ToastContext";
import type { NotionEntityType } from "../types";
import { openExternalUrl } from "../utils/externalLinks";
import { buildNotionPageUrl, canSyncNotionRecord, findNotionPageUrl, getNotionRecordSyncMeta } from "../utils/notionStatus";

interface NotionRecordActionProps {
  entityType: NotionEntityType;
  entityId: string;
  label?: string;
  className?: string;
}

export default function NotionRecordAction({
  entityType,
  entityId,
  label = "Notion",
  className = "category-pill detail-notion-pill"
}: NotionRecordActionProps) {
  const navigate = useNavigate();
  const { notionSettings, notionPageMappings, notionSyncQueue, syncNotionTargets } = useLifeLog();
  const notify = useToast();
  const [syncing, setSyncing] = useState(false);
  const notionPageUrl = findNotionPageUrl({
    entityType,
    entityId,
    mappings: notionPageMappings
  });
  const canSync = canSyncNotionRecord(notionSettings, entityType);
  const syncMeta = getNotionRecordSyncMeta({
    enabled: canSync,
    entityType,
    entityId,
    mappings: notionPageMappings,
    queue: notionSyncQueue
  });

  if (!notionPageUrl && !canSync) return null;

  async function handleClick() {
    if (notionPageUrl && syncMeta.status === "synced") {
      await openExternalUrl(notionPageUrl);
      return;
    }
    if (syncing || !canSync) return;

    setSyncing(true);
    try {
      const result = await syncNotionTargets([{ entityType, entityId }], {
        trigger: "single",
        targetLabel: `同步${formatNotionEntityLabel(entityType)}`
      });
      const syncedPageUrl = buildSyncedPageUrl(result.mappings, entityType, entityId);
      if (result.failed) {
        const failureDetail = getSyncFailureDetail(result);
        notify({
          message: failureDetail ? `Notion 同步失败：${failureDetail}` : `Notion 同步失败 ${result.failed} 条`,
          tone: "error",
          actions: [
            {
              label: "去设置",
              onClick: () => navigate("/account")
            }
          ],
          durationMs: 7200
        });
        return;
      }
      notify({
        message: "已同步到 Notion",
        tone: "success",
        actions: syncedPageUrl
          ? [
            {
              label: "打开",
              onClick: () => void openExternalUrl(syncedPageUrl)
            }
          ]
          : undefined,
        durationMs: syncedPageUrl ? 6200 : 3200
      });
    } finally {
      setSyncing(false);
    }
  }

  const buttonState = getNotionActionState({
    hasPage: Boolean(notionPageUrl),
    syncing,
    status: syncMeta.status,
    label
  });
  const Icon = buttonState.icon;

  return (
    <button
      className={`${className} ${buttonState.className}`}
      type="button"
      onClick={() => void handleClick()}
      disabled={buttonState.disabled}
      title={syncMeta.detail}
    >
      <Icon className={buttonState.spinning ? "spinning" : ""} />
      {buttonState.text}
    </button>
  );
}

function formatNotionEntityLabel(entityType: NotionEntityType) {
  if (entityType === "person") return "人物";
  if (entityType === "place") return "地点";
  if (entityType === "memory") return "回忆";
  return "安排";
}

function buildSyncedPageUrl(
  mappings: Array<{ entityType: NotionEntityType; entityId: string; notionPageId?: string; lastError?: string }>,
  entityType: NotionEntityType,
  entityId: string
) {
  const mapping = mappings.find((item) =>
    item.entityType === entityType &&
    item.entityId === entityId &&
    item.notionPageId &&
    !item.lastError
  );
  return buildNotionPageUrl(mapping?.notionPageId || "");
}

function getSyncFailureDetail(result: { failedItems?: Array<{ message?: string }>; messages?: string[] }) {
  const rawDetail = result.failedItems?.[0]?.message || result.messages?.[0] || "";
  const detail = rawDetail.replace(/\s+/g, " ").trim();
  if (!detail) return "";
  return detail.length > 38 ? `${detail.slice(0, 38)}...` : detail;
}

function getNotionActionState({
  hasPage,
  syncing,
  status,
  label
}: {
  hasPage: boolean;
  syncing: boolean;
  status: ReturnType<typeof getNotionRecordSyncMeta>["status"];
  label: string;
}) {
  if (syncing || status === "syncing") {
    return {
      icon: LoaderCircle,
      text: "同步中",
      className: "syncing",
      disabled: true,
      spinning: true
    };
  }
  if (status === "pending") {
    return {
      icon: Clock,
      text: "待同步",
      className: "pending",
      disabled: false,
      spinning: false
    };
  }
  if (status === "failed") {
    return {
      icon: AlertCircle,
      text: "重试 Notion",
      className: "failed",
      disabled: false,
      spinning: false
    };
  }
  if (hasPage && status === "synced") {
    return {
      icon: ExternalLink,
      text: label,
      className: "synced",
      disabled: syncing,
      spinning: false
    };
  }
  return {
    icon: RefreshCw,
    text: "同步 Notion",
    className: "unsynced",
    disabled: false,
    spinning: false
  };
}
