const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { javaMajor } = require('./android.cjs');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('doctor recognizes JDK versions and rejects missing runtime output', () => {
  assert.equal(javaMajor('openjdk version "21.0.8" 2025-07-15'), 21);
  assert.equal(javaMajor('java version "1.8.0_462"'), 8);
  assert.equal(javaMajor('openjdk version "25"'), 25);
  assert.equal(javaMajor('Unable to locate a Java Runtime.'), 0);
});

test('Android source contract: preview isolation, stable release identity and version', () => {
  const gradle = read('android/app/build.gradle');
  const pkg = JSON.parse(read('package.json'));
  assert.match(gradle, /applicationId "com\.cnxin\.lifelog"/);
  assert.match(gradle, /debug\s*\{\s*applicationIdSuffix "\.preview"\s*versionNameSuffix "-preview"\s*\}/);
  assert.equal(gradle.match(/versionName "([^"]+)"/)[1], pkg.version);
  assert.ok(Number(gradle.match(/versionCode (\d+)/)[1]) > 135);
  assert.match(read('capacitor.config.ts'), /androidScheme: "https"/);
  assert.doesNotMatch(read('capacitor.config.ts'), /hostname:|\burl:/);
  assert.match(read('android/app/src/debug/res/values/strings.xml'), /日子 · 测试版/);
});

test('Android source contract: only INTERNET permission, no old native integrations', () => {
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  assert.deepEqual([...manifest.matchAll(/<uses-permission\s+android:name="([^"]+)"/g)].map(m => m[1]), ['android.permission.INTERNET']);
  const activity = read('android/app/src/main/java/com/cnxin/lifelog/MainActivity.java');
  assert.match(activity, /registerPlugin\(NativeBackupFilePlugin.class\)/);
  assert.doesNotMatch(activity, /NativeExternalBrowser|NativeImageShare/);
  const dependencies = JSON.parse(read('package.json')).dependencies;
  assert.equal(dependencies['@capacitor/local-notifications'], undefined);
  assert.equal(dependencies['@capacitor/browser'], undefined);
});

function workerModule({ native = true, prod = true, registrations = [], cacheKeys = [] } = {}) {
  const registered = [], removed = [];
  const serviceWorker = {
    getRegistrations: async () => registrations,
    register: async (url) => { registered.push(url); },
  };
  const code = ts.transpileModule(read('src/registerServiceWorker.ts').replaceAll('import.meta.env.PROD', String(prod)), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exported = {};
  const caches = { keys: async () => cacheKeys, delete: async key => { removed.push(key); return true; } };
  // No storage APIs supplied: accidentally accessing user data fails these tests.
  vm.runInNewContext(code, {
    exports: exported,
    require: () => ({ Capacitor: { isNativePlatform: () => native } }),
    navigator: { serviceWorker }, document: { readyState: 'complete' },
    window: { caches }, caches, location: { origin: 'https://localhost' }, URL, console,
  });
  return { exported, registered, removed };
}

test('native cleanup unregisters only LifeLog /sw.js and deletes only owned caches', async () => {
  const unregistered = [];
  const registration = (script, name) => ({
    active: { scriptURL: script }, unregister: async () => unregistered.push(name),
  });
  const { exported, removed } = workerModule({
    registrations: [registration('https://localhost/sw.js', 'lifelog'), registration('https://localhost/other/sw.js', 'other')],
    cacheKeys: ['lifelog-static-v3', 'lifelog-runtime-v3', 'other-cache', 'lifelog-photos'],
  });
  await exported.clearNativeWebCache();
  assert.deepEqual(unregistered, ['lifelog']);
  assert.deepEqual(removed, ['lifelog-static-v3', 'lifelog-runtime-v3']);
});

test('native startup cleans up without registering, refreshing or reading data', async () => {
  const { exported, registered, removed } = workerModule({ cacheKeys: ['lifelog-static-v3'] });
  exported.registerServiceWorker();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(registered, []);
  assert.deepEqual(removed, ['lifelog-static-v3']);
});

test('web production keeps offline registration; development does not register', () => {
  const production = workerModule({ native: false });
  production.exported.registerServiceWorker();
  assert.deepEqual(production.registered, ['/sw.js']);
  const development = workerModule({ native: false, prod: false });
  development.exported.registerServiceWorker();
  assert.deepEqual(development.registered, []);
});

const { verifyPreviewBadging } = require('./android.cjs');
const sampleBadging = `package: name='com.cnxin.lifelog.preview' versionCode='136' versionName='0.2.0-alpha.1-preview' platformBuildVersionName='16'
application-label:'日子 · 测试版'
uses-permission: name='android.permission.INTERNET'
uses-permission: name='com.cnxin.lifelog.preview.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION'
launchable-activity: name='com.cnxin.lifelog.MainActivity' label='日子 · 测试版' icon=''
`;
test('APK inspection accepts isolated preview identity and expected merged permissions', () => {
  const info = verifyPreviewBadging(sampleBadging, '0.2.0-alpha.1', 136);
  assert.equal(info.applicationId, 'com.cnxin.lifelog.preview');
  assert.equal(info.versionCode, 136);
  assert.equal(info.permissions.length, 2);
});
test('APK inspection rejects production ID, stale versions and ambiguous labels', () => {
  for (const [before, after] of [
    ["name='com.cnxin.lifelog.preview'", "name='com.cnxin.lifelog'"],
    ["versionCode='136'", "versionCode='135'"],
    ["versionName='0.2.0-alpha.1-preview'", "versionName='0.1.0'"],
    ["application-label:'日子 · 测试版'", "application-label:'LifeLog'"],
  ]) assert.throws(() => verifyPreviewBadging(sampleBadging.replace(before, after), '0.2.0-alpha.1', 136));
});
test('APK inspection rejects removed capabilities even in sdk-specific permission entries', () => {
  for (const entry of ["uses-permission: name='android.permission.CAMERA'", "uses-permission-sdk-23: name='android.permission.READ_EXTERNAL_STORAGE'"]) {
    assert.throws(() => verifyPreviewBadging(sampleBadging + entry, '0.2.0-alpha.1', 136), /未预期权限/);
  }
});
test('Gradle uses a checksum-pinned binary distribution', () => {
  const wrapper = read('android/gradle/wrapper/gradle-wrapper.properties');
  assert.match(wrapper, /distributionUrl=.*gradle-8\.14\.3-bin\.zip/);
  assert.match(wrapper, /distributionSha256Sum=[a-f0-9]{64}/);
});

test('Android local-only storage is excluded from cloud backup and automatic device transfer', () => {
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  assert.match(manifest, /android:allowBackup="false"/);
  assert.match(manifest, /android:fullBackupContent="false"/);
  assert.match(manifest, /android:dataExtractionRules="@xml\/data_extraction_rules"/);
  const rules = read('android/app/src/main/res/xml/data_extraction_rules.xml');
  for (const mode of ['cloud-backup', 'device-transfer']) {
    const section = rules.split(`<${mode}>`)[1].split(`</${mode}>`)[0];
    for (const domain of ['root', 'file', 'database', 'sharedpref', 'external', 'device_root', 'device_file', 'device_database', 'device_sharedpref']) {
      assert.ok(section.includes(`<exclude domain="${domain}" path="." />`), `${mode}/${domain}`);
    }
    assert.ok(!section.includes('<include'));
  }
});

test('SystemBars owns native insets and foreground style without the legacy overlay plugin', () => {
  const config = read('capacitor.config.ts');
  assert.match(config, /SystemBars:\s*\{\s*insetsHandling: "css",\s*style: "LIGHT"/);
  assert.doesNotMatch(config, /overlaysWebView|StatusBar:/);
  const app = read('src/App.tsx');
  assert.match(app, /SystemBars\.setStyle\(\{ style: SystemBarsStyle.Light \}\)/);
  assert.doesNotMatch(app, /@capacitor\/status-bar|setBackgroundColor|setOverlaysWebView/);
  assert.equal(JSON.parse(read('package.json')).dependencies['@capacitor/status-bar'], undefined);
  const css = read('src/styles.css');
  for (const edge of ['top', 'right', 'bottom', 'left']) {
    assert.ok(css.replace(/\s+/g, "").includes(`var(--safe-area-inset-${edge},env(safe-area-inset-${edge},0px))`));
  }
  assert.match(read('index.html'), /viewport-fit=cover/);
  const theme = read('android/app/src/main/res/values/styles.xml');
  assert.match(theme, /Theme.AppCompat.Light.NoActionBar/);
  assert.match(theme, /android:windowBackground">#f7f8fa/);
});
