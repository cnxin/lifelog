# LifeLog 完整优化方案（Master Plan）

> **状态**：现行唯一优化主方案
> **当前收口版本**：`0.1.0-test.135`
> **创建**：2026-07-13
> **产品定位**：本地优先、温暖私密的 Android 生活记录本
> **设计依据**：`react-app/.impeccable.md`（柔和、私人、温暖、轻量精致）
> **原则**：先稳后炫 · 先减噪后加能力 · 不扩云同步/协作大功能 · 小步发版

---

## 0. 如何使用本文档

| 角色 | 用法 |
|------|------|
| 日常开发 | 只看 **§4 阶段任务** 与 **§5 版本切片**，按 P0→P1 勾选 |
| 发版前 | 跑 **§7 Release Gate** + 真机清单 |
| 写新方案 | **禁止**再开平行 `*_PLAN_vN.md`；新想法只追加到 **§9 Backlog 收件箱** |
| 历史文档 | 见 **§10 文档治理**；旧文仅作归档参考 |

**关联文档（只读参考，不平行实施）：**

- [`APPLE_FEEL_EXECUTION_PLAN.md`](../APPLE_FEEL_EXECUTION_PLAN.md) — 流体手感（P0/P1 已落地）
- [`docs/APPLE_FEEL_QA_CHECKLIST.md`](./APPLE_FEEL_QA_CHECKLIST.md) — 真机手感验收
- [`docs/UI_OPTIMIZATION_PLAN_v128.md`](./UI_OPTIMIZATION_PLAN_v128.md) — 128 后界面诊断（部分已在 129–132 落地）
- [`docs/LifeLog-后续优化计划.md`](./LifeLog-后续优化计划.md) — 工程化阶段 1–7 基础版已完成
- [`UX_OPTIMIZATION_PLAN_v2.md`](../UX_OPTIMIZATION_PLAN_v2.md) — UX 痛点归档
- [`OPTIMIZATION_PLAN.md`](../OPTIMIZATION_PLAN.md) — **已废弃**（Vue 栈，勿用）

---

## 1. 一句话结论

| 维度 | 132 基线 | 下一阶段应解决 |
|------|----------|----------------|
| 交互手感 | Sheet / Photo / FAB 已接近原生 | 保持，只修回归 |
| 产品感 | 功能很全，仪表盘痕迹仍在 | **记录本气质 + 主路径更短** |
| 工程 | 已小步拆分，仍有巨石文件 | **拆大页 / 拆 Context / 控 CSS** |
| 数据 | IndexedDB 全量进内存 Context | **千级数据性能与照片策略** |
| 文档 | 多份方案并存 | **以本文为唯一真相源** |
| 质量 | 工具脚本全，缺主路径 smoke | **发版门禁 + 主路径自动化** |

**最大收益不在新功能，而在：主路径打磨、性能上限、可维护性、发版质量。**

---

## 2. 产品与技术基线

### 2.1 产品定位（不可偏移）

- **本地功能全部免费**：人物、地点、回忆、纪念日、备份、导入导出、本地分享。
- **数据本地优先**：IndexedDB（Dexie）+ 本地照片二进制。
- **当前主形态**：Android APK（Capacitor 8）；Web 仅开发/调试。
- **未来付费方向**（本方案不实施）：云同步、云备份、多设备、购买校验。
- **Notion**：实验能力，不得拖垮本地 CRUD 主路径。

### 2.2 技术栈

| 层 | 选型 |
|----|------|
| UI | React 18 + TypeScript + Vite 8 + React Router 6 |
| 存储 | IndexedDB + Dexie |
| 壳 | Capacitor 8（Android 优先） |
| 动效 | 自研 `utils/motion` spring（**不**引入 Framer 全站化） |
| 图标 | `lucide-react@1.14.0`（钉死版本） |
| 测试 | Node 脚本回归（`npm run test:*`）+ 真机清单 |

### 2.3 已完成能力（勿重复立项）

| 版本区间 | 成果 |
|----------|------|
| ~127 | 安全加固、批量操作、统计页、分享图模板 |
| 128 | Apple 流体：Sheet / PhotoViewer / Press / FAB / a11y 降级 |
| 129 | 首页减噪、EmptyState、回忆缩略图玻璃风 |
| 130 | Home/CSS/Context 拆分、骨架屏、暗色 token、窗口列表 |
| 131 | HEIC 超时、备份体积选项、搜索隐私、详情阅读优化 |
| 132 | 搜索 `@人名`/日期分区、缺图引导、Context 写操作工厂化、动态行高 |

### 2.4 代码体量锚点（2026-07-13 测量）

**页面/组件巨石：**

| 文件 | 约行数 | 拆分优先级 |
|------|--------|------------|
| `pages/Places/Places.tsx` | 1342 | P0 |
| `pages/People/PersonDetail.tsx` | 1103 | P0 |
| `pages/Account/AccountNotionSync.tsx` | 1012 | P1（实验隔离） |
| `pages/Settings/Settings.tsx` | 995 | P1 |
| `pages/Account/AccountDataManagement.tsx` | 995 | P1 |
| `context/createLifeLogContextValue.ts` | 1264 | P0 |
| `components/EntrySheet/PlaceFields.tsx` | 865 | P2 |
| `components/LocalShareSheet.tsx` | 827 | P2 |
| `components/EntrySheet/MemoryFields.tsx` | 813 | P2 |

**样式：** CSS 合计约 18k 行；`04-layout` / `03-themes` / `06-entry-sheet` 仍为重文件（`07-pages` 已拆 07a–f）。

**运行时模型：** 冷启动 `loadLifeLogState` 将人物/地点/回忆等全量装入 Context，数据增大后同时影响启动、重渲染、备份峰值内存。

---

## 3. 目标与非目标

### 3.1 目标（未来约 4–6 个小版本，v133–v137+）

1. **主路径 30 秒闭环**：打开 → 记一件事（可带人/地/图）→ 列表或搜索找回。
2. **千级数据可用**：约 1k 回忆 + 数百照片，冷启动可点、列表可滚、备份不白屏。
3. **工程软上限**：新建页面组件 ≤ 400 行；存量巨石每次改造净减少或拆出子模块；目标 Top 巨石 < 800 行。
4. **文档单一真相源**：本文 + CHANGELOG；旧方案只归档。
5. **发版可重复**：`test:release-ready` + 主路径 smoke + 手感清单无 P0 回退。

### 3.2 非目标（本阶段明确不做）

- 家庭协作 / 多用户 / 实时同步
- 完整云同步付费闭环（可继续只做 Notion 试验）
- iOS 正式上架
- Flutter 迁移（`docs/FLUTTER_MIGRATION_PLAN.md` 仅归档）
- 重写整套主题系统
- 引入大型动画库或全站 Framer Motion
- 为「更好看」推翻现有 classic / cream / mint / mist 四套主题

### 3.3 设计约束（实施时始终遵守）

来自 `.impeccable.md`，摘要：

1. 移动端优先，触控目标清晰。
2. 温暖克制：柔和渐变与半透明，禁止霓虹、强科技感、厚重嵌套卡片。
3. 功能不被装饰淹没。
4. 能用稳定原生控件时不引入复杂自定义。
5. 状态完整：默认 / 焦点 / 按下 / 禁用一致可见。

**动效：** 继续自研 spring；尊重 `prefers-reduced-motion` / `prefers-reduced-transparency`；流体能力可用 `utils/features.ts` 开关回滚。

---

## 4. 分阶段任务

### Phase A — 收敛与止血（约 0.5–1 周 · 建议 v133 同期）

**主题：停止发散，锁定下一刀切在哪。**

| ID | 任务 | 说明 | 验收 | 状态 |
|----|------|------|------|------|
| A1 | 文档收敛 | 旧方案文件顶部统一指向本文；Apple Feel 标 Done | 新人只读本文 + CHANGELOG | Done |
| A2 | demo 治理 | 未跟踪 `demo/*`：入库有用对照 html，其余 gitignore 或删 | `git status` 无垃圾素材 | Done（正式图标对照入库；本地探索产物忽略） |
| A3 | 真机补验收 | 跑 `docs/APPLE_FEEL_QA_CHECKLIST.md`，未过项写入 §9 | 128 手感无 P0 洞 | Blocked（ADB 无连接设备，待真机） |
| A4 | 性能基线 | 记录冷启动、首页可点、500+ 列表滚动、100 图备份耗时/体感 | 有可对比基线表 | Partial（桌面 Web 已测；Android 待测） |
| A5 | 忽略项检查 | `.tmp-chrome-webtest`、日志、本地 APK 等确保在 `.gitignore` | 干净工作区 | Done |
| A6 | 本地 UX 基线 | 只采集计数、耗时、结果分类；禁止正文、查询词、名称、ID 出端或入指标 | 可导出/清空的本地聚合基线；通过隐私字段测试 | Done |

**交付物：** 本文生效 + 性能/UX 基线指标表（可附在本文 §8 或 `docs/METRICS.md`）。

---

### Phase B — 主路径体验（约 1–2 周 · v133–v135）

**主题：像记录本，不像后台。**

| ID | 优先级 | 任务 | 做法要点 | 关键路径 | 状态 |
|----|--------|------|----------|----------|------|
| B1 | P0 | 记事路径再短 | 首页快捷记录默认好用；保存后 Toast 补操作；减少打断式弹层 | `Home` / EntrySheet / Toast | Todo |
| B2 | P0 | 搜索「找得到」 | Header 搜索权重加强；空态语法提示；结果跳转高亮 | `Header` / `GlobalSearchPanel` | Done |
| B3 | P0 | 列表扫视效率 | 回忆缩略图/计划 vs 回忆区分；人物 monogram 一致 | `MemoryCard` / `Memories` / `AvatarFace` | Todo |
| B4 | P1 | 详情第一屏规范 | 关联人/地/图前置固化；次要信息统一「更多」 | `MemoryDetail` / `PersonDetail` | Todo |
| B5 | P1 | 新用户 3 步剧本 | 记第一句 → 加一个人 → 导入或跳过 | `EmptyState` / `Home` | Done |
| B6 | P2 | 设置信息架构 | 账号/应用/数据/实验降噪；实验更深折叠 | `Settings` / `Account*` | Todo |
| B7 | P2 | 轻量 DESIGN.md | 从 tokens + impeccable 提炼 token/组件/ban，供人机统一风格 | `react-app/DESIGN.md` | Todo |
| B8 | P1 | 稳定个性化 | 先记住显式选择；只有 A6 证明有收益时才增加置顶/推荐，禁止自动频繁换序 | `Home` / `useHomeLayout` / preferences | Deferred（等待 ≥7 天且 ≥20 次曝光） |
| B9 | P1 | 分享隐私预设 | 提供私密/熟人/自定义预设和发送前字段预览；照片与精准定位继续默认关闭 | `LocalShareSheet` / share utils | Done |

**Phase B 验收：**

- [ ] 新装机约 1 分钟内完成第一条回忆
- [ ] 有数据用户：首页首屏强制区块克制 + 快捷记录明显
- [ ] 搜索 `@某人`、日期/年月可稳定命中并跳转

---

### Phase C — 工程可维护性（约 1–2 周 · 可与 B 并行 · v134–v136）

**主题：把改不动的文件拆到能改。**

#### C1 页面拆分

| ID | 目标文件 | 建议拆法 | 状态 |
|----|----------|----------|------|
| C1a | `Places.tsx` | `PlacesList` + `PlacesFilters` + `PlacesBatchBar` + `usePlacesQuery` | Todo |
| C1b | `PersonDetail.tsx` | Header / Anniversaries / Timeline / Prefs 子模块 | Todo |
| C1c | `Settings` / `AccountDataManagement` | 按 section 组件 + export/import/health hooks | Todo |
| C1d | `AccountNotionSync` | UI 与 model 继续分离；同步 actions 不进主 Context 热路径 | Todo |

#### C2 Context 减负（最重要结构债）

| ID | 步骤 | 说明 | 状态 |
|----|------|------|------|
| C2a | 读切片 hooks | `usePeople` / `usePlaces` / `useMemories` 等，避免按钮级订阅全 state | Todo |
| C2b | 写操作按域拆工厂 | `createPersonActions` / `createPlaceActions` / `createMemoryActions`；原工厂只组装 | Todo |
| C2c | （可选）Dexie liveQuery | 列表页减少对「全量数组」的依赖 | Todo |

**禁令：** 禁止一次性重写状态模型；必须小步、可回滚。

#### C3 CSS 第二刀

| ID | 文件 | 动作 | 状态 |
|----|------|------|------|
| C3a | `04-layout.css` | 按 shell / list / detail / form 拆 | Todo |
| C3b | `06-entry-sheet.css` | 与 EntrySheet 子组件对齐 | Todo |
| C3c | `03-themes.css` | 每主题一文件或纯 token 化 | Todo |
| C3d | 规范 | **禁止**新样式写入巨石；新样式进 `styles/pages/` 或组件域 | Todo |

#### C4 软门禁

| ID | 规则 | 状态 |
|----|------|------|
| C4a | 新建页面组件 ≤ 400 行 | Todo |
| C4b | 存量巨石每次 PR 净行数下降或拆出 ≥1 模块 | Todo |
| C4c | CHANGELOG/发版说明点名「拆了谁」 | Todo |

**Phase C 验收：**

- [ ] Places / PersonDetail / createLifeLogContextValue 均 < 800 行或已模块化且主文件 < 800
- [ ] 至少落地 C2a 切片 hooks，列表交互无明显「改一处全树更新」体感恶化

---

### Phase D — 性能与数据上限（约 1–2 周 · v135–v137）

**主题：用一年后的数据量设计今天。**

| ID | 优先级 | 任务 | 方案要点 | 状态 |
|----|--------|------|----------|------|
| D1 | P0 | 启动减负 | 设置/Notion 映射延迟加载；首屏近 N 条 memories + 计数 | Todo |
| D2 | P0 | 照片策略 | 列表强制 thumbnail；原图仅 Viewer/导出；保留缺图引导 | Todo |
| D3 | P0 | 备份稳态 | 分块序列化或 Worker；大备份默认缩略图；进度可见 | Todo |
| D4 | P1 | 窗口列表全覆盖 | 人物/地点/搜索结果均窗口化 + 动态行高 | Todo |
| D5 | P1 | Dexie 索引 | 评估 `memories` 日期/标签等索引，谨慎 version upgrade | Todo |
| D6 | P2 | 占用诊断 | 关于页展示数据量/照片占用估算 | Todo |
| D7 | P2 | 大备份可取消 | 原图全量导出可取消（成本高可后置） | Todo |

**内部性能目标（基线 agnostic，落地后填实测）：**

| 场景 | 目标 |
|------|------|
| 中端 Android，约 500 回忆冷启动到可点 | < 2.5s |
| 首页/列表滚动 | 无明显掉帧 |
| 约 200 图缩略图备份 | 不白屏，有进度 |
| 全量原图备份 | 有进度；可取消为加分项 |

---

### Phase E — 质量与发版（从 v133 起持续嵌入）

| ID | 任务 | 做法 | 状态 |
|----|------|------|------|
| E1 | 主路径 smoke | node：seed → save memory → search → backup normalize → import plan | Done |
| E2 | 发版门禁 | 保持并收紧 `test:release-ready`（版本三处一致、notes、APK 元数据） | Todo |
| E3 | Notion 隔离 | 同步失败不影响本地 CRUD；队列错误边界 | Todo |
| E4 | 安全回归 | 发版必跑 external-links / backup-import / update-checker | Todo |
| E5 | 手感回归 | 发版抽测 Apple Feel 清单 A/B/C 关键项 | Todo |
| E6 | UX 回归门禁 | 主路径 smoke + A6 指标前后对比 + 新装机/隐私分享真机用例 | 无隐私字段；核心指标无显著退化 | Doing（自动化完成，Android 真机待验） |

---

### Phase F — 可选增值（A–E 稳定后）

| ID | 方向 | 备注 | 状态 |
|----|------|------|------|
| F1 | 年度/月度回顾叙事化 | 已有统计页，强化分享图叙事 | Todo |
| F2 | 提醒智能化 | 现有长期未联系/地点回访增加分类开关、频率上限和“减少此类提醒”；默认安静 | Doing（分类开关完成；扩展与频率策略待基线） |
| F3 | 桌面 PWA 轻支持 | 非主路径 | Todo |
| F4 | 云同步商业化预研 | **独立文档**，不进主迭代代码 | Todo |
| F5 | 设计 token 文档化 | 与 B7 DESIGN.md 合并即可 | Todo |

---

## 5. 版本切片（建议排期）

| 版本 | 焦点 Phase | 用户可感知结果 |
|------|------------|----------------|
| **v133** | A（含 A6）+ B1/B2/B5 | 更好写下第一句、更好搜到；有可比较的 UX 基线 |
| **v134** | B8/B9（B8 受 A6 数据门槛约束）+ C1a/C1b + C2a | 分享更放心；只做有证据的个性化；列表更跟手 |
| **v135** | D1/D2/D3 | 数据多了也不慌 |
| **v136** | C1c + C3 + B6 | 设置更清晰；CSS 可维护 |
| **v137** | E（含 E6）固化 + A3 收口 | 发版更稳，UX 改动可验证 |
| 之后 | F | 回顾 / 提醒 / 预研 |

**发版节奏约定：**

- 继续 `0.1.0-test.N` 小步发布
- 中文 Conventional Commit + CHANGELOG
- 每版：`build` + 相关 `test:*` + `test:release-ready`
- Android 为验收主场；Web 仅作开发辅助

---

## 6. 优先级总表（执行顺序）

### P0 — 必须先做

1. A1–A6 文档、仓库与基线收敛
2. B1 记事主路径、B2 搜索可达、B5 新用户闭环
3. C2a Context 读切片（或等价减少全树订阅）
4. D1–D3 启动 / 照片 / 备份稳态
5. C1a/C1b Places、PersonDetail 拆分启动

### P1 — 紧随

6. B3/B4 列表与详情扫视
7. B9 分享隐私预设
8. B8 稳定个性化（仅在 A6 达到启动门槛后实施）
9. C2b 写操作分域工厂
10. C3 CSS 第二刀
11. E1/E6 主路径与 UX 回归门禁
12. Notion 严格实验化（E3 + C1d）

### P2 — 有余力

13. B6/B7 设置与 DESIGN.md
14. D4–D7 窗口列表/索引/诊断/可取消备份
15. F 增值项

---

## 7. Release Gate（发版门禁）

### 7.1 自动化（每版必过）

```powershell
cd react-app
npm.cmd run build
npm.cmd run test:release-ready
# 按本版改动加跑：
# npm.cmd run test:spring
# npm.cmd run test:backup-import
# npm.cmd run test:backup-health
# npm.cmd run test:external-links
# npm.cmd run test:update-checker
# npm.cmd run test:helpers
# … 以及 E1 主路径 smoke（落地后）
```

### 7.2 产品级（每版至少抽测）

| # | 门禁 | 标准 |
|---|------|------|
| G1 | 主路径 | 冷启动 → 记一条（尽量带图）→ 搜索找到 → 缩略图备份 → 导入预检通过 |
| G2 | 手感 | Apple Feel 清单无新增 P0 回退 |
| G3 | 性能 | 约定数据量下无 ANR / 长时间白屏 |
| G4 | 工程 | 若动巨石文件：净减少行数或完成约定拆分 |
| G5 | 文档 | CHANGELOG 已写；本文状态/版本切片已更新（若本版关闭任务） |
| G6 | 安全 | 外链/备份/更新相关测试通过（有改动时） |

### 7.3 回滚开关

- 流体：`utils/features.ts` → `fluidSheet` / `fluidPhotoViewer` / `fluidFab`
- 性能实验：新 flag 必须默认安全、可关

---

## 8. 性能基线表（A4 填写）

> 桌面数据由 `npm.cmd run measure:performance` 在生产构建上测得，原始结果见 [`performance-baseline-web.json`](./performance-baseline-web.json)。该结果用于版本间回归对比，不能替代 Android 真机性能和手感验收。

| 指标 | 设备 | 数据量 | 基线值 | 测量日期 | 备注 |
|------|------|--------|--------|----------|------|
| 冷启动到首页可点 | Windows x64 / Headless Chromium / 390×844 | Demo seed；5 次全新 context | 中位 1325.4 ms；P95 1462.6 ms | 2026-07-22 | `test.135` 生产构建预览；Android 待测 |
| 首页滚动体感 | Android 真机 | 待固定 | 待测 | | 需手工 UAT |
| 回忆列表 500+ 滚动 | Windows x64 / Headless Chromium / 390×844 | 500 条同月记录 | 首屏 1160.6 ms；48,771 px / 120 帧；P95 18.1 ms；>50 ms 0 帧 | 2026-07-22 | 已启用窗口渲染，DOM 17 项；Android 待测 |
| 100 图缩略图备份 | Windows x64 / Headless Chromium / 390×844 | 100×16 KiB Photo Blob | 523.1 ms；导出 4,651,476 bytes | 2026-07-22 | 浏览器下载完整落盘；Android SAF 待测 |
| 全量备份峰值体感 | Android 真机 | 待固定 | 待测 | | 需覆盖真实大图 |
| APK 包体 | Android release APK | `0.1.0-test.135` | 4,129,237 bytes | 2026-07-22 | 较 `test.134` 增加 68 bytes |

---

## 9. Backlog 收件箱

> 新想法只追加到这里，评审后再升到 Phase 任务表。
> 格式：`- [ ] YYYY-MM-DD 描述 （来源）`

- [ ] （空）

---

## 10. 文档治理

### 10.1 现行

| 文档 | 职责 |
|------|------|
| **本文** `docs/OPTIMIZATION_MASTER_PLAN.md` | 唯一优化主方案与任务板 |
| `CHANGELOG.md` | 已发布变更史 |
| `README.md` | 用户向说明与下载 |
| `docs/APPLE_FEEL_QA_CHECKLIST.md` | 手感真机清单 |

### 10.2 归档（勿按正文实施）

| 文档 | 处理 |
|------|------|
| `OPTIMIZATION_PLAN.md` | 已废弃声明 |
| `UX_OPTIMIZATION_PLAN_v2.md` | 顶部应指向本文 |
| `APPLE_FEEL_EXECUTION_PLAN.md` | 实施完成；维护改为清单回归 |
| `docs/UI_OPTIMIZATION_PLAN_v128.md` | 诊断参考；未完成项已吸收进 Phase B |
| `docs/LifeLog-后续优化计划.md` | 阶段 1–7 基础完成；增量进本文 |
| `docs/FLUTTER_MIGRATION_PLAN.md` | 非当前路线 |
| `docs/LifeLog-总计划.md` / `开发方案.md` | 历史总览，不替代本文 |

### 10.3 规则

1. 不新建平行优化方案文件。
2. 阶段完成时更新本文任务 **状态** 列：`Todo` → `Doing` → `Done`。
3. 版本发布时在 §5 或 CHANGELOG 交叉引用关闭的任务 ID（如 B1、C1a）。

---

## 11. 风险与规避

| 风险 | 规避 |
|------|------|
| 一次重写 Context 导致回归 | 只拆文件 + 加 selector；不换状态范式 |
| 性能优化误伤功能 | 前后指标对比；feature flag |
| 文档继续膨胀 | 新想法只进 §9 |
| Notion 吸干维护时间 | 实验区 bug 降优先级；本地 CRUD 永远优先 |
| demo/临时文件污染 PR | gitignore + A2 |
| 巨石拆分中途不可用 | 每次 PR 可运行、可发版；禁止「拆到一半合并」 |

---

## 12. 成功画像（v137 前后）

用户侧：

- 打开就能写，写完能找到，找到能回味。
- 数据用一年后仍然顺滑。
- 界面仍是「贴身记录本」，不是功能展览馆。

工程侧：

- 改地点列表不必翻 1300 行单文件。
- 发版一条命令检查就绪。
- 方案只有一份，CHANGELOG 能对上任务 ID。

---

## 13. 建议立即执行的第一刀（v133）

若只开一个迭代，推荐组合：

1. **A1 + A2 + A5 + A6** — 文档、仓库与 UX 基线收敛（低风险）
2. **B2** — 搜索入口与结果回落（高感知）
3. **B5** — 新用户 3 步闭环（高感知）
4. **E1 最小 smoke** — 把“写下并找回”固化成回归路径
5. **C2a 启动** — 为后续性能与拆分铺路（高杠杆）

不做：新大功能、Notion 增强、Flutter、主题重做。

---

## 14. 变更记录（本文自身）

| 日期 | 变更 |
|------|------|
| 2026-07-13 | 初版：整合 128–132 现状、UX/UI/后续计划与工程诊断，定为唯一主方案 |
| 2026-07-19 | 吸收历史 UX 方案中仍有价值的度量、新用户、稳定个性化、搜索回落、提醒控制和分享隐私，新增 §15 执行计划 |
| 2026-07-22 | `0.1.0-test.135` 收口：旧方案统一归档指向、demo/忽略项治理、建立可重复桌面 Web 性能基线；记录详情操作栏恢复文档流。ADB 未发现连接设备，A3、Android A4 与 UX-08 真机 UAT 保持未完成 |

---

## 15. 历史 UX 借鉴项执行计划

> **范围：** 只实施尚未闭环的 A6、B2、B5、B8、B9、E1、E6，以及受数据门槛约束的 F2。
> **不重复建设：** 快速记录 Toast、HEIC/队列/重试、批量操作、搜索语法/历史、统计页、分享卡、FAB 精简均视为已完成能力。
> **执行原则：** 先测量，后改变；显式偏好优先于隐式推断；所有 UX 数据只留本地且不含用户内容。

### 15.1 依赖与执行波次

| 波次 | 任务 | 依赖 | 建议切片 | 结束条件 |
|------|------|------|----------|----------|
| 0 | UX-01 本地指标内核；UX-02 主路径 smoke | 无 | 1 个小版本 | 有可信基线且测试能重放主路径 |
| 1 | UX-03 新用户闭环；UX-04 搜索入口与结果回落；UX-05 分享隐私预设 | 波次 0 事件定义冻结 | 1–2 个小版本 | 三条用户路径通过自动化 + 真机验收 |
| 2 | UX-06 稳定个性化；UX-07 智能提醒控制 | 至少 7 天本地样本或专项 UAT | 独立小版本，可部分跳过 | 只有达到启动门槛的能力上线 |
| 3 | UX-08 Release Gate 固化 | 波次 1；若执行波次 2 则包含其用例 | 与当前发布合并 | E1/E6 成为每版固定门禁 |

### 15.2 波次 0 — 基线与可验证性（A6 + E1）

#### UX-01 本地 UX 指标内核

**目标：** 用本地聚合数据回答“路径是否更短、失败是否更少”，不建设远程分析平台。

**建议文件：**

- 新建 `react-app/src/utils/uxMetrics.ts`：事件白名单、按版本/日期聚合、导出、清空。
- 新建 `react-app/src/hooks/useUxMetrics.ts`：页面/组件调用边界，不暴露任意 payload。
- 修改 `react-app/src/utils/diagnostics.ts` 与 `react-app/src/pages/Account/AccountDataManagement.tsx`：只读展示、导出、清空。
- 新建 `react-app/scripts/test-ux-metrics.cjs`，加入 `package.json` 测试脚本。

**允许字段：** `event`、`appVersion`、日期桶、耗时、模式枚举、结果枚举、数量桶。
**禁止字段：** 正文、标题、搜索词、人物/地点名称、URL、照片数据、业务 ID、精确位置。

**首批事件：**

| 事件 | 聚合维度 | 用途 |
|------|----------|------|
| `record_flow` | quick/full、saved/cancelled、耗时桶 | 判断记录路径是否更短 |
| `photo_process` | heic/other、success/retry/fail、耗时桶 | 验证照片可靠性 |
| `search_flow` | result-count 桶、selected/abandoned、耗时桶 | 判断是否“找得到” |
| `home_section` | section 枚举、open/close | 判断默认布局是否合适 |
| `onboarding_step` | step 枚举、complete/skip | 判断新用户是否完成首个价值闭环 |

**验收：**

- 指标 API 不接受自由文本和业务 ID；测试对禁用字段逐项失败。
- 只保存按日聚合结果，不保存原始事件；最多保留 90 个日期桶，超限自动删除最旧聚合。
- 断网下可记录、查看、导出、清空；代码中不存在网络发送路径。
- 指标写入失败不得阻塞保存、搜索、照片或导航。
- 首次基线记录进 §15.6，未取得基线前不得宣称“提升 N%”。

#### UX-02 主路径 smoke

**目标：** 自动重放 `seed → 快速记录 → 搜索命中 → 备份规范化 → 导入预检`。

**建议文件：**

- 将搜索解析/评分的纯逻辑从 `GlobalSearchPanel.tsx` 提取到 `src/utils/globalSearch.ts`，UI 保持现状。
- 新建 `scripts/test-main-path-smoke.cjs`，复用现有保存、搜索、备份 helper。
- 将脚本加入 `test:release-ready` 或发布准备脚本。

**验收：** 固定种子运行结果确定；失败返回非零；不依赖浏览器网络；覆盖中文人物、日期搜索、带关联记录和缩略图备份。

### 15.3 波次 1 — 三条高感知路径（B2 + B5 + B9）

#### UX-03 新用户 3 步闭环（B5）

**路径：** 写第一句 → 关联或新建一个人 → 完成备份/导入，或明确跳过第三步。

**实现约束：**

- 首页现有“补资料”队列继续服务有数据用户；新装机使用独立轻量清单，不混用语义。
- 每一步都可直接完成、稍后、跳过；状态本地持久化，完成后不再占据首屏。
- 不使用强制轮播、全屏教学和营销式说明；第一步必须直接打开快速记录。

**建议文件：** `src/pages/Home/Home.tsx`、`src/pages/Home/homeHelpers.tsx`、`src/components/EmptyState.tsx`，可拆 `src/components/OnboardingChecklist.tsx`、`src/hooks/useOnboardingProgress.ts` 与页面域样式文件；禁止把新样式写回 CSS 巨石。

**验收：**

- 清空数据/偏好后，60 秒内可保存第一条记录。
- 中途退出应用后从正确步骤恢复；全部跳过后不再弹出。
- 已有数据用户不进入新用户流程；屏幕阅读器可读出进度与按钮用途。

#### UX-04 搜索入口与结果回落（B2）

**实现约束：**

- 保留现有搜索语法、最近搜索和隐私模式，只增强入口权重和结果回落。
- Android 首屏提供可见“搜索”文案或等价可发现入口；桌面保留 `Ctrl/Cmd+K`。
- 选择结果后将匹配上下文作为瞬时路由状态传递；目标条目短暂高亮并滚入视野，不写入 URL，不持久化查询词。
- 尊重 `prefers-reduced-motion`；禁用动效时只做静态焦点样式。

**建议文件：** `src/components/Header.tsx`、`src/components/GlobalSearchPanel.tsx`、`src/pages/Memories/MemoryDetail.tsx`、`src/pages/People/PersonDetail.tsx`、`src/pages/Places/PlaceDetail.tsx`；新样式进入 `src/styles/pages/` 页面域文件并由 `styles/index.css` 引入，禁止继续扩张 `03-themes.css`。

**验收：** 人物、地点、记录三类结果都能正确回落；返回搜索后查询仍在本次面板会话内；隐私模式不产生历史或指标文本。

#### UX-05 分享隐私预设（B9）

**预设：**

| 预设 | 人物 | 地点 | 正文 | 照片/精准定位 |
|------|------|------|------|---------------|
| 私密分享（默认） | 昵称或隐藏 | 仅名称/城市级 | 用户显式确认 | 关闭 |
| 熟人分享 | 公开姓名 | 完整地点但无坐标 | 开启 | 关闭 |
| 自定义 | 逐项选择 | 逐项选择 | 逐项选择 | 默认关闭 |

**实现约束：** 生成链接、二维码、分享包和分享图之前显示统一字段摘要；切换目标时不得沿用上一条记录的敏感选择；精准定位和照片不能因记忆偏好自动开启。

**建议文件：** `src/components/LocalShareSheet.tsx`、`src/utils/lifelogShare.ts`、`src/utils/shareHistory.ts`、`src/styles/pages/07b-share.css` 及分享回归脚本。

**验收：** 每种预设的 payload 快照通过测试；默认 payload 不含照片、坐标和公开姓名；预览摘要与实际 payload 字段一致。

### 15.4 波次 2 — 受证据约束的增强（B8 + F2）

#### UX-06 稳定个性化（B8）

**启动门槛：** A6 显示某首页区块在至少 7 天且至少 20 次相关曝光中被重复展开/访问，或专项 UAT 中多数测试者明确要求固定入口。达不到门槛则保持现状并关闭任务，不为“智能化”而开发。

**允许：** 记住显式展开、默认记录模式、手动置顶；基于行为给一次性“是否置顶”建议。
**禁止：** 每次启动自动换序、无法解释的评分、根据正文/人物内容推断偏好。

**建议文件：** `src/hooks/useHomeLayout.ts`、`src/hooks/useUserPreferences.ts`、`src/pages/Home/Home.tsx`。

**验收：** 手动选择始终覆盖推荐；布局跨重启稳定；有“恢复默认”；旧偏好数据迁移不丢失。

#### UX-07 智能提醒控制（F2）

**启动门槛：** 现有智能提示在至少 7 天且至少 20 次曝光后完成稍后/忽略比例基线；若无法获得样本，仅做控制项，不新增提示类型。

**实现约束：** 为纪念日准备、长期未记录、档案补全、常去地点、记录间隔提供分类开关；同类提示有频率上限；“减少此类提醒”可撤销；默认继续安静。

**建议文件：** `src/pages/Home/homeHelpers.tsx`、`src/pages/Home/Home.tsx`、`src/pages/Settings/ReminderSettings.tsx`、`src/hooks/useUserPreferences.ts`。

**验收：** 关闭分类后不再生成对应提示；频率上限使用确定性时间测试；升级后沿用当前 snooze/dismiss 状态。

### 15.5 波次 3 — 验证与发布（E6）

**自动化门禁：**

```powershell
npm.cmd run build
npm.cmd run test:ux-metrics
npm.cmd run test:main-path
npm.cmd run test:ui
npm.cmd run test:release-ready
```

**真机用例：**

1. 新装机完成/跳过三步流程，重启后状态正确。
2. 快速记录保存后补照片，再从搜索进入并定位目标。
3. HEIC 成功、失败重试各一次，记录聚合结果但不记录文件名。
4. 三种分享预设逐一核对字段摘要、二维码/链接/分享包 payload。
5. 智能提示关闭、稍后、减少此类提醒后跨重启保持。

**发布判定：** 功能测试全过；无 P0 真机问题；禁止字段测试全过；记录成功率、搜索选择率或主路径耗时不得相对基线显著退化。样本不足时只判断功能与隐私，不做百分比结论。

### 15.6 基线与结果记录

| 版本/日期 | 样本环境 | 指标 | 基线 | 结果 | 决策 |
|-----------|----------|------|------|------|------|
| 待填写 | Android 真机 + 固定 seed | 首条记录耗时 | | | |
| 待填写 | Android 真机 + 固定 seed | 搜索命中并打开耗时 | | | |
| 待填写 | Android 真机 + HEIC/JPG 样本 | 照片成功/重试/失败 | | | |
| 待填写 | 本地聚合（≥7 天后） | 首页重复展开率 | | | 是否启动 UX-06 |
| 待填写 | 本地聚合（≥7 天后） | 提示稍后/忽略率 | | | 是否扩展 UX-07 |

### 15.7 风险、回滚与停止条件

| 风险 | 控制与回滚 |
|------|------------|
| 指标意外记录隐私 | 编译期窄类型 + 运行时白名单 + 禁止字段测试；可一键清空并关闭 A6 |
| 首页因个性化跳动 | 显式选择优先；UX-06 独立 feature flag；恢复默认布局 |
| 新用户流程干扰老用户 | 数据与完成状态双门槛；提供永久跳过 |
| 搜索高亮造成眩晕/错位 | reduced-motion 静态焦点；找不到目标时静默降级 |
| 分享预设与 payload 不一致 | 单一 options builder + payload 快照测试；异常时退回自定义确认页 |
| 智能提醒变成打扰 | 分类开关、频率上限、减少此类提醒；无证据不新增类型 |

**停止条件：** 若波次 0 无法建立可信、无隐私的基线，暂停 UX-06/UX-07；若波次 1 任一路径使保存或分享失败率上升，先回滚该路径，不带病进入下一波次。

### 15.8 执行记录（2026-07-19）

| 任务 | 状态 | 落地与验证 |
|------|------|------------|
| UX-01 本地 UX 指标内核 | Done | 6 类固定枚举事件；按日聚合；最多 90 天；数据管理页可查看、导出、清空；诊断只附计数摘要；禁止字段回归通过 |
| UX-02 主路径 smoke | Done | 固定 seed 覆盖快速记录、`@人物 + 日期` 搜索、搜索回落 state、备份预检与导入规范化；已纳入 `test:release-ready` |
| UX-03 新用户闭环 | Done | 非 Demo 数据作为完成依据；三步可独立完成或跳过；“稍后”仅隐藏当前会话；已有真实数据用户不进入流程 |
| UX-04 搜索回落 | Done | 人物、地点、记录统一使用瞬时路由 state；详情短暂聚焦；返回恢复同次查询；查询不进入 URL 或 UX 指标 |
| UX-05 分享隐私预设 | Done | 私密默认、熟人、自定义；发送前字段摘要；切换目标重置私密；链接/二维码/分享包共用 options builder；payload 快照通过 |
| UX-06 稳定个性化 | Deferred | 当前没有 ≥7 天且 ≥20 次曝光的本地样本，保持现状，不开发自动换序或隐式推荐 |
| UX-07 智能提醒控制 | Partial | 已为 5 类现有首页轻提示增加分类开关并保留 snooze/dismiss；没有新增提示类型，频率策略等待基线 |
| UX-08 Release Gate | Doing | 自动门禁已固化；2026-07-22 ADB 未发现连接设备，Android 真机 5 项 UAT 待执行，不计为通过 |

**本轮自动验证：** `npm.cmd run build`、`test:ux-metrics`、`test:main-path`、`test:share-privacy`、`test:diagnostics`、`test:quick-memory`、`test:backup-import`、`test:reminders`、`test:ui`、`test:release-ready` 均通过。390×844 与 1280×900 视口无横向溢出；未取得 7 天真实样本，不填写提升百分比。
