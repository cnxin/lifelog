# LifeLog · 日子

把重要的日子，放在心上。一个**本地优先、无需账号的纪念日 / 生日 / 倒数日工具**。

当前开发版本：`0.2.0-alpha.1`。这是对旧版 LifeLog 的产品收敛，不是旧版全功能应用的小改版；Android 提供独立测试 APK，不是旧版覆盖升级包。

## 下载 Android 测试版

在 [GitHub 预发布页面](https://github.com/cnxin/lifelog/releases/tag/v0.2.0-alpha.1-preview) 的 Assets 中下载 `lifelog-days-0.2.0-alpha.1-preview.apk`。Android 7.0 及以上可安装；测试版使用独立包名，与旧 LifeLog 并存。

**请保留旧版，先导出完整 JSON 备份，再在测试版中导入。** 此包使用 debug 签名，已通过构建、签名校验和自动化测试，但尚未完成真机验收，不作为正式升级版。

## 只做这些事

- 直接创建日子：名称、日期、分类、备注、置顶。
- 过去的日子显示「已经 X 天」，未来显示「还有 X 天」，当天显示「就是今天」。不重复的记录按实际经过天数计算，起始当天是 0 天。
- 公历 / 农历年度重复：生日、周年纪念日显示下一次到来的倒计时。
- 单页浏览、分类筛选、关键词搜索、临近优先 / 日期排序。
- 本地 IndexedDB 保存；JSON 导出、预览并合并导入；同源多窗口刷新。
- 显式迁移旧版人物生日、年度纪念日；不修改旧版数据库。
- Web / PWA；保留 Android Capacitor 工程和原生文件保存器。

不再包含：人物档案、地点库、回忆与照片管理、复杂安排与待办、统计、账号、Notion、二维码分享、内置更新器。

**当前不提供系统通知、云同步、里程碑或月历页面。** 这不是在后台继续运行旧系统、只把入口藏起来：旧业务已经移出活动源码和构建依赖。

## 开发与验证

需要 Node.js 22.12+（本次使用 Node.js 24）。

```sh
cd react-app
npm ci
npm run dev
```

开发服务器：`http://127.0.0.1:5188`。端口占用时会明确报错，不自动切换到其他服务。

```sh
npm test                         # 日期 / 农历 / 备份 / 迁移规则测试
npm run build                    # TypeScript 检查和生产构建
npx playwright install chromium  # 首次浏览器测试前安装
npm run test:e2e                  # 另一个终端保持 npm run dev 运行（含 axe 无障碍扫描）
# 生产离线测试：另一终端启动 npm run preview -- --host 127.0.0.1 --port 5189 --strictPort
npm run test:offline
```

浏览器测试使用隔离的测试上下文，不写入日常浏览器的数据。测试截图位于 `react-app/.artifacts/`（已忽略）。生产服务测试可设置 `BASE_URL`。

### Android

```sh
npm run android:doctor           # 只读检查 JDK / SDK / 可用空间
npm run android:preview          # 检查通过后：测试 → Web 构建 → 同步 → debug APK + lint
```

测试版使用独立包名 `com.cnxin.lifelog.preview`，桌面名称「日子 · 测试版」，不替换旧应用。它不能直接读取原版私有数据，使用旧 JSON 备份测试导入。

正式升级版保留包名 `com.cnxin.lifelog` 与原 WebView origin，必须使用原签名进行覆盖升级验收。原生侧只保留应用生命周期、状态栏和文件保存；移除通知、相机、安装更新等旧权限及分享入口。

需要 JDK 21、Android SDK API 36、Build Tools 35.0.0 和足够磁盘空间。**Web 构建和 Capacitor 同步成功不代表 APK 已打包、签名或升级验证。** 不要卸载旧版来尝试迁移，先在旧版导出完整备份。详见 [Android 测试与升级验收](docs/ANDROID_RELEASE.md)。

## 旧数据怎么处理

1. 在旧版先导出完整 JSON 备份（含照片的原备份也请保留）。
2. 新版右上角 → **数据与备份** → **从本机旧版迁移**。
3. 查看识别数量，再确认合并。只读取 `LifeLogDatabase.people`；旧版 localStorage 也有只读兼容路径。
4. 不同设备、不同域名或开发端口无法直接读取旧存储，请选择 **导入备份**。
5. 同 ID 的记录跳过、不覆盖现有修改；无效旧日期会报告跳过数量。非法新版备份整份拒绝，不部分写入。

新版使用独立的 `LifeLogDays` 数据库。原人物、地点、回忆、照片、安排不会被删除，但**新版不能浏览或编辑这些旧内容**。新版导出仅包含日子，不能代替旧版的完整备份。再次手动导入旧备份会重新添加已在新版删除的旧记录。

### 日期约定

- 按本地日历日期计算天数，不使用经过小时数，避免夏令时误差。
- 公历 2 月 29 日在非闰年按 2 月 28 日纪念。
- 农历输入仍选择原始**公历日期**，表单显示转换结果；之后按对应农历日期重复。无闰月的年份回退到同名普通月，农历三十在小月回退为廿九。
- 支持录入 1901–2099 年的日期；数据限制为 10,000 条，单个 JSON 文件最大 128 MB。
- 年度重复的起始日期在未来时，不会在首次日期之前生成周年。

## 简化后的代码

```text
react-app/src/
  App.tsx            单页列表、筛选、置顶与应用状态
  DayEditor.tsx      新增 / 编辑 / 删除
  DataPanel.tsx      备份和旧版迁移确认
  Modal.tsx          原生 dialog、焦点管理
  domain.ts          日期计算、数据类型、备份验证与旧格式转换
  storage.ts         新版数据库、事务合并、只读旧存储访问
  backup.ts          浏览器下载 / Android 原生文件保存
  main.tsx           React 入口与错误边界
  styles.css         单份响应式样式
```

没有路由层、全局业务 Provider、服务端或外部字体请求。

## 旧版归档与回退

- `react-app/legacy/`：旧源码、旧依赖清单、旧测试/发布脚本、被替换的原生集成。**不参与新构建，不是可直接运行的第二套应用。**
- `docs/archive/README-full-lifelog.md`：原版说明。
- 其他历史计划、历史下载文件及发布清单保留，均不代表新版的能力或安装包。
- 完整回退请使用 Git 中重构前的提交；不能仅把 `legacy/src` 拷回，因为依赖、原生工程和构建入口也已变化。

保留归档是为了迁移核对和回退。本次减少的是**运行时功能、活动源码与依赖**，没有声称 Git 历史或历史 APK 仓库体积已被缩减。

### 本机测试 APK

Android 构建入口会将校验后的独立测试包放在 `react-app/.artifacts/`（不提交 Git），并生成同名 `.apk.json` 校验报告。测试包使用 debug 签名，不能作为正式发布包。

在这台机器的新终端里，先执行 `source "$HOME/.local/share/lifelog-android/env.sh"` 加载已安装的工具链，再运行 Android 构建命令。其他机器需自行配置环境。
