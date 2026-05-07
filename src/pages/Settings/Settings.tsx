import { Download, Star } from "lucide-react";
import { useRef } from "react";
import GlassCard from "../../components/GlassCard";
import Tags from "../../components/Tags";
import { useLifeLog } from "../../context/LifeLogContext";

export default function Settings() {
  const { exportData, importData, resetDemo } = useLifeLog();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleImport(file: File | undefined) {
    if (!file) return;
    if (!confirm("确认导入这个 JSON？当前 IndexedDB 数据会被覆盖。")) return;
    try {
      await importData(file);
    } catch (error) {
      alert(error instanceof Error ? error.message : "导入失败，请检查文件格式。");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <>
      <section className="section">
        <GlassCard className="memory-card">
          <div className="memory-badge">
            <Download />
          </div>
          <div className="memory-info">
            <div className="memory-title">数据备份</div>
            <p className="memory-desc">当前数据已保存到 IndexedDB。可以导出 JSON，也可以从 JSON 备份恢复。</p>
            <div className="tags">
              <button className="category-pill active" onClick={exportData}>
                导出 JSON
              </button>
              <button className="category-pill" onClick={() => fileInputRef.current?.click()}>
                导入 JSON
              </button>
              <button className="category-pill" onClick={() => {
                if (confirm("确认重置？所有数据将被清空并还原为示例数据。")) void resetDemo();
              }}>
                重置 Demo
              </button>
            </div>
            <input
              ref={fileInputRef}
              className="hidden-file"
              type="file"
              accept="application/json,.json"
              onChange={(event) => void handleImport(event.target.files?.[0])}
            />
          </div>
        </GlassCard>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>
            <Star /> 后续路线
          </h2>
        </div>
        <Tags items={["React 组件化", "Dexie IndexedDB", "PWA", "Capacitor Android", "本地通知"]} />
      </section>
    </>
  );
}
