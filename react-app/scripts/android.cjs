// Local preflight + isolated preview build. Never installs, signs a release, or publishes.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const android = path.join(root, 'android');
const windows = process.platform === 'win32';

function javaMajor(output) {
  const match = output.match(/(?:java|openjdk) version "(\d+)(?:\.(\d+))?/i);
  return match ? Number(match[1] === '1' ? match[2] : match[1]) : 0;
}
function inspect() {
  const checks = [];
  const check = (ok, label, detail) => checks.push({ ok: !!ok, label, detail });
  const java = process.env.JAVA_HOME
    ? path.join(process.env.JAVA_HOME, 'bin', windows ? 'java.exe' : 'java') : 'java';
  const result = spawnSync(java, ['-version'], { encoding: 'utf8', timeout: 10000 });
  const version = javaMajor((result.stdout || '') + (result.stderr || ''));
  check(result.status === 0 && version === 21, 'JDK 21', version ? `检测到 Java ${version}；本项目固定使用 21` : '未发现可用 JDK；安装 JDK 21 并设置 JAVA_HOME');
  const javac = process.env.JAVA_HOME
    ? path.join(process.env.JAVA_HOME, 'bin', windows ? 'javac.exe' : 'javac') : 'javac';
  const compiler = spawnSync(javac, ['-version'], { encoding: 'utf8', timeout: 10000 });
  check(compiler.status === 0 && /javac 21(?:[.\s]|$)/.test((compiler.stdout || '') + (compiler.stderr || '')), 'Java 编译器', '需要完整 JDK 21，而非只有 Java 运行时');
  const defaultSdk = process.platform === 'darwin'
    ? path.join(os.homedir(), 'Library/Android/sdk')
    : windows ? path.join(process.env.LOCALAPPDATA || os.homedir(), 'Android/Sdk')
    : path.join(os.homedir(), 'Android/Sdk');
  // Require an explicit environment variable for a nonstandard SDK path (no local.properties edits).
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || defaultSdk;
  check(fs.existsSync(sdk), 'Android SDK', sdk + '（非默认路径请设置 ANDROID_HOME）');
  const variables = fs.readFileSync(path.join(android, 'variables.gradle'), 'utf8');
  const api = variables.match(/compileSdkVersion\s*=\s*(\d+)/)[1];
  check(fs.existsSync(path.join(sdk, `platforms/android-${api}/android.jar`)), `Android API ${api}`, `SDK Manager 安装 platforms;android-${api}`);
  check(fs.existsSync(path.join(sdk, 'build-tools/35.0.0/aapt2' + (windows ? '.exe' : ''))), 'Build Tools 35.0.0', '本项目 AGP 8.13 默认工具版本：build-tools;35.0.0');
  check(fs.existsSync(path.join(sdk, 'platform-tools/adb' + (windows ? '.exe' : ''))), 'Platform Tools', '安装 platform-tools；不自动连接或修改设备');
  check(fs.existsSync(path.join(android, 'gradle/wrapper/gradle-wrapper.jar')), 'Gradle wrapper', '使用仓库自带 wrapper，无需全局安装 Gradle');
  for (const [label, location] of [['项目磁盘', root], ['工具缓存磁盘', os.homedir()]]) {
    try {
      const stats = fs.statfsSync(location);
      const free = stats.bavail * stats.bsize / 1024 ** 3;
      check(free >= 6, label, `${free.toFixed(1)} GiB 可用；此脚本预留至少 6 GiB（构建缓存的保守门槛，并非官方最低要求）`);
    } catch {
      check(false, label, '无法检查可用空间，请手动确认');
    }
  }
  return { checks, sdk };
}
function run(command, args, cwd = root, env = process.env) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit', shell: windows });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} 执行失败（${result.status ?? result.signal}）`);
}
function verifyPreviewBadging(badging, version, versionCode) {
  const id = badging.match(/^package: name='([^']+)'/m)?.[1];
  const name = badging.match(/^application-label:'([^']+)'/m)?.[1];
  const actualVersion = badging.match(/^package:.* versionName='([^']+)'/m)?.[1];
  const actualCode = Number(badging.match(/^package:.* versionCode='([^']+)'/m)?.[1]);
  const permissions = [...badging.matchAll(/^uses-permission(?:-sdk-\d+)?: name='([^']+)'/gm)].map(match => match[1]);
  const allowed = new Set(['android.permission.INTERNET', 'android.permission.VIBRATE',
    'android.permission.POST_NOTIFICATIONS', 'android.permission.RECEIVE_BOOT_COMPLETED',
    'android.permission.WAKE_LOCK', 'com.cnxin.lifelog.preview.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION']);
  if (id !== 'com.cnxin.lifelog.preview') throw new Error('APK 包名不是独立测试版，停止交付');
  if (name !== '日子 · 测试版') throw new Error('APK 桌面名称不能区分测试版');
  if (actualVersion !== version + '-preview' || actualCode !== versionCode) throw new Error('APK 版本与源码不符');
  if (!permissions.includes('android.permission.INTERNET') || permissions.some(item => !allowed.has(item))) {
    throw new Error('APK 含未预期权限，请检查合并后的 Manifest: ' + permissions.join(', '));
  }
  if (!/^launchable-activity: name='com\.cnxin\.lifelog\.MainActivity'/m.test(badging)) throw new Error('APK 启动入口不符');
  return { applicationId: id, label: name, versionName: actualVersion, versionCode: actualCode, permissions };
}
function capture(command, args, env) {
  const result = spawnSync(command, args, { cwd: root, env, encoding: 'utf8', shell: windows, timeout: 120000 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(command + ' 检查失败: ' + result.stderr);
  return result.stdout;
}
function inspectApk(apk, sdk, env) {
  const tools = path.join(sdk, 'build-tools/35.0.0');
  const badging = capture(path.join(tools, windows ? 'aapt.exe' : 'aapt'), ['dump', 'badging', apk], env);
  const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
  const versionCode = Number(fs.readFileSync(path.join(android, 'app/build.gradle'), 'utf8').match(/versionCode (\d+)/)[1]);
  const info = verifyPreviewBadging(badging, version, versionCode);
  const signature = capture(path.join(tools, windows ? 'apksigner.bat' : 'apksigner'), ['verify', '--verbose', '--print-certs', apk], env);
  const bytes = fs.readFileSync(apk);
  const report = { ...info, sizeBytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), signatureVerification: signature.trim(), deviceTested: false };
  const output = path.join(root, '.artifacts');
  fs.mkdirSync(output, { recursive: true });
  const delivered = path.join(output, 'lifelog-days-' + info.versionName + '.apk');
  fs.copyFileSync(apk, delivered);
  fs.writeFileSync(delivered + '.json', JSON.stringify(report, null, 2) + '\n');
  console.log('已校验 APK 身份、权限与签名，交付副本: ' + delivered);
}
function main(mode) {
  if (!['doctor', 'preview'].includes(mode)) throw new Error('用法：node scripts/android.cjs doctor|preview');
  const { checks, sdk } = inspect();
  for (const item of checks) console.log(`[${item.ok ? 'OK' : '缺少'}] ${item.label}: ${item.detail}`);
  console.log('原签名配置: ' + (fs.existsSync(path.join(android, 'keystore.properties')) ? '文件存在（未读取、未验证密钥）' : '未配置；不影响独立测试版，但不能据此覆盖升级原版'));
  if (checks.some(item => !item.ok)) {
    console.error('\n环境检查未通过；未下载工具链、未调用 Gradle、未安装 APK。');
    process.exitCode = 1;
    return;
  }
  if (mode === 'doctor') return;
  const npm = windows ? 'npm.cmd' : 'npm';
  run(npm, ['test']);
  run(npm, ['run', 'build']);
  run(process.execPath, ['node_modules/@capacitor/cli/bin/capacitor', 'sync', 'android']);
  const env = { ...process.env, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk };
  if (windows) run('gradlew.bat', [':app:assembleDebug', ':app:lintDebug', '--no-daemon'], android, env);
  else run('sh', ['./gradlew', ':app:assembleDebug', ':app:lintDebug', '--no-daemon'], android, env);
  const apk = path.join(android, 'app/build/outputs/apk/debug/app-debug.apk');
  if (!fs.existsSync(apk)) throw new Error('Gradle 结束但未找到测试 APK');
  inspectApk(apk, sdk, env);
  console.log(`\n测试 APK: ${apk}\n包名: com.cnxin.lifelog.preview\n这是独立测试应用；不读取原版私有数据。使用备份导入测试，不代表覆盖升级已验证。`);
}
if (require.main === module) {
  try { main(process.argv[2] || 'doctor'); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { javaMajor, verifyPreviewBadging };
