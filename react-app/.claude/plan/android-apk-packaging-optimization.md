# Android APK 打包优化方案

**目标**: 在不改变业务代码的前提下，优化 release APK 体积与隐私默认值。

## 执行清单

- [x] 1. 开启 release R8 压缩 `minifyEnabled true`
- [x] 2. 开启 release 资源压缩 `shrinkResources true`
- [x] 3. 保留现有 ProGuard/Capacitor 规则，避免插件被裁剪
- [x] 4. 将 Android 备份开关改为 `allowBackup=false`
- [x] 5. 运行轻量配置校验，说明完整 APK 构建风险
- [x] 6. 汇报结果

## 验证

- `npm run build` 已通过。
- 尚未运行完整 release APK 构建；R8 压缩需要在下一次 APK 构建后做真机冒烟验证。
