# 本地 Gradle 构建性能排查方案

**目标**: 修复/缓解 Windows 本机 Gradle daemon 卡死或 APK 构建极慢问题。

## 执行清单

- [x] 1. 检查 Gradle/Java 残留进程
- [x] 2. 使用 `gradlew --stop` 正常停止 daemon
- [x] 3. 验证当前无 Java/Gradle 残留进程
- [x] 4. 使用 `gradlew help --no-daemon` 验证 Gradle 可完整启动
- [x] 5. 调整 `android/gradle.properties`，启用 daemon、parallel、build cache 和更高 JVM 内存
- [x] 6. 复测热启动性能
- [x] 7. 汇报结论与下一步建议

## 结果

- 残留锁死问题已解除，`gradlew help --no-daemon` 可成功完成。
- 但本机 Gradle/Android 工程配置仍明显偏慢：`help` 任务耗时约 3m57s。
- 启用常规 Gradle 性能参数后，90 秒内仍未完成热启动测试，说明主要瓶颈不在 Gradle 参数，而更可能在 Windows 本机环境：杀毒/安全软件扫描、磁盘 I/O、网络/VPN/TAP/虚拟网卡枚举、Android Gradle Plugin 配置阶段。

## 后续建议

- 将 `C:\Users\42008\.gradle`、`D:\projects\lifelog-demo\react-app\android\.gradle`、`D:\projects\lifelog-demo\react-app\android\app\build` 加入安全软件排除项。
- 关闭不必要的 VPN/TAP/虚拟网卡后再测试 Gradle。
- 如果仍慢，优先使用云端/Android Studio 构建，不再依赖命令行本机构建作为唯一发布路径。
