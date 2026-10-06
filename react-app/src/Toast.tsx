import { useState } from "react";
import type { Notice } from "./hooks/useNotices";

export default function Toast({ notice, visible }: { notice: Notice | null; visible: boolean }) {
  const [busy, setBusy] = useState(false);
  return <div className="toast" role="status" data-visible={visible}>
    {notice?.message}
    {notice?.action && <button type="button" disabled={busy || !visible} onClick={async () => {
      setBusy(true);
      try { await notice.action!.run(); } finally { setBusy(false); }
    }}>{notice.action.label}</button>}
  </div>;
}
