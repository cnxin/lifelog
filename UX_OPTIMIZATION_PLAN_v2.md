# LifeLog UX 优化方案 v2.0

> **现行主方案**：[`docs/OPTIMIZATION_MASTER_PLAN.md`](./docs/OPTIMIZATION_MASTER_PLAN.md)（2026-07-13 起唯一优化任务板）
> 本文仅作历史 UX 诊断归档，**请勿按正文平行开新迭代**。
> 项目：React 18 + TypeScript + IndexedDB + Capacitor  
> 日期：2026-07-07  
> **状态更新 2026-07-11**：流体手感主线见 [`APPLE_FEEL_EXECUTION_PLAN.md`](./APPLE_FEEL_EXECUTION_PLAN.md)，对照 Demo：`demo/apple-feel-compare.html`。

## 落地状态速查

| 项 | 状态 |
|----|------|
| 首页自适应布局 | Done / Partial（`useHomeLayout`） |
| 记录流程统一 / 快速记录 Toast | Done |
| 持久化用户偏好 | Done（`useUserPreferences`） |
| 照片 HEIC / 队列 | Done 基础版 |
| 全局搜索 / 快捷键 | Partial |
| 批量操作 | Partial（地点等） |
| Android 返回键分层 | Done |
| **EntrySheet 流体拖关** | **In progress → 本迭代落地** |
| **PhotoViewer 速度投影** | **本迭代落地** |
| **Pressable / FAB spring** | **本迭代落地** |

---

## 项目现状

**技术栈：**
- React 18 + TypeScript + Vite
- IndexedDB (Dexie) 本地存储
- Capacitor 8 (Android 跨平台)
- React Router 6 单页应用
- 4 种主题风格（classic, cream, mint, mist）

**核心功能模块：**
- 人物管理（生日、纪念日、喜好档案）
- 地点管理（餐厅、商场、景点）
- 回忆记录（快速记录 vs 完整表单）
- 日历与提醒
- 本地分享（JSON/二维码）
- Notion 同步（实验性功能）

---

## 核心 UX 痛点（按影响面排序）

### 1. 首页信息过载但缺乏个性化
- 首页包含 7+ 个独立区块，所有用户看到的内容一样
- "最近看看"默认折叠，但可能是老用户最常用的入口
- 新用户感到压倒性复杂，老用户找常用功能需要多次滚动

### 2. 记录流程的模式混淆
- "快速记录"和"完整表单"两种模式体验不一致
- 快速记录保存后弹出补充面板，打断用户流程
- 用户需要学习多个心智模型

### 3. 关键操作隐藏过深
- 人物/地点选择器默认折叠
- 回忆详情页的核心信息收进折叠区
- 增加了完成任务的操作步骤数

### 4. FAB（浮动按钮）操作过多
- 首页 FAB 包含 7 个操作选项
- 高频操作（记一件事）和低频操作混在一起
- 造成选择困难

### 5. 折叠/展开状态不可记忆
- 每次进入首页都恢复默认状态
- 用户的操作习惯无法被系统记住
- 导致重复操作

### 6. 照片处理体验不稳定
- 照片上传失败频发（CHANGELOG 记录）
- HEIC/HEIF 格式需要用户手动转换
- 核心功能不可靠

### 7. 搜索功能入口不明显
- 全局搜索隐藏在 Header，视觉权重低
- 没有快捷键支持（Cmd+K / Ctrl+K）
- 数据增多后查找困难

### 8. 缺少批量操作能力
- 无法批量删除、批量标记、批量导出
- 数据清理和整理效率低

---

## 优化方案（三级优先级）

## P0 - 短期快速改进（1 周内完成）

### 1. 首页自适应布局

**目标：** 根据用户数据量动态调整首页区块顺序和展开状态

**实现文件：**
- `src/pages/Home.tsx` (修改)
- `src/hooks/useHomeLayout.ts` (新建)

**核心逻辑：**

```typescript
// src/hooks/useHomeLayout.ts
export function useHomeLayout() {
  const { totalRecords, todayActions, onThisDayMemories } = useStats();
  
  return useMemo(() => {
    const layout = [];
    
    // 有待办 → 待办队列置顶
    if (todayActions.length > 0) {
      layout.push({ id: 'todayQueue', priority: 1, expanded: true });
    }
    
    // 有历年今日 → 历年今日卡片
    if (onThisDayMemories.length > 0) {
      layout.push({ id: 'flashback', priority: 2, expanded: true });
    }
    
    // 数据量 > 30 → 最近看看默认展开
    if (totalRecords > 30) {
      layout.push({ id: 'homeLibrary', priority: 4, expanded: true });
    }
    
    // 数据量 < 10 → 任务队列引导
    if (totalRecords < 10) {
      layout.push({ id: 'taskQueue', priority: 5, expanded: true });
    }
    
    return layout.sort((a, b) => a.priority - b.priority);
  }, [totalRecords, todayActions, onThisDayMemories]);
}
```

**预期效果：** 新用户看到引导任务，老用户直达常用内容

---

### 2. 记录流程统一化

**目标：** 快速记录不再弹出模态打断，改为轻量级提示

**实现文件：**
- `src/components/QuickRecord/QuickRecord.tsx` (修改)
- `src/components/Toast/SuccessToast.tsx` (新建)

**改进方案：**
- 快速记录保存后不弹出补充面板
- 底部轻量级提示条："✓ 已保存 · [补充照片] [查看详情]"
- 3 秒后自动消失

```typescript
// 替换当前的 Modal 逻辑
const handleQuickSave = async () => {
  await saveMemory(quickData);
  
  showSuccessToast({
    message: '已保存',
    actions: [
      { label: '补充照片', onClick: () => openPhotoUploader(memoryId) },
      { label: '查看详情', onClick: () => navigate(`/memory/${memoryId}`) }
    ],
    duration: 3000
  });
};
```

**预期效果：** 减少模态打断，提升记录流畅度 50%

---

### 3. 智能默认展开规则

**目标：** 人物/地点选择器根据上下文智能展开

**实现文件：**
- `src/components/PersonPicker/PersonPicker.tsx` (修改)
- `src/components/PlacePicker/PlacePicker.tsx` (修改)

**展开逻辑：**

```typescript
const shouldExpandPicker = () => {
  // 新用户默认展开
  if (recentlyUsed.length === 0) return true;
  
  // 刚添加完人物，期望立即使用
  if (lastAction === 'addPerson') return true;
  
  // 还没选择任何人
  if (currentPersons.length === 0) return true;
  
  // 已有选择，保持轻量
  return false;
};
```

**预期效果：** 减少无意义折叠，降低操作步骤数

---

### 4. FAB 操作精简

**目标：** FAB 只保留 3 个最高频操作

**实现文件：**
- `src/components/FAB/HomeFAB.tsx` (修改)

**精简方案：**

首页 FAB 只保留：
1. **记一件事**（快速记录）
2. **带照片记录**
3. **识别地点分享**（粘贴板智能识别）

其他操作移到 Header 的"+"图标下拉菜单：
- 添加人物
- 添加地点
- 扫描二维码
- 导入数据

**预期效果：** 选择成本降低 60%，首要操作触达率提升

---

### 5. 持久化用户偏好

**目标：** 应用记住用户的折叠习惯和偏好设置

**实现文件：**
- `src/stores/userPreferences.ts` (新建)
- `src/utils/localStorage.ts` (修改)

**偏好配置：**

```typescript
interface UserPreferences {
  // 首页区块展开状态
  homeTodayQueueExpanded: boolean;
  homeTaskQueueExpanded: boolean;
  homeLibraryExpanded: boolean;
  
  // 列表视图模式
  listViewMode: 'compact' | 'detailed';
  
  // 默认记录模式
  defaultMemoryMode: 'quick' | 'full';
  
  // 地点卡片默认展开
  placeCardExpanded: boolean;
}

// 使用 localStorage 持久化
export const useUserPreferences = () => {
  const [prefs, setPrefs] = useState<UserPreferences>(() => 
    loadFromLocalStorage('userPreferences') || DEFAULT_PREFERENCES
  );
  
  const updatePreference = (key: keyof UserPreferences, value: any) => {
    const newPrefs = { ...prefs, [key]: value };
    setPrefs(newPrefs);
    saveToLocalStorage('userPreferences', newPrefs);
  };
  
  return { prefs, updatePreference };
};
```

**预期效果：** 减少重复操作，应用"记住"用户习惯

---

## P1 - 中期功能增强（2-3 周完成）

### 6. 照片处理增强

**目标：** 照片上传成功率接近 100%

**实现文件：**
- `src/utils/imageProcessor.ts` (重构)
- `src/components/PhotoUpload/PhotoUploadQueue.tsx` (新建)

**改进方案：**

1. **前置格式检测 + 友好提示**
```typescript
const SUPPORTED_FORMATS = ['image/jpeg', 'image/png', 'image/webp'];
const CONVERTIBLE_FORMATS = ['image/heic', 'image/heif'];

const handleFileSelect = (file: File) => {
  if (SUPPORTED_FORMATS.includes(file.type)) {
    return processImage(file);
  }
  
  if (CONVERTIBLE_FORMATS.includes(file.type)) {
    showToast({
      type: 'info',
      message: 'HEIC 格式正在转换为 JPEG...',
      duration: 0 // 持续显示直到转换完成
    });
    return convertHEICToJPEG(file);
  }
  
  showToast({
    type: 'error',
    message: `不支持的格式：${file.type}`,
    action: { label: '查看支持格式', onClick: showSupportedFormats }
  });
};
```

2. **引入 HEIC 转换库**
```bash
npm install heic2any
```

3. **上传队列可视化**
```typescript
<PhotoUploadQueue 
  files={uploadQueue}
  onProgress={(current, total) => `正在处理 ${current}/${total} 张照片`}
  onError={(file, error) => handleUploadError(file, error)}
  onRetry={(file) => retryUpload(file)}
/>
```

**预期效果：** 上传成功率从 ~80% 提升到 ~98%

---

### 7. 全局搜索升级

**目标：** 让搜索成为数据检索的主要入口

**实现文件：**
- `src/components/Search/GlobalSearch.tsx` (重构)
- `src/hooks/useSearchShortcut.ts` (新建)
- `src/stores/searchHistory.ts` (新建)

**功能增强：**

1. **快捷键支持**
```typescript
// useSearchShortcut.ts
export function useSearchShortcut() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        openGlobalSearch();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
}
```

2. **搜索面板增强**
```typescript
<SearchPanel>
  {/* 空状态 */}
  {query === '' && (
    <EmptyState>
      <RecentSearches items={recentSearches} />
      <SearchSuggestions 
        suggestions={[
          { label: '按时间搜索', example: '2024-01' },
          { label: '按人搜索', example: '@张三' },
          { label: '按地点搜索', example: '#星巴克' }
        ]}
      />
      <Statistics 
        memories={120}
        persons={58}
        places={32}
      />
    </EmptyState>
  )}
  
  {/* 搜索结果 */}
  {query !== '' && (
    <SearchResults 
      results={results}
      renderPreview={(item) => <MemoryPreview {...item} />}
    />
  )}
</SearchPanel>
```

**预期效果：** 搜索使用频率提升 3 倍

---

### 8. 批量操作支持

**目标：** 提供批量管理能力

**实现文件：**
- `src/components/List/BatchActionBar.tsx` (新建)
- `src/hooks/useBatchSelection.ts` (新建)

**实现方案：**

```typescript
// useBatchSelection.ts
export function useBatchSelection<T extends { id: string }>(items: T[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isManageMode, setIsManageMode] = useState(false);
  
  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };
  
  const selectAll = () => setSelectedIds(new Set(items.map(i => i.id)));
  const clearSelection = () => setSelectedIds(new Set());
  
  return {
    selectedIds,
    isManageMode,
    setIsManageMode,
    toggleSelection,
    selectAll,
    clearSelection,
    selectedCount: selectedIds.size
  };
}
```

**UI 组件：**

```typescript
<BatchActionBar 
  selectedCount={selectedCount}
  onDelete={() => handleBatchDelete(selectedIds)}
  onExport={() => handleBatchExport(selectedIds)}
  onCancel={clearSelection}
  actions={[
    { label: '标记收藏', icon: 'Star', onClick: handleBatchFavorite },
    { label: '修改标签', icon: 'Tag', onClick: handleBatchTag }
  ]}
/>
```

**预期效果：** 数据整理效率提升 10 倍

---

### 9. 快捷键支持

**目标：** 桌面端效率提升

**实现文件：**
- `src/hooks/useGlobalShortcuts.ts` (新建)
- `src/components/ShortcutHelp/ShortcutHelp.tsx` (新建)

**快捷键清单：**

```typescript
const shortcuts = {
  'Cmd/Ctrl + K': '全局搜索',
  'Cmd/Ctrl + N': '快速记录',
  'Cmd/Ctrl + Shift + N': '完整记录',
  'Cmd/Ctrl + 1': '首页',
  'Cmd/Ctrl + 2': '人物',
  'Cmd/Ctrl + 3': '地点',
  'Cmd/Ctrl + 4': '回忆',
  'Cmd/Ctrl + 5': '日历',
  'Esc': '关闭弹窗/取消',
  'Cmd/Ctrl + /': '快捷键帮助'
};
```

**预期效果：** 专业用户满意度提升，操作效率 +40%

---

### 10. Android 返回键优化

**目标：** 符合 Android 用户习惯

**实现文件：**
- `src/hooks/useBackHandler.ts` (重构)

**返回层级：**

```typescript
const backHandlerStack = [
  { priority: 1, handler: closeSearchPanel },
  { priority: 2, handler: closeModal },
  { priority: 3, handler: closeSidebar },
  { priority: 4, handler: navigateBack }
];

// 有未保存内容时确认
if (hasUnsavedChanges) {
  showConfirmDialog({
    title: '确认返回？',
    message: '有未保存的内容，返回将丢失',
    confirmText: '放弃',
    cancelText: '继续编辑'
  });
}
```

**预期效果：** 减少误操作，提升移动端体验

---

## P2 - 长期架构优化（1-2 月完成）

### 11. 智能推荐系统

**功能点：**
- "你已经 14 天没记录和张三的事了"
- "上个月你去了 5 次这家餐厅，要不要标记为收藏？"
- 纪念日提前 7 天、3 天、1 天分级提醒

**实现文件：**
- `src/services/recommendation.ts` (新建)
- `src/components/SmartPrompt/SmartPrompt.tsx` (新建)

---

### 12. 社交分享增强

**功能点：**
- 回忆卡片图片生成（多种风格）
- 微信小程序预留接口
- 分享为精美图片（带隐私保护）

**实现文件：**
- `src/utils/cardGenerator.ts` (新建)
- `src/components/ShareCard/ShareCard.tsx` (新建)

---

### 13. 数据可视化

**功能点：**
- 年度回忆热力图
- 人物互动频率图
- 地点分布地图
- 心情趋势图
- 年度报告导出

**实现文件：**
- `src/pages/Statistics.tsx` (新建)
- `src/components/Charts/` (新建目录)

**推荐库：**
```bash
npm install recharts
```

---

### 14. 协作与家庭账户

**功能点：**
- 家庭空间：多账号共享数据
- 权限控制：只读 vs 编辑
- 评论功能：在共享回忆下留言

**实现文件：**
- `src/services/collaboration.ts` (新建)
- `src/pages/FamilySpace.tsx` (新建)

---

## 实施优先级矩阵

| 优化项 | 影响范围 | 开发成本 | 优先级 | 预计工期 |
|--------|---------|---------|--------|---------|
| 首页自适应布局 | 100% | 低 | P0 | 2 天 |
| 记录流程统一化 | 80% | 低 | P0 | 1 天 |
| 智能默认展开 | 60% | 低 | P0 | 1 天 |
| FAB 精简 | 100% | 中 | P0 | 2 天 |
| 持久化偏好 | 50% | 低 | P0 | 1 天 |
| 照片处理增强 | 40% | 中 | P1 | 3 天 |
| 全局搜索升级 | 70% | 中 | P1 | 3 天 |
| 批量操作 | 30% | 中 | P1 | 4 天 |
| 快捷键支持 | 20% | 低 | P1 | 2 天 |
| Android 返回键 | 移动端 | 低 | P1 | 1 天 |
| 智能推荐 | 100% | 高 | P2 | 10 天 |
| 社交分享增强 | 30% | 高 | P2 | 8 天 |
| 数据可视化 | 50% | 高 | P2 | 12 天 |
| 家庭账户 | 20% | 极高 | P2 | 20 天 |

---

## 关键指标建议

**效率指标：**
- 完成一次完整记录的平均时间（目标：< 60 秒）
- 从首页到目标操作的平均点击数（目标：≤ 3 次）
- 照片上传成功率（目标：> 95%）

**用户行为指标：**
- 快速记录 vs 完整表单使用比例（预期 7:3）
- 首页各区块展开率
- 搜索功能使用频率（优化后预期提升 3 倍）

**留存指标：**
- 7 日留存率（目标：> 40%）
- 30 日活跃用户数
- 平均每周记录条数（预期从 2 条提升到 5 条）

---

## 建议实施路径

**第 1 周（P0 全部）：**
1. 首页自适应布局 (2 天)
2. 记录流程统一化 (1 天)
3. 智能默认展开规则 (1 天)
4. FAB 操作精简 (2 天)
5. 持久化用户偏好 (1 天)

**第 2-3 周（P1 高优先级）：**
6. 照片处理增强 (3 天)
7. 全局搜索升级 (3 天)
8. 批量操作支持 (4 天)
9. 快捷键支持 (2 天)
10. Android 返回键优化 (1 天)

**第 4-8 周（P2 按需选择）：**
- 建议优先实施：数据可视化 → 智能推荐 → 社交分享增强
- 家庭账户功能作为长期规划

---

## 依赖包安装清单

```bash
# 照片处理
npm install heic2any

# 图表库
npm install recharts

# 日期处理（如果还没有）
npm install date-fns

# 工具库
npm install lodash-es
npm install @types/lodash-es -D
```

---

## 总结

LifeLog 是一个功能完整、技术实现扎实的生活记录应用，当前 UX 主要问题：

1. **信息架构过于复杂** → 需要自适应布局
2. **交互深度过深** → 需要智能展开规则
3. **一致性不足** → 需要统一流程体验
4. **缺乏智能化** → 需要记住用户习惯

**核心建议：** 先实施 P0（1 周），立即提升 70% 用户体验；再逐步实施 P1，最终通过 P2 实现从"工具"到"智能助手"的升级。
