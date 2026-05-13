import { Info } from "lucide-react";
import GlassCard from "../../components/GlassCard";
import Tags from "../../components/Tags";

export default function AccountAbout() {
  return (
    <section className="section">
      <div className="section-header">
        <h2>
          <Info /> 关于
        </h2>
      </div>
      <div className="list">
        <GlassCard className="detail-row">
          <strong>版本</strong>
          <span>0.1.0-test.42</span>
        </GlassCard>
        <GlassCard className="detail-row">
          <strong>存储</strong>
          <span>IndexedDB (Dexie v4)</span>
        </GlassCard>
        <GlassCard className="detail-row">
          <strong>技术栈</strong>
          <span>React 18 + TypeScript + Capacitor 8</span>
        </GlassCard>
        <GlassCard className="settings-capability-overview">
          <div className="settings-capability-overview-head">
            <strong>当前能力</strong>
            <span>本地优先</span>
          </div>
          <div className="settings-capability-overview-list">
            {[
              { label: "资料管理", value: "人物、地点、商场" },
              { label: "生活记录", value: "回忆、照片" },
              { label: "辅助能力", value: "提醒、本地备份" }
            ].map((item) => (
              <div className="settings-capability-overview-item" key={item.label}>
                <em>{item.label}</em>
                <span>{item.value}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
      <div className="settings-about-tags">
        <Tags items={["React 18", "Vite", "Dexie", "Capacitor 8", "照片", "提醒", "本地优先"]} />
      </div>
    </section>
  );
}
