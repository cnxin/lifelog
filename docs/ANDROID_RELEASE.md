# 日子：Android 测试与升级验收

## 两种安装用途，不能混用

| | 独立测试版（debug） | 原应用升级版（release） |
| --- | --- | --- |
| 包名 | `com.cnxin.lifelog.preview` | `com.cnxin.lifelog` |
| 桌面名称 | 日子 · 测试版 | LifeLog · 日子 |
| 签名 | 本机 debug 签名 | 必须使用原版签名 |
| 原版数据 | 不可直接读取，导入旧版 JSON 测试 | 同签名覆盖安装后验收本机迁移 |
| 用途 | 测布局、增删改、导入导出、返回键 | 测真实升级与数据保留 |

测试版没有在原版数据库旁运行，它是另一套应用沙箱。**独立测试版通过，不等于原版覆盖升级通过。** 不要为安装新版而卸载原版、清除原版数据或临时更改正式包名。

## 本地构建入口

在 `react-app` 目录运行：

```sh
npm ci
npm run android:doctor
npm run android:preview
```

- `android:doctor` 只读检查 JDK 21、编译器、Android SDK API 36、Build Tools 35.0.0、platform-tools、Gradle wrapper 和磁盘空间，不读取签名密码。非默认 SDK 路径请设置 `ANDROID_HOME`，JDK 路径请设置 `JAVA_HOME`。
- 脚本要求项目和用户缓存所在磁盘各有至少 6 GiB 可用空间。这是保守的本地检查门槛，不是官方最低要求，也不是空间一定够用的保证。
- `android:preview` 在环境检查通过后运行单元测试、Web 生产构建、Capacitor 同步、Gradle `assembleDebug` 和 `lintDebug`，再用 SDK 工具校验 APK 的包名、桌面名称、版本、合并权限和签名。校验失败不会产生新的交付副本。不自动安装到设备，不构建或发布正式版。
- 首次 Gradle 构建需要联网下载依赖；本脚本不自动安装 SDK 或代为接受 SDK 许可。
- 原始输出：`react-app/android/app/build/outputs/apk/debug/app-debug.apk`。校验后的交付副本在 `react-app/.artifacts/lifelog-days-0.2.0-alpha.1-preview.apk`，旁边的 `.apk.json` 记录实际包名、权限、签名验证结果、大小与 SHA-256。
- Gradle 使用固定的 8.14.3 `bin` 分发包，已配置官方 SHA-256 校验，避免下载不需要的源码/文档。
- 若手工跳过脚本在 Android Studio 构建，请先完成 Web 构建和 `npx cap sync android`，避免把旧资源打进 APK。

## 覆盖升级前的硬性条件

1. 在旧版先导出**完整备份**，保留照片与回忆，不以新版「仅日子」备份代替。
2. 找到原版使用的签名密钥，安全地在本地配置已被 Git 忽略的 `android/keystore.properties`。不要生成新密钥冒充旧签名，不要在聊天中发送密钥或密码。
3. 只有这些条件满足后才构建 release。现有 Gradle 在未配置签名时可生成 unsigned APK，**构建成功本身不证明已签名**。
4. 使用 Android SDK 的 `apksigner verify --verbose --print-certs` 分别检查原版 APK 与候选 APK，验证候选签名有效，并核对原版签名证书 SHA-256；本次不涉及签名轮换。
5. 用 `apkanalyzer manifest application-id` 和 `apkanalyzer manifest version-code` 检查候选包：正式包名不变、versionCode 高于设备上已安装版本。目前源码配置为 136；仍须读取实际安装版本确认。
6. 在有备份的测试设备上执行同签名覆盖升级。签名不一致时停止，**不要通过卸载原应用来绕过**。

## 真机验收单（仍待执行）

- [ ] 测试版可与旧版并存，名称能区分，旧版仍可正常打开。
- [ ] 旧版 JSON 导入预览准确；重复导入不覆盖编辑，失败导入不写入。
- [ ] 同签名 release 覆盖升级后，本机旧人物生日和纪念日可识别；确认前不写入新版库。
- [ ] 核对原数据库的照片、回忆等旧内容仍完整；新版没有这些内容的浏览入口。
- [ ] 原生文件保存成功、取消、拒绝访问；保存的文件可再次导入。
- [ ] 返回键优先关闭弹窗，主页返回进入后台；重新进入日期和数据正常。
- [ ] 软键盘、状态栏、安全区域、大字号和深色系统设置下可操作。
- [ ] 断网冷启动和持久化；首次升级后退出并重新打开，确认没有旧 service worker 页面回退。
- [ ] 用 APK 分析工具核对合并后的实际权限；确认旧系统提醒不再触发或残留。

Android 12+ 显式通过 `dataExtractionRules` 排除云备份和自动设备迁移，较早系统也禁用自动备份。用户换机需手动导出和导入 JSON，卸载前尤其要保存备份。

旧版曾注册 `/sw.js`。新版 Android 启动时会注销自己的 worker，并只清理 `lifelog-static-*` / `lifelog-runtime-*` 缓存，不触碰 IndexedDB 或 localStorage，不强制刷新未保存编辑。已受控的页面需要关闭后才完全脱离 worker；仍需真机冷启动验证。浏览器测试只能模拟该清理过程，不能代替 Android WebView 测试。

## 回退与提交策略

旧版本已有 Git 标签 `v0.1.0-test.135`，指向：

```text
d3b4cb73fa80463cefb57edacea39a5cc59def4c
```

已核对与重构前 HEAD 相同，无需再建重复标签。之后把重构提交到 `codex/anniversary-lite`，经审查和升级验收后再合并主分支；不需要另建 GitHub 仓库。

该标签是**源码回退点**，不意味着 Android 允许直接安装低版本 APK。不要在当前有未提交修改的工作区强行切回旧版本，也不要以卸载重装作为数据回退方案。

## 2026-09-29 本机构建环境

之前的磁盘不足问题已解除。本次在用户目录内配置工具链，没有改动全局 shell 配置，也没有安装完整 Android Studio。

- JDK：Temurin 21.0.12.1，Apple Silicon 版本；下载包已按官方 API 提供的 SHA-256 校验。
- SDK：API 36、Build Tools 35.0.0、platform-tools，安装在 `~/Library/Android/sdk`。
- 新终端运行以下命令后即可复用本机环境（此文件不在 Git 仓库中）：

```sh
source "$HOME/.local/share/lifelog-android/env.sh"
cd /path/to/lifelog/react-app
npm run android:doctor
npm run android:preview
```

其他机器需自行安装工具并设置 `JAVA_HOME` / `ANDROID_HOME`，不要复制这台机器的绝对路径。

原版签名文件仍未配置。独立测试 APK 使用自动生成的本机 debug 签名，不是正式升级包。仅通过 `v0.2.0-alpha.1-preview` 预发布版分发独立测试 APK，不合并主分支、不替换旧版发布。

### 本轮实际验证结果

- `npm run android:preview` 完整通过，包括 27 项 Node 测试、Web 构建、Capacitor 同步、真实 Gradle `assembleDebug` 和 `lintDebug`。
- APK：`react-app/.artifacts/lifelog-days-0.2.0-alpha.1-preview.apk`，4,651,929 字节。
- SHA-256：`1a321165ce9ac8523a8fd3e510fa3b729b44f9dda7469595330bfbccc71a337c`（此本地构建；之后重新构建请以同名 JSON 报告为准）。
- SDK `apksigner verify` 成功：本机 Android Debug 证书，APK v2 签名。它不是原应用的正式签名。
- 实际合并权限只有 `INTERNET` 及 AndroidX 使用的本应用签名级 `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`；无通知、相机、存储或应用安装权限。
- 17 个打包的 Web 文件与本轮生产构建逐字节一致；打包的 Capacitor 配置也一致。
- Android lint：**0 错误、26 条警告**。已修复 Manifest 顺序与显式数据备份策略提示；剩余为旧图标/启动图、静态扫描认为未使用的资源以及依赖更新提示等，未通过全局屏蔽来隐藏。报告在 `react-app/android/app/build/reports/lint-results-debug.html`。
- 生产预览浏览器回归、无障碍扫描和离线/旧缓存清理测试重新通过。
- `adb devices -l` 未发现连接设备。**没有安装到手机，也没有运行真机或模拟器验收；原签名覆盖升级仍待验证。**
- 已删除本次下载的 JDK、命令行工具和 Gradle 临时压缩包，保留已安装工具链、Gradle 构建缓存及下载校验信息。

### 手机测试顺序

1. 把上述 APK 传到 Android 手机，安装「日子 · 测试版」，保留旧 LifeLog，不卸载、不清数据。
2. 在旧版导出完整备份，再在测试版「数据与备份 → 导入备份」中选择 JSON，查看预览后确认。独立测试版的「从本机旧版迁移」无法跨应用沙箱读取原版，这是预期行为。
3. 试用新增/编辑/删除、公历/农历年度重复、置顶、搜索，退出后重开核对持久化。
4. 测试原生文件保存成功和取消、再导入、返回键、软键盘和断网冷启动。
5. 测试结果确认后，再准备原签名 release 覆盖升级；不把此 preview 包当作正式版替代品。
