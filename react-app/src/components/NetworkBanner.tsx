import { useEffect, useState } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import { applyServiceWorkerUpdate, onServiceWorkerUpdate } from "../registerServiceWorker";

export default function NetworkBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    const handleOnline = () => setOffline(false);
    const handleOffline = () => setOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    onServiceWorkerUpdate(() => setUpdateReady(true));

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (updateReady) {
    return (
      <div className="network-banner update" role="status">
        <RefreshCw size={14} />
        <span>有新版本可用</span>
        <button type="button" onClick={() => applyServiceWorkerUpdate()}>
          立即更新
        </button>
      </div>
    );
  }

  if (offline) {
    return (
      <div className="network-banner offline" role="status">
        <CloudOff size={14} />
        <span>当前处于离线模式，仍可正常使用</span>
      </div>
    );
  }

  return null;
}
