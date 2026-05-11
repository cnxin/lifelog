# LifeLog Flutter Demo

一个使用 Flutter + Material Design 3 构建的生活记录应用，采用 Glass UI 设计风格。

## 功能特性

### 核心功能
- 📱 **人物管理** - 记录联系人信息、生日、纪念日
- 📍 **地点管理** - 收藏喜欢的地点、餐厅、咖啡厅
- 📝 **记忆管理** - 记录生活中的美好瞬间
- 📅 **日历视图** - 查看生日、纪念日和记忆事件
- ⚙️ **设置中心** - 主题切换、数据管理、通知设置

### 高级功能
- 📸 **照片管理** - 相册/相机选择，自动压缩
- 🔔 **智能提醒** - 生日和纪念日提前一天提醒
- 🎨 **主题系统** - 4种配色方案 + 暗色模式
- 🔍 **全局搜索** - 快速查找人物、地点、记忆
- 💾 **数据管理** - 导出/导入/重置数据
- 🔗 **外部链接** - 地图、大众点评等平台链接

### 设计特色
- ✨ **Glass UI** - 毛玻璃效果、渐变背景
- 🎭 **Material Design 3** - 现代化的设计语言
- 🌈 **多主题支持** - Classic/Ocean/Sunset/Forest
- 🌙 **暗色模式** - 护眼的夜间模式
- 📱 **响应式布局** - 适配不同屏幕尺寸

## 技术栈

- **Flutter** 3.41.9
- **Dart** 3.7.0
- **状态管理** - Riverpod 2.6.1
- **路由** - go_router 14.8.1
- **数据库** - Drift (SQLite) 2.20.3
- **通知** - flutter_local_notifications 18.0.1
- **照片** - image_picker 1.1.2 + flutter_image_compress 2.3.0

## 快速开始

### 环境要求

- Flutter SDK >= 3.7.0
- Dart SDK >= 3.7.0
- Android Studio / Xcode (用于移动端开发)
- Chrome (用于 Web 开发)

详细的环境配置指南请参考 [DEVELOPMENT.md](DEVELOPMENT.md)。

### 安装步骤

1. **克隆项目**
```bash
git clone <repository-url>
cd lifelog-flutter-demo
```

2. **使用开发脚本（推荐）**
```bash
# Linux/macOS
chmod +x dev.sh
./dev.sh setup    # 自动安装依赖、生成代码、运行分析

# Windows
dev.bat setup
```

3. **或手动安装**
```bash
# 安装依赖
flutter pub get

# 生成 Drift 数据库代码
flutter pub run build_runner build --delete-conflicting-outputs
```

4. **运行应用**
```bash
# 使用开发脚本
./dev.sh run      # Linux/macOS
dev.bat run       # Windows

# 或手动运行
flutter run -d chrome    # Web
flutter run -d android   # Android
flutter run -d ios       # iOS
```

### 使用构建脚本（推荐）

**Linux/macOS:**
```bash
chmod +x build.sh
./build.sh web        # 构建 Web 版本
./build.sh android    # 构建 Android 版本
./build.sh all        # 构建所有平台
```

**Windows:**
```cmd
build.bat web         # 构建 Web 版本
build.bat android     # 构建 Android 版本
build.bat all         # 构建所有平台
```

构建脚本会自动执行：
1. 清理旧构建
2. 获取依赖
3. 生成 Drift 代码
4. 运行测试
5. 代码分析
6. 构建应用

### 可选：生成应用图标和启动页

1. 准备图标资源（参考 `ICON_SPLASH_SETUP.md`）
2. 生成图标：
```bash
flutter pub run flutter_launcher_icons
```
3. 生成启动页：
```bash
flutter pub run flutter_native_splash:create
```

## 项目结构

```
lib/
├── main.dart              # 应用入口
├── app.dart               # 路由配置
├── models/                # 数据模型
│   ├── person.dart
│   └── lifelog_models.dart
├── pages/                 # 页面（13个）
│   ├── home_page.dart
│   ├── people_list_page.dart
│   ├── person_detail_page.dart
│   ├── person_form_page.dart
│   ├── places_list_page.dart
│   ├── place_detail_page.dart
│   ├── place_form_page.dart
│   ├── memories_list_page.dart
│   ├── memory_detail_page.dart
│   ├── memory_form_page.dart
│   ├── calendar_page.dart
│   └── settings_page.dart
├── providers/             # 状态管理
│   └── providers.dart
├── services/              # 服务层
│   ├── notification_service.dart
│   └── photo_service.dart
├── database/              # 数据持久化
│   ├── tables.dart
│   ├── app_database.dart
│   └── database_helper.dart
├── theme/                 # 主题系统
│   └── app_theme.dart
└── widgets/               # 通用组件
    └── glass_card.dart

test/                      # 测试文件
├── widget_test.dart
├── models_test.dart
└── services_test.dart

assets/                    # 资源文件
├── icons/
│   └── app_icon.svg
└── images/

docs/                      # 文档
├── MIGRATION_STATUS.md
├── SQLITE_MIGRATION.md
├── ICON_SPLASH_SETUP.md
├── MIGRATION_COMPLETE.md
└── CHANGELOG.md
```

## 开发指南

### 运行测试
```bash
flutter test
```

### 代码检查
```bash
flutter analyze
```

### 热重载
开发时，修改代码后按 `r` 进行热重载，按 `R` 进行热重启。

### 数据库迁移

应用首次启动时会自动从 SharedPreferences 迁移到 SQLite。详见 `SQLITE_MIGRATION.md`。

如需重新生成 Drift 代码：
```bash
flutter pub run build_runner build --delete-conflicting-outputs
```

## 构建发布版本

### Android
```bash
# APK
flutter build apk --release

# App Bundle (推荐用于 Google Play)
flutter build appbundle --release
```

### iOS
```bash
flutter build ios --release
```

### Web
```bash
flutter build web --release
```

## 功能截图

（待添加）

## 文档

- [README.md](README.md) - 项目说明（本文件）
- [DEVELOPMENT.md](DEVELOPMENT.md) - 开发环境配置指南
- [DEPLOYMENT.md](DEPLOYMENT.md) - 部署指南（Web/Android/iOS）
- [CONTRIBUTING.md](CONTRIBUTING.md) - 贡献指南
- [MIGRATION_STATUS.md](MIGRATION_STATUS.md) - 从 React 迁移的进度
- [SQLITE_MIGRATION.md](SQLITE_MIGRATION.md) - 数据库迁移说明
- [ICON_SPLASH_SETUP.md](ICON_SPLASH_SETUP.md) - 应用图标和启动页配置
- [MIGRATION_COMPLETE.md](MIGRATION_COMPLETE.md) - 迁移工作总结
- [CHANGELOG.md](CHANGELOG.md) - 开发日志
- [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) - 项目总览

## 主要依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| flutter_riverpod | ^2.6.1 | 状态管理 |
| go_router | ^14.8.1 | 路由导航 |
| drift | ^2.20.3 | SQLite ORM |
| image_picker | ^1.1.2 | 照片选择 |
| flutter_local_notifications | ^18.0.1 | 本地通知 |
| google_fonts | ^6.2.1 | 字体 |
| flutter_image_compress | ^2.3.0 | 图片压缩 |
| timezone | ^0.9.4 | 时区处理 |

完整依赖列表见 `pubspec.yaml`。

## 性能优化

- ✅ SQLite 数据库（查询速度提升 10-100 倍）
- ✅ 照片自动压缩（节省存储空间）
- ✅ 懒加载和分页（优化列表性能）
- ✅ 状态缓存（减少重复计算）
- ✅ 图片缓存（减少网络请求）

## 已知问题

1. **Flutter 环境** - 需要配置 Flutter 环境变量
2. **首次构建** - 首次构建可能需要较长时间（下载依赖）
3. **照片权限** - 首次使用需要授予相册/相机权限
4. **通知权限** - Android 13+ 需要运行时权限

## 故障排查

### 依赖获取失败
```bash
flutter clean
flutter pub get
```

### Drift 代码生成失败
```bash
flutter pub run build_runner clean
flutter pub run build_runner build --delete-conflicting-outputs
```

### 测试失败
```bash
flutter test --verbose
```

### 构建失败
```bash
flutter clean
flutter pub get
flutter pub run build_runner build --delete-conflicting-outputs
flutter build <platform> --release
```

## 贡献指南

欢迎提交 Issue 和 Pull Request！

### 开发流程
1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 代码规范
- 遵循 Flutter 官方代码风格
- 运行 `flutter analyze` 确保无警告
- 添加必要的测试
- 更新相关文档

## 许可证

MIT License

## 联系方式

- 项目地址：[GitHub](https://github.com/your-repo/lifelog-flutter-demo)
- 问题反馈：[Issues](https://github.com/your-repo/lifelog-flutter-demo/issues)

## 致谢

- 原 React 版本设计
- Flutter 社区
- Material Design 团队
- Drift 开发团队
- Riverpod 开发团队

## 版本历史

### v1.0.0 (2026-05-11)
- ✅ 完整迁移 React 版本所有功能
- ✅ 实现 Glass UI 设计系统
- ✅ 集成 SQLite 数据库
- ✅ 添加照片管理功能
- ✅ 添加通知系统
- ✅ 完善测试和文档

---

**注意**：这是一个演示项目，用于展示 Flutter + Material Design 3 的开发实践。

