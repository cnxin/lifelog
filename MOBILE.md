# Mobile Build Notes

LifeLog uses Capacitor to prepare native Android and iOS shells around the existing Vite production build.

## Current Scope

This repository currently includes:

- `@capacitor/core`
- `@capacitor/cli`
- `@capacitor/android`
- `capacitor.config.ts`
- `android/`
- npm scripts for adding, syncing, and opening native platforms

The Android native project has been generated. The iOS project is intentionally not generated yet because it requires macOS and Xcode.

## App Identity

- App ID: `com.cnxin.lifelog`
- App name: `LifeLog`
- Web output directory: `dist`
- Android scheme: `https`

## Android Flow

Prerequisites:

- Android Studio
- Android SDK
- JDK 17 or newer
- `ANDROID_HOME` or `ANDROID_SDK_ROOT` pointing to the Android SDK

Current generated Android versions:

- Android Gradle Plugin: `8.13.0`
- Gradle Wrapper: `8.14.3`
- minSdk: `24`
- compileSdk: `36`
- targetSdk: `36`

The Android project is already present, so the normal update flow is:

```bash
npm.cmd run build
npm.cmd run cap:sync
npm.cmd run cap:open:android
```

To build from the command line after Android Studio, SDK, and JDK 17 are installed:

```bash
npm.cmd run build
npm.cmd run cap:sync
cd android
gradlew.bat assembleDebug
```

On the current Windows machine, `gradlew.bat --version` works, but a full Android task/build was not completed because the command-line environment does not yet expose a complete Android SDK/JDK 17 setup. The detected Java runtime is JDK 15, and only `ANDROID_SDK_HOME=C:\Android` is set.

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

- Install or configure Android Studio, Android SDK, and JDK 17.
- Set `JAVA_HOME` and `ANDROID_HOME` or `ANDROID_SDK_ROOT`.
- Run `android\gradlew.bat assembleDebug`.
- Open the project with Android Studio and run on an emulator or real device.
- Add real PNG app icon and splash source files.
- Verify IndexedDB persistence in Android WebView.
- Decide whether location/map features use external links first or native plugins.
- Defer iOS packaging until a macOS/Xcode environment is available.
