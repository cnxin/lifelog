import { AlertCircle, CheckCircle2, Clock, Cloud, LoaderCircle } from "lucide-react";
import type { NotionRecordSyncMeta } from "../utils/notionStatus";

interface NotionSyncBadgeProps {
  meta: NotionRecordSyncMeta;
  compact?: boolean;
}

export default function NotionSyncBadge({ meta, compact = false }: NotionSyncBadgeProps) {
  if (meta.status === "off") return null;
  const Icon = meta.status === "synced"
    ? CheckCircle2
    : meta.status === "failed"
      ? AlertCircle
      : meta.status === "syncing"
        ? LoaderCircle
        : meta.status === "pending"
          ? Clock
          : Cloud;
  return (
    <span className={`notion-sync-badge ${meta.status} ${compact ? "compact" : ""}`} title={meta.detail}>
      <Icon className={meta.status === "syncing" ? "spinning" : ""} />
      {!compact && <span>{meta.label}</span>}
    </span>
  );
}
