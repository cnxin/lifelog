@echo off
REM LifeLog Flutter Demo - Windows 构建脚本

echo ==========================================
echo LifeLog Flutter Demo - 构建脚本
echo ==========================================
echo.

REM 检查 Flutter 是否安装
where flutter >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Flutter 未安装或不在 PATH 中
    echo 请先安装 Flutter: https://flutter.dev/docs/get-started/install
    exit /b 1
)

echo ✅ Flutter 已安装
flutter --version
echo.

REM 1. 清理旧的构建
echo 📦 步骤 1/6: 清理旧的构建...
flutter clean
echo ✅ 清理完成
echo.

REM 2. 获取依赖
echo 📦 步骤 2/6: 获取依赖...
flutter pub get
if %ERRORLEVEL% NEQ 0 (
    echo ❌ 依赖获取失败
    exit /b 1
)
echo ✅ 依赖获取完成
echo.

REM 3. 生成 Drift 代码
echo 📦 步骤 3/6: 生成 Drift 数据库代码...
flutter pub run build_runner build --delete-conflicting-outputs
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Drift 代码生成失败
    exit /b 1
)
echo ✅ Drift 代码生成完成
echo.

REM 4. 运行测试
echo 📦 步骤 4/6: 运行测试...
flutter test
if %ERRORLEVEL% NEQ 0 (
    echo ⚠️  测试失败，但继续构建
) else (
    echo ✅ 测试通过
)
echo.

REM 5. 代码分析
echo 📦 步骤 5/6: 代码分析...
flutter analyze
if %ERRORLEVEL% NEQ 0 (
    echo ⚠️  代码分析发现问题，但继续构建
) else (
    echo ✅ 代码分析通过
)
echo.

REM 6. 构建（根据参数选择平台）
echo 📦 步骤 6/6: 构建应用...

if "%1"=="web" (
    echo 构建 Web 版本...
    flutter build web --release
    echo ✅ Web 构建完成: build\web\
) else if "%1"=="android" (
    echo 构建 Android APK...
    flutter build apk --release
    echo ✅ Android 构建完成: build\app\outputs\flutter-apk\app-release.apk
) else if "%1"=="all" (
    echo 构建所有平台...
    flutter build web --release
    flutter build apk --release
    echo ✅ 所有平台构建完成
) else (
    echo 用法: build.bat [web^|android^|all]
    echo 示例: build.bat web
    exit /b 1
)

echo.
echo ==========================================
echo ✅ 构建完成！
echo ==========================================
