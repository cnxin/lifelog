# Changelog

所有重要变更会记录在这个文件中。

## [0.1.0] - 2026-04-29

### Fixed

- 修复 Android 真机按系统返回键直接退回桌面的问题，现在会优先关闭新增面板或返回上一页。
- 修复喜好档案和禁忌输入英文逗号时被强制拆分的问题，改为使用顿号、分号或换行分隔。
- 修复高德地图等外部链接在 Capacitor Android 中无法正常打开的问题。
- 修复三字中文姓名头像显示不完整的问题，例如 `王晓明` 会完整显示。
- 修复人物资料无法添加自定义纪念日的问题，支持多个纪念日并自动显示农历日期。

### Added

- 初始化 React 18 + Vite + TypeScript 项目。
- 引入 `react-router-dom`，完成页面路由拆分。
- 引入 `lucide-react` 作为图标库。
- 完成移动端优先 App Shell：
  - 顶部 Header
  - 底部导航
  - 悬浮新增按钮
  - 毛玻璃卡片
  - 浅色/深色模式变量
- 完成人员模块：
  - 人员列表
  - 人员详情页
  - 动态喜好分组
  - 动态禁忌分组
  - 生日和纪念日记录
  - 农历日期自动展示
- 完成地点模块：
  - 地点列表
  - 地点详情页
  - 国家、城市、区域、店家层级
  - 地址、经纬度、地图链接、参考链接
  - 关联人员和关联回忆跳转
- 完成回忆模块：
  - 回忆列表
  - 回忆详情页
  - 关联人员
  - 关联地点
  - 标签、心情和正文内容
- 完成日历模块：
  - 月视图展示
  - 生日、纪念日、回忆事件聚合
  - 日历事件点击跳转
- 完成设置模块：
  - JSON 数据导出
  - JSON 数据导入
  - 重置演示数据
- 引入 Dexie，将应用数据保存到 IndexedDB。
- 增加旧版 `localStorage` 数据迁移逻辑。
- 增加应用级确认弹窗，替代浏览器默认 `confirm()`。
- 增加基础表单校验。
- 增加手写 PWA 支持：
  - Web App Manifest
  - SVG 应用图标
  - Service Worker
  - 生产环境注册逻辑
- 增加 Capacitor 移动端打包准备：
  - `capacitor.config.ts`
  - Android/iOS 平台脚本
  - `MOBILE.md` 移动端构建说明
- 生成 Android 原生工程：
  - `android/`
  - `@capacitor/android`
  - Gradle Wrapper
  - AndroidManifest 和基础应用配置
- 增加 Windows Android debug APK 构建脚本：
  - `scripts/build-android-debug.ps1`
  - `npm.cmd run android:debug`
- 完成 Android debug APK 构建验证，产物为 `android/app/build/outputs/apk/debug/app-debug.apk`。
- 增加 Android release APK 本地签名和构建流程：
  - `scripts/create-android-keystore.ps1`
  - `scripts/build-android-release.ps1`
  - `npm.cmd run android:release`
- 增加 Android release APK 安装脚本：
  - `scripts/install-android-release.ps1`
  - `npm.cmd run android:install:release`
- 增加移动端触摸反馈：
  - 可点击卡片、按钮、底部导航、筛选标签、日历项按压反馈
  - 移除移动浏览器默认蓝色点击高亮
  - 适配 `prefers-reduced-motion`

### Changed

- 将原生 JS Demo 重构为 React 组件化结构。
- 将单页 UI 拆分为 `Home`、`People`、`Places`、`Memories`、`Calendar`、`Settings` 等页面。
- 将 `Card`、`SearchBar`、`BottomNav`、`EntrySheet` 等界面单元抽离为独立组件。
- 将人员、地点、回忆数据统一纳入 `LifeLogContext` 管理。
- 将生日和纪念日输入规则统一为公历录入、农历自动计算展示。
- 修正生成的 Gradle Wrapper 启动脚本，避免 Windows 下空 `-classpath` 参数导致 wrapper 无法启动。

### Fixed

- 修复首页回忆无法点击进入详情的问题。
- 修复回忆详情里的关联地点无法跳转的问题。
- 修复回忆详情里的关联人员无法跳转的问题。
- 修复地点详情里一起去过的人无法点击的问题。
- 修复喜好和禁忌只能录入单项的问题。
- 修复地点无法点开查看详情的问题。
- 移除地点中的图标和人均字段，改为更适合地点资料管理的地址、定位和链接信息。

## Planned

- 安装 APK 到 Android 真机或模拟器完成运行验证。
- 增加照片和相册能力。
- 增加地图选点、当前位置获取和外部导航跳转。
- 增加云同步和账号登录。
- 增加测试、Lint 和 GitHub Actions。
