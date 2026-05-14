# GitHub Actions 云端 APK 构建方案

**目标**: 将正式 APK 构建迁移到 GitHub Actions，避免 Windows 本机 Gradle daemon/文件锁导致构建卡死。

## 执行清单

- [x] 1. 确认 Android release 签名配置需要的 keystore 字段
- [x] 2. 新增 GitHub Actions workflow，使用干净 Ubuntu runner 构建 APK
- [x] 3. 在 workflow 中同步 Android 版本、执行 Web build + Capacitor sync + Gradle assembleRelease
- [x] 4. 支持 GitHub Secrets 注入 release keystore，缺失时降级构建 debug APK artifact
- [x] 5. 上传 APK artifact，命名区分 release/debug 与版本号
- [x] 6. 更新 README，说明云端构建与 Secrets 配置
- [x] 7. 运行基础语法/状态检查并汇报
