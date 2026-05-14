# APK 签名统一方案

**目标**: 避免 release/debug 包签名不同导致手机必须卸载重装。

## 执行清单

- [x] 1. 修改 Android `debug` buildType：存在 release keystore 时使用 release 签名
- [x] 2. 云端 Actions 缺少 signing secrets 时直接失败，不再产出 debug artifact
- [x] 3. 更新 README，说明可覆盖安装必须使用同一签名
- [x] 4. 运行静态配置检查
- [ ] 5. 提交并推送
