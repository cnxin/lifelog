# LifeLog PWA Notes

LifeLog uses a hand-written PWA setup because the current Vite 8 dependency is ahead of the stable `vite-plugin-pwa` peer range.

## Included

- `public/manifest.webmanifest`
- `public/icon.svg`
- `public/sw.js`
- `src/registerServiceWorker.ts`

The service worker is registered only in production builds.

## Local Test

```bash
npm.cmd run build
npm.cmd run preview
```

Then open the preview URL in a browser and check:

- Application → Manifest
- Application → Service Workers
- Offline reload

