import { BarChart3, Bell, ChevronDown, Database, Download, GitMerge, Info, RotateCcw, SlidersHorizontal, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import DateInput from "../../components/DateInput";
import GlassCard from "../../components/GlassCard";
import NumberStepper from "../../components/NumberStepper";
import Tags from "../../components/Tags";
import TimePicker from "../../components/TimePicker";
import { useConfirm } from "../../context/ConfirmContext";
import { useToast } from "../../context/ToastContext";
import { useLifeLog } from "../../context/LifeLogContext";
import type { ThemeStyle } from "../../types";
import ReminderSettings from "./ReminderSettings";

const themeOptions: Array<{
  value: ThemeStyle;
  label: string;
  desc: string;
}> = [
  {
    value: "classic",
    label: "原版",
    desc: "紫橙渐变"
  },
  {
    value: "cream",
    label: "奶油纸感",
    desc: "温柔米白"
  },
  {
    value: "mint",
    label: "薄荷留白",
    desc: "绿蓝清爽"
  },
  {
    value: "mist",
    label: "晨雾极简",
    desc: "冷灰极简"
  }
];

export default function Settings() {
  const {
    state,
    settings,
    duplicatePlaceGroups,
    latestPlaceMerge,
    mergeAllDuplicatePlaces,
    undoLatestPlaceMerge,
    updateSettings,
    exportData,
    importData,
    resetDemo
  } = useLifeLog();
  const confirm = useConfirm();
  const notify = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const importLockRef = useRef(false);
  const mergeLockRef = useRef(false);
  const undoLockRef = useRef(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [showReminders, setShowReminders] = useState(false);
  const [openPicker, setOpenPicker] = useState<"relationship" | "mood" | null>(null);
  const [pickerAnchor, setPickerAnchor] = useState({ top: 0, right: 0 });

  const relationshipOptions = ["朋友", "家人", "同事", "同学", "恋人", "其他"];
  const moodOptions = ["开心", "平静", "感动", "怀念", "疲惫", "焦虑", "日常"];

  const favoritePeopleCount = useMemo(
    () => state.people.filter((person) => person.favorite).length,
    [state.people]
  );
  const favoritePlacesCount = useMemo(
    () => state.places.filter((place) => place.favorite).length,
    [state.places]
  );
  const cityCount = useMemo(
    () => new Set(state.places.map((place) => place.city).filter(Boolean)).size,
    [state.places]
  );
  const dataSummary = useMemo(
    () => [
      `${state.people.length} 个人物`,
      `${state.places.length} 个地点`,
      `${state.memories.length} 条回忆`
    ].join(" · "),
    [state.memories.length, state.people.length, state.places.length]
  );
  const hasUserData = state.people.length > 0 || state.places.length > 0 || state.memories.length > 0;
  const strongCount = useMemo(
    () => duplicatePlaceGroups.filter((group) => group.strength === "strong").length,
    [duplicatePlaceGroups]
  );

  async function handleImport(file: File | undefined) {
    if (!file) return;
    if (importLockRef.current) return;
    const accepted = await confirm({
      title: "导入数据",
      message: `导入会覆盖当前本地数据（${dataSummary}）。建议先导出备份，再确认导入这个 JSON 文件。`,
      confirmText: "确认覆盖导入"
    });
    if (!accepted) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    importLockRef.current = true;
    setIsImporting(true);
    try {
      await importData(file);
      notify({ message: "数据导入完成，当前资料已恢复", tone: "success" });
    } catch (error) {
      await confirm({
        title: "导入失败",
        message: error instanceof Error ? error.message : "请检查文件格式。",
        confirmText: "知道了",
        tone: "info"
      });
    } finally {
      importLockRef.current = false;
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleReset() {
    const accepted = await confirm({
      title: "重置为示例数据",
      message: `这会清空当前本地数据（${dataSummary}）并替换为 Demo 示例数据。建议先导出备份。`,
      confirmText: "确认重置"
    });
    if (!accepted) return;
    await resetDemo();
    notify({ message: "已重置为示例数据", tone: "success" });
  }

  async function handleMergeAll() {
    if (mergeLockRef.current) return;
    mergeLockRef.current = true;
    setIsMerging(true);
    try {
      const mergedCount = await mergeAllDuplicatePlaces();
      await confirm({
        title: "合并完成",
        message: mergedCount ? `已合并 ${mergedCount} 条重复地点。` : "没有可自动合并的强重复地点。",
        confirmText: "好的",
        tone: "info"
      });
    } finally {
      mergeLockRef.current = false;
      setIsMerging(false);
    }
  }

  async function handleUndo() {
    if (undoLockRef.current) return;
    const accepted = await confirm({
      title: "撤销上次合并",
      message: "将恢复到上次地点合并前的状态。",
      confirmText: "确认撤销"
    });
    if (!accepted) return;

    undoLockRef.current = true;
    setIsUndoing(true);
    try {
      const reverted = await undoLatestPlaceMerge();
      await confirm({
        title: "撤销结果",
        message: reverted ? "已撤销上次地点合并。" : "没有可撤销的地点合并记录。",
        confirmText: "好的",
        tone: "info"
      });
    } finally {
      undoLockRef.current = false;
      setIsUndoing(false);
    }
  }

  function handleSettingsBlur<K extends keyof typeof settings>(key: K, value: string) {
    void updateSettings({
      [key]: value.trim()
    });
  }

  function togglePicker(type: "relationship" | "mood", element: HTMLButtonElement) {
    if (openPicker === type) {
      setOpenPicker(null);
      return;
    }

    const appContainer = element.closest(".app-container")?.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    setPickerAnchor({
      top: rect.bottom - (appContainer?.top || 0) + 8,
      right: (appContainer?.right || window.innerWidth) - rect.right
    });
    setOpenPicker(type);
  }

  function handlePickerSelect<K extends keyof typeof settings>(key: K, value: string) {
    setOpenPicker(null);
    void updateSettings({
      [key]: value
    });
  }

  return (
    <>
      <section className="section">
        <div className="section-header">
          <h2>
            <BarChart3 /> 数据概览
          </h2>
        </div>
        <GlassCard className="insight-card">
          <div className="metric">
            <strong>{state.people.length}</strong>
            <span>人物</span>
          </div>
          <div className="metric">
            <strong>{state.places.length}</strong>
            <span>地点</span>
          </div>
          <div className="metric">
            <strong>{state.memories.length}</strong>
            <span>回忆</span>
          </div>
        </GlassCard>
        <GlassCard className="insight-card">
          <div className="metric">
            <strong>{favoritePeopleCount}</strong>
            <span>收藏人物</span>
          </div>
          <div className="metric">
            <strong>{favoritePlacesCount}</strong>
            <span>收藏地点</span>
          </div>
          <div className="metric">
            <strong>{cityCount}</strong>
            <span>去过的城市</span>
          </div>
        </GlassCard>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>
            <Database /> 数据管理
          </h2>
        </div>
        <div className="data-management-panel">
          <GlassCard className="data-management-intro">
            <strong>本地数据备份</strong>
            <span>{dataSummary}</span>
            <p>数据保存在当前设备的 IndexedDB 中。导出不会修改现有数据；导入和重置会覆盖当前本地数据。</p>
          </GlassCard>
          <div className="data-action-grid">
            <button
              className="data-action-card glass-card"
              onClick={() => {
                exportData();
                notify({ message: "JSON 备份文件已生成", tone: "success" });
              }}
              disabled={!hasUserData}
            >
              <div className="data-action-icon">
                <Download />
              </div>
              <div>
                <strong>导出 JSON 备份</strong>
                <span>保存人物、地点、回忆和设置</span>
              </div>
            </button>
            <button
              className="data-action-card glass-card"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
            >
              <div className="data-action-icon">
                <Upload />
              </div>
              <div>
                <strong>{isImporting ? "导入中…" : "从 JSON 恢复"}</strong>
                <span>导入前会再次确认覆盖风险</span>
              </div>
            </button>
            <button className="data-action-card danger glass-card" onClick={() => void handleReset()}>
              <div className="data-action-icon">
                <RotateCcw />
              </div>
              <div>
                <strong>重置为示例数据</strong>
                <span>清空当前数据并还原 Demo</span>
              </div>
            </button>
          </div>
        </div>
        <input
          ref={fileInputRef}
          className="hidden-file"
          type="file"
          accept=".json,application/json"
          onChange={(event) => void handleImport(event.target.files?.[0])}
        />
      </section>

      <section className="section">
        <div className="section-header">
          <h2>
            <GitMerge /> 地点去重
          </h2>
        </div>
        {duplicatePlaceGroups.length > 0 ? (
          <>
            <GlassCard className="pref-block">
              <p className="memory-desc">
                发现 {duplicatePlaceGroups.length} 组疑似重复地点，其中 {strongCount} 组强重复可以自动合并。
              </p>
              {strongCount > 0 && (
                <button
                  className="category-pill active"
                  onClick={() => void handleMergeAll()}
                  disabled={isMerging}
                >
                  {isMerging ? "合并中…" : "一键合并强重复"}
                </button>
              )}
            </GlassCard>
            <div className="list">
              {duplicatePlaceGroups.map((group) => (
                <GlassCard className="detail-row" key={group.signature}>
                  <strong>{group.label}</strong>
                  <span>{group.placeIds.length} 条 · {group.strength === "strong" ? "强重复" : "弱重复"}</span>
                </GlassCard>
              ))}
            </div>
          </>
        ) : (
          <GlassCard className="empty">没有发现重复地点</GlassCard>
        )}
        {latestPlaceMerge && (
          <div className="settings-undo-row">
            <p className="form-hint">上次合并：{latestPlaceMerge.reason}</p>
            <button
              className="category-pill"
              onClick={() => void handleUndo()}
              disabled={isUndoing}
            >
              {isUndoing ? "撤销中…" : "撤销上次合并"}
            </button>
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-header">
          <h2>
            <Bell /> 提醒设置
          </h2>
          <button
            className="category-pill"
            onClick={() => setShowReminders(!showReminders)}
          >
            {showReminders ? "收起" : "展开"}
          </button>
        </div>
        {showReminders && <ReminderSettings />}
      </section>

      <section className="section">
        <div className="section-header">
          <h2>
            <SlidersHorizontal /> 默认值
          </h2>
        </div>
        <div className="list">
          <GlassCard className="detail-row settings-default-row">
            <strong>默认城市</strong>
            <input
              className="settings-default-input"
              defaultValue={settings.defaultCity}
              placeholder="杭州"
              onBlur={(event) => handleSettingsBlur("defaultCity", event.target.value)}
            />
          </GlassCard>
          <GlassCard className="detail-row settings-default-row">
            <strong>默认关系</strong>
            <div className="settings-picker">
              <button
                className="settings-picker-trigger"
                type="button"
                aria-expanded={openPicker === "relationship"}
                onClick={(event) => togglePicker("relationship", event.currentTarget)}
              >
                <span>{settings.defaultRelationship}</span>
                <ChevronDown />
              </button>
            </div>
          </GlassCard>
          <GlassCard className="detail-row settings-default-row">
            <strong>默认心情</strong>
            <div className="settings-picker">
              <button
                className="settings-picker-trigger"
                type="button"
                aria-expanded={openPicker === "mood"}
                onClick={(event) => togglePicker("mood", event.currentTarget)}
              >
                <span>{settings.defaultMood}</span>
                <ChevronDown />
              </button>
            </div>
          </GlassCard>
          <GlassCard className="settings-control-demo">
            <div className="settings-control-demo-header">
              <strong>控件样式 Demo</strong>
              <span>确认后可批量替换原始控件</span>
            </div>
            <div className="settings-control-demo-grid">
              <label className="settings-control-field">
                <span>日期</span>
                <DateInput label="Demo 日期" defaultValue="2026-05-08" />
              </label>
              <label className="settings-control-field">
                <span>时间</span>
                <TimePicker label="Demo 时间" value="09:00" onChange={() => undefined} />
              </label>
              <label className="settings-control-field">
                <span>数字</span>
                <NumberStepper min={1} max={30} defaultValue={7} label="Demo 数字" />
              </label>
              <div className="settings-control-field inline">
                <span>开关</span>
                <label className="reminder-toggle">
                  <input type="checkbox" defaultChecked />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
          </GlassCard>
        </div>
        <p className="form-hint settings-section-hint">新建人物、地点和回忆时会使用这些默认值，修改后自动保存。</p>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>
            <SlidersHorizontal /> 视觉风格
          </h2>
        </div>
        <div className="theme-selector-row">
          {themeOptions.map((option) => (
            <button
              className={`theme-option theme-option-${option.value} ${settings.themeStyle === option.value ? "active" : ""}`}
              type="button"
              key={option.value}
              aria-pressed={settings.themeStyle === option.value}
              onClick={() => void updateSettings({ themeStyle: option.value })}
            >
              <span className="theme-option-swatch" aria-hidden="true" />
              <strong>{option.label}</strong>
              <small>{option.desc}</small>
            </button>
          ))}
        </div>
        <p className="form-hint settings-section-hint">选择后会立即应用到全局页面和控件，并在刷新后保留。</p>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>
            <Info /> 关于
          </h2>
        </div>
        <div className="list">
          <GlassCard className="detail-row">
            <strong>版本</strong>
            <span>0.1.0-test.29</span>
          </GlassCard>
          <GlassCard className="detail-row">
            <strong>存储</strong>
            <span>IndexedDB (Dexie v4)</span>
          </GlassCard>
          <GlassCard className="detail-row">
            <strong>技术栈</strong>
            <span>React + TypeScript + Capacitor</span>
          </GlassCard>
        </div>
        <div className="settings-about-tags">
          <Tags items={["React 18", "Vite", "Dexie", "Capacitor 8", "PWA", "lucide-react"]} />
        </div>
      </section>

      {openPicker && (
        <>
          <button
            className="settings-picker-backdrop"
            type="button"
            aria-label="关闭选项菜单"
            onClick={() => setOpenPicker(null)}
          />
          <div
            className="settings-picker-menu"
            style={{ top: pickerAnchor.top, right: pickerAnchor.right }}
          >
            {(openPicker === "relationship" ? relationshipOptions : moodOptions).map((option) => {
              const activeValue = openPicker === "relationship" ? settings.defaultRelationship : settings.defaultMood;
              return (
                <button
                  className={option === activeValue ? "active" : ""}
                  type="button"
                  key={option}
                  onClick={() =>
                    handlePickerSelect(openPicker === "relationship" ? "defaultRelationship" : "defaultMood", option)
                  }
                >
                  {option}
                </button>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
