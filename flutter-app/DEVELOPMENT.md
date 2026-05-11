# LifeLog Flutter Demo - 开发环境配置

本文档提供详细的开发环境配置指南，帮助新开发者快速上手。

## 目录

- [系统要求](#系统要求)
- [Flutter 安装](#flutter-安装)
- [IDE 配置](#ide-配置)
- [项目设置](#项目设置)
- [常用命令](#常用命令)
- [调试技巧](#调试技巧)
- [性能分析](#性能分析)

---

## 系统要求

### Windows
- Windows 10 或更高版本（64位）
- 磁盘空间：至少 2.5 GB
- Git for Windows
- PowerShell 5.0 或更高版本

### macOS
- macOS 10.14 (Mojave) 或更高版本
- 磁盘空间：至少 2.8 GB
- Xcode（用于 iOS 开发）
- CocoaPods

### Linux
- 64位 Ubuntu 18.04 或更高版本
- 磁盘空间：至少 1.5 GB
- 必需的依赖包（见下文）

---

## Flutter 安装

### Windows 安装

1. **下载 Flutter SDK**
   ```powershell
   # 访问 https://flutter.dev/docs/get-started/install/windows
   # 下载最新稳定版 ZIP 文件
   ```

2. **解压到目标目录**
   ```powershell
   # 推荐路径：C:\flutter
   # 避免使用包含空格或特殊字符的路径
   ```

3. **配置环境变量**
   ```powershell
   # 方法 1：使用 PowerShell（临时）
   $env:Path += ";C:\flutter\bin"

   # 方法 2：系统设置（永久）
   # 1. 右键"此电脑" -> 属性 -> 高级系统设置
   # 2. 环境变量 -> 系统变量 -> Path -> 编辑
   # 3. 新建 -> 输入 C:\flutter\bin
   # 4. 确定并重启终端
   ```

4. **验证安装**
   ```powershell
   flutter --version
   flutter doctor
   ```

5. **安装 Android Studio**（用于 Android 开发）
   - 下载：https://developer.android.com/studio
   - 安装 Android SDK
   - 配置 Android 模拟器

### macOS 安装

1. **下载 Flutter SDK**
   ```bash
   cd ~/development
   curl -O https://storage.googleapis.com/flutter_infra_release/releases/stable/macos/flutter_macos_3.41.9-stable.zip
   unzip flutter_macos_3.41.9-stable.zip
   ```

2. **配置环境变量**
   ```bash
   # 编辑 ~/.zshrc 或 ~/.bash_profile
   export PATH="$PATH:$HOME/development/flutter/bin"

   # 重新加载配置
   source ~/.zshrc
   ```

3. **验证安装**
   ```bash
   flutter --version
   flutter doctor
   ```

4. **安装 Xcode**（用于 iOS 开发）
   ```bash
   # 从 App Store 安装 Xcode
   # 安装命令行工具
   sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
   sudo xcodebuild -runFirstLaunch

   # 接受许可协议
   sudo xcodebuild -license accept

   # 安装 CocoaPods
   sudo gem install cocoapods
   ```

### Linux 安装

1. **安装依赖**
   ```bash
   sudo apt-get update
   sudo apt-get install -y curl git unzip xz-utils zip libglu1-mesa
   ```

2. **下载 Flutter SDK**
   ```bash
   cd ~/development
   wget https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/flutter_linux_3.41.9-stable.tar.xz
   tar xf flutter_linux_3.41.9-stable.tar.xz
   ```

3. **配置环境变量**
   ```bash
   # 编辑 ~/.bashrc
   export PATH="$PATH:$HOME/development/flutter/bin"

   # 重新加载配置
   source ~/.bashrc
   ```

4. **验证安装**
   ```bash
   flutter --version
   flutter doctor
   ```

---

## IDE 配置

### Visual Studio Code（推荐）

1. **安装 VS Code**
   - 下载：https://code.visualstudio.com/

2. **安装扩展**
   ```
   必需扩展：
   - Flutter (Dart-Code.flutter)
   - Dart (Dart-Code.dart-code)

   推荐扩展：
   - Error Lens (usernamehw.errorlens)
   - Bracket Pair Colorizer (CoenraadS.bracket-pair-colorizer-2)
   - GitLens (eamodio.gitlens)
   - Todo Tree (Gruntfuggly.todo-tree)
   - Pubspec Assist (jeroen-meijer.pubspec-assist)
   ```

3. **配置 settings.json**
   ```json
   {
     "dart.flutterSdkPath": "C:\\flutter",
     "dart.lineLength": 80,
     "editor.formatOnSave": true,
     "editor.rulers": [80],
     "dart.debugExternalPackageLibraries": true,
     "dart.debugSdkLibraries": false,
     "[dart]": {
       "editor.formatOnSave": true,
       "editor.formatOnType": true,
       "editor.selectionHighlight": false,
       "editor.suggest.snippetsPreventQuickSuggestions": false,
       "editor.suggestSelection": "first",
       "editor.tabCompletion": "onlySnippets",
       "editor.wordBasedSuggestions": false
     }
   }
   ```

4. **配置 launch.json**
   ```json
   {
     "version": "0.2.0",
     "configurations": [
       {
         "name": "Flutter (Chrome)",
         "request": "launch",
         "type": "dart",
         "deviceId": "chrome"
       },
       {
         "name": "Flutter (Android)",
         "request": "launch",
         "type": "dart",
         "deviceId": "android"
       },
       {
         "name": "Flutter (iOS)",
         "request": "launch",
         "type": "dart",
         "deviceId": "ios"
       }
     ]
   }
   ```

### Android Studio

1. **安装 Android Studio**
   - 下载：https://developer.android.com/studio

2. **安装插件**
   - File -> Settings -> Plugins
   - 搜索并安装：Flutter, Dart

3. **配置 Flutter SDK**
   - File -> Settings -> Languages & Frameworks -> Flutter
   - 设置 Flutter SDK path

4. **配置 Android SDK**
   - File -> Settings -> Appearance & Behavior -> System Settings -> Android SDK
   - 安装必需的 SDK 版本（API 21+）

### IntelliJ IDEA

配置方式与 Android Studio 类似。

---

## 项目设置

### 1. 克隆项目

```bash
git clone https://github.com/your-repo/lifelog-flutter-demo.git
cd lifelog-flutter-demo
```

### 2. 安装依赖

```bash
flutter pub get
```

### 3. 生成 Drift 代码

```bash
flutter pub run build_runner build --delete-conflicting-outputs
```

### 4. 配置设备

```bash
# 查看可用设备
flutter devices

# 启动 Chrome（Web 开发）
# 自动启动，无需额外配置

# 启动 Android 模拟器
flutter emulators
flutter emulators --launch <emulator_id>

# 连接 Android 真机
# 1. 启用开发者选项和 USB 调试
# 2. 连接 USB
# 3. 授权调试

# 启动 iOS 模拟器（仅 macOS）
open -a Simulator
```

### 5. 运行应用

```bash
# Web
flutter run -d chrome

# Android
flutter run -d android

# iOS（仅 macOS）
flutter run -d ios

# 热重载：按 r
# 热重启：按 R
# 退出：按 q
```

---

## 常用命令

### 开发命令

```bash
# 运行应用（开发模式）
flutter run

# 运行应用（指定设备）
flutter run -d <device_id>

# 运行应用（详细输出）
flutter run -v

# 热重载
# 在运行中按 r

# 热重启
# 在运行中按 R

# 清理构建缓存
flutter clean

# 获取依赖
flutter pub get

# 更新依赖
flutter pub upgrade

# 检查过期依赖
flutter pub outdated
```

### 代码质量

```bash
# 代码分析
flutter analyze

# 格式化代码
dart format .

# 格式化单个文件
dart format lib/main.dart

# 检查格式（不修改）
dart format --set-exit-if-changed .

# 运行测试
flutter test

# 运行测试（详细输出）
flutter test --verbose

# 运行测试（生成覆盖率）
flutter test --coverage

# 查看覆盖率报告
genhtml coverage/lcov.info -o coverage/html
open coverage/html/index.html
```

### 构建命令

```bash
# 构建 Web
flutter build web --release

# 构建 Android APK
flutter build apk --release

# 构建 Android APK（分架构）
flutter build apk --release --split-per-abi

# 构建 Android App Bundle
flutter build appbundle --release

# 构建 iOS
flutter build ios --release

# 构建 iOS（无代码签名）
flutter build ios --release --no-codesign
```

### Drift 代码生成

```bash
# 生成代码
flutter pub run build_runner build

# 生成代码（删除冲突）
flutter pub run build_runner build --delete-conflicting-outputs

# 监听文件变化自动生成
flutter pub run build_runner watch

# 清理生成的代码
flutter pub run build_runner clean
```

### 诊断命令

```bash
# 环境诊断
flutter doctor

# 详细诊断
flutter doctor -v

# 查看设备
flutter devices

# 查看模拟器
flutter emulators

# 查看日志
flutter logs

# 查看日志（指定设备）
flutter logs -d <device_id>
```

---

## 调试技巧

### 1. 使用 DevTools

```bash
# 启动 DevTools
flutter pub global activate devtools
flutter pub global run devtools

# 或在运行应用时自动打开
flutter run --devtools
```

**DevTools 功能：**
- Widget Inspector - 检查 Widget 树
- Timeline - 性能分析
- Memory - 内存分析
- Network - 网络请求监控
- Logging - 日志查看

### 2. 断点调试

在 VS Code 中：
1. 在代码行号左侧点击设置断点
2. 按 F5 启动调试
3. 使用调试工具栏控制执行

### 3. 打印调试

```dart
// 基本打印
print('Debug message');

// 调试打印（仅在 debug 模式）
debugPrint('Debug message');

// 条件打印
if (kDebugMode) {
  print('Only in debug mode');
}

// 格式化打印
print('User: ${user.name}, Age: ${user.age}');
```

### 4. 断言

```dart
// 断言（仅在 debug 模式生效）
assert(user != null, 'User cannot be null');
assert(age >= 0, 'Age must be non-negative');
```

### 5. Flutter Inspector

在 VS Code 中：
1. 运行应用
2. 打开 Flutter Inspector 面板
3. 选择 Widget 查看属性
4. 使用 "Toggle Debug Paint" 查看布局边界

---

## 性能分析

### 1. 性能叠加层

```dart
// 在 MaterialApp 中启用
MaterialApp(
  showPerformanceOverlay: true,
  // ...
)
```

### 2. 检查重建

```dart
// 在 MaterialApp 中启用
MaterialApp(
  debugShowCheckedModeBanner: false,
  showSemanticsDebugger: false,
  // ...
)

// 在 Widget 中添加
@override
Widget build(BuildContext context) {
  print('${runtimeType} rebuilt');
  return Container();
}
```

### 3. Timeline 分析

```bash
# 运行应用并记录 timeline
flutter run --profile --trace-startup

# 分析结果
# 在 DevTools 的 Timeline 标签查看
```

### 4. 内存分析

```bash
# 运行应用（profile 模式）
flutter run --profile

# 在 DevTools 的 Memory 标签：
# - 查看内存使用
# - 检测内存泄漏
# - 分析对象分配
```

### 5. 构建大小分析

```bash
# 分析 APK 大小
flutter build apk --analyze-size

# 分析 App Bundle 大小
flutter build appbundle --analyze-size

# 生成大小报告
flutter build apk --analyze-size --target-platform android-arm64
```

---

## 常见问题

### Q1: flutter 命令找不到

**解决方案**：
```bash
# 检查环境变量
echo $PATH  # Linux/macOS
echo %PATH% # Windows

# 重新配置环境变量（见上文）
```

### Q2: Gradle 下载慢

**解决方案**：
```bash
# 配置国内镜像
# 编辑 android/build.gradle
repositories {
    maven { url 'https://maven.aliyun.com/repository/google' }
    maven { url 'https://maven.aliyun.com/repository/jcenter' }
    maven { url 'https://maven.aliyun.com/repository/public' }
}
```

### Q3: iOS 构建失败

**解决方案**：
```bash
# 清理 iOS 构建
cd ios
rm -rf Pods Podfile.lock
pod install
cd ..
flutter clean
flutter run
```

### Q4: 热重载不工作

**解决方案**：
- 检查是否有语法错误
- 尝试热重启（按 R）
- 重新运行应用

### Q5: 依赖冲突

**解决方案**：
```bash
# 清理并重新获取依赖
flutter clean
rm pubspec.lock
flutter pub get
```

---

## 推荐工具

### 命令行工具
- **fvm** - Flutter 版本管理
- **melos** - 多包管理
- **lcov** - 代码覆盖率报告

### 在线工具
- **DartPad** - 在线 Dart 编辑器
- **FlutLab** - 在线 Flutter IDE
- **Zapp** - Flutter 在线运行

### 调试工具
- **Flipper** - 移动应用调试平台
- **Charles** - HTTP 代理调试
- **Postman** - API 测试

---

## 下一步

配置完成后，您可以：

1. 阅读 [README.md](README.md) 了解项目
2. 查看 [CONTRIBUTING.md](CONTRIBUTING.md) 学习贡献流程
3. 运行 `flutter run` 启动应用
4. 开始开发！

---

**祝您开发愉快！** 🚀
