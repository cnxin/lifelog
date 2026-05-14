# APK 发布链路自动化方案

**目标**: 避免“代码已更新但 APK 版本/产物未更新”的问题，让 APK 发布流程可重复、可校验、可快速定位失败点。

## 执行清单

- [x] 1. 新增统一版本同步脚本，将 `package.json` 版本同步到 `android/app/build.gradle`
- [x] 2. 新增 APK 发布脚本，串联版本同步、Web 构建、Capacitor 同步、Android release 构建和 APK 校验
- [x] 3. 在 `package.json` 增加 `android:sync-version`、`release:apk` 脚本入口
- [x] 4. 更新 README 的 APK 发布说明，写清产物路径、版本校验和可选提交参数
- [x] 5. 运行版本同步验证
- [x] 6. 汇报结果与剩余风险

## 后续验证

- [x] 运行 `npm.cmd run release:apk`，已验证版本同步、Web 构建、Capacitor 同步会按顺序执行。
- [ ] Gradle release 构建仍卡在 daemon 启动阶段，需要先清理本机 Gradle/Java 进程或重启后再完成 APK 时间戳校验。
