# 📋 实施计划：提醒功能完善

**任务类型**: 全栈（前端 UI + 后端逻辑修复）  
**创建时间**: 2026-05-08  
**项目**: LifeLog React App

---

## 任务概述

为 LifeLog React App 完善本地通知提醒系统。当前已有基础设施（数据库、权限管理、调度器），但存在以下缺口：

1. **核心 Bug**：`reminderScheduler.ts` 的"提前 N 天提醒"日期计算错误
2. **缺失 UI**：提醒设置页面和入口
3. **缺失集成**：应用启动时的调度逻辑和数据变更监听

---

## 技术方案

### 方案选择：独立提醒集成 Hook（推荐）

基于 codex 分析，采用 **Option B**：

- 新建 `useReminderScheduling` Hook 处理调度生命周期
- 修正 `reminderScheduler.ts` 的日期计算 bug
- 创建 `ReminderSettings.tsx` UI 页面
- 在 `Settings.tsx` 添加入口
- 在 `App.tsx` 或 `AppLayout.tsx` 挂载调度 Hook

**优势**：
- 生命周期清晰，不污染路由和数据 Context
- 易于处理数据变更自动重调度
- 可统一处理权限、StrictMode、平台差异
- 后续扩展（app resume、通知点击跳转）更自然

---

## 实施步骤（可勾选清单）

### Step 1: 修正调度器日期计算 Bug（Critical）⚠️

**文件**: `src/utils/reminderScheduler.ts`

- [x] 1.1 修正生日提前提醒日期计算
  - 位置：`generateBirthdayReminders` 函数，第 67-74 行
  - 修改：`getScheduleDate(days, ...)` → `getScheduleDate(0, ...)`
- [x] 1.2 修正纪念日提前提醒日期计算
  - 位置：`generateAnniversaryReminders` 函数，第 100-107 行
  - 修改：`getScheduleDate(days, ...)` → `getScheduleDate(0, ...)`
- [x] 1.3 过滤纪念日中的生日，避免重复提醒
  - 位置：`generateAnniversaryReminders` 函数
  - 添加：`if (anniversary.title === "生日") continue;`
- [x] 1.4 添加调度窗口（未来 30 天）
  - 位置：`generateBirthdayReminders` 和 `generateAnniversaryReminders`
  - 修改：不仅调度 `days === advanceDays` 的提醒，还要调度 `days <= 30` 范围内的所有提醒
- [ ] 1.5 验证修复：运行项目，检查日期计算是否正确

**预期产物**: ✅ 修正后的 `reminderScheduler.ts`

---

### Step 2: 创建提醒设置页面

**文件**: `src/pages/Settings/ReminderSettings.tsx`（新建）

- [x] 2.1 创建文件 `src/pages/Settings/ReminderSettings.tsx`
- [x] 2.2 实现通知权限状态显示
  - 使用 `checkNotificationPermission()` 检查权限
  - 显示状态：已授权 ✓ / 未授权 ✗ / 不支持
- [x] 2.3 实现请求权限按钮
  - 未授权时显示"启用通知"按钮
  - 点击调用 `requestNotificationPermission()`
- [x] 2.4 实现生日提醒配置
  - 开关 + 提前天数输入（1-30） + 时间选择器
- [x] 2.5 实现纪念日提醒配置
  - 开关 + 提前天数输入（1-30） + 时间选择器
- [x] 2.6 实现定期联系提醒配置
  - 开关 + 间隔天数输入（7-90） + 时间选择器
- [x] 2.7 实现回忆回顾提醒配置
  - 开关 + 时间选择器
- [x] 2.8 实现测试通知按钮
  - 点击调用 `sendTestNotification()`
- [x] 2.9 使用 `GlassCard` 和 `lucide-react` 图标美化 UI

**预期产物**: ✅ `src/pages/Settings/ReminderSettings.tsx`

---

### Step 3: 在 Settings 页面添加入口

**文件**: `src/pages/Settings/Settings.tsx`

- [x] 3.1 导入 `ReminderSettings` 组件
- [x] 3.2 添加状态管理（展开/收起）
  - `const [showReminders, setShowReminders] = useState(false);`
- [x] 3.3 在"默认值"区块之前添加"提醒设置"区块
  - 使用 `<Bell />` 图标
  - 点击切换 `showReminders` 状态
- [x] 3.4 条件渲染 `ReminderSettings` 组件
  - `{showReminders && <ReminderSettings />}`
- [ ] 3.5 验证：点击"提醒设置"能展开/收起

**预期产物**: ✅ 更新后的 `Settings.tsx`

---

### Step 4: 创建提醒调度 Hook

**文件**: `src/hooks/useReminderScheduling.ts`（新建）

- [x] 4.1 创建 `src/hooks` 目录（如果不存在）
- [x] 4.2 创建文件 `src/hooks/useReminderScheduling.ts`
- [x] 4.3 实现权限检查逻辑
  - 使用 `checkNotificationPermission()`
- [x] 4.4 实现数据变化监听
  - 监听 `state.people`, `state.memories`, `reminderSettings`
- [x] 4.5 实现防抖处理（1 秒）
  - 使用 `setTimeout` + `clearTimeout`
- [x] 4.6 实现平台检查（可选）
  - 仅在 Android/iOS 上调度
- [x] 4.7 调用 `scheduleAllReminders`

**预期产物**: ✅ `src/hooks/useReminderScheduling.ts`

---

### Step 5: 在 App 层挂载调度 Hook

**文件**: `src/components/AppLayout.tsx`

- [x] 5.1 导入 `useReminderScheduling`
- [x] 5.2 在组件顶部调用 `useReminderScheduling()`
- [ ] 5.3 验证：启动应用，检查是否自动调度提醒

**预期产物**: ✅ 更新后的 `AppLayout.tsx`

---

### Step 6: 添加测试通知功能

**文件**: `src/utils/reminderScheduler.ts`

- [x] 6.1 添加 `sendTestNotification` 函数
  - 调度一个 3 秒后触发的测试通知
  - ID 使用 999999（避免与正常提醒冲突）
- [x] 6.2 导出 `sendTestNotification` 函数
- [x] 6.3 在 `ReminderSettings.tsx` 中调用测试通知
- [ ] 6.4 验证：点击"测试通知"按钮，3 秒后收到通知

**预期产物**: ✅ 更新后的 `reminderScheduler.ts`

---

## 关键文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/utils/reminderScheduler.ts:67-74` | 修改 | 修正提前提醒日期计算 |
| `src/utils/reminderScheduler.ts:100-107` | 修改 | 修正纪念日提前提醒日期计算 |
| `src/utils/reminderScheduler.ts:58-88` | 修改 | 添加调度窗口（未来 30 天） |
| `src/utils/reminderScheduler.ts:90-123` | 修改 | 过滤纪念日中的生日 |
| `src/utils/reminderScheduler.ts` | 新增 | 添加 `sendTestNotification` 函数 |
| `src/pages/Settings/ReminderSettings.tsx` | 新建 | 提醒设置 UI 页面 |
| `src/pages/Settings/Settings.tsx:256` | 修改 | 添加"提醒设置"区块 |
| `src/hooks/useReminderScheduling.ts` | 新建 | 提醒调度 Hook |
| `src/components/AppLayout.tsx` | 修改 | 挂载 `useReminderScheduling` |

---

## 风险与缓解

### 风险 1: 提前提醒日期计算错误（Critical）
- **影响**: 用户设置"提前 7 天提醒"，但实际在生日当天才收到提醒
- **缓解**: Step 1 优先修复，添加单元测试验证日期计算

### 风险 2: 生日和纪念日重复提醒
- **影响**: 用户同时收到"生日提醒"和"纪念日提醒"
- **缓解**: 在 `generateAnniversaryReminders` 中过滤 `title === "生日"` 的纪念日

### 风险 3: 调度窗口过窄
- **影响**: 用户只在"刚好提前 N 天打开 App"时才生成通知
- **缓解**: 添加调度窗口（未来 30 天），每次调度时生成所有符合条件的提醒

### 风险 4: React StrictMode 重复调度
- **影响**: 开发环境下 useEffect 执行两次，导致重复调度
- **缓解**: 使用防抖（1 秒）+ `scheduleAllReminders` 内部先取消所有提醒

### 风险 5: 通知权限被拒绝
- **影响**: 用户拒绝权限后无法收到提醒
- **缓解**: UI 显示权限状态，提供"打开系统设置"引导

### 风险 6: Android 13+ 通知权限请求时机
- **影响**: 启动时强弹权限请求，用户体验差
- **缓解**: 仅在用户开启某个提醒或点击"启用通知"时请求权限

---

## 验证方案

### 功能验证
1. **日期计算验证**：
   - 添加一个 7 天后生日的人物，设置"提前 7 天提醒"
   - 验证今天收到提醒（而不是 7 天后）
2. **权限流程验证**：
   - 首次打开提醒设置，显示"未授权"状态
   - 点击"启用通知"，弹出权限请求
   - 授权后，状态变为"已授权"
3. **测试通知验证**：
   - 点击"发送测试通知"按钮
   - 3 秒后收到测试通知
4. **数据变更验证**：
   - 添加一个人物，验证自动重新调度
   - 修改提醒设置，验证自动重新调度
5. **生日重复验证**：
   - 添加一个有生日的人物
   - 验证不会同时收到"生日提醒"和"纪念日提醒"

### 边界测试
1. 禁用某类提醒后不再收到该类通知
2. 删除人物后相关提醒自动取消
3. 应用关闭后提醒仍然触发
4. 多个提醒同时触发时的表现

### 性能验证
1. 100+ 人物时调度提醒的耗时 < 2 秒
2. 通知权限被拒绝时的降级处理

---

## SESSION_ID（供 /ccg:execute 使用）

- **CODEX_SESSION**: `019e0659-94bc-7eb3-bbb3-e673a7016337`
- **GEMINI_SESSION**: `N/A`（用户 Gemini API 不可用，跳过前端分析）

---

## 进度追踪

- **Step 1**: ✅ 4/5 完成（修正调度器 Bug）
- **Step 2**: ✅ 9/9 完成（创建提醒设置页面）
- **Step 3**: ✅ 4/5 完成（添加 Settings 入口）
- **Step 4**: ✅ 7/7 完成（创建调度 Hook）
- **Step 5**: ✅ 2/3 完成（挂载调度 Hook）
- **Step 6**: ✅ 3/4 完成（添加测试通知）
- **总进度**: ✅ 29/33 完成（88%）

## 实施优先级

1. **P0（Critical）**: Step 1 - 修正日期计算 Bug
2. **P1（High）**: Step 2 - 创建提醒设置页面
3. **P1（High）**: Step 3 - 添加 Settings 入口
4. **P2（Medium）**: Step 4 - 创建调度 Hook
5. **P2（Medium）**: Step 5 - 挂载调度 Hook
6. **P3（Low）**: Step 6 - 添加测试通知

---

## 后续优化方向

1. **智能提醒时间**: 根据用户活跃时间自动调整提醒时间
2. **提醒分组**: 多个提醒合并为一条通知
3. **提醒历史**: 记录已触发的提醒，支持查看和重新提醒
4. **自定义提醒**: 用户可以为特定人物设置个性化提醒规则
5. **iOS 支持**: 适配 iOS 平台的通知机制
6. **通知点击跳转**: 点击通知后跳转到对应的人物/回忆详情页

---

## 技术债务

1. `notificationPermissions.ts` 未使用 Capacitor v8 的 `checkExactNotificationSetting`
2. `scheduleAllReminders` 会取消所有 pending notifications，未来需要支持多种通知类型共存
3. 当前调度策略是"全量取消 + 重新调度"，未来可优化为"增量更新"

---

## 参考资料

- [Capacitor Local Notifications API](https://capacitorjs.com/docs/apis/local-notifications)
- [Android 13+ 通知权限](https://developer.android.com/develop/ui/views/notifications/notification-permission)
- [Android 12+ 精确定时权限](https://developer.android.com/about/versions/12/behavior-changes-12#exact-alarm-permission)
