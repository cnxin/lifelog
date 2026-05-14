# 设置页默认下拉框 Polish 方案

**项目**: LifeLog React App  
**目标**: 打磨设置页“默认关系”和“默认心情”的下拉选择框视觉  
**创建时间**: 2026-05-08  
**质量目标**: 小范围发布级 polish，保持功能不变

---

## 设计方向

- 延续现有 LifeLog 移动端、毛玻璃、柔和渐变风格。
- 下拉框应看起来像一个精致的设置控件，而不是浏览器默认 select。
- 保持原生 select 行为，避免引入自定义下拉逻辑和无关状态。
- 保证触控目标不小于 44px，focus 状态清晰。

## 执行清单

- [x] 1. 定位 Settings 默认值区域的两个 select
- [x] 2. 为 select 增加轻量 wrapper，提供自定义箭头承载层
- [x] 3. 新增 `settings-select-shell` / `settings-select` 样式
- [x] 4. 统一高度、圆角、内边距、渐变背景、focus/active 反馈
- [x] 5. 运行 TypeScript 类型检查
- [x] 6. 汇报变更和验证结果

## 关键文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/pages/Settings/Settings.tsx` | 修改 | 包装默认关系/默认心情 select |
| `src/index.css` | 修改 | 新增精致下拉框视觉样式 |

## 进度追踪

- **总进度**: ✅ 6/6
