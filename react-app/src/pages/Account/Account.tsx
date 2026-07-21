import { CloudOff, Crown, Database, FlaskConical, Info, KeyRound, Settings, UserRound } from "lucide-react";
import { useLayoutEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import ListRow from "../../components/ListRow";
import { AppSettingsPanel, DataOrganizePanel } from "../Settings/Settings";
import AccountAbout from "./AccountAbout";
import AccountDataManagement from "./AccountDataManagement";
import AccountFeedback from "./AccountFeedback";
import AccountNotionSync from "./AccountNotionSync";

type AccountTab = "account" | "app" | "data" | "labs" | "about";

export default function Account() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<AccountTab>(() => getInitialAccountTab(location.state));

  useLayoutEffect(() => {
    document.querySelector<HTMLElement>(".main-content")?.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [activeTab]);

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
          <div className="management-card-grid content-list settings-list">
            <ListRow className="management-info-card">
              <UserRound />
              <div>
                <strong>本地免费</strong>
                <span>人物、地点、回忆、提醒、备份、分享等本地功能全部免费使用。</span>
              </div>
            </ListRow>
            <ListRow className="management-info-card">
              <CloudOff />
              <div>
                <strong>云端高级</strong>
                <span>暂未开启。后续只对云同步、云备份、多设备和云端恢复做高级能力。</span>
              </div>
            </ListRow>
            <ListRow className="management-info-card">
              <Crown />
              <div>
                <strong>购买验证</strong>
                <span>仅用于云端高级权益校验，不影响任何本地功能使用。</span>
              </div>
            </ListRow>
            <ListRow className="management-info-card">
              <KeyRound />
              <div>
                <strong>授权信息</strong>
                <span>暂无云端订阅凭证。后续可用于恢复购买和绑定云端账号。</span>
              </div>
            </ListRow>
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

      {activeTab === "labs" && <AccountNotionSync />}

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
  { id: "labs", label: "实验", icon: FlaskConical },
  { id: "about", label: "关于", icon: Info }
];

function getInitialAccountTab(state: unknown): AccountTab {
  if (!state || typeof state !== "object") return "account";
  const value = (state as { accountTab?: unknown }).accountTab;
  return value === "account" || value === "app" || value === "data" || value === "labs" || value === "about"
    ? value
    : "account";
}
