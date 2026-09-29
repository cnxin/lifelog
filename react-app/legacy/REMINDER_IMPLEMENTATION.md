# 提醒功能实施方案

**项目**: LifeLog React App  
**功能**: 本地通知提醒系统  
**创建时间**: 2026-05-08  
**状态**: 进行中

---

## Phase 1: 基础设施

### 1.1 依赖管理
- [x] 安装 `@capacitor/local-notifications` (已安装 v8.1.0)
- [ ] 验证依赖版本兼容性

### 1.2 Android 配置
- [ ] 添加通知权限到 `android/app/src/main/AndroidManifest.xml`
  - `POST_NOTIFICATIONS` (Android 13+)
  - `SCHEDULE_EXACT_ALARM` (Android 12+)
- [ ] 同步 Capacitor: `npm run cap:sync`

### 1.3 数据模型
- [ ] 更新 `src/types/index.ts`
  - 添加 `ReminderSettings` 接口
  - 添加 `ReminderType` 枚举
- [ ] 升级数据库到 version 7 (`src/db/database.ts`)
  - 添加 `reminderSettings` 表
  - 添加迁移逻辑

---

## Phase 2: 核心功能

### 2.1 提醒调度器
- [ ] 创建 `src/utils/reminderScheduler.ts`
  - `scheduleAllReminders()` - 调度所有提醒
  - `scheduleBirthdayReminders()` - 生日提醒
  - `scheduleAnniversaryReminders()` - 纪念日提醒
  - `scheduleContactReminders()` - 定期联系提醒
  - `scheduleMemoryReviewReminders()` - 回忆回顾提醒
  - `cancelAllReminders()` - 取消所有提醒

### 2.2 权限管理
- [ ] 创建 `src/utils/notificationPermissions.ts`
  - `requestNotificationPermission()` - 请求通知权限
  - `checkNotificationPermission()` - 检查权限状态
  - `openNotificationSettings()` - 打开系统设置

### 2.3 Context 更新
- [ ] 更新 `src/context/LifeLogContext.tsx`
  - 添加 `reminderSettings` 状态
  - 添加 `updateReminderSettings()` 方法
  - 添加 `getReminderSettings()` 方法
  - 在数据变更时触发重新调度

---

## Phase 3: UI 实现

### 3.1 提醒设置页面
- [ ] 创建 `src/pages/Settings/ReminderSettings.tsx`
  - 通知权限状态显示
  - 生日提醒开关 + 提前天数
  - 纪念日提醒开关 + 提前天数
  - 定期联系提醒开关 + 间隔天数
  - 回忆回顾提醒开关
  - 提醒时间选择器
  - 测试通知按钮

### 3.2 设置入口
- [ ] 更新 `src/pages/Settings/Settings.tsx`
  - 添加"提醒设置"入口
  - 添加路由配置

### 3.3 应用启动集成
- [ ] 更新 `src/App.tsx`
  - 应用启动时调度提醒
  - 请求通知权限

---

## Phase 4: 集成和测试

### 4.1 数据联动
- [ ] 在 `LifeLogContext` 中添加数据变更监听
  - 人物添加/删除 → 重新调度
  - 回忆添加/删除 → 重新调度
  - 提醒设置变更 → 重新调度

### 4.2 测试功能
- [ ] 添加测试通知功能
  - 立即发送一条测试通知
  - 验证通知权限和调度逻辑

### 4.3 真机测试
- [ ] Android 真机测试
  - 权限请求流程
  - 生日提醒触发
  - 纪念日提醒触发
  - 定期联系提醒触发
  - 回忆回顾提醒触发
  - 应用关闭后提醒仍然触发

---

## 关键文件清单

### 新建文件
- `src/utils/reminderScheduler.ts` - 提醒调度逻辑
- `src/utils/notificationPermissions.ts` - 权限管理
- `src/pages/Settings/ReminderSettings.tsx` - 提醒设置页面

### 修改文件
- `src/types/index.ts` - 添加 ReminderSettings 接口
- `src/db/database.ts` - 升级到 version 7
- `src/context/LifeLogContext.tsx` - 添加提醒设置管理
- `src/pages/Settings/Settings.tsx` - 添加入口
- `src/App.tsx` - 启动时调度提醒
- `android/app/src/main/AndroidManifest.xml` - 添加权限

---

## 验证方案

### 功能验证
- [ ] 权限测试：首次打开应用，弹出通知权限请求
- [ ] 生日提醒测试：添加明天生日的人物，验证提前提醒
- [ ] 纪念日提醒测试：添加后天纪念日的人物，验证提前提醒
- [ ] 定期联系提醒测试：创建 30 天前的回忆，验证"好久没联系"提醒
- [ ] 回忆回顾提醒测试：创建去年今天的回忆，验证"X年前的今天"提醒
- [ ] 设置变更测试：修改提醒时间、提前天数，验证重新调度

### 边界测试
- [ ] 禁用某类提醒后不再收到该类通知
- [ ] 删除人物后相关提醒自动取消
- [ ] 应用关闭后提醒仍然触发
- [ ] 多个提醒同时触发时的表现

### 性能验证
- [ ] 100+ 人物时调度提醒的耗时 < 2 秒
- [ ] 通知权限被拒绝时的降级处理

---

## 技术风险和缓解

### 风险 1: Android 13+ 通知权限被拒绝
- **缓解**: 在设置页面提供引导，说明如何在系统设置中开启
- **降级**: 权限被拒绝时隐藏提醒设置，显示权限引导

### 风险 2: 精确定时权限被拒绝 (Android 12+)
- **缓解**: 使用非精确定时作为备选方案
- **提示**: 告知用户提醒时间可能不准确

### 风险 3: 大量提醒导致性能问题
- **缓解**: 限制最多调度 64 个提醒 (Android 限制)
- **策略**: 优先调度最近 30 天内的提醒

### 风险 4: 应用被系统杀死后提醒失效
- **缓解**: 在应用恢复时重新调度
- **说明**: 这是 Android 系统限制，无法完全避免

---

## 后续优化方向

1. **智能提醒时间**: 根据用户活跃时间自动调整提醒时间
2. **提醒分组**: 多个提醒合并为一条通知
3. **提醒历史**: 记录已触发的提醒，支持查看和重新提醒
4. **自定义提醒**: 用户可以为特定人物设置个性化提醒规则
5. **iOS 支持**: 适配 iOS 平台的通知机制

---

## 进度追踪

- **Phase 1**: ⬜ 0/6 完成
- **Phase 2**: ⬜ 0/3 完成
- **Phase 3**: ⬜ 0/3 完成
- **Phase 4**: ⬜ 0/3 完成
- **总进度**: ⬜ 0/15 完成

---

## 更新日志

### 2026-05-08
- 创建实施方案文档
- 确认 `@capacitor/local-notifications` 已安装
