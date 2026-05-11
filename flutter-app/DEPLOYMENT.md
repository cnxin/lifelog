# LifeLog Flutter Demo - 部署指南

本文档提供详细的部署步骤，帮助您将应用发布到各个平台。

## 目录

- [前置准备](#前置准备)
- [Web 部署](#web-部署)
- [Android 部署](#android-部署)
- [iOS 部署](#ios-部署)
- [常见问题](#常见问题)

---

## 前置准备

### 1. 环境检查

确保已安装并配置好以下工具：

```bash
# 检查 Flutter 版本
flutter --version
# 需要：Flutter >= 3.7.0, Dart >= 3.7.0

# 检查可用设备
flutter devices

# 运行环境诊断
flutter doctor -v
```

### 2. 依赖安装

```bash
cd D:/projects/lifelog-demo/react-app/flutter-app

# 安装依赖
flutter pub get

# 生成 Drift 数据库代码（必需）
flutter pub run build_runner build --delete-conflicting-outputs
```

### 3. 代码检查

```bash
# 运行测试
flutter test

# 代码分析
flutter analyze

# 确保无错误和警告
```

---

## Web 部署

### 方案 1：使用构建脚本（推荐）

**Windows:**
```cmd
build.bat web
```

**Linux/macOS:**
```bash
chmod +x build.sh
./build.sh web
```

### 方案 2：手动构建

```bash
# 清理旧构建
flutter clean

# 构建生产版本
flutter build web --release

# 输出目录：build/web/
```

### 部署到静态托管

构建完成后，`build/web/` 目录包含所有静态文件，可以部署到：

#### Vercel

```bash
# 安装 Vercel CLI
npm i -g vercel

# 部署
cd build/web
vercel --prod
```

#### Netlify

```bash
# 安装 Netlify CLI
npm i -g netlify-cli

# 部署
cd build/web
netlify deploy --prod --dir .
```

#### GitHub Pages

```bash
# 1. 创建 gh-pages 分支
git checkout -b gh-pages

# 2. 复制构建文件
cp -r build/web/* .

# 3. 提交并推送
git add .
git commit -m "Deploy to GitHub Pages"
git push origin gh-pages

# 4. 在 GitHub 仓库设置中启用 GitHub Pages
```

#### Firebase Hosting

```bash
# 安装 Firebase CLI
npm i -g firebase-tools

# 登录
firebase login

# 初始化项目
firebase init hosting
# 选择 build/web 作为 public 目录

# 部署
firebase deploy --only hosting
```

### Web 配置优化

编辑 `web/index.html` 添加 PWA 支持：

```html
<!-- 添加到 <head> -->
<link rel="manifest" href="manifest.json">
<meta name="theme-color" content="#6C63FF">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black">
<meta name="apple-mobile-web-app-title" content="LifeLog">
```

---

## Android 部署

### 1. 签名配置

#### 生成密钥库

```bash
keytool -genkey -v -keystore ~/lifelog-release-key.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias lifelog
```

记录以下信息：
- 密钥库密码
- 密钥别名：lifelog
- 密钥密码

#### 配置签名

创建 `android/key.properties`：

```properties
storePassword=你的密钥库密码
keyPassword=你的密钥密码
keyAlias=lifelog
storeFile=C:/Users/你的用户名/lifelog-release-key.jks
```

**重要**：将 `android/key.properties` 添加到 `.gitignore`！

编辑 `android/app/build.gradle.kts`，在 `android {` 之前添加：

```kotlin
val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}
```

在 `android {` 内添加：

```kotlin
signingConfigs {
    create("release") {
        keyAlias = keystoreProperties["keyAlias"] as String
        keyPassword = keystoreProperties["keyPassword"] as String
        storeFile = file(keystoreProperties["storeFile"] as String)
        storePassword = keystoreProperties["storePassword"] as String
    }
}

buildTypes {
    release {
        signingConfig = signingConfigs.getByName("release")
    }
}
```

### 2. 构建 APK

```bash
# 使用构建脚本
build.bat android  # Windows
./build.sh android # Linux/macOS

# 或手动构建
flutter build apk --release

# 输出：build/app/outputs/flutter-apk/app-release.apk
```

### 3. 构建 App Bundle（Google Play）

```bash
flutter build appbundle --release

# 输出：build/app/outputs/bundle/release/app-release.aab
```

### 4. 发布到 Google Play

1. 访问 [Google Play Console](https://play.google.com/console)
2. 创建应用
3. 填写应用信息：
   - 应用名称：LifeLog
   - 简短描述：生活记录应用
   - 完整描述：（参考 README.md）
   - 截图：至少 2 张
   - 图标：1024x1024px
4. 上传 `app-release.aab`
5. 设置定价和分发
6. 提交审核

### 5. 测试安装

```bash
# 安装到连接的设备
adb install build/app/outputs/flutter-apk/app-release.apk

# 或使用 Flutter
flutter install --release
```

---

## iOS 部署

### 1. 前置要求

- macOS 系统
- Xcode 14.0+
- Apple Developer 账号（$99/年）

### 2. 配置签名

```bash
# 打开 Xcode 项目
open ios/Runner.xcworkspace

# 在 Xcode 中：
# 1. 选择 Runner 项目
# 2. 选择 Runner target
# 3. Signing & Capabilities 标签
# 4. 选择你的 Team
# 5. 修改 Bundle Identifier（例如：com.yourcompany.lifelog）
```

### 3. 更新应用信息

编辑 `ios/Runner/Info.plist`：

```xml
<key>CFBundleDisplayName</key>
<string>LifeLog</string>
<key>CFBundleName</key>
<string>LifeLog</string>
<key>CFBundleVersion</key>
<string>1</string>
<key>CFBundleShortVersionString</key>
<string>1.0.0</string>
```

### 4. 构建 IPA

```bash
# 构建 iOS 应用
flutter build ios --release

# 或使用构建脚本
./build.sh ios
```

### 5. 使用 Xcode 打包

```bash
# 打开 Xcode
open ios/Runner.xcworkspace

# 在 Xcode 中：
# 1. 选择 Product > Archive
# 2. 等待构建完成
# 3. 在 Organizer 中选择 Distribute App
# 4. 选择 App Store Connect
# 5. 上传到 TestFlight
```

### 6. 发布到 App Store

1. 访问 [App Store Connect](https://appstoreconnect.apple.com)
2. 创建新应用
3. 填写应用信息：
   - 应用名称：LifeLog
   - 副标题：生活记录助手
   - 描述：（参考 README.md）
   - 关键词：生活记录,日记,纪念日,生日提醒
   - 截图：iPhone 和 iPad 各至少 1 张
   - 图标：1024x1024px
4. 选择构建版本（从 TestFlight）
5. 提交审核

---

## 常见问题

### Q1: Flutter 命令找不到

**解决方案**：
```bash
# Windows - 添加到 PATH
setx PATH "%PATH%;C:\flutter\bin"

# Linux/macOS - 添加到 ~/.bashrc 或 ~/.zshrc
export PATH="$PATH:/path/to/flutter/bin"
```

### Q2: Drift 代码生成失败

**解决方案**：
```bash
# 清理并重新生成
flutter pub run build_runner clean
flutter pub run build_runner build --delete-conflicting-outputs
```

### Q3: Android 签名错误

**错误**：`Keystore file not found`

**解决方案**：
- 检查 `android/key.properties` 中的 `storeFile` 路径
- 使用绝对路径
- Windows 使用反斜杠：`C:\\Users\\...`

### Q4: iOS 构建失败

**错误**：`Signing for "Runner" requires a development team`

**解决方案**：
- 在 Xcode 中配置 Team
- 确保有有效的 Apple Developer 账号

### Q5: Web 部署后白屏

**解决方案**：
- 检查浏览器控制台错误
- 确保 `web/index.html` 中的 `base href` 正确
- 如果部署到子目录，修改 `<base href="/subdirectory/">`

### Q6: 应用图标未显示

**解决方案**：
```bash
# 确保已转换 SVG 为 PNG
# 重新生成图标
flutter pub run flutter_launcher_icons

# 清理并重新构建
flutter clean
flutter build <platform> --release
```

### Q7: 通知不工作

**Android 13+**：
- 需要在运行时请求通知权限
- 在设置页面点击"请求通知权限"

**iOS**：
- 首次运行会自动请求权限
- 如果拒绝，需要在系统设置中手动开启

### Q8: 照片选择器崩溃

**Android**：
- 检查 `AndroidManifest.xml` 权限配置
- 确保 `minSdk >= 21`

**iOS**：
- 检查 `Info.plist` 权限描述
- 确保描述文字清晰易懂

---

## 性能优化建议

### 1. 减小应用体积

```bash
# 启用代码混淆和压缩
flutter build apk --release --obfuscate --split-debug-info=build/debug-info

# 构建分架构 APK（更小）
flutter build apk --release --split-per-abi
```

### 2. 启用 Web 缓存

编辑 `web/index.html`，添加 Service Worker：

```html
<script>
  if ('serviceWorker' in navigator) {
    window.addEventListener('flutter-first-frame', function () {
      navigator.serviceWorker.register('flutter_service_worker.js');
    });
  }
</script>
```

### 3. 优化图片资源

```bash
# 压缩应用图标
# 使用 TinyPNG 或 ImageOptim
```

---

## 版本管理

### 更新版本号

编辑 `pubspec.yaml`：

```yaml
version: 1.0.1+2  # 格式：主版本.次版本.修订号+构建号
```

### 发布新版本

```bash
# 1. 更新版本号
# 2. 更新 CHANGELOG.md
# 3. 提交代码
git add .
git commit -m "Release v1.0.1"
git tag v1.0.1
git push origin main --tags

# 4. 重新构建
flutter clean
flutter pub get
flutter pub run build_runner build --delete-conflicting-outputs

# 5. 构建发布版本
build.bat all  # 或 ./build.sh all

# 6. 上传到各平台
```

---

## 监控和分析

### Firebase Analytics（可选）

```bash
# 添加依赖
flutter pub add firebase_core firebase_analytics

# 配置 Firebase
# 参考：https://firebase.google.com/docs/flutter/setup
```

### Sentry 错误追踪（可选）

```bash
# 添加依赖
flutter pub add sentry_flutter

# 在 main.dart 中初始化
import 'package:sentry_flutter/sentry_flutter.dart';

Future<void> main() async {
  await SentryFlutter.init(
    (options) => options.dsn = 'YOUR_DSN',
    appRunner: () => runApp(MyApp()),
  );
}
```

---

## 持续集成（CI/CD）

### GitHub Actions 示例

创建 `.github/workflows/build.yml`：

```yaml
name: Build and Deploy

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: subosito/flutter-action@v2
        with:
          flutter-version: '3.41.9'
      
      - name: Install dependencies
        run: flutter pub get
      
      - name: Generate Drift code
        run: flutter pub run build_runner build --delete-conflicting-outputs
      
      - name: Run tests
        run: flutter test
      
      - name: Analyze code
        run: flutter analyze
      
      - name: Build Web
        run: flutter build web --release
      
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./build/web
```

---

## 安全检查清单

发布前确保：

- [ ] 移除所有调试代码和 `print()` 语句
- [ ] 检查 API 密钥未硬编码
- [ ] `android/key.properties` 已添加到 `.gitignore`
- [ ] 所有敏感信息使用环境变量
- [ ] 启用代码混淆（`--obfuscate`）
- [ ] 测试所有权限请求流程
- [ ] 验证数据加密和存储安全
- [ ] 检查第三方依赖的安全性

---

## 支持和反馈

- 项目地址：[GitHub](https://github.com/your-repo/lifelog-flutter-demo)
- 问题反馈：[Issues](https://github.com/your-repo/lifelog-flutter-demo/issues)
- 文档：[README.md](README.md)

---

**祝您部署顺利！** 🚀
