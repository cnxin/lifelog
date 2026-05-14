# LifeLog v0.1.0-test.35 人物/地点详情页体验优化

**目标**: 让人物和地点详情页从资料展示升级为可回看的关系/到访档案。

## 版本策略

- [x] 本轮版本号使用 `0.1.0-test.35`
- [x] 同步 Android `versionCode` / `versionName`

## Phase 1：人物详情页增强

- [x] 增加人物关系摘要区
- [x] 展示与该人物相关的回忆总数
- [x] 展示最近一次共同回忆日期
- [x] 展示常出现地点
- [x] 相关回忆按年月分组展示
- [x] 无相关回忆时显示快捷记录引导

## Phase 2：地点详情页增强

- [x] 增加地点到访摘要区
- [x] 展示该地点相关回忆总数
- [x] 展示最近一次到访日期
- [x] 展示常关联人物
- [x] 相关回忆按年月分组展示
- [x] 无相关回忆时显示快捷记录引导

## Phase 3：复用与样式

- [x] 复用现有 GlassCard / Tags / EntrySheet 风格
- [x] 补充时间线和摘要卡片 CSS
- [x] 保持四套主题下可读
- [x] 避免新增重型依赖和复杂数据结构

## Phase 4：文档与版本记录

- [x] 更新 `package.json` 到 `0.1.0-test.35`
- [x] 同步 `package-lock.json`
- [x] 更新 `CHANGELOG.md`

## Phase 5：验证与提交

- [x] 运行 TypeScript / Vite 生产构建
- [x] 检查 Git diff，避免提交 `.claude/plan` 和本地缓存
- [x] 按规则运行质量门禁或等价检查（`verify-change` 当前不可用，已用 build / diff / diff --check 替代）
- [x] 提交并推送到 GitHub

## 暂不纳入本轮

- [ ] 全局搜索
- [ ] 数据导入导出
- [ ] 照片大图预览
- [ ] APK 构建与发布
