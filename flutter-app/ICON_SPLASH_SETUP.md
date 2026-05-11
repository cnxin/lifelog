# App Icon and Splash Screen Setup

## 概述
使用 flutter_launcher_icons 和 flutter_native_splash 自动生成应用图标和启动页。

## 图标设计

### 主图标 (app_icon.svg)
- **设计**: 渐变背景 + 书本图标 + 心形标记
- **颜色**: 紫色渐变 (#6C63FF → #A855F7)
- **尺寸**: 512x512px
- **风格**: Glass UI，与应用主题一致

### 图标含义
- 📖 书本：记录生活
- 💜 心形：珍藏记忆
- 🎨 渐变：多彩人生

## 生成步骤

### 1. 准备图标资源

需要准备以下文件（放在 `assets/icons/` 目录）：

- `app_icon.png` - 主图标 (1024x1024px，PNG 格式)
- `app_icon_foreground.png` - Android 自适应图标前景 (1024x1024px)
- `splash_icon.png` - 启动页图标 (512x512px)
- `branding.png` - 启动页品牌标识（可选）

### 2. 从 SVG 生成 PNG

如果只有 SVG 文件，可以使用以下工具转换：

**在线工具**:
- https://svgtopng.com/
- https://cloudconvert.com/svg-to-png

**命令行工具**:
```bash
# 使用 ImageMagick
convert -background none -density 300 app_icon.svg -resize 1024x1024 app_icon.png

# 使用 Inkscape
inkscape app_icon.svg --export-png=app_icon.png --export-width=1024 --export-height=1024
```

### 3. 安装依赖

```bash
flutter pub get
```

### 4. 生成应用图标

```bash
flutter pub run flutter_launcher_icons
```

这会自动生成：
- Android: `android/app/src/main/res/mipmap-*/ic_launcher.png`
- iOS: `ios/Runner/Assets.xcassets/AppIcon.appiconset/`
- Web: `web/icons/`
- Windows: `windows/runner/resources/app_icon.ico`
- macOS: `macos/Runner/Assets.xcassets/AppIcon.appiconset/`

### 5. 生成启动页

```bash
flutter pub run flutter_native_splash:create
```

这会自动生成：
- Android: `android/app/src/main/res/drawable*/launch_background.xml`
- iOS: `ios/Runner/Assets.xcassets/LaunchImage.imageset/`
- Web: `web/splash/`

## 配置说明

### flutter_launcher_icons.yaml

```yaml
flutter_launcher_icons:
  android: true              # 生成 Android 图标
  ios: true                  # 生成 iOS 图标
  image_path: "..."          # 主图标路径
  adaptive_icon_background: "#6C63FF"  # Android 自适应图标背景色
  adaptive_icon_foreground: "..."      # Android 自适应图标前景
```

### flutter_native_splash.yaml

```yaml
flutter_native_splash:
  color: "#FFFFFF"           # 浅色模式背景色
  color_dark: "#1A1A2E"      # 暗色模式背景色
  image: "..."               # 启动页图标
  fullscreen: true           # 全屏显示
  android_12: ...            # Android 12+ 特殊配置
```

## 自定义图标

如果要使用自定义设计：

1. 设计 1024x1024px 的图标（PNG 格式，透明背景）
2. 替换 `assets/icons/app_icon.png`
3. 重新运行生成命令

### 设计建议

- **简洁**: 图标应该在小尺寸下清晰可辨
- **对比**: 确保在浅色和深色背景下都清晰
- **品牌**: 使用应用的主色调
- **圆角**: 系统会自动应用圆角，设计时考虑安全区域

## 验证

### Android
```bash
flutter run -d android
```
检查：
- 应用抽屉图标
- 最近任务图标
- 启动页显示

### iOS
```bash
flutter run -d ios
```
检查：
- 主屏幕图标
- 设置中的图标
- 启动页显示

### Web
```bash
flutter run -d chrome
```
检查：
- 浏览器标签页图标
- PWA 图标
- 启动页显示

## 故障排查

### 图标未更新
```bash
# 清理缓存
flutter clean
flutter pub get

# 重新生成
flutter pub run flutter_launcher_icons
flutter pub run flutter_native_splash:create

# 重新构建
flutter run
```

### Android 图标显示异常
- 检查 `adaptive_icon_foreground` 是否正确
- 确保前景图标有足够的内边距（安全区域）
- 尝试不同的背景色

### iOS 图标显示异常
- 确保图标是 PNG 格式，非透明背景
- 检查 Xcode 中的 Assets.xcassets
- 清理 iOS 构建缓存

## 文件结构

```
assets/
├── icons/
│   ├── app_icon.svg          # 源文件（SVG）
│   ├── app_icon.png          # 主图标（1024x1024）
│   ├── app_icon_foreground.png  # Android 前景
│   ├── splash_icon.png       # 启动页图标（512x512）
│   └── branding.png          # 品牌标识（可选）
└── images/
    └── (其他应用图片)

flutter_launcher_icons.yaml   # 图标配置
flutter_native_splash.yaml    # 启动页配置
```

## 注意事项

1. **图标尺寸**: 必须严格按照要求的尺寸，否则可能显示异常
2. **透明背景**: 主图标建议使用透明背景，系统会自动添加背景
3. **版本控制**: 生成的图标文件应该提交到 Git
4. **平台差异**: 不同平台对图标的要求不同，测试时注意检查
5. **Android 12+**: 需要特殊配置自适应图标

## 更新图标

当需要更新图标时：

1. 替换 `assets/icons/` 中的源文件
2. 重新运行生成命令
3. 清理缓存并重新构建
4. 在所有目标平台上测试

## 参考资源

- [flutter_launcher_icons](https://pub.dev/packages/flutter_launcher_icons)
- [flutter_native_splash](https://pub.dev/packages/flutter_native_splash)
- [Material Design Icons](https://material.io/design/iconography)
- [iOS Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/app-icons)
- [Android Adaptive Icons](https://developer.android.com/guide/practices/ui_guidelines/icon_design_adaptive)
