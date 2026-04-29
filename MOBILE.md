# Mobile Build Notes

LifeLog uses Capacitor to prepare native Android and iOS shells around the existing Vite production build.

## Current Scope

This repository currently includes:

- `@capacitor/core`
- `@capacitor/cli`
- `capacitor.config.ts`
- npm scripts for adding, syncing, and opening native platforms

The native `android/` and `ios/` folders are intentionally not generated yet. Generate them only on machines with the required platform toolchain installed.

## App Identity

- App ID: `com.cnxin.lifelog`
- App name: `LifeLog`
- Web output directory: `dist`
- Android scheme: `https`

## Android Flow

Prerequisites:

- Android Studio
- Android SDK
- JDK compatible with the installed Android Gradle plugin

Commands:

```bash
npm.cmd run build
npm.cmd run cap:add:android
npm.cmd run cap:sync
npm.cmd run cap:open:android
```

After the native Android project exists, the normal update flow is:

```bash
npm.cmd run build
npm.cmd run cap:sync
npm.cmd run cap:open:android
```

## iOS Flow

Prerequisites:

- macOS
- Xcode
- Apple Developer account for device testing or App Store distribution

Commands on macOS:

```bash
npm run build
npm run cap:add:ios
npm run cap:sync
npm run cap:open:ios
```

## Icons And Splash Assets

Native icon and splash assets should be prepared as PNG files before store packaging.

Recommended source files:

```text
assets/icon.png
assets/splash.png
```

The optional `@capacitor/assets` package is not kept in the project because its current dependency tree reports high-severity audit warnings from downstream packages. Use Android Studio and Xcode asset catalogs directly, or add a clean asset-generation tool later if needed.

## Data And Platform Notes

- App data currently lives in IndexedDB through Dexie.
- PWA service worker is registered only in production builds.
- For native builds, test IndexedDB persistence after app upgrades before storing real user data.
- Location, camera, photo library, contacts, and push notification features should be added through Capacitor plugins only when the product flow requires them.

## Recommended Next Mobile Tasks

- Generate Android project locally after Android Studio is installed.
- Add real PNG app icon and splash source files.
- Verify IndexedDB persistence in Android WebView.
- Decide whether location/map features use external links first or native plugins.
- Defer iOS packaging until a macOS/Xcode environment is available.
