# LifeLog Flutter Demo - 项目总览

## 🎯 项目简介

LifeLog 是一个使用 Flutter + Material Design 3 构建的生活记录应用，采用 Glass UI 设计风格。本项目从 React 版本完整迁移而来，保留所有原有功能并增加了移动端支持。

## 📦 快速开始

### 环境要求
- Flutter SDK >= 3.7.0
- Dart SDK >= 3.7.0

### 安装运行

```bash
# 1. 克隆项目
git clone <repository-url>
cd lifelog-flutter-demo

# 2. 安装依赖
flutter pub get

# 3. 生成数据库代码
flutter pub run build_runner build --delete-conflicting-outputs

# 4. 运行应用
flutter run -d chrome  # Web
flutter run -d android # Android
flutter run -d ios     # iOS
```

### 使用构建脚本

```bash
# Windows
build.bat web

# Linux/macOS
chmod +x build.sh
./build.sh web
```

## 📁 项目结构

```
lifelog-flutter-demo/
├── lib/                    # 源代码（39个文件）
│   ├── main.dart          # 应用入口
│   ├── app.dart           # 路由配置
│   ├── models/            # 数据模型
│   ├── pages/             # 页面（13个）
│   ├── providers/         # 状态管理
│   ├── services/          # 服务层
│   ├── database/          # 数据库
│   ├── theme/             # 主题系统
│   └── widgets/           # 通用组件
├── test/                  # 测试文件（3个）
├── docs/                  # 文档（8个）
│   ├── README.md
│   ├── DEPLOYMENT.md
│   ├── CONTRIBUTING.md
│   ├── MIGRATION_COMPLETE.md
│   ├── MIGRATION_STATUS.md
│   ├── SQLITE_MIGRATION.md
│   ├── ICON_SPLASH_SETUP.md
│   └── CHANGELOG.md
├── build.sh / build.bat   # 构建脚本
└── LICENSE                # MIT 许可证
```

## ✨ 核心功能

### 数据管理
- 📱 **人物管理** - 联系人、生日、纪念日
- 📍 **地点管理** - 收藏地点、餐厅、咖啡厅
- 📝 **记忆管理** - 记录生活瞬间
- 📅 **日历视图** - 查看重要日期

### 高级功能
- 📸 **照片管理** - 相册/相机选择，自动压缩
- 🔔 **智能提醒** - 生日和纪念日提前一天提醒
- 🎨 **主题系统** - 4种配色 + 暗色模式
- 🔍 **全局搜索** - 快速查找
- 💾 **数据管理** - 导出/导入/重置
- 🔗 **外部链接** - 地图、大众点评等

### 设计特色
- ✨ **Glass UI** - 毛玻璃效果、渐变背景
- 🎭 **Material Design 3** - 现代化设计语言
- 🌈 **多主题支持** - Classic/Ocean/Sunset/Forest
- 🌙 **暗色模式** - 护眼的夜间模式
- 📱 **响应式布局** - 适配不同屏幕

## 🛠️ 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 框架 | Flutter | 3.41.9 |
| 语言 | Dart | 3.7.0 |
| 状态管理 | Riverpod | 2.6.1 |
| 路由 | go_router | 14.8.1 |
| 数据库 | Drift (SQLite) | 2.20.3 |
| 通知 | flutter_local_notifications | 18.0.1 |
| 照片 | image_picker + flutter_image_compress | 1.1.2 + 2.3.0 |
| 字体 | google_fonts | 6.2.1 |

## 📊 项目统计

- **代码文件**: 39 个 Dart 文件（~3000 行）
- **测试文件**: 3 个
- **配置文件**: 11 个
- **文档文件**: 8 个 Markdown
- **总文件数**: 61 个
- **开发时间**: ~8 小时
- **测试覆盖**: 核心模型和服务
- **许可证**: MIT

## 🚀 部署

### Web 部署
```bash
flutter build web --release
# 输出: build/web/
# 可部署到 Vercel, Netlify, GitHub Pages, Firebase Hosting
```

### Android 部署
```bash
flutter build apk --release
# 输出: build/app/outputs/flutter-apk/app-release.apk

flutter build appbundle --release
# 输出: build/app/outputs/bundle/release/app-release.aab (Google Play)
```

### iOS 部署
```bash
flutter build ios --release
# 需要 macOS + Xcode + Apple Developer 账号
```

详细部署指南请参考 [DEPLOYMENT.md](DEPLOYMENT.md)。

## 🧪 测试

```bash
# 运行所有测试
flutter test

# 代码分析
flutter analyze

# 格式化代码
dart format .
```

## 📖 文档导航

| 文档 | 说明 |
|------|------|
| [README.md](README.md) | 完整项目说明 |
| [DEPLOYMENT.md](DEPLOYMENT.md) | 部署指南（Web/Android/iOS） |
| [CONTRIBUTING.md](CONTRIBUTING.md) | 贡献指南 |
| [MIGRATION_COMPLETE.md](MIGRATION_COMPLETE.md) | 迁移工作总结 |
| [SQLITE_MIGRATION.md](SQLITE_MIGRATION.md) | 数据库迁移说明 |
| [CHANGELOG.md](CHANGELOG.md) | 开发日志 |

## 🎨 设计规范

- **字体**: Outfit (英文), 系统默认 (中文)
- **圆角**: 12-28px
- **间距**: 8/12/16/24px
- **阴影**: 柔和，低透明度
- **动画**: 160-200ms 缓动
- **配色**: 4种预设主题，支持暗色模式

## 🔧 常见问题

### Flutter 命令找不到
```bash
# Windows
setx PATH "%PATH%;C:\flutter\bin"

# Linux/macOS
export PATH="$PATH:/path/to/flutter/bin"
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

更多问题请查看 [README.md](README.md) 的故障排查部分。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

详细贡献指南请参考 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件。

## 🙏 致谢

- 原 React 版本设计
- Flutter 社区
- Material Design 团队
- Drift 开发团队
- Riverpod 开发团队

## 📞 联系方式

- 项目地址: [GitHub](https://github.com/your-repo/lifelog-flutter-demo)
- 问题反馈: [Issues](https://github.com/your-repo/lifelog-flutter-demo/issues)

---

**注意**: 这是一个演示项目，用于展示 Flutter + Material Design 3 的开发实践。

**版本**: 1.0.0 | **最后更新**: 2026-05-11
