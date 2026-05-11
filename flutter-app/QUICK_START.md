# LifeLog Flutter Demo - 快速开始

5 分钟快速上手指南。

## 🚀 最快开始方式

### 1. 确保已安装 Flutter

```bash
flutter --version
```

如果未安装，请参考 [DEVELOPMENT.md](DEVELOPMENT.md) 配置开发环境。

### 2. 克隆并初始化项目

```bash
# 克隆项目
git clone <repository-url>
cd lifelog-flutter-demo

# 一键初始化（推荐）
./dev.sh setup      # Linux/macOS
dev.bat setup       # Windows

# 或手动初始化
flutter pub get
flutter pub run build_runner build --delete-conflicting-outputs
```

### 3. 运行应用

```bash
# 使用开发脚本
./dev.sh run        # Linux/macOS
dev.bat run         # Windows

# 或手动运行
flutter run -d chrome
```

就这么简单！应用将在浏览器中打开。

---

## 📱 开发工作流

### 日常开发

```bash
# 1. 启动应用
./dev.sh run

# 2. 修改代码后按 r 热重载
# 3. 按 R 热重启
# 4. 按 q 退出
```

### 运行测试

```bash
./dev.sh test
```

### 代码检查

```bash
./dev.sh analyze
./dev.sh format
```

### 生成覆盖率报告

```bash
./dev.sh coverage
```

---

## 🛠️ 开发脚本命令

| 命令 | 说明 |
|------|------|
| `./dev.sh setup` | 初始化项目 |
| `./dev.sh run` | 运行应用 |
| `./dev.sh test` | 运行测试 |
| `./dev.sh analyze` | 代码分析 |
| `./dev.sh format` | 格式化代码 |
| `./dev.sh clean` | 清理缓存 |
| `./dev.sh generate` | 生成 Drift 代码 |
| `./dev.sh coverage` | 测试覆盖率 |
| `./dev.sh doctor` | 环境检查 |
| `./dev.sh upgrade` | 更新依赖 |

---

## 📂 项目结构速览

```
lib/
├── main.dart              # 应用入口
├── app.dart               # 路由配置
├── models/                # 数据模型
├── pages/                 # 13 个页面
├── providers/             # 状态管理
├── services/              # 服务层
├── database/              # SQLite 数据库
├── theme/                 # 主题系统
└── widgets/               # 通用组件
```

---

## 🎯 核心功能

- 📱 人物管理 - 联系人、生日、纪念日
- 📍 地点管理 - 收藏地点、餐厅
- 📝 记忆管理 - 记录生活瞬间
- 📅 日历视图 - 查看重要日期
- 📸 照片管理 - 自动压缩
- 🔔 智能提醒 - 生日提醒
- 🎨 主题切换 - 4 种配色 + 暗色模式

---

## 🔧 常见问题

### Flutter 命令找不到

```bash
# Windows
setx PATH "%PATH%;C:\flutter\bin"

# Linux/macOS
export PATH="$PATH:$HOME/flutter/bin"
```

### 依赖安装失败

```bash
flutter clean
flutter pub get
```

### Drift 代码生成失败

```bash
flutter pub run build_runner clean
flutter pub run build_runner build --delete-conflicting-outputs
```

更多问题请查看 [README.md](README.md) 或 [DEVELOPMENT.md](DEVELOPMENT.md)。

---

## 📖 完整文档

- [README.md](README.md) - 完整项目说明
- [DEVELOPMENT.md](DEVELOPMENT.md) - 开发环境配置
- [DEPLOYMENT.md](DEPLOYMENT.md) - 部署指南
- [CONTRIBUTING.md](CONTRIBUTING.md) - 贡献指南
- [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) - 项目总览

---

## 🎉 开始开发

现在您已经准备好开始开发了！

1. 运行 `./dev.sh run` 启动应用
2. 在浏览器中查看效果
3. 修改代码，按 `r` 热重载
4. 享受开发过程！

**祝您开发愉快！** 🚀
