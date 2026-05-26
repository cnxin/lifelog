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

当前版本：`0.1.0-test.79`

最新 Release：

- Release 页面：https://github.com/cnxin/lifelog/releases/tag/v0.1.0-test.79
- APK 下载：https://github.com/cnxin/lifelog/releases/download/v0.1.0-test.79/lifelog-v0.1.0-test.79.apk
- 国内镜像：https://gitee.com/ysjugg/lifelog/raw/main/downloads/lifelog-v0.1.0-test.79.apk

APK 信息：

- 文件名：`lifelog-v0.1.0-test.79.apk`
- 大小：`3623664` bytes
- SHA256：`c17aeae3607a423dd5cc30769c6cedb21723b0be8818998c97d060d271535df1`

如果 GitHub 下载慢，可优先使用 Gitee 国内镜像；App 内更新会同时比较 Gitee 镜像清单、GitHub raw 清单、CDN 清单和 GitHub latest Release，避免单一来源缓存旧版本时误判。

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

# 复制 APK 并刷新 update-manifest.json 基础字段
npm.cmd run release:prepare-files
```

`release:prepare-files` 会把 Android release APK 复制到 `downloads/`，并自动回填版本号、APK 文件名、大小、GitHub 下载地址和 Gitee 镜像地址。README、CHANGELOG 和发布说明仍需按实际变更人工确认。

## 🛠️ 技术栈

- **前端框架**: React 18 + TypeScript
- **构建工具**: Vite 8
- **路由**: React Router 6
- **本地存储**: IndexedDB + Dexie
- **日期处理**: lunar-javascript
- **移动端**: Capacitor 8
- **图标**: Lucide React

## 最新更新

- 导入预检新增照片归属修复、缺失引用、孤立照片和补回关联提示。
- 更新检查页新增下载源展示，可区分 Gitee 国内镜像、GitHub Release 和 CDN。
- 更新检查优先读取 Gitee 镜像清单，同版本时优先使用包含国内镜像的清单。
- 新增 `release:prepare-files` 脚本，减少 APK 复制和 update-manifest 字段回填漏步骤。

## 备份排查

- 导入预检会显示人物、地点、回忆、照片数量，并提示照片归属修复、缺失照片引用和会被忽略的孤立照片。
- Android 导出会调用系统文件保存器；如果第一次导出失败，请记录失败提示和选择的保存位置，再重试同一目录，便于区分系统文件授权失败和备份内容生成失败。

## 仓库结构

```text
.
├── react-app/             # React + Capacitor Android 应用源码
├── downloads/             # 当前最新 APK 镜像文件，历史版本在 GitHub Releases
├── docs/                  # 规划、迁移和产品说明文档
├── update-manifest.json   # App 内更新清单
├── CHANGELOG.md           # 版本变更记录
└── README.md              # 项目说明
```

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
