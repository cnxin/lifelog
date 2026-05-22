# LifeLog 开发方案

## 1. 项目定位

LifeLog 是一个面向个人使用的信息记录应用，用来长期记录重要的人、地点和共同经历。第一阶段优先开发 Web 端，采用移动端优先的响应式设计；后续在同一套前端代码基础上通过 PWA 和 Capacitor 打包 Android。

核心价值：

- 快速记录一个人的喜好、禁忌、纪念日和备注。
- 快速记录餐厅、酒店、景点、电影院等地点。
- 用“回忆/事件”把人物和地点关联起来，记录某天和谁去了哪里、发生了什么。
- 本地优先保存，先保证离线可用；云同步、Android 通知和图片管理放到后续阶段。

## 2. 一期范围

一期目标是做出一个能真实使用的 MVP，而不是一次性塞满所有功能。

一期包含：

- 人物管理：新增、编辑、删除、详情、收藏、标签、喜好、禁忌、纪念日。
- 地点管理：新增、编辑、删除、详情、收藏、分类、评分、消费、推荐项。
- 回忆/事件管理：新增、编辑、删除、按人物和地点关联。
- 首页 Dashboard：即将到来的纪念日、收藏人物、最近回忆、关键统计。
- 搜索：人物、地点、回忆的统一关键词搜索。
- 数据导出：JSON 备份。
- 本地存储：Web Demo 使用 localStorage；正式版切换为 IndexedDB/Dexie。

一期暂不包含：

- 登录注册。
- 云端同步。
- Android 原生通知。
- 大量图片上传和相册管理。
- 多语言。
- 复杂动画。

## 3. 推荐技术架构

正式开发建议使用：

| 层面 | 技术 | 说明 |
| --- | --- | --- |
| 前端框架 | React + TypeScript | 组件化、类型安全，后续迁移成本低 |
| 构建工具 | Vite | 开发快，配置轻 |
| 路由 | React Router | 支持多页面 SPA |
| 本地数据库 | IndexedDB + Dexie.js | 支持离线、大数据量、索引查询 |
| 状态管理 | Zustand 或 React Context | 一期状态不复杂，优先轻量 |
| UI | 自研 CSS + lucide-react | 保持界面克制、移动端友好 |
| PWA | vite-plugin-pwa | 后续支持安装到桌面/手机 |
| Android | Capacitor | 使用 Web 代码打包 Android |
| 云同步 | Supabase 或 Firebase | 后续可选 |

演示 Demo 为了方便直接查看，使用纯 HTML/CSS/JavaScript 实现，不依赖安装环境。

## 4. 核心数据模型

正式版建议以 `Person`、`Place`、`MemoryEvent` 为核心。人物和地点不直接互相保存冗余关系，统一通过事件关联，避免数据不一致。

```ts
type ID = string;

interface Person {
  id: ID;
  name: string;
  nickname?: string;
  birthday?: string;
  relationship?: string;
  contacts: ContactInfo[];
  preferences: Preference[];
  dislikes: string[];
  anniversaries: Anniversary[];
  sizes?: Record<string, string>;
  notes?: string;
  tags: string[];
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ContactInfo {
  type: "phone" | "wechat" | "email" | "other" | string;
  value: string;
  label?: string;
}

interface Preference {
  category: string;
  items: string[];
}

interface Anniversary {
  id: ID;
  name: string;
  date: string;
  isLunar: boolean;
  reminder: boolean;
}

interface Place {
  id: ID;
  name: string;
  category: string;
  address?: string;
  phone?: string;
  rating?: number;
  avgCost?: number;
  recommendations: string[];
  businessHours?: string;
  review?: string;
  notes?: string;
  tags: string[];
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

interface MemoryEvent {
  id: ID;
  title: string;
  date: string;
  personIds: ID[];
  placeId?: ID;
  content?: string;
  rating?: number;
  mood?: string;
  tags: string[];
  photos: string[];
  createdAt: string;
  updatedAt: string;
}
```

## 5. 页面结构

```text
/                     Dashboard 首页
/people               人物列表
/people/new           新增人物
/people/:id           人物详情
/people/:id/edit      编辑人物
/places               地点列表
/places/new           新增地点
/places/:id           地点详情
/places/:id/edit      编辑地点
/events               回忆列表
/events/new           新增回忆
/events/:id           回忆详情
/events/:id/edit      编辑回忆
/search               全局搜索
/settings             设置、导出、导入、同步入口
```

移动端底部主导航建议放 5 个入口：

- 首页
- 人物
- 地点
- 回忆
- 设置

## 6. 交互设计原则

- 移动端优先，桌面端做宽屏增强。
- 表单录入要快，常用字段放前面，可选字段折叠或弱化。
- 不用大面积渐变、毛玻璃和复杂动画，避免长期使用疲劳。
- 卡片圆角控制在 8-12px。
- 首页突出“马上有用”的信息：即将到来的纪念日、最近记录、收藏入口。
- 所有删除操作需要二次确认。
- 第一版先用文本和标签，图片功能后移。

## 7. 功能拆分

### 7.1 人物模块

列表：

- 搜索姓名、昵称、标签。
- 按收藏、关系标签筛选。
- 显示姓名、昵称、关系、标签、即将到来的纪念日。

详情：

- 基本信息。
- 喜好。
- 禁忌。
- 纪念日。
- 相关回忆。
- 一起去过的地点通过回忆聚合得出。

表单：

- 必填：姓名。
- 可选：昵称、生日、关系、标签、喜好、禁忌、纪念日、备注、收藏。

### 7.2 地点模块

列表：

- 搜索名称、分类、地址、标签。
- 按分类和收藏筛选。
- 显示评分、人均、标签、最近关联回忆。

详情：

- 基本信息。
- 评分和评价。
- 推荐项。
- 相关回忆。
- 一起去过的人通过回忆聚合得出。

表单：

- 必填：名称、分类。
- 可选：地址、电话、营业时间、评分、人均、推荐项、标签、备注、收藏。

### 7.3 回忆模块

列表：

- 按时间倒序。
- 显示标题、日期、关联人物、关联地点、标签。

详情：

- 时间。
- 人物。
- 地点。
- 内容。
- 评分/心情。

表单：

- 必填：标题、日期。
- 可选：关联人物、关联地点、内容、评分、心情、标签。

## 8. 本地存储设计

正式版 IndexedDB 建议表结构：

```ts
db.version(1).stores({
  people: "id, name, birthday, relationship, isFavorite, updatedAt",
  places: "id, name, category, isFavorite, updatedAt",
  events: "id, date, placeId, updatedAt, *personIds",
  tags: "id, name, type"
});
```

数据读取原则：

- 页面加载时从 IndexedDB 读取。
- 新增/编辑/删除后立即写入 IndexedDB。
- 状态层只保留当前页面需要的数据，不把数据库完整复制成全局大对象。
- 导出时生成一个包含版本号的 JSON。

导出格式：

```json
{
  "version": 1,
  "exportedAt": "2026-04-29T00:00:00.000Z",
  "people": [],
  "places": [],
  "events": []
}
```

## 9. Android 路线

阶段 1：Web MVP

- 完成人物、地点、回忆、搜索、导出。
- 验证移动浏览器体验。

阶段 2：PWA

- 加 `manifest.json`。
- 加 service worker。
- 支持离线打开。
- 支持添加到手机主屏幕。

阶段 3：Capacitor Android

- 初始化 Capacitor。
- 添加 Android 平台。
- 处理状态栏、软键盘、安全区域。
- 处理 Android 返回键。

阶段 4：原生增强

- 本地通知提醒纪念日。
- 相机/相册权限。
- 文件系统存储图片。
- 后台提醒策略。

## 10. 里程碑计划

### Phase 1：MVP 骨架

- 项目初始化。
- 页面路由。
- 基础布局和底部导航。
- 本地数据层。
- 示例数据和空状态。

验收标准：

- 手机宽度下能完整浏览。
- 首页、人物、地点、回忆、设置可切换。
- 数据刷新后不丢失。

### Phase 2：核心 CRUD

- 人物新增/编辑/删除。
- 地点新增/编辑/删除。
- 回忆新增/编辑/删除。
- 详情页聚合关联数据。

验收标准：

- 能记录“一个人 + 一个地点 + 一段回忆”完整链路。
- 人物详情能看到相关回忆。
- 地点详情能看到相关回忆。

### Phase 3：效率功能

- 全局搜索。
- 标签筛选。
- 纪念日倒计时。
- JSON 导出/导入。

验收标准：

- 能用关键词找到人物、地点、回忆。
- 导出的 JSON 可以再次导入恢复。

### Phase 4：移动端增强

- PWA。
- 响应式细节。
- Android 打包。
- 本地通知。

验收标准：

- Android 设备可安装并打开。
- 返回键行为符合移动端预期。
- 通知权限和提醒逻辑可控。

## 11. 风险和处理

| 风险 | 处理 |
| --- | --- |
| 图片导致本地库变大 | 图片功能后移，单独设计附件表 |
| 关系数据重复 | 用 MemoryEvent 作为人物和地点的唯一关联来源 |
| 年龄过期 | 只存 birthday，年龄实时计算 |
| 农历复杂 | 一期先保留字段，正式提醒逻辑二期实现 |
| 云同步冲突 | 本地优先，一期只做导出备份 |
| Android 权限差异 | Web MVP 稳定后再接 Capacitor 插件 |

## 12. Demo 说明

当前目录下的 `demo/index.html` 是一个无依赖静态演示版，包含：

- Dashboard。
- 人物、地点、回忆三类数据。
- 新增表单。
- 搜索。
- JSON 导出。
- localStorage 本地保存。

直接用浏览器打开即可体验：

```text
demo/index.html
```

