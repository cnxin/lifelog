# LifeLog - 人生日志

一款简洁优雅的个人日志应用，记录生活中的每一个重要时刻。

## 特性

- **人物档案** - 记录关系、生日、纪念日、喜好和禁忌。
- **地点资料** - 管理餐厅、商场、酒店、景点等地点，支持商场 / 店铺层级。
- **回忆记录** - 用快速记录或完整表单保存一次经历，并关联人物和地点。
- **日历视图** - 聚合生日、纪念日和回忆，支持农历、节日和节气显示。
- **Android 分享导入** - 从高德、美团、大众点评等 App 分享文本中识别地点草稿。
- **本地优先备份** - 数据保存在 IndexedDB，支持完整备份、导入预检和健康检查。
- **提醒能力** - 支持生日、纪念日、联系提醒和回忆提醒，并展示调度预览。
- **移动端体验** - Capacitor Android APK、系统返回键处理、全屏安全区和多主题适配。

## 🚀 快速开始

### 下载 APK

直接下载最新版本 APK 安装到 Android 手机：

```
https://github.com/cnxin/lifelog/raw/main/lifelog-v0.1.0-test.59.apk
```

当前版本：`0.1.0-test.59`

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
# 构建 Web 资源并同步到 Android
npm.cmd run build
npm.cmd run cap:sync

# 构建签名 release APK
npm.cmd run release:apk
```

## 🛠️ 技术栈

- **前端框架**: React 18 + TypeScript
- **构建工具**: Vite 8
- **路由**: React Router 6
- **本地存储**: IndexedDB + Dexie
- **日期处理**: lunar-javascript
- **移动端**: Capacitor 8
- **图标**: Lucide React

## 最新更新

- 地点平台店铺链接二期：新增小红书、百度地图、腾讯地图、微信、官网 / 公众号等预设。
- 平台链接支持粘贴后自动识别并归位，平台按钮可再次点击取消选择。
- 地点详情页会展示全部已保存平台链接，不再只显示美团 / 点评。
- 分享解析样本库扩展到小红书、抖音短链、百度地图、腾讯地图和微信位置。
- 人物喜好 / 禁忌输入框去掉长提示，改由下方说明承载批量添加提示。

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
