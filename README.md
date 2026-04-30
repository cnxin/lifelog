# LifeLog · 生活记录本

LifeLog 是一个移动端优先的跨平台 Web App，用来记录身边重要的人、地点和回忆。当前版本以 React 18 + Vite + TypeScript 实现 Web/PWA Demo，后续可以通过 Capacitor 打包到 Android 和 iOS。

## 当前状态

- MVP UI Demo 已完成
- 已按页面路由拆分
- 已支持人员、地点、回忆、日历、设置等核心模块
- 数据已从 `localStorage` 迁移到 IndexedDB
- 已加入手写 PWA 支持
- 已生成 Capacitor Android 原生工程
- GitHub 私有仓库：`https://github.com/cnxin/lifelog`

## 技术栈

- React 18
- Vite
- TypeScript
- React Router DOM
- Dexie / IndexedDB
- lucide-react
- Native CSS

## 功能模块

### 首页

- 展示近期纪念日、重要人员、常用地点和最近回忆
- 支持点击进入人员、地点、回忆详情
- 支持快速新增记录

### 人员

- 人员列表和人员详情页
- 姓名、昵称、关系、生日、备注
- 喜好档案支持自由分组和多项内容，例如颜色、食物、电影类型
- 禁忌档案支持自由分组和多项内容
- 生日和纪念日只录入公历日期，自动展示农历日期
- 详情页可查看关联回忆和相关地点

### 地点

- 地点列表和地点详情页
- 支持国家、城市、区域、店家层级
- 支持默认城市筛选
- 支持地址、经纬度、地图链接、参考链接、评分、标签和描述
- 详情页可查看一起去过的人和相关回忆

### 回忆

- 回忆列表和回忆详情页
- 支持标题、日期、心情、内容、标签
- 支持关联多个人员和一个地点
- 关联人员、关联地点均可点击跳转详情

### 日历

- 月视图日历
- 展示人员生日、纪念日和回忆日期
- 生日和纪念日按年循环出现
- 日历条目可点击跳转对应详情

### 设置

- 数据导出
- 数据导入
- 重置演示数据
- 使用应用内确认弹窗替代浏览器默认 `confirm()`

## 目录结构

```text
src/
  components/          通用组件
    AppLayout.tsx
    BottomNav.tsx
    EntrySheet.tsx
    GlassCard.tsx
    SearchBar.tsx
  context/             全局状态和确认弹窗
    ConfirmContext.tsx
    LifeLogContext.tsx
  data/                初始演示数据
    seedData.ts
  db/                  IndexedDB 数据层
    database.ts
  pages/               页面路由
    Calendar/
    Home/
    Memories/
    People/
    Places/
    Settings/
  types/               业务类型
    index.ts
  utils/               日期和文本工具
```

## 本地开发

安装依赖：

```bash
npm.cmd install
```

启动开发服务器：

```bash
npm.cmd run dev
```

生产构建：

```bash
npm.cmd run build
```

预览生产构建：

```bash
npm.cmd run preview
```

## 数据存储

当前数据存储在浏览器 IndexedDB 中，数据库逻辑位于 `src/db/database.ts`。应用首次启动会写入演示数据，并保留了从旧版 `localStorage` 数据迁移到 IndexedDB 的兼容逻辑。

## PWA

当前使用手写 PWA 配置，相关文件：

- `public/manifest.webmanifest`
- `public/icon.svg`
- `public/sw.js`
- `src/registerServiceWorker.ts`
- `PWA.md`

Service Worker 只会在生产环境注册。

## 移动端方向

项目已加入 Capacitor 基础配置：

- `capacitor.config.ts`
- `@capacitor/core`
- `@capacitor/cli`
- `@capacitor/android`
- Android/iOS 平台脚本
- `android/` 原生工程
- Android debug APK 构建已验证

详细说明见 `MOBILE.md`。

## 后续开发建议

- 安装 APK 到 Android 真机或模拟器完成运行验证
- 后续在 macOS 上生成 iOS 工程
- 补充照片上传和本地图片管理
- 增加地点地图选择和定位权限
- 增加人员、地点、回忆的编辑历史或软删除
- 增加云同步和账号体系
- 增加自动化测试和基础 CI
