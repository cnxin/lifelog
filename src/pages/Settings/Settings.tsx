import { BarChart3, Database, GitMerge, Info, SlidersHorizontal } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import GlassCard from "../../components/GlassCard";
import Tags from "../../components/Tags";
import { useConfirm } from "../../context/ConfirmContext";
import { useLifeLog } from "../../context/LifeLogContext";

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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const importLockRef = useRef(false);
  const mergeLockRef = useRef(false);
  const undoLockRef = useRef(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);

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
  const strongCount = useMemo(
    () => duplicatePlaceGroups.filter((group) => group.strength === "strong").length,
    [duplicatePlaceGroups]
  );

  async function handleImport(file: File | undefined) {
    if (!file) return;
    if (importLockRef.current) return;
    const accepted = await confirm({
      title: "导入数据",
      message: "确认导入这个 JSON？当前 IndexedDB 数据会被覆盖。",
      confirmText: "确认导入"
    });
    if (!accepted) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    importLockRef.current = true;
    setIsImporting(true);
    try {
      await importData(file);
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
      message: "清空所有数据并还原 Demo，确认继续吗？",
      confirmText: "确认重置"
    });
    if (!accepted) return;
    await resetDemo();
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
        <div className="list">
          <button className="detail-row detail-button glass-card" onClick={exportData}>
            <strong>导出数据</strong>
            <span>下载 JSON 备份文件</span>
          </button>
          <button
            className="detail-row detail-button glass-card"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
          >
            <strong>{isImporting ? "导入中…" : "导入数据"}</strong>
            <span>从 JSON 备份恢复</span>
          </button>
          <button className="detail-row detail-button glass-card" onClick={() => void handleReset()}>
            <strong>重置为示例数据</strong>
            <span>清空所有数据并还原 Demo</span>
          </button>
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
            <SlidersHorizontal /> 默认值
          </h2>
        </div>
        <div className="list">
          <GlassCard className="detail-row">
            <strong>默认城市</strong>
            <input
              className="settings-inline-input"
              defaultValue={settings.defaultCity}
              placeholder="杭州"
              onBlur={(event) => handleSettingsBlur("defaultCity", event.target.value)}
            />
          </GlassCard>
          <GlassCard className="detail-row">
            <strong>默认关系</strong>
            <input
              className="settings-inline-input"
              defaultValue={settings.defaultRelationship}
              placeholder="朋友"
              onBlur={(event) => handleSettingsBlur("defaultRelationship", event.target.value)}
            />
          </GlassCard>
          <GlassCard className="detail-row">
            <strong>默认心情</strong>
            <input
              className="settings-inline-input"
              defaultValue={settings.defaultMood}
              placeholder="开心"
              onBlur={(event) => handleSettingsBlur("defaultMood", event.target.value)}
            />
          </GlassCard>
        </div>
        <p className="form-hint settings-section-hint">新建人物、地点和回忆时会使用这些默认值，修改后自动保存。</p>
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
            <span>0.1.0-test.28</span>
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
    </>
  );
}
