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
- JDK 21 or newer
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

To build a debug APK from the command line:

```bash
npm.cmd run android:debug
```

The verified debug APK output is:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

On the current Windows machine, a portable JDK 21 is installed at `C:\Users\42008\.local\jdks\jdk-21.0.11+10`, and Android SDK command-line tools are installed at `C:\Users\42008\Android\Sdk`. The debug APK build was verified successfully on 2026-04-30.

## Release APK

For local distribution or repeated installation on the same Android devices, use a signed release APK.

Create the local signing key once:

```bash
powershell -ExecutionPolicy Bypass -File scripts/create-android-keystore.ps1
```

Build the signed release APK:

```bash
npm.cmd run android:release
```

The release APK output is:

```text
android/app/build/outputs/apk/release/app-release.apk
```

Signing files are intentionally not committed:

- `C:\Users\42008\.local\lifelog\lifelog-release.p12`
- `android/keystore.properties`

Keep the release keystore backed up. Android treats packages signed with a different key as different upgrade lines, so losing the key means future builds cannot upgrade over the old installed app.

Install the release APK on a connected Android device:

```bash
npm.cmd run android:install:release
```

The device must have Developer options and USB debugging enabled. If the phone asks whether to allow USB debugging, approve it and run the install command again.

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

- Install the debug APK on an emulator or real Android device.
- Share the signed release APK for small-scope manual testing.
- Open the project with Android Studio and run on an emulator or real device.
- Add real PNG app icon and splash source files.
- Verify IndexedDB persistence in Android WebView.
- Decide whether location/map features use external links first or native plugins.
- Defer iOS packaging until a macOS/Xcode environment is available.
