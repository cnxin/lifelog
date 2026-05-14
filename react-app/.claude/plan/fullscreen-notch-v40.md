# LifeLog v0.1.0-test.40 全屏适配与异形屏支持

**目标**: 实现状态栏沉浸式全屏体验，适配刘海屏、挖孔屏、圆角屏和手势导航栏。

## 版本策略

- [ ] 本轮版本号使用 `0.1.0-test.40`
- [ ] 同步 Android `versionCode` / `versionName`

## Phase 1：技术调研与依赖

- [ ] 安装 `@capacitor/status-bar` 插件
- [ ] 检查 Capacitor 当前版本是否支持 safe-area API
- [ ] 调研 Android 11+ 手势导航栏高度获取方案
- [ ] 确认 CSS `env(safe-area-inset-*)` 在 Capacitor WebView 中的支持情况

## Phase 2：Capacitor 配置

- [ ] 更新 `capacitor.config.ts`，启用状态栏透明
- [ ] 配置 Android 主题，移除默认状态栏背景
- [ ] 配置状态栏内容颜色（深色/浅色）跟随主题
- [ ] 配置手势导航栏透明或半透明

## Phase 3：CSS 安全区域适配

- [ ] 在 `src/index.css` 根变量中定义 `--safe-area-inset-top/bottom/left/right`
- [ ] 使用 `env(safe-area-inset-top)` 等 CSS 环境变量回退
- [ ] 更新 `.app-container` 高度计算，减去安全区域
- [ ] 更新顶部 Header 增加状态栏高度 padding
- [ ] 更新底部导航栏增加手势导航栏高度 padding
- [ ] 更新悬浮按钮 FAB 位置，避开底部安全区域

## Phase 4：异形屏视觉优化

- [ ] 检查顶部 Header 在刘海屏/挖孔屏下的显示效果
- [ ] 检查底部导航栏在圆角屏下的显示效果
- [ ] 检查弹出层、面板、确认框是否被安全区域遮挡
- [ ] 优化深色模式下状态栏图标颜色
- [ ] 优化浅色模式下状态栏图标颜色

## Phase 5：真机验证

- [ ] 在刘海屏设备上验证顶部安全区域
- [ ] 在挖孔屏设备上验证顶部安全区域
- [ ] 在手势导航设备上验证底部安全区域
- [ ] 在三键导航设备上验证底部导航栏不被遮挡
- [ ] 验证横屏模式下的安全区域适配

## Phase 6：文档与版本记录

- [ ] 更新 `package.json` 到 `0.1.0-test.40`
- [ ] 同步 `package-lock.json`
- [ ] 更新 `CHANGELOG.md`

## Phase 7：验证、提交与发布

- [ ] 运行 TypeScript / Vite 生产构建
- [ ] 检查 Git diff，避免提交 `.claude/plan` 和本地缓存
- [ ] 按规则运行质量门禁或等价检查
- [ ] 提交并推送到 GitHub
- [ ] 构建并上传 GitHub Release APK

## 技术要点

### 状态栏沉浸方案

```typescript
// capacitor.config.ts
plugins: {
  StatusBar: {
    style: 'dark', // 或 'light'，跟随主题动态切换
    backgroundColor: '#00000000', // 完全透明
    overlaysWebView: true // 内容延伸到状态栏下方
  }
}
```

### CSS 安全区域变量

```css
:root {
  --safe-area-inset-top: env(safe-area-inset-top, 0px);
  --safe-area-inset-bottom: env(safe-area-inset-bottom, 0px);
  --safe-area-inset-left: env(safe-area-inset-left, 0px);
  --safe-area-inset-right: env(safe-area-inset-right, 0px);
}

.app-container {
  height: calc(100vh - var(--safe-area-inset-top) - var(--safe-area-inset-bottom));
  padding-top: var(--safe-area-inset-top);
  padding-bottom: var(--safe-area-inset-bottom);
}

.header {
  padding-top: calc(12px + var(--safe-area-inset-top));
}

.bottom-nav {
  padding-bottom: calc(8px + var(--safe-area-inset-bottom));
}
```

### Android 主题配置

```xml
<!-- android/app/src/main/res/values/styles.xml -->
<style name="AppTheme.NoActionBar" parent="Theme.AppCompat.Light.NoActionBar">
  <item name="android:statusBarColor">@android:color/transparent</item>
  <item name="android:navigationBarColor">@android:color/transparent</item>
  <item name="android:windowTranslucentStatus">true</item>
  <item name="android:windowTranslucentNavigation">true</item>
  <item name="android:windowDrawsSystemBarBackgrounds">true</item>
</style>
```

## 暂不纳入本轮

- [ ] iPad / 平板横屏分栏布局
- [ ] 折叠屏适配
- [ ] 动态岛（Dynamic Island）适配
