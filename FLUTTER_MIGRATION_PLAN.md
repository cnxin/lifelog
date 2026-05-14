# LifeLog Flutter + M3 分阶段迁移计划

> 从 React 18 + Capacitor → Flutter + Material Design 3
> 目标平台：Android / iOS / Web（渐进式）

---

## 技术选型

| 层 | 现有方案 | Flutter 方案 | 理由 |
|----|---------|-------------|------|
| UI 框架 | React 18 + 手写 CSS | Flutter + Material 3 | 内置组件库，主题 token 化 |
| 状态管理 | React Context | Riverpod 2.x | 类型安全，细粒度刷新，类似 Context 模型 |
| 数据库 | Dexie (IndexedDB) | Drift (SQLite) | 类型安全 ORM，支持迁移/FTS，跨平台 |
| 路由 | React Router DOM 6 | go_router | 声明式，支持深链接/嵌套路由 |
| 照片 | browser-image-compression | image_picker + image_compress | 原生相机/相册访问 |
| 通知 | @capacitor/local-notifications | flutter_local_notifications | 无 64 条限制，更灵活 |
| ID 生成 | uuid | uuid (Dart) | 同名包，API 一致 |
| 图标 | lucide-react | Material Icons / lucide_icons | M3 内置 2000+ 图标 |
| 农历 | 自写 date.ts | lunar (pub.dev) | 成熟社区包 |
| 序列化 | 手动 JSON | json_serializable + freezed | 编译期类型安全 |

---

## 主题映射

现有 4 套主题直接映射为 M3 `ColorScheme`：

| 主题 | 现有 Primary | M3 Seed Color | 效果 |
|------|-------------|---------------|------|
| Classic | `#7c8cf8` 薰衣草紫 | `Color(0xFF7C8CF8)` | 紫蓝色调，柔和活力 |
| Cream | `#9f7b55` 焦糖棕 | `Color(0xFF9F7B55)` | 暖咖色调，复古温馨 |
| Mint | `#12b886` 薄荷绿 | `Color(0xFF12B886)` | 清新绿调，自然清爽 |
| Mist | `#4b5563` 雾灰 | `Color(0xFF4B5563)` | 中性灰调，低调克制 |

每个 seed color 自动生成完整的 light/dark 模式配色方案（含 Primary/Secondary/Tertiary/Error/Surface 全套 token），无需手写 CSS 变量。

---

## Phase 0：环境搭建 & 项目初始化（1 天）

### 目标
- Flutter SDK 安装 & `flutter doctor` 全绿
- 创建项目骨架 `lifelog_flutter`
- 验证 M3 主题 + 4 色切换 + 亮暗模式

### 产出
```
lifelog_flutter/
├── lib/
│   ├── main.dart
│   ├── app.dart              # MaterialApp + ThemeData
│   ├── theme/
│   │   └── app_theme.dart    # 4 套 M3 seed color
│   └── router/
│       └── app_router.dart   # go_router 路由表
├── pubspec.yaml
└── test/
```

### 依赖
```yaml
dependencies:
  flutter_riverpod: ^2.5.0
  go_router: ^14.0.0
  drift: ^2.18.0
  sqlite3_flutter_libs: ^0.5.0
  path_provider: ^2.1.0
  uuid: ^4.4.0
  json_annotation: ^4.9.0
  intl: ^0.19.0

dev_dependencies:
  build_runner: ^2.4.0
  json_serializable: ^6.8.0
  drift_dev: ^2.18.0
  freezed: ^2.5.0
  freezed_annotation: ^2.4.0
```

### 验收标准
- [ ] `flutter run` 在 Android 模拟器/真机启动成功
- [ ] 4 套主题可切换，亮暗模式自动适配
- [ ] 底部导航栏 5 个 tab 可点击切换

---

## Phase 1：数据层迁移（2-3 天）

### 目标
把 IndexedDB (Dexie) → Drift (SQLite)，保持完全相同的数据模型

### 数据模型映射

```dart
// Person 表
class People extends Table {
  TextColumn get id => text()();
  TextColumn get name => text()();
  TextColumn get nickname => text().withDefault(const Constant(''))();
  TextColumn get relationship => text()();
  TextColumn get birthday => text().nullable()();
  BoolColumn get birthdayIsLunar => boolean().withDefault(const Constant(false))();
  BoolColumn get favorite => boolean().withDefault(const Constant(false))();
  TextColumn get preferences => text().withDefault(const Constant('[]'))(); // JSON
  TextColumn get dislikes => text().withDefault(const Constant('[]'))();   // JSON
  TextColumn get anniversaries => text().withDefault(const Constant('[]'))(); // JSON
  TextColumn get notes => text().withDefault(const Constant(''))();

  @override
  Set<Column> get primaryKey => {id};
}

// Place 表 — 对应现有 7 版 schema 最终形态
// Memory 表 — 含 personIds JSON 数组
// Photo 表 — 存文件路径而非 Blob
// AppSettings / ReminderSettings — key-value 表
```

### 关键变化
| 项目 | IndexedDB | SQLite (Drift) |
|------|-----------|----------------|
| 照片存储 | Blob 存数据库 | 文件系统存储，数据库存路径 |
| 多值索引 | `*personIds` | 中间表 `memory_people` |
| Schema 迁移 | Dexie version() | Drift schemaVersion + migrator |
| 全文搜索 | 手动遍历 | SQLite FTS5 |

### 数据导入兼容
- 支持读取现有 JSON 导出格式
- 写一个 `legacy_importer.dart` 处理旧数据导入

### 验收标准
- [ ] 所有实体 CRUD 单元测试通过
- [ ] 导入现有 JSON 数据无报错
- [ ] FTS5 搜索可跨 People/Places/Memories

---

## Phase 2：People 模块完整迁移（2-3 天）

### 页面对应
| React 页面 | Flutter 页面 |
|------------|-------------|
| `People.tsx` | `people_list_page.dart` |
| `PersonDetail.tsx` | `person_detail_page.dart` |
| `EntrySheet.tsx` (person 部分) | `person_form_page.dart` |

### M3 组件映射
| 功能 | React (手写) | Flutter M3 |
|------|-------------|------------|
| 人物卡片 | 手写 CSS card | `Card.filled()` / `ListTile` |
| 搜索栏 | 手写 input | `SearchBar` / `SearchAnchor` |
| 星标收藏 | 手写 toggle | `IconButton` + `Icons.star` |
| 表单输入 | 手写各种控件 | `TextFormField` / `DropdownMenu` |
| 日期选择 | 自写 `DateInput.tsx` | `showDatePicker()` |
| 偏好分组 | 手写列表 | `ExpansionTile` + `Chip` |
| FAB 新建 | 手写按钮 | `FloatingActionButton.extended()` |
| 确认删除 | 自写 ConfirmDialog | `showDialog()` + `AlertDialog` |

### 验收标准
- [ ] 人物列表：搜索/筛选/收藏/分组
- [ ] 新建/编辑人物：含偏好/纪念日/农历生日
- [ ] 删除人物：级联清理 Memory 关联
- [ ] 与现有 React 版功能完全一致

---

## Phase 3：Places 模块迁移（2-3 天）

### 新增难点
- 多级地理层级（国家/省/市/区/商场/店铺）
- 地点去重算法迁移
- 评分星级 + 外部链接
- 商场聚合视图

### M3 组件映射
| 功能 | Flutter M3 |
|------|-----------|
| 地点卡片 | `Card` + 评分 `Row` |
| 分类筛选 | `FilterChip` / `SegmentedButton` |
| 评分输入 | 自写星级组件 / `Slider` |
| 商场详情 | `SliverAppBar` + `SliverList` |
| 地图链接 | `url_launcher` 跳转高德/百度 |

### 验收标准
- [ ] 地点 CRUD + 商场聚合
- [ ] 去重检测 + 合并预览 + 撤销
- [ ] 外部链接跳转正常

---

## Phase 4：Memories 模块迁移（3-4 天）

### 新增难点
- 多人+单地点关联选择
- 照片上传/压缩/缩略图/查看
- 心情标签
- 标签系统

### 照片处理方案
```
拍照/相册 → image_picker
    ↓
压缩 → flutter_image_compress
    ↓
存储 → path_provider 获取 app 目录 → 文件系统
    ↓
缩略图 → 压缩时同时生成小图
    ↓
数据库 → Drift 存文件路径 + 元数据
```

### 验收标准
- [ ] Memory CRUD + 关联人/地点
- [ ] 照片多选/压缩/网格展示/全屏查看
- [ ] 心情选择器 + 标签输入
- [ ] 按时间/心情/标签筛选

---

## Phase 5：Home 首页 + Calendar 日历（2-3 天）

### 首页 Dashboard
- 近期生日/纪念日卡片 → `Card` + `ListTile`
- 收藏人物/地点快捷入口
- 最近 Memory 时间线

### 日历
- `table_calendar` 包
- 农历日期显示（`lunar` 包）
- 生日/纪念日/Memory 标记
- 点击日期跳转详情

### 验收标准
- [ ] 首页信息聚合正确
- [ ] 日历月视图 + 农历 + 事件标记
- [ ] 点击事件跳转正常

---

## Phase 6：Settings + 通知 + 数据管理（2-3 天）

### 功能
- 主题切换（4 套 M3 色 + 亮暗模式）
- 提醒设置（生日/纪念日/联络/记忆回顾）
- 数据导入/导出 JSON
- 数据重置
- 存储用量估算

### 通知方案
```dart
// flutter_local_notifications
// 无 Capacitor 64 条限制
// 支持精确定时、重复、分组
final notification = FlutterLocalNotificationsPlugin();
await notification.zonedSchedule(
  id: uniqueId,
  title: '生日提醒',
  body: '${person.name} 的生日还有 ${days} 天',
  scheduledDate: tz.TZDateTime(...),
  matchDateTimeComponents: DateTimeComponents.dateAndTime,
);
```

### 验收标准
- [ ] 4 主题切换即时生效
- [ ] 提醒设置保存 + 通知触发正常
- [ ] JSON 导入/导出与旧版格式兼容
- [ ] 存储用量显示准确

---

## Phase 7：平台适配 & 发布（2-3 天）

### Android
- 签名配置（复用现有 keystore）
- 权限声明（通知/相机/相册/精确闹钟）
- 自适应图标 + 启动页
- APK / AAB 构建

### iOS（新增）
- Info.plist 权限描述
- App Icon + Launch Screen
- 通知权限请求流程
- TestFlight 分发

### Web（可选）
- `flutter build web --wasm`
- 首屏加载优化（deferred loading）
- PWA manifest

### 验收标准
- [ ] Android APK 大小 < 25MB
- [ ] iOS 真机运行正常
- [ ] Web 版本可访问（如需要）

---

## 时间线总览

```
Phase 0  环境 & 骨架        ████                          1 天
Phase 1  数据层              ████████                      2-3 天
Phase 2  People              ████████                      2-3 天
Phase 3  Places              ████████                      2-3 天
Phase 4  Memories            ██████████                    3-4 天
Phase 5  Home + Calendar     ████████                      2-3 天
Phase 6  Settings + 通知     ████████                      2-3 天
Phase 7  平台适配 & 发布     ████████                      2-3 天
                                                    ───────────
                                                    总计 16-23 天
```

---

## 风险 & 缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Web 首屏过大 (2-4MB) | 移动端网页体验差 | 仅保留 Android/iOS 为主要平台，Web 作为预览 |
| 农历包精度 | 纪念日计算偏差 | Phase 5 重点测试，必要时移植现有 date.ts |
| 照片迁移 | Blob → 文件，旧数据不兼容 | Phase 1 写迁移脚本，JSON 导入时自动转换 |
| APK 包体积增大 | ~15MB vs 现在 ~5MB | 可接受范围，原生体验弥补 |
| 桌面端需求 | Flutter 桌面仍有粗糙之处 | 优先 mobile，桌面作为 bonus |

---

## Demo 验证清单（Phase 0 产出）

在正式迁移前，先用一个最小 demo 验证以下关键技术点：

- [x] M3 主题系统：4 套 seed color + 亮暗模式切换
- [x] M3 组件：Card / ListTile / FAB / SearchBar / BottomNav
- [x] Drift SQLite：People CRUD + 持久化
- [x] go_router：5 个 tab 页面路由
- [x] Riverpod：状态管理 + 响应式刷新
- [ ] 照片：image_picker + 压缩（Phase 4 验证）
- [ ] 通知：flutter_local_notifications（Phase 6 验证）
- [ ] 农历：lunar 包精度（Phase 5 验证）
