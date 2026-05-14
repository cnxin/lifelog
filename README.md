# LifeLog - 人生日志 📖

一款简洁优雅的个人日志应用，记录生活中的每一个重要时刻。

## ✨ 特性

- 📅 **日历视图** - 直观的月历展示，快速浏览历史记录
- 🎨 **多主题支持** - 经典、现代、暗黑三种主题风格
- 📝 **富文本编辑** - 支持标题、列表、引用等格式
- 🏷️ **标签分类** - 灵活的标签系统，轻松管理回忆
- 📸 **照片墙** - 支持添加照片，记录视觉回忆
- 🌙 **农历显示** - 显示中国传统农历日期
- 📱 **响应式设计** - 完美适配移动端和桌面端
- 🎭 **平滑动画** - 精心设计的交互动画，提升使用体验

## 🚀 快速开始

### 下载 APK

直接下载最新版本 APK 安装到 Android 手机：

```
https://github.com/cnxin/lifelog/raw/main/lifelog-v0.1.0-test.43.apk
```

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/cnxin/lifelog.git
cd lifelog/react-app

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

### Android 构建

```bash
# 同步到 Android
npx cap sync android

# 构建 APK（需要 Java 17）
cd android
./gradlew assembleRelease
```

## 🛠️ 技术栈

- **前端框架**: React 19 + TypeScript
- **构建工具**: Vite 8
- **路由**: React Router 7
- **富文本编辑器**: TipTap
- **日期处理**: date-fns + lunar-javascript
- **移动端**: Capacitor 8
- **图标**: Lucide React

## 📱 截图

### 主界面
- 日历视图展示每月回忆
- 金元宝账号图标
- 主题切换支持

### 详情页
- 富文本编辑器
- 标签管理
- 照片墙展示
- 平滑折叠动画

### 账号页面
- 主题切换
- 数据统计
- 设置选项

## 📝 更新日志

查看 [CHANGELOG.md](./CHANGELOG.md) 了解详细更新记录。

## 🎯 开发计划

- [ ] 数据云同步
- [ ] 搜索功能
- [ ] 数据导出/导入
- [ ] 更多主题风格
- [ ] 桌面端应用

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

Made with ❤️ by [cnxin](https://github.com/cnxin)
