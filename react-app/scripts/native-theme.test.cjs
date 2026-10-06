const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loadTs } = require('./load-ts.cjs');

async function withShell({ dark = false, background = true, reject = false }, check) {
  const effects = [], styles = [], colors = [], listeners = new Set();
  let removed = false;
  const query = { matches: dark, addEventListener: (_, fn) => listeners.add(fn), removeEventListener: (_, fn) => listeners.delete(fn) };
  const originals = Object.fromEntries(['document', 'matchMedia', 'getComputedStyle'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  globalThis.document = { documentElement: {} };
  globalThis.matchMedia = value => { assert.equal(value, '(prefers-color-scheme: dark)'); return query; };
  globalThis.getComputedStyle = () => ({ getPropertyValue: key => {
    assert.equal(key, '--bg'); return query.matches ? '#15191a' : '#f7f8fa';
  } });
  const SystemBars = {
    setStyle: options => { styles.push(options.style); return reject ? Promise.reject(new Error('unsupported')) : Promise.resolve(); },
    ...(background ? { setBackgroundColor: options => { colors.push(options.color); return reject ? Promise.reject(new Error('unsupported')) : Promise.resolve(); } } : {}),
  };
  try {
    const { default: useNativeShell } = loadTs('src/hooks/useNativeShell.ts', {
      react: { useRef: () => ({ current: false }), useEffect: fn => effects.push(fn) },
      '@capacitor/core': { Capacitor: { isNativePlatform: () => true }, SystemBars, SystemBarsStyle: { Dark: 'DARK', Light: 'LIGHT' } },
      '@capacitor/app': { App: { addListener: async () => ({ remove: async () => { removed = true; } }) } },
      '../notifications': { hasNativeNotifications: () => false }, '../domain': { todayKey: () => '2026-10-06' },
    });
    useNativeShell({ headerRef: {}, sortMenuOpen: false, setSortMenuOpen() {}, load: async () => {}, setToday() {}, setNativeSyncTick() {}, setWidgetLaunchTick() {} });
    const cleanup = effects.at(-1)();
    await check({ styles, colors, change: value => { query.matches = value; for (const fn of listeners) fn(); } });
    cleanup();
    assert.equal(listeners.size, 0, 'theme listener removed');
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(removed, 'existing native back listener cleaned up');
  } finally {
    for (const [key, descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
  }
}

test('native bars follow initial system theme and subsequent changes, then unsubscribe', async () => {
  await withShell({ dark: true }, async ({ styles, colors, change }) => {
    assert.deepEqual(styles, ['DARK']); assert.deepEqual(colors, []);
    change(false); assert.deepEqual(styles, ['DARK', 'LIGHT']); assert.deepEqual(colors, []);
  });
});
test('a core without the optional background API still updates bar content', async () => {
  await withShell({ background: false }, async ({ styles, colors, change }) => {
    change(true); assert.deepEqual(styles, ['LIGHT', 'DARK']); assert.deepEqual(colors, []);
  });
});
test('the installed core has no background setter, so the night resource is the supported fallback', () => {
  const declarations = fs.readFileSync('node_modules/@capacitor/core/types/core-plugins.d.ts', 'utf8');
  const plugin = declarations.slice(declarations.indexOf('export interface SystemBarsPlugin'), declarations.indexOf('export declare class SystemBarsPluginWeb'));
  assert.doesNotMatch(plugin, /setBackgroundColor/);
  assert.match(fs.readFileSync('node_modules/@capacitor/android/capacitor/src/main/java/com/getcapacitor/plugin/SystemBars.java', 'utf8'), /getThemeColor\(getContext\(\), android.R.attr.windowBackground\)/);
});
test('unsupported native API rejection does not break theme changes or cleanup', async () => {
  await withShell({ reject: true }, async ({ styles, change }) => {
    change(true); await new Promise(resolve => setImmediate(resolve)); assert.deepEqual(styles, ['LIGHT', 'DARK']);
  });
});

test('widget light/night color resources match names, preserve light values and meet dark text contrast', () => {
  const read = qualifier => new Map([...fs.readFileSync(`android/app/src/main/res/${qualifier}/colors.xml`, 'utf8')
    .matchAll(/<color name="([^"]+)">(#[\da-f]+)<\/color>/gi)].map(([, key, value]) => [key, value.toLowerCase()]));
  const light = read('values'), dark = read('values-night');
  assert.deepEqual([...light.keys()], [...dark.keys()]);
  assert.equal(light.get('widget_day_text'), '#303530'); assert.equal(light.get('widget_day_count'), '#465b45');
  for (const [tone, value] of [['rose', '#f3e4e0'], ['amber', '#f4ebda'], ['sage', '#e7ece3']]) {
    assert.equal(light.get(`widget_day_${tone}`), value);
    assert.match(fs.readFileSync(`android/app/src/main/res/drawable/widget_day_${tone}.xml`, 'utf8'), new RegExp(`@color/widget_day_${tone}`));
  }
  const luminance = value => {
    const c = value.slice(1).match(/../g).map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
  };
  for (const foreground of ['widget_day_text', 'widget_day_count']) for (const tone of ['rose', 'amber', 'sage']) {
    const levels = [luminance(dark.get(foreground)), luminance(dark.get(`widget_day_${tone}`))].sort((a, b) => a - b);
    assert.ok((levels[1] + .05) / (levels[0] + .05) >= 4.5, `${foreground}/${tone}`);
  }
  assert.doesNotMatch(fs.readFileSync('android/app/src/main/res/layout/widget_day.xml', 'utf8'), /android:textColor="#/);
  assert.match(fs.readFileSync('android/app/src/main/res/values-night/styles.xml', 'utf8'), /android:windowBackground">@color\/lifelog_background/);
});
