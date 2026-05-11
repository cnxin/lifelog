# LifeLog · 生活记录本

LifeLog 是一个移动端优先的跨平台 Web App，用来记录身边重要的人、地点和回忆。当前版本以 React 18 + Vite + TypeScript 实现 Web/PWA Demo，并通过 Capacitor 打包为 Android APK 进行真机测试。

## 当前状态

- MVP UI Demo 已完成
- 已按页面路由拆分
- 已支持人员、地点、回忆、日历、设置等核心模块
- 数据已从 `localStorage` 迁移到 IndexedDB
- 已加入手写 PWA 支持
- 已生成 Capacitor Android 原生工程
- 已支持本地通知提醒设置和 Android 通知权限请求
- 已支持生日、纪念日、定期联系、回忆回顾四类提醒
- 已支持照片上传、压缩、缩略图和回忆详情查看
- 已支持关系、地点类型、日期、时间和数字等移动端友好的自定义控件
- 已支持原版、奶油纸感、薄荷留白、晨雾极简 4 套视觉风格，并可在设置中横向快速切换
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
- 关系支持预设选项选择，减少手机端手动输入
- 生日使用统一日期控件，并自动拆分保存年月日
- 喜好档案支持自由分组和多项内容，例如颜色、食物、电影类型
- 禁忌档案支持自由分组和多项内容
- 生日和纪念日只录入公历日期，自动展示农历日期
- 详情页可查看关联回忆和相关地点

### 地点

- 地点列表和地点详情页
- 支持国家、城市、区域、店家层级
- 地点类型支持预设选项选择，保持录入格式统一
- 支持默认城市筛选
- 支持地址、经纬度、地图链接、参考链接、评分、标签和描述
- 详情页可查看一起去过的人和相关回忆

### 回忆

- 回忆列表和回忆详情页
- 支持兼容旧数据和导入数据中缺失的关联人物、标签、照片字段，避免详情页打开时报错
- 支持标题、日期、心情、内容、标签
- 支持关联多个人员和一个地点
- 支持照片上传、本地压缩、缩略图展示和全屏查看
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
- 默认城市、关系、心情配置
- 视觉风格切换：原版、奶油纸感、薄荷留白、晨雾极简
- 设置页内置控件样式 Demo，用于统一日期、时间、数字和开关控件体验
- 地点强重复自动合并与撤销
- 本地提醒设置：生日、纪念日、定期联系、回忆回顾
- 通知权限引导和测试通知
- 使用应用内确认弹窗替代浏览器默认 `confirm()`

## 目录结构

```text
src/
  components/          通用组件
    DateInput.tsx
    NumberStepper.tsx
    SelectPicker.tsx
    TimePicker.tsx
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
  hooks/               自定义 Hooks
    useReminderScheduling.ts
  types/               业务类型
    index.ts
  utils/               日期、文本、图片压缩和提醒调度工具
```

## 本地通知提醒

当前 Android 版本集成了 `@capacitor/local-notifications`：

- 生日提醒：支持提前 N 天和当天提醒
- 纪念日提醒：支持提前 N 天和当天提醒，并避免与生日重复
- 定期联系提醒：根据最近一次关联回忆判断是否需要联系
- 回忆回顾提醒：展示往年今天的回忆
- 设置页可开关各类提醒、配置提醒时间和发送测试通知

Android 权限已在 `android/app/src/main/AndroidManifest.xml` 中声明：

- `POST_NOTIFICATIONS`：Android 13+ 通知权限
- `SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM`：精确定时提醒

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

## GitHub Actions 云端 APK 构建

项目提供 `.github/workflows/build-android-apk.yml`，推送到 `main` 或手动运行 workflow 后，会在 GitHub Actions 的干净 Ubuntu runner 上构建 APK，并上传 artifact。

### 手动运行

1. 打开 GitHub 仓库的 **Actions** 页面。
2. 选择 **Build Android APK**。
3. 点击 **Run workflow**。
4. 构建完成后，在 workflow run 的 **Artifacts** 下载 APK。

### Release 签名配置

如果配置以下 GitHub Secrets，workflow 会构建签名 release APK：

```text
ANDROID_KEYSTORE_BASE64
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_ALIAS
ANDROID_KEY_PASSWORD
```

`ANDROID_KEYSTORE_BASE64` 是 release keystore 文件的 base64 内容。未配置这些 Secrets 时，workflow 会直接失败，避免产出无法覆盖安装 release 包的 debug APK。

本地构建时，如果 `android/keystore.properties` 存在，`debug` 和 `release` 都会使用同一套 release 签名，方便在真机上直接覆盖安装；如果不存在，debug APK 仍会使用 Android 默认 debug 签名。

## 本地 Android APK 构建与真机测试

一键同步 Android 版本、构建 release APK 并校验产物时间戳：

```bash
npm.cmd run release:apk
```

构建 release APK：

```bash
npm.cmd run android:release
```

构建成功后 APK 输出到：

```text
android/app/build/outputs/apk/release/app-release.apk
```

构建 debug APK：

```bash
npm.cmd run android:debug
```

构建成功后 APK 输出到：

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

真机测试建议：

1. 安装 debug APK 到 Android 真机。
2. 打开「设置 → 提醒设置」，点击「启用通知」并授权。
3. 点击「发送测试通知」，确认 3 秒后收到通知。
4. 新建一个 7 天后生日的人物，确认生日提前提醒被调度。
5. 修改提醒时间或开关后，重新进入应用确认提醒会自动重调度。

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
- 增加地点地图选择和定位权限
- 增加人员、地点、回忆的编辑历史或软删除
- 增加云同步和账号体系
- 增加自动化测试和基础 CI
