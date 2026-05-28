import { CloudOff, Crown, Database, Info, KeyRound, Settings, ShieldCheck, UserRound } from "lucide-react";
import { useState } from "react";
import GlassCard from "../../components/GlassCard";
import { AppSettingsPanel, DataOrganizePanel } from "../Settings/Settings";
import AccountAbout from "./AccountAbout";
import AccountDataManagement from "./AccountDataManagement";
import AccountFeedback from "./AccountFeedback";

type AccountTab = "account" | "app" | "data" | "about";

export default function Account() {
  const [activeTab, setActiveTab] = useState<AccountTab>("account");

  return (
    <>
      <section className="section management-hero-section">
        <div className="management-tab-row" role="tablist" aria-label="管理中心分类">
          {managementTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                className={activeTab === tab.id ? "active" : ""}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {activeTab === "account" && (
        <section className="section">
          <div className="management-card-grid">
            <GlassCard className="management-info-card">
              <UserRound />
              <div>
                <strong>本地账号</strong>
                <span>当前没有云端登录，资料只保存在本设备。</span>
              </div>
            </GlassCard>
            <GlassCard className="management-info-card">
              <CloudOff />
              <div>
                <strong>云同步</strong>
                <span>暂未开启。后续如果加入云端功能，会在这里显示同步状态和设备列表。</span>
              </div>
            </GlassCard>
            <GlassCard className="management-info-card">
              <Crown />
              <div>
                <strong>付费解锁</strong>
                <span>当前为本地免费功能。未来付费功能会在这里验证购买状态。</span>
              </div>
            </GlassCard>
            <GlassCard className="management-info-card">
              <KeyRound />
              <div>
                <strong>授权信息</strong>
                <span>暂无授权码或订阅凭证。后续可用于恢复购买和绑定设备。</span>
              </div>
            </GlassCard>
          </div>
        </section>
      )}

      {activeTab === "app" && <AppSettingsPanel />}

      {activeTab === "data" && (
        <>
          <DataOrganizePanel />
          <AccountDataManagement />
        </>
      )}

      {activeTab === "about" && (
        <>
          <AccountAbout />
          <AccountFeedback />
        </>
      )}
    </>
  );
}

const managementTabs: Array<{ id: AccountTab; label: string; icon: typeof UserRound }> = [
  { id: "account", label: "账号", icon: UserRound },
  { id: "app", label: "应用", icon: Settings },
  { id: "data", label: "数据", icon: Database },
  { id: "about", label: "关于", icon: Info }
];
