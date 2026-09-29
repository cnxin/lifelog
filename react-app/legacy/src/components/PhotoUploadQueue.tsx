import { AlertCircle, CheckCircle2, Clock3, Loader2 } from "lucide-react";

export type PhotoUploadQueueStatus = "queued" | "processing" | "done" | "error";

export interface PhotoUploadQueueItem {
  id: string;
  name: string;
  status: PhotoUploadQueueStatus;
  message?: string;
}

interface PhotoUploadQueueProps {
  items: PhotoUploadQueueItem[];
}

export default function PhotoUploadQueue({ items }: PhotoUploadQueueProps) {
  if (!items.length) return null;

  const doneCount = items.filter((item) => item.status === "done").length;
  const errorCount = items.filter((item) => item.status === "error").length;
  const processingCount = items.filter((item) => item.status === "processing").length;

  return (
    <div className="photo-upload-queue" role="status" aria-live="polite">
      <div className="photo-upload-queue-head">
        <strong>照片处理队列</strong>
        <span>
          {doneCount} 完成
          {processingCount ? ` · ${processingCount} 处理中` : ""}
          {errorCount ? ` · ${errorCount} 失败` : ""}
        </span>
      </div>
      <div className="photo-upload-queue-list">
        {items.map((item) => (
          <div className={`photo-upload-queue-item ${item.status}`} key={item.id}>
            <span className="photo-upload-queue-icon">
              {item.status === "queued" && <Clock3 />}
              {item.status === "processing" && <Loader2 />}
              {item.status === "done" && <CheckCircle2 />}
              {item.status === "error" && <AlertCircle />}
            </span>
            <span className="photo-upload-queue-copy">
              <strong>{item.name}</strong>
              <small>{item.message || statusLabel(item.status)}</small>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function statusLabel(status: PhotoUploadQueueStatus) {
  if (status === "queued") return "等待处理";
  if (status === "processing") return "正在压缩和生成预览";
  if (status === "done") return "已添加";
  return "处理失败";
}
