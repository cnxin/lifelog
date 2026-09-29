# alpha.2：Apple Design 原则与顶栏适配

## 范围

参考用户提供的 apple-design skill，保留现有鼠尾草绿 / 暖粉色调与本地优先产品边界；只修改界面与系统栏，不更改数据库、备份格式或迁移规则。

- 顶栏：常驻、轻薄半透明材质与柔和滚动边缘；品牌、新增、备份始终可达。顶栏高度由内容决定，放大字号可换行；ResizeObserver 同步滚动避让高度。
- 排版：系统字体、rem 字号、清晰的标题和数字层级。手机卡片以标题 / 日期与天数分栏，大字号时自动折行。
- 操作：主要顶栏与手机筛选 / 置顶操作具备至少 48px 常规字号触摸区域；按下即反馈，不额外安装动画库。
- 无障碍：跳转主内容、清晰焦点、弹窗滚动锁定和关闭后焦点恢复；降低动态效果时取消按压缩放；降低透明度 / 提高对比度时提供实色材质。

## 顶部与底部安全区

使用 Capacitor 8 已内置的 SystemBars；删除独立 @capacitor/status-bar 依赖及旧 overlay / background-color 设置。SystemBars 统一使用 LIGHT（浅色背景上的深色系统图标），Android Activity 明确保持浅色主题，不跟随系统深色设置变成深色状态栏图标背景错配。

CSS 每个方向都使用 var(--safe-area-inset-方向, env(safe-area-inset-方向, 0px))：优先读取 Capacitor 注入值，否则使用浏览器安全区，不把两者相加。顶栏占用顶部安全区，页面保护左右与底部，dialog 和 toast 单独避让系统区域。旧 WebView 若已由原生层留白，其注入值为 0，不再额外预留固定的 24/32px 状态栏。

实现依据：项目安装版本的 @capacitor/core/system-bars.md、@capacitor/android 的 SystemBars.java 与官方 SystemBars 配置类型。浏览器模拟不等于真机认证。

## 验证

- npm test：28 项通过。
- npm run test:e2e：增删改、备份合并去重、旧库只读迁移、跨窗口刷新、焦点、多个宽度与 axe 扫描通过。
- npm run test:chrome：320–1440px、顶部 32px / 底部 24px 模拟安全区、滚动常驻、横屏侧边 44px、短视口、200% 字号、触摸区域、深色系统偏好下的浅色界面、高对比度、减少动态效果、弹窗背景锁定与焦点恢复通过。
- npm run test:offline：离线首次缓存 / 新增 / 持久化和旧缓存清理模拟通过。
- npm run android:preview：真实 assembleDebug / lintDebug / APK 元数据、权限、签名校验通过；lint 0 错误、26 条警告；16 个打包 Web 文件逐字节匹配 dist。

## 预发布交付

- 发布页面：[v0.2.0-alpha.2-preview](https://github.com/cnxin/lifelog/releases/tag/v0.2.0-alpha.2-preview)。
- 本地 APK：react-app/.artifacts/lifelog-days-0.2.0-alpha.2-preview.apk
- 包名：com.cnxin.lifelog.preview；versionCode：137；大小：4356034 字节。
- SHA-256：009cfcb8e0090b31967ad9b8edc1b6a21b573580ca39255d682395622f210473
- 与 alpha.1 独立测试版签名证书一致、版本码更高，可作为测试版更新候选；先在测试版导出 JSON，再尝试覆盖安装。没有执行实际覆盖安装，不保证设备侧升级已验收。
- 不替换正式 LifeLog，不卸载旧应用、不清除数据，不覆盖旧版 GitHub Release；仅推送 `codex/anniversary-lite` 并创建 alpha.2 预发布。

## 仍需手机验收

在 Android 14 / 15 / 16 的实际设备上检查刘海 / 打孔、手势与三键导航、系统深色偏好、旋转、字体放大、键盘打开后的编辑与保存、弹窗返回、冷启动与 alpha.1 测试版覆盖安装。本轮无连接设备，未运行真机或模拟器。
