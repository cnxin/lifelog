const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const tokens = fs.readFileSync(path.join(root, 'src/styles/00-tokens.css'), 'utf8');
const [light, dark] = tokens.split('@media (prefers-color-scheme: dark)');
const palette = text => new Map([...text.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, key, value]) => [key, value.trim()]));
const lightValues = palette(light), darkValues = palette(dark);

test('all CSS color literals live in the shared palette, not component rules', () => {
  for (const file of fs.readdirSync(path.join(root, 'src/styles')).filter(file => file.endsWith('.css') && file !== '00-tokens.css')) {
    const css = fs.readFileSync(path.join(root, 'src/styles', file), 'utf8');
    assert.doesNotMatch(css, /#[\da-f]{3,8}\b|rgba?\(|(?:color|background)\s*:\s*(?:white|black)\b/i, file);
  }
});

test('every literal light palette role has an explicit dark override', () => {
  for (const [key, value] of lightValues) {
    if (/^#|^rgba?\(/.test(value)) assert.ok(darkValues.has(key), key);
  }
  assert.match(light, /color-scheme: light dark;/);
  for (const key of ['bg', 'surface', 'surface-2', 'text', 'muted', 'border', 'border-strong', 'green', 'accent', 'shadow',
    'rose-bg', 'rose-fg', 'rose-deep', 'amber-bg', 'amber-fg', 'amber-deep', 'sage-bg', 'sage-fg', 'sage-deep']) {
    assert.ok(lightValues.has(key) && darkValues.has(key), key);
  }
});

function luminance(value) {
  const channels = value.slice(1).match(/../g).map(v => parseInt(v, 16) / 255)
    .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}
function resolved(key) {
  const value = darkValues.get(key) || lightValues.get(key);
  return value.startsWith('var(') ? resolved(value.match(/var\(--([\w-]+)\)/)[1]) : value;
}
test('dark text, tones and solid focus ring meet contrast thresholds', () => {
  for (const [foreground, backgrounds, threshold] of [
    ['text', ['bg', 'surface', 'surface-2', 'rose-bg', 'amber-bg', 'sage-bg'], 4.5],
    ['muted', ['bg', 'surface', 'surface-2', 'control-selected'], 4.5],
    ['green', ['bg', 'surface', 'button-face', 'control-selected'], 4.5],
    ['rose-fg', ['rose-bg', 'rose-soft'], 4.5], ['amber-fg', ['amber-bg', 'amber-soft'], 4.5],
    ['sage-fg', ['sage-bg', 'sage-soft'], 4.5], ['on-green', ['green', 'green-hover', 'toast-bg'], 4.5],
    ['sage-fg', ['bg', 'surface', 'surface-2'], 3],
  ]) for (const background of backgrounds) {
    const levels = [luminance(resolved(foreground)), luminance(resolved(background))].sort((a, b) => a - b);
    assert.ok((levels[1] + .05) / (levels[0] + .05) >= threshold, `${foreground}/${background} >= ${threshold}:1`);
  }
});

test('browser theme-color follows the system while the manifest stays light', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /name="theme-color" media="\(prefers-color-scheme: light\)" content="#f7f8fa"/);
  assert.match(html, /name="theme-color" media="\(prefers-color-scheme: dark\)" content="#15191a"/);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public/manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.background_color, '#f7f8fa');
  assert.equal(manifest.theme_color, '#f7f8fa');
});
