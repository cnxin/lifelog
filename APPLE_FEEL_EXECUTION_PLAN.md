# LifeLog Apple 流体交互 · 完整执行方案

> **后续优化请转**：[`docs/OPTIMIZATION_MASTER_PLAN.md`](./docs/OPTIMIZATION_MASTER_PLAN.md)
> 状态：**P0/P1 已落地（0.1.0-test.128+）** — 本文冻结为实施档案；回归用 [`docs/APPLE_FEEL_QA_CHECKLIST.md`](./docs/APPLE_FEEL_QA_CHECKLIST.md)
> 创建：2026-07-11  
> 基线版本：`0.1.0-test.128`  
> 对照 Demo：`demo/apple-feel-compare.html`  
> 设计依据：Apple *Designing Fluid Interfaces*（WWDC）→ Emil Kowalski `apple-design` skill  
> 产品定位：本地优先、温暖私密的移动端生活记录本（见 `react-app/.impeccable.md`）

## 实施进度

| Phase | 状态 | 说明 |
|-------|------|------|
| 0 文档治理 | Done | 废弃 Vue 方案；v2 状态表；CHANGELOG Unreleased |
| 1 Motion 基础 | Done | `utils/motion/*` + `test:spring` 11/11 |
| 2 Pressable | Done | `09-motion.css` + 按钮/底栏 class |
| 3 SheetPrimitive | Done | Entry / Preference / Anniversary / LocalShare / QrScanner |
| 4 PhotoViewer | Done | 1:1 + project + spring dismiss |
| 5 FAB | Done | stagger spring + fluid 开关 |
| 6 a11y | Done | reduced-motion/transparency CSS |
| 7 发版 | Pending | 真机清单 `docs/APPLE_FEEL_QA_CHECKLIST.md` + version bump |
| 8 结构债 | Todo | CSS/Home 拆分另开 |

回滚：`utils/features.ts` → `setFluidFeatureEnabled('fluidSheet'|'fluidPhotoViewer'|'fluidFab', false)`

---

## 0. 一句话目标

把 LifeLog 三条最高频路径——**记事 Sheet、照片浏览、按压反馈**——从「能用的 Web 套壳」提升到「可打断、带速度、1:1 跟手」的原生手感，且不引入大而全的动画库膨胀。

---

## 1. 范围

### 1.1 做（In Scope）

| 优先级 | 主题 | 用户可感知结果 |
|--------|------|----------------|
| P0 | 可打断 Spring 引擎 | 全站手势动效共用同一套物理 |
| P0 | EntrySheet 流体 Bottom Sheet | 拖关 / 甩关 / 中途抓回 |
| P0 | PhotoViewer 流体手势 | 1:1 横滑、速度翻页、竖滑 dismiss |
| P0 | 全局 Pressable 反馈 | pointerdown 即 scale |
| P0 | reduced-motion / transparency | 系统偏好可降级 |
| P1 | FAB 弹簧菜单 | 错开弹出 / 可打断关闭 |
| P1 | 材质与深度小修 | 顶栏底栏 / Sheet materialize |
| P1 | 首页信息密度再砍 | 默认区块更克制 |
| P1 | 文档治理 | 废止错误方案、统一 backlog |
| P2 | CSS 巨石拆分 | 工程可维护性 |
| P2 | Home / EntrySheet 组件拆分 | 降低后续改动成本 |

### 1.2 不做（Out of Scope · 本轮）

- 家庭协作、云同步、微信分享卡片、大型数据可视化
- 引入 Framer Motion 全站化（可选轻量 `motion`，默认自研 spring ~80–150 行）
- 重写全部 CSS 主题系统
- iOS 正式发包
- 批量操作扩展到人物（可另开迭代）

### 1.3 成功判据（Release Gate）

真机 Android（主路径）+ Chrome 桌面，对照 Demo 右侧手感：

1. **Sheet**：打开有弹簧；拖 handle/面板 1:1；慢拖松手弹回；快甩关闭；关闭动画中可再抓回；有未保存内容时下拉到阈值弹回并走现有确认框。
2. **PhotoViewer**：横滑接近 1:1；甩一下翻页；慢拖松手回弹；下拉过线或甩出关闭；全程 `setPointerCapture` 不丢手。
3. **Press**：主按钮 / 卡片 / 底栏 / FAB 按下即缩，无 200ms+ 迟滞感。
4. **A11y**：系统「减少动态效果」开启时，滑入/弹簧改为 ≤200ms 淡入淡出，无大幅位移。
5. **回归**：现有草稿、未保存确认、Android 返回键分层、快速记录 Toast 补操作均不回退。
6. **包体**：不因本轮增加 >150KB gzip 依赖（自研 spring 优先）。

---

## 2. 现状与对照

### 2.1 代码锚点

| 能力 | 现状 | 关键文件 |
|------|------|----------|
| Bottom Sheet | 静态 DOM，点遮罩/× 关闭 | `components/EntrySheet.tsx`、`styles/06-entry-sheet.css` |
| 同类 Sheet | 人物喜好等独立 Sheet | `PersonPreferenceSheet.tsx`、`AnniversaryPlanSheet.tsx`、`LocalShareSheet.tsx` 等 |
| 照片浏览 | pointer 拖有雏形，阈值硬切、无速度/弹簧、无 capture | `components/PhotoViewer.tsx` |
| FAB | 布尔 open + 条件渲染 | `components/FloatingActionButton.tsx` |
| 返回键 | 已分层关闭 viewer/sheet/搜索 | `hooks/useAndroidBackButton.ts`、`AppLayout.tsx` |
| 布局壳 | 全局 Sheet/FAB/搜索入口 | `components/AppLayout.tsx` |
| 设计 token | 4 主题 + 阴影 | `styles/01-tokens.css` |
| 样式体量 | pages ~8k 行 | `styles/07-pages.css` 等 |

### 2.2 Before / After 对照

| 维度 | Before（当前） | After（目标） |
|------|----------------|---------------|
| 输入响应 | 多在 click | pointerdown 即时反馈 |
| 拖动 | 无 / 衰减 0.28 | 1:1 + grab offset |
| 松手 | 固定阈值 | 速度投影 + 最近吸附 |
| 动画 | CSS transition / 瞬切 | interruptible spring |
| 打断 | 等动画结束 | 任意时刻可抓回 |
| 边界 | 硬停 | rubber-band |
| 减弱动效 | 基本缺失 | 三套 media query |

### 2.3 参考资产

- 交互对照：`demo/apple-feel-compare.html`（已可本地打开）
- 参数经验值：

| 场景 | 弹簧倾向 | 备注 |
|------|----------|------|
| 默认 UI 位移 | critically damped | stiffness≈210, damping≈26 |
| 甩动手势收尾 | 轻微 under-damped | stiffness≈170, damping≈18 |
| Sheet response | ~0.3–0.4s 体感 | 无固定 duration |
| 投影 deceleration | 0.994–0.998 | Apple 指数衰减形式 |
| Press scale | 0.97（FAB 0.94） | 100ms ease-out 即可 |

---

## 3. 架构设计

### 3.1 分层

```
utils/motion/
  spring.ts          # 可打断弹簧 + project + rubberband
  prefers.ts         # reduced-motion / transparency 读取

hooks/
  useSpringValue.ts  # rAF 驱动的单一数值弹簧（可选）
  useDragGesture.ts  # pointer capture + velocity history

components/motion/
  Pressable.tsx      # 统一按下反馈（或纯 CSS 类 .pressable）
  SheetPrimitive.tsx # 通用 Bottom Sheet 壳（手势 + spring）
  （PhotoViewer 内聚手势，不强制抽通用 Carousel）

components/
  EntrySheet.tsx     # 业务表单 → 挂到 SheetPrimitive
  PhotoViewer.tsx    # 替换手势层
  FloatingActionButton.tsx
```

### 3.2 为何默认自研 spring，不直接上 motion 库

| 选项 | 优点 | 缺点 | 决策 |
|------|------|------|------|
| 自研 ~100 行 | 零依赖、完全可控、包体不变 | 要自己测边界 | **默认** |
| `motion` (Motion One / FM) | API 成熟 | 依赖 + 学习成本 + WebView 兼容要验 | Sheet/Viewer 若自研翻车再引入，仅局部 |

**原则**：手势驱动路径禁止依赖不可打断的 CSS `transition` / `@keyframes`。

### 3.3 SheetPrimitive 行为契约

```
状态机：
  closed → (open) → opening → open
  open → (drag) → dragging
  dragging → (release, project) → settling → open | closed
  opening|settling → (pointerdown) → dragging   // 可打断

打开：
  from Y = panelHeight → 0，spring critically damped
  backdrop opacity 0 → 1，与 Y 联动

拖动：
  setPointerCapture
  仅允许 Y ≥ 0 方向自由跟手；Y < 0 时 rubberband
  内容区 scrollTop > 0 时，不启动 sheet 拖（避免和滚动抢手势）
  handle 区域始终可拖

松手：
  v = velocity from last ~5 samples (px/s)
  projected = y + project(v, 0.995)
  close if projected > height * 0.28 || v > 900
  else spring back to 0，注入 v

关闭：
  spring to height+buffer，完成后 unmount/隐藏
  若 hasUnsavedChanges：不直接 close，spring back + 调用现有 requestClose/confirm

Android 返回：
  保持现有 lifelog:request-close-entry-sheet 事件链，
  SheetPrimitive 暴露 imperative close(fromBackButton)
```

### 3.4 PhotoViewer 行为契约

```
横滑：
  1:1 translateX
  松手 project → 超过宽度 22% 或 |vx|>700 则翻页
  翻页：当前页 spring 离场 → 换 index → 对侧入场 spring 到 0

竖滑：
  Y>0 跟手；Y<0 rubberband
  project → >120 或 vy>900 → dismiss spring
  否则 spring 回 0
  opacity 随 |offset| 衰减

必须：
  setPointerCapture
  方向锁（pending → horizontal|vertical，阈值 ~8px）
  reduced-motion：取消弹簧，淡出关闭 / 瞬时切图
```

### 3.5 Pressable

优先 **CSS 工具类**，避免包一层破坏现有按钮语义：

```css
.pressable {
  transition: transform 100ms ease-out, box-shadow 100ms ease-out;
  touch-action: manipulation;
}
.pressable:active,
.pressable.is-pressed {
  transform: scale(0.97);
}
@media (prefers-reduced-motion: reduce) {
  .pressable:active,
  .pressable.is-pressed { transform: none; }
}
```

挂载点：`.primary-btn`、`.ghost-btn`、`.nav-item`、`.fab`、可点击 `.glass-card` / 列表行、chip。

---

## 4. 分阶段执行计划

总工期建议：**10–14 个有效工作日**（单人全职估）。可按 Phase 独立合并发版。

---

### Phase 0 · 基线与文档治理（0.5 天）

**目标**：避免错误文档带偏；建立可回归基线。

| # | 任务 | 产出 |
|---|------|------|
| 0.1 | 归档/标注 `OPTIMIZATION_PLAN.md` 为过时（Vue 方案，与仓库无关） | 文件头 `DEPRECATED` 或移入 `docs/archive/` |
| 0.2 | 在 `UX_OPTIMIZATION_PLAN_v2.md` 顶部增加 Done/Partial/Todo 状态表 | 与本方案交叉引用 |
| 0.3 | 本文件作为唯一「流体交互」执行源 | `APPLE_FEEL_EXECUTION_PLAN.md` |
| 0.4 | 录制/固定 Demo 行为说明（已有 html） | README 增加一节链接 |
| 0.5 | 列真机检查清单（见 §7） | 发版前打勾 |

**验收**：新同学只读本文件 + Demo 即可开工，不再被 Vue 方案误导。

---

### Phase 1 · Motion 基础库（1–1.5 天）· P0

**目标**：可复用、可单测的物理原语。

#### 新建文件

```
react-app/src/utils/motion/spring.ts
react-app/src/utils/motion/prefers.ts
react-app/src/utils/motion/index.ts
react-app/scripts/test-spring-motion.cjs   # 纯数值单测，无 DOM
```

#### `spring.ts` API（建议冻结）

```ts
export type SpringConfig = { stiffness: number; damping: number; mass?: number };
export const SPRING_DEFAULT: SpringConfig; // critically damped UI
export const SPRING_BOUNCY: SpringConfig;  // flick settle

export function project(velocityPxPerSec: number, decelerationRate?: number): number;
export function rubberband(overshoot: number, dimension: number, constant?: number): number;

export function animateSpring(options: {
  from: number;
  to: number;
  velocity?: number;
  spring?: SpringConfig;
  onUpdate: (value: number, velocity: number) => void;
  onComplete?: (value: number) => void;
  restDelta?: number;
  restSpeed?: number;
}): { stop: () => void; readonly value: number; readonly velocity: number };
```

#### `prefers.ts`

```ts
export function prefersReducedMotion(): boolean;
export function prefersReducedTransparency(): boolean;
export function subscribePrefersReducedMotion(cb: (v: boolean) => void): () => void;
```

#### 任务拆解

| # | 任务 | 验收 |
|---|------|------|
| 1.1 | 实现 `project` / `rubberband` / `animateSpring` | 与 Demo 同公式 |
| 1.2 | 打断：`stop()` 后可从当前 value/velocity 开新动画 | 单测模拟 |
| 1.3 | `prefers*` 读 `matchMedia`，SSR/无 window 安全 | 不抛错 |
| 1.4 | 脚本测试：投影符号、过冲衰减、rest 收敛 | `npm run test:spring` |
| 1.5 | `package.json` 增加 script | CI/本地可跑 |

**风险**：rAF 在后台 WebView 节流 → onComplete 用 rest 条件 + 帧上限双保险（Demo 已有 frame>600 兜底）。

---

### Phase 2 · Pressable 全局反馈（0.5–1 天）· P0

**目标**：最低成本、全站立刻「活」一点。

#### 改动文件

| 文件 | 改动 |
|------|------|
| `styles/01-tokens.css` 或 `02-base.css` | 增加 `.pressable` 与 reduced-motion |
| `styles/04-layout.css` / `06-entry-sheet.css` / `07-pages.css` | 主按钮、nav、fab、卡片补 class 或合并选择器 |
| `BottomNav.tsx` | `nav-item` 加 pressable |
| `FloatingActionButton.tsx` | fab / menu item |
| `GlassCard.tsx` | 可选：支持 `interactive` prop → 加 class |
| `MemoryCard.tsx` 等列表卡片 | 可点击者加 class |

#### 任务

| # | 任务 | 验收 |
|---|------|------|
| 2.1 | CSS 工具类落地 | DevTools 可见 |
| 2.2 | 底栏 / FAB / 主次按钮 | 真机按下有缩 |
| 2.3 | 避免与现有 `transform` 动画冲突 | FAB open 旋转等用子元素或分开属性 |
| 2.4 | reduced-motion 关闭缩放 | 系统开关验证 |

**注意**：不要对 `input`/`textarea` 加 scale。

---

### Phase 3 · SheetPrimitive + EntrySheet 接入（3–4 天）· P0 核心

**目标**：记人 / 记地 / 记事三条路径统一流体关闭。

#### 新建

```
react-app/src/components/motion/SheetPrimitive.tsx
react-app/src/hooks/useDragGesture.ts   # 可选，可先内聚在 Sheet
react-app/src/styles/09-motion.css      # sheet 手势相关，will-change 等
```

#### `SheetPrimitive` Props（建议）

```ts
type SheetPrimitiveProps = {
  open: boolean;
  onDismissRequest: () => void; // 用户意图关闭（拖够/点遮罩/×）——业务层决定是否真关
  onExited?: () => void;        // 离场动画结束
  children: React.ReactNode;
  /** 为 true 时，拖到关闭线不直接 dismiss，而是回弹并仍回调 onDismissRequest */
  blockDismiss?: boolean;
  ariaLabel?: string;
};
```

业务层（EntrySheet）保留：

- 草稿、校验、保存、merge workbench
- `requestClose` / `hasUnsavedChanges` / confirm
- 表单 DOM 结构（header、fields、submit-row）

Primitive 只负责：**壳、遮罩、Y 变换、手势、弹簧**。

#### EntrySheet 改造步骤（避免大爆炸）

| 步骤 | 内容 | 风险控制 |
|------|------|----------|
| 3.1 | 抽 `SheetPrimitive`，API 用静态 open/close 先跑通 | 视觉可暂与现网一致 |
| 3.2 | EntrySheet 用 Primitive 替换 `.sheet` 外壳，业务 JSX 原样迁入 | diff 以壳替换为主 |
| 3.3 | 打开/关闭弹簧 | 对比 Demo |
| 3.4 | 拖动手势 + 速度投影 | 真机主测 |
| 3.5 | 与 `scroll` 协商（scrollTop===0 才拖） | 长表单不卡滚 |
| 3.6 | 未保存：`blockDismiss` + 现有 confirm | 不丢数据 |
| 3.7 | 返回键 / `lifelog:request-close-entry-sheet` | 回归 AppLayout |
| 3.8 | reduced-motion 分支 | 淡入淡出 |
| 3.9 | 同步 `PersonPreferenceSheet` 等至少一个第二 Sheet | 验证 Primitive 复用 |

#### 样式

- `sheet-panel` 使用 `transform: translate3d(0, Ypx, 0)`，禁止改 `bottom/height` 做拖动
- `touch-action: none` 仅在拖动手势激活时挂在 panel/handle
- backdrop 跟 Y 插值透明度
- 进入时可选轻微 `scale(1.02→1)` + blur materialize（reduced-motion 关闭）

#### 验收清单（Phase 3）

- [ ] 快速记录 / 完整记录 / 编辑人物 / 编辑地点均可拖关
- [ ] 甩关、慢拖回弹手感接近 Demo After
- [ ] 关闭动画中再次按下可拖回
- [ ] 输入框聚焦时拖 handle 仍可关；内容滚动不误触关闭
- [ ] 未保存确认逻辑与现网一致
- [ ] Android 返回：搜索 → viewer → sheet → 路由，顺序不乱
- [ ] 无控制台报错；低端机不掉到明显 1 位数 fps（只动 transform/opacity）

---

### Phase 4 · PhotoViewer 流体化（2–2.5 天）· P0

**目标**：对齐 Demo 右侧照片场景。

#### 改动文件

| 文件 | 改动 |
|------|------|
| `components/PhotoViewer.tsx` | 重写手势层；接入 spring/project/rubberband |
| `styles/07-pages.css`（或拆出 photo-viewer 段） | stage will-change、禁止 transition 打架 |

#### 任务

| # | 任务 | 验收 |
|---|------|------|
| 4.1 | `setPointerCapture` + 方向锁 | 拖出边界不丢 |
| 4.2 | 横滑 1:1 + 速度投影翻页 | 轻扫/重扫都稳 |
| 4.3 | 竖滑 dismiss + rubberband 上拉 | 与现阈值体验对比明显改善 |
| 4.4 | 翻页离场/入场 spring，可打断 | 连滑不卡死 |
| 4.5 | 键盘 ←/→/Esc 保留 | 桌面不回退 |
| 4.6 | 关闭事件 `lifelog:close-photo-viewer` 保留 | 返回键 |
| 4.7 | reduced-motion：淡出关闭、瞬时切图 | 系统开关 |
| 4.8 | 图片 loading 态不参与错误位移 | loading 时仍可关 |

#### 非目标（本 Phase）

- 双指缩放 / 旋转（可列为后续）
- 虚拟长图列表

---

### Phase 5 · FAB 弹簧菜单（1 天）· P1

#### 改动

`FloatingActionButton.tsx` + 相关 CSS

| # | 任务 | 验收 |
|---|------|------|
| 5.1 | 菜单项 mount 后 stagger spring（~40ms） | 接近 Demo |
| 5.2 | 关闭反向 stagger + backdrop淡出 | 可打断（再点 +） |
| 5.3 | backdrop 与菜单同轮春 | 无「先有菜单后有罩」 |
| 5.4 | 复核首页 FAB 动作数量（保持 ≤3–4 高频） | 与 v2 精简原则一致 |

**产品决策点**（实施前确认一次）：

- 首页 FAB：`记一件事` / `带照片` / `识别地点` 是否仍为三主动作
- 低频（加人/加地/扫码/导入）是否已在 Header「+」——若未迁完，本 Phase 只做动效不改信息架构

---

### Phase 6 · 材质 / a11y / 首页减噪（1.5–2 天）· P1

#### 6.A 材质

| # | 任务 |
|---|------|
| 6.1 | `bottom-nav` / 粘性 header：确认 `backdrop-filter: blur() saturate()` + 半透明，内容可从下方滚过 |
| 6.2 | 禁止浅透卡片叠浅透导致糊字；必要时详情内层改 solid |
| 6.3 | Sheet 打开 materialize（opacity+translate，可选 blur） |

#### 6.B 系统偏好（全局 CSS）

```css
@media (prefers-reduced-motion: reduce) { /* 见 Phase 1/2/3 */ }
@media (prefers-reduced-transparency: reduce) {
  .bottom-nav, .sheet-panel, .glass-card {
    backdrop-filter: none;
    background: var(--card-solid);
  }
}
```

#### 6.C 首页减噪（小步，可单独 PR）

| # | 任务 | 文件 |
|---|------|------|
| 6.4 | 复核 `useHomeLayout` 默认 expanded 规则 | `hooks/useHomeLayout.ts`、`pages/Home/Home.tsx` |
| 6.5 | 新用户（totalRecords\<10）任务队列展开；老用户「最近看看」优先 | 同上 |
| 6.6 | 避免首屏同时展开 4+ 大区块 | 视觉验收 |

**不做**：Home.tsx 一次性拆 1275 行（放到 Phase 8）。

---

### Phase 7 · 工程文档与发版（0.5–1 天）

| # | 任务 |
|---|------|
| 7.1 | CHANGELOG 写清用户可感知手感变化（中文） |
| 7.2 | `npm run test:release-ready` 及相关 test:\* 全绿 |
| 7.3 | `test:spring` 纳入 release 检查或 `test:release-ready` |
| 7.4 | Android debug 包真机跑 §7 清单 |
| 7.5 | 版本号 + release 脚本按现有流程 |
| 7.6 | README 增加 Demo 链接与「手势说明」一小节 |

---

### Phase 8 · 结构优化（可选，1–2 周穿插）· P2

不影响手感主线，建议手感发版后再做：

| # | 任务 | 收益 |
|---|------|------|
| 8.1 | `07-pages.css` 按域拆分（home/people/memories/photo-viewer） | 可维护 |
| 8.2 | `Home.tsx` 拆 TodayQueue / OnThisDay / HomeLibrary | 可测 |
| 8.3 | EntrySheet 草稿逻辑 → `useEntryDraft` | 薄组件 |
| 8.4 | 列表虚拟化（回忆/人物 >100） | 性能 |

---

## 5. 依赖关系与并行

```
Phase 0 文档
    ↓
Phase 1 Motion 基础  ──────────────┐
    ↓                              │
Phase 2 Pressable（可与 3 前半并行）│
    ↓                              │
Phase 3 SheetPrimitive ←───────────┤ 依赖 spring
    ↓                              │
Phase 4 PhotoViewer ←──────────────┘ 依赖 spring
    ↓
Phase 5 FAB（依赖 spring，可与 4 尾部并行）
    ↓
Phase 6 材质/a11y/首页
    ↓
Phase 7 发版
    ⇢ Phase 8 结构债（不挡发版）
```

**建议 PR 切片**（便于 review / 回滚）：

1. `feat(motion): spring + prefers + tests`
2. `feat(ui): pressable feedback`
3. `feat(sheet): SheetPrimitive + EntrySheet`
4. `feat(photos): fluid PhotoViewer`
5. `feat(fab): spring menu`
6. `feat(a11y): reduced motion/transparency + home defaults`
7. `docs: changelog + plan status`

---

## 6. 风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| Android WebView 触摸与滚动抢手势 | Sheet 难拖或页面无法滚 | scrollTop 协商；handle 热区放大；方向锁 |
| `backdrop-filter` 性能差 | 掉帧 | 拖动中临时降 blur 或关 filter，松手恢复 |
| 弹簧与 React 18 频繁 setState | 卡顿 | 拖动中直接改 DOM/`transform`，松手再 setState；或 ref + rAF |
| 未保存确认与拖关冲突 | 丢稿或关不掉 | `blockDismiss` + 回弹 + 现有 confirm |
| 多 Sheet 实现不一致 | 手感分裂 | Primitive 复用；旧 Sheet 列迁移表 |
| 自研 spring 边界 bug | 抖、不收敛 | 单测 + 帧上限 + Demo 对照 |
| 与现有 CSS transition 叠用 | 跳变 | 手势路径 `transition: none` |
| HEIC/大图加载中拖动 | 错位 | loading 层固定，stage 仍可 dismiss |

---

## 7. 测试计划

### 7.1 自动化

| 命令 | 覆盖 |
|------|------|
| `npm run test:spring`（新增） | project/rubberband/收敛/stop |
| 现有 `test:helpers` / `test:quick-memory` 等 | 业务不回退 |
| `npm run test:release-ready` | 发版门禁 |
| `npm run build` | 类型 + 打包 |

### 7.2 手动 · 桌面 Chrome

- 鼠标拖 Sheet / 照片（pointer 事件）
- 键盘 PhotoViewer
- DevTools 切换 `prefers-reduced-motion`

### 7.3 手动 · Android 真机（主验收）

| # | 用例 | 期望 |
|---|------|------|
| A1 | 首页 FAB → 记一件事 → 上滑打开完成 | 弹簧，无闪白 |
| A2 | 慢下拉 Sheet 半程松手 | 弹回 open |
| A3 | 快下甩 Sheet | 关闭 |
| A4 | 关闭过程中指按住上拖 | 打断并跟手 |
| A5 | 表单填一半下拉关 | 回弹 + 确认框 |
| A6 | 长内容表单内部滚动 | 不误关 Sheet |
| A7 | 回忆详情多图 → Viewer 左右甩 | 翻页顺滑 |
| A8 | Viewer 下拉关闭 | 弹簧 dismiss |
| A9 | Viewer 打开时系统返回 | 先关 Viewer |
| A10 | Sheet 打开时系统返回 | 走关闭/确认 |
| A11 | 连点主按钮 / 底栏 | 按下缩放明显 |
| A12 | 系统减少动态效果 ON | 无大位移弹簧 |
| A13 | 快速记录保存 | Toast 补照片/详情仍在 |
| A14 | 低端机拖 Sheet 10s | 无明显掉帧/发热异常 |

### 7.4 回归范围（业务）

- 草稿恢复 / 丢弃
- 地点合并 workbench
- Notion 队列 toast 文案
- 全局搜索 / 快捷键面板
- 分享导入深链

---

## 8. 回滚策略

| 层级 | 做法 |
|------|------|
| 功能开关 | `utils/features.ts` 增加 `fluidSheet` / `fluidPhotoViewer`（默认 true）；出问题 APK 可打 false 热修或下版关 |
| PR 级 | 每 Phase 独立 PR，Git revert 单 PR |
| 样式 | motion 样式集中 `09-motion.css`，删除 import 即可剥离开 |
| 数据 | 无 schema 变更；纯 UI，无需迁移 |

建议开关形态：

```ts
// features.ts
export const features = {
  fluidSheet: true,
  fluidPhotoViewer: true,
  fluidFab: true,
};
```

EntrySheet / PhotoViewer 顶部读开关：false 时走旧 DOM 路径（Phase 3 迁移期保留旧壳 1 个版本，确认稳定后删除）。

---

## 9. 里程碑与工期

| 里程碑 | 内容 | 累计人天 |
|--------|------|----------|
| M0 | 文档治理 + Demo 链接 | 0.5 |
| M1 | spring 库 + Pressable | 2 |
| M2 | Sheet 真机可玩（可内测） | 5.5 |
| M3 | PhotoViewer + FAB | 8.5 |
| M4 | a11y + 首页减噪 + 发版 | **10–11** |
| M5（可选） | CSS/组件拆分 | +5–10 |

**内测建议**：M2 打一版 `test.xxx` 给自己日用 2–3 天，再进 M3（Sheet 是体感基本盘）。

---

## 10. 任务看板（可直接当 Todo）

### P0

- [ ] 0.x 文档治理
- [ ] 1.x `utils/motion/*` + `test:spring`
- [ ] 2.x `.pressable` 全局
- [ ] 3.x `SheetPrimitive` + EntrySheet
- [ ] 3.9 至少一个第二 Sheet 复用
- [ ] 4.x PhotoViewer 流体化
- [ ] 7.x 真机清单 + CHANGELOG + 发版

### P1

- [ ] 5.x FAB spring
- [ ] 6.x 材质 + reduced-transparency + 首页默认

### P2

- [ ] 8.x CSS/Home/EntrySheet 拆分
- [ ] 双指缩放（照片）另议
- [ ] 列表虚拟化另议

---

## 11. 关键文件清单（实施时对照）

### 新建

```
react-app/src/utils/motion/spring.ts
react-app/src/utils/motion/prefers.ts
react-app/src/utils/motion/index.ts
react-app/src/components/motion/SheetPrimitive.tsx
react-app/src/hooks/useDragGesture.ts          # 可选
react-app/src/styles/09-motion.css
react-app/scripts/test-spring-motion.cjs
APPLE_FEEL_EXECUTION_PLAN.md                   # 本文件
```

### 重点修改

```
react-app/src/components/EntrySheet.tsx
react-app/src/components/PhotoViewer.tsx
react-app/src/components/FloatingActionButton.tsx
react-app/src/components/BottomNav.tsx
react-app/src/components/AppLayout.tsx          # 若需协调开关/返回
react-app/src/components/GlassCard.tsx
react-app/src/styles/index.css                 # import 09-motion
react-app/src/styles/01-tokens.css / 02-base.css
react-app/src/styles/06-entry-sheet.css
react-app/src/utils/features.ts
react-app/package.json
react-app/CHANGELOG.md / 根 CHANGELOG.md
README.md
```

### 只读参考

```
demo/apple-feel-compare.html
react-app/.impeccable.md
react-app/src/hooks/useAndroidBackButton.ts
react-app/src/hooks/useHomeLayout.ts
```

---

## 12. 实施约定（写码时遵守）

1. **手势路径只动 `transform` / `opacity`**，动画帧内避免 React re-render。
2. **永远从呈现值开启动画**，禁止从逻辑目标值跳变。
3. **松手必带 velocity**；无速度时用 critically damped。
4. **bounce 只给动量手势**；菜单 fade、设置页切换不弹。
5. **中文 commit**（仓库偏好）。
6. **不扩大产品范围**：本轮是手感，不是新功能 sprint。
7. **每 Phase 结束对照 Demo After**，不以「能关」为完成。
8. **WebView 真机否决权**：桌面顺滑但真机抢手势 = 未完成。

---

## 13. 完成定义（DoD）

当且仅当同时满足：

1. §1.3 成功判据全部勾选  
2. §7.3 真机 A1–A14 通过  
3. 现有自动化测试 + `test:spring` 通过  
4. CHANGELOG / 版本按现有 release 流程发布  
5. 功能开关可关（或旧路径已安全删除且稳定 ≥1 周）  
6. 本文件任务看板 P0 全勾，P1 按发版范围勾选  

---

## 14. 下一步行动（你确认后立刻可开写）

**推荐启动顺序：**

1. Phase 0 文档小清理（10 分钟）  
2. Phase 1 `utils/motion/spring.ts` + 单测  
3. Phase 2 Pressable  
4. Phase 3 SheetPrimitive ← **第一条用户可感知主线**

回复「开始执行」或指定 Phase（例如「先做 Phase 1–3」）即可按本方案落地代码。
