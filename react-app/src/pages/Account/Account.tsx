import { ShieldCheck } from "lucide-react";
import GlassCard from "../../components/GlassCard";
import AccountAbout from "./AccountAbout";
import AccountDataManagement from "./AccountDataManagement";
import AccountFeedback from "./AccountFeedback";

export default function Account() {
  return (
    <>
      <section className="section">
        <GlassCard className="account-profile-card">
          <div className="account-profile-avatar">L</div>
          <div className="account-profile-main">
            <strong>LifeLog · 本地账号</strong>
            <span>当前资料保存在本设备，备份文件可用于迁移和恢复。</span>
          </div>
          <ShieldCheck />
        </GlassCard>
      </section>
      <AccountDataManagement />
      <AccountFeedback />
      <AccountAbout />
    </>
  );
}
