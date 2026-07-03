# LifeLog - 人生日志

LifeLog 是一个本地优先的个人生活记录应用，用人物、地点、回忆和日历把日常经历串起来。它优先服务个人长期记录：记录和谁一起、去了哪里、发生了什么、未来有什么纪念日或安排需要处理。

当前版本：`0.1.0-test.116`

## 下载与安装

### Android APK

- GitHub Release：https://github.com/cnxin/lifelog/releases/tag/v0.1.0-test.116
- APK 下载：https://github.com/cnxin/lifelog/releases/download/v0.1.0-test.116/lifelog-v0.1.0-test.116.apk
- Gitee 国内镜像：https://gitee.com/ysjugg/lifelog/raw/main/downloads/lifelog-v0.1.0-test.116.apk

APK 校验信息：

- 文件名：`lifelog-v0.1.0-test.116.apk`
- 大小：`3745981` bytes
- SHA256：`a2dbbc3e23be1b64df2722993d028e2b49d17fd25f9d9558612d896262a28875`

App 内检查更新会优先读取 Gitee API 清单、jsDelivr CDN 清单和 GitHub latest Release，拿到可用结果后不再等待较慢来源；GitHub raw 清单仅作为兜底。Android 端会优先使用 Gitee raw 镜像下载到本地 `.apk` 后调用系统安装器，避免部分下载源把 APK 保存成 zip 的问题。

### 适用平台

- Web：用于开发调试和桌面浏览器测试。
- Android：Capacitor 打包的本地 APK，是当前主要真机使用形态。
- iOS / 桌面端：仓库保留 Capacitor 脚本和迁移规划，但当前未作为正式发布目标。

## 产品定位

- 本地功能全部免费：人物、地点、回忆、纪念日安排、备份、导入导出、本地分享都不做付费限制。
- 数据本地优先：主要数据保存在浏览器 / WebView 的 IndexedDB，照片以本地二进制记录保存。
- 未来付费方向只放在云端高级能力：云同步、云备份、多设备同步、云端分享恢复和购买校验。
- 当前分享是本地分享：通过分享包、链接或二维码传递数据，不依赖 LifeLog 云服务。

## 核心能力

### 首页

- 快速记录一条回忆，支持未提交草稿自动保留。
- 今日行动聚焦今天和逾期需要处理的事项，减少和未来提醒重复。
- 展示最近回忆、常用人物、常去地点、往年今日和可继续处理的安排。
- 首页全局新增入口支持快速记录、带照片记录、新增人物、新增地点、粘贴地点分享和导入 LifeLog 分享。

### 人物

- 记录姓名、昵称、关系、生日、星座、纪念日、备注、喜好档案和禁忌雷区。
- 喜好档案和禁忌雷区可在人物列表和人物详情中独立编辑。
- 人物详情展示关系摘要、关系温度、共同回忆、常出现地点和回忆时间线。
- 纪念日支持安排计划、待办、预算、提醒日期、关联地点、往年安排和复用历史安排。
- 纪念日可配置天数节点，例如情侣 100 / 200 / 500 / 1000 天、宝宝百日、目标 7 / 21 / 30 / 100 天，也支持自定义节点。
- 天数节点可单独建立安排、待办、关联地点和回忆，不会和年度纪念日安排混在一起。
- 完成纪念日安排后可以直接打开回忆记录表单，并自动带入人物、日期和关联地点。

### 地点

- 管理餐厅、商场、酒店、景点、影院等地点。
- 支持国家、省份、城市、区域、商场、店铺、地址、评分、标签、照片和外部链接。
- 支持商场 / 店铺层级，商场详情可统计内部店铺数量和访问回忆。
- 从高德、美团、大众点评等 App 分享文本中识别地点草稿。
- 支持重复地点检测、合并预览、一键合并、撤销合并。
- 支持批量管理地点，修改前预览，可批量补充分类、商场、区域和标签，并支持撤销。

### 记录

- 记录分为已发生的回忆和未来的计划，未来日期快捷记录会先保存为计划。
- 支持快速记录和完整表单记录，快速记录会根据日期显示“记录今天 / 补记 / 安排”。
- 快速记录支持常用场景模板，也会根据当前人物 / 地点给出上下文标题模板。
- 可关联多个人物和多个地点，支持心情、日期、内容、标签和照片。
- 可从人物、地点、日历上下文中快速创建记录，自动带入当前人物、地点或日期。
- 到期或已过期的计划详情提供“补成回忆”入口，保存后转为真实回忆，不生成重复记录。
- 记录详情支持查看关联人物、关联地点、照片、标签和相关记录；照片较多时会先展示前 9 张，可再展开全部。
- 支持本地分享单条记录，可选择隐藏或公开内容、关联人物、关联地点和照片。

### 日历与提醒

- 日历聚合生日、纪念日、回忆和未来计划。
- 支持农历、节日、节气和周年显示。
- 支持纪念日天数节点展示和提醒，例如“满 100 天”“第 365 天”。
- 提醒支持生日、纪念日、联系提醒和回忆提醒，未来计划不会计入真实到访和共同回忆统计。
- 提醒中心可查看未来 30 天事项，支持查看、忽略、完成和跳过。
- Android 端集成本地通知权限检查、提醒权限检查和测试通知。

### 分享与导入

- 回忆和地点支持生成本地分享包 JSON。
- 支持生成 LifeLog 分享链接和二维码，二维码可点击放大查看。
- 回忆详情和地点详情提供独立分享操作卡，可直接打开分享面板。
- 首页快捷新增和分享导入页支持扫描 LifeLog 分享二维码。
- Android 支持 `lifelog://share/import#...` 深链，真机扫码可直达分享导入页。
- Android 支持把分享二维码保存到相册，也可调用系统分享面板转发到微信等应用；保存成功后会在弹窗内显示提示。
- 分享导入会先预览内容，再确认导入。
- 导入分享后可撤销本次新增的人物、地点、回忆和照片。
- 数据管理页保留分享历史，支持再次复制分享链接和查看导入结果。
- 二维码使用专用低密度编码，并默认生成精简版分享；完整正文、地址、链接、照片或内容较多时建议使用复制链接或分享包。

### 备份与数据管理

- 支持完整备份导出 JSON。
- 支持导入前预检，展示人物、地点、回忆、照片数量和与当前数据的差异。
- 支持备份健康检查，提示照片归属修复、缺失照片引用、孤立照片和结构问题。
- 支持安全导入模式，严格导入失败后可跳过异常照片并尽量恢复可用的人物、地点和回忆。
- Android 导出会调用系统文件保存器；如果第一次导出失败，建议重试同一保存目录，用于区分系统授权问题和内容生成问题。
- 支持可读导出，用于把本地数据生成便于人工查看的文本 / HTML 内容。
- 支持重置演示数据。

### Notion 联动

- 设置页的“实验”入口新增 Notion 同步试验功能，可保存 Internal Integration Token 和父页面 ID，并通过折叠式连接配置完成连接。
- Notion 同步页拆分为连接配置、数据同步、自动同步队列、同步历史和高级配置，连接完成后可按需展开对应工具区。
- 支持在父页面下自动创建人物、地点、回忆、纪念日安排数据库，并把数据库 ID 自动写回设置。
- 支持测试连接和数据库字段体检，分别提示 Token 无效、权限不足、数据库不存在、网络失败、字段缺失和字段类型冲突。
- 缺少 LifeLog 需要的中文字段时可一键补齐；字段类型冲突会提示在 Notion 手动处理或重新建库。
- 保存人物、地点、回忆和纪念日安排后会进入自动同步队列，连续编辑会去重合并，失败项可在队列中重试。
- 人物、地点和回忆列表会显示 Notion 同步状态徽标，区分未同步、待同步、同步中、同步失败和已同步。
- 支持在数据同步工具区手动同步全部，也可按人物、地点、回忆和安排单独同步，把 LifeLog 本地数据单向写入 Notion。
- 记录同步可写入 Notion 页面正文，页面内会生成正文、原计划和关联信息；重新同步只替换 LifeLog 同步区，保留同步区外手动内容。
- 高级配置可关闭记录页面正文同步，仅保留 Notion 数据库属性同步。
- 同步会保存本地页面映射，重复同步不会重复创建；Notion 页面被删除后会自动重新创建。
- 当前不上传图片，只同步照片数量；人物、地点关系先以文本字段写入。
- Notion 同步属于未来云端高级能力方向，本地人物、地点、回忆、提醒、备份和分享功能继续免费。

使用步骤：

1. 在 Notion 创建 Internal Integration，复制 Secret。
2. 在 Notion 新建一个空页面，例如 `LifeLog`。
3. 打开该页面右上角 Share / Invite，把页面分享给刚创建的 Integration。
4. 复制该页面链接，在 LifeLog 的 设置 -> 实验 -> Notion 同步 中展开“连接配置”。
5. 按 4 个步骤依次填写 Token、填写父页面、自动创建数据库、测试连接。
6. 连接通过后展开“数据同步”，可同步全部或只同步某一类数据。
7. 自动同步队列、同步历史和高级配置默认折叠，需要排查或手动维护时再展开。

### 设置与关于

- 设置页分为账号、应用、数据、实验、关于几个入口。
- 应用设置包含视觉风格、提醒设置、隐私模式、默认城市、默认关系、默认心情。
- 关于页显示当前版本、最新版本、安装权限、提醒权限、应用能力和更新诊断。
- 内置升级展示下载来源、速度、剩余时间和校验信息，主源失败时会重试备用源。

## 技术栈

- React 18
- TypeScript
- Vite 8
- React Router 6
- IndexedDB + Dexie
- Capacitor 8
- Capacitor Local Notifications
- lunar-javascript
- qrcode
- lucide-react

## 本地开发

环境要求：

- Node.js
- npm
- Android Studio / Android SDK 36
- JDK 21
- Windows PowerShell，当前脚本按 Windows 环境维护

启动 Web 开发环境：

```powershell
cd react-app
npm install
npm.cmd run dev
```

生产构建：

```powershell
cd react-app
npm.cmd run build
```

预览生产构建：

```powershell
cd react-app
npm.cmd run preview
```

## Android 构建

同步 Web 资源到 Android：

```powershell
cd react-app
npm.cmd run build
npm.cmd run cap:sync
```

构建签名 release APK：

```powershell
cd react-app
npm.cmd run release:apk
```

复制 APK 到 `downloads/` 并刷新 `update-manifest.json`：

```powershell
cd react-app
npm.cmd run release:prepare-files
```

一键完成本地发布准备检查、APK 构建和发布文件刷新：

```powershell
cd react-app
npm.cmd run release:prepare
```

安装 release APK 到已连接设备：

```powershell
cd react-app
npm.cmd run android:install:release
```

如果 Gradle daemon 卡住，可以使用 no-daemon 和独立缓存重新构建：

```powershell
$env:JAVA_HOME=Join-Path $env:USERPROFILE ".local\jdks\jdk-21.0.11+10"
$env:ANDROID_HOME=Join-Path $env:USERPROFILE "Android\Sdk"
$env:ANDROID_SDK_ROOT=$env:ANDROID_HOME
$env:Path="$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:Path"
$env:GRADLE_USER_HOME="D:\tmp\lifelog-gradle-cache"
Push-Location react-app\android
.\gradlew.bat --no-daemon --project-cache-dir D:\tmp\lifelog-gradle-project-cache assembleRelease
Pop-Location
```

## 测试与发布检查

常用检查：

```powershell
cd react-app
npm.cmd run build
npm.cmd run test:release-ready
npm.cmd audit --audit-level=moderate
```

功能脚本：

```powershell
cd react-app
npm.cmd run test:parser
npm.cmd run test:update-checker
npm.cmd run test:backup-health
npm.cmd run test:backup-import
npm.cmd run test:reminders
npm.cmd run test:memory
npm.cmd run test:display
npm.cmd run test:location
npm.cmd run test:notion
npm.cmd run test:notion-sync
```

发布前需要确认：

- `react-app/package.json` 版本号已更新。
- `react-app/android/app/build.gradle` 的 `versionCode` 和 `versionName` 已同步。
- `react-app/src/constants/releaseNotes.ts` 已添加当前版本说明。
- `CHANGELOG.md` 已添加当前版本记录。
- `README.md` 的下载链接、APK 大小和 SHA256 已更新。
- `update-manifest.json` 的版本、下载地址、大小、SHA256 和更新文案已更新。
- `downloads/lifelog-v版本.apk` 已生成并提交。
- GitHub Release 已上传 APK 资产。
- Gitee 镜像仓库已推送，确保国内镜像链接可用。

## 更新清单

App 内更新读取根目录 `update-manifest.json`。当前字段：

- `version`：最新版本号。
- `releaseUrl`：GitHub Release 页面。
- `apkUrl`：GitHub Release APK 下载地址。
- `mirrorApkUrl`：Gitee raw APK 镜像地址。
- `apkName`：APK 文件名。
- `apkSize`：APK 字节大小。
- `apkSha256`：APK SHA256。
- `publishedAt`：发布时间。
- `body`：更新说明。

## 目录结构

```text
.
├── react-app/             # React + Capacitor Android 应用源码
│   ├── android/           # Capacitor Android 工程
│   ├── scripts/           # 构建、发布和测试脚本
│   └── src/               # 前端源码
├── downloads/             # 当前发布 APK 镜像文件
├── docs/                  # 规划、迁移和产品说明文档
├── update-manifest.json   # App 内更新清单
├── CHANGELOG.md           # 版本变更记录
└── README.md              # 项目说明
```

## 当前版本更新

`0.1.0-test.116` 主要变化：

- 人物生日信息统一展示公历日期、年龄、星座、农历和干支，列表、详情、编辑预览、搜索、Notion 同步和可读导出都能识别星座。
- 快速记录的关联人物 / 地点改为折叠式上下文入口，默认可先写内容，需要时再展开关联，隐藏状态仍保留已选人物和地点。
- 人物和地点选择器默认突出已关联、最近常用和可先不关联，减少新增回忆时的搜索框和大按钮干扰。
- 首页今日行动只保留到期计划、今日纪念日安排和真实提醒，联系建议和历年今日回看回到记录建议 / 历年今日区块，减少重复。

完整历史见 [CHANGELOG.md](./CHANGELOG.md)。

## 开发中变更

- 暂无未发布变更。

## 后续方向

- 云端高级能力：云同步、云备份、多设备同步、云端分享恢复。
- 购买校验：为未来云端高级能力接入购买信息验证，本地功能继续免费。
- 分享能力：在保留本地分享的基础上，后续可增加云端短链接和跨设备恢复。
- 数据体验：继续增强备份恢复引导、数据体检、重复数据清理和大数据量性能。
- 移动端体验：继续优化真机权限、安装更新链路、通知稳定性和弱网下载体验。

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。开发或发布前请先运行构建、发布就绪检查和相关功能测试。
