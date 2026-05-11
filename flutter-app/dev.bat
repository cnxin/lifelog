@echo off
REM LifeLog Flutter Demo - Windows 开发辅助脚本

setlocal enabledelayedexpansion

REM 检查 Flutter 是否安装
where flutter >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Flutter 未安装或不在 PATH 中
    echo 请访问 https://flutter.dev/docs/get-started/install 安装 Flutter
    exit /b 1
)

REM 解析命令
if "%1"=="" goto :help
if "%1"=="setup" goto :setup
if "%1"=="run" goto :run
if "%1"=="test" goto :test
if "%1"=="analyze" goto :analyze
if "%1"=="format" goto :format
if "%1"=="clean" goto :clean
if "%1"=="generate" goto :generate
if "%1"=="coverage" goto :coverage
if "%1"=="doctor" goto :doctor
if "%1"=="upgrade" goto :upgrade
if "%1"=="help" goto :help
if "%1"=="--help" goto :help
if "%1"=="-h" goto :help

echo [ERROR] 未知命令: %1
echo.
goto :help

:help
echo LifeLog Flutter Demo - 开发辅助脚本
echo.
echo 用法: dev.bat [命令]
echo.
echo 命令:
echo   setup       - 初始化项目（安装依赖、生成代码）
echo   run         - 运行应用（Web）
echo   test        - 运行测试
echo   analyze     - 代码分析
echo   format      - 格式化代码
echo   clean       - 清理构建缓存
echo   generate    - 生成 Drift 代码
echo   coverage    - 生成测试覆盖率报告
echo   doctor      - 检查开发环境
echo   upgrade     - 更新依赖
echo   help        - 显示此帮助信息
echo.
echo 示例:
echo   dev.bat setup      # 初始化项目
echo   dev.bat run        # 运行应用
echo   dev.bat test       # 运行测试
exit /b 0

:setup
echo [INFO] 初始化项目...
echo.

echo [INFO] 1/3 安装依赖...
flutter pub get
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] 依赖安装失败
    exit /b 1
)
echo [SUCCESS] 依赖安装完成
echo.

echo [INFO] 2/3 生成 Drift 代码...
flutter pub run build_runner build --delete-conflicting-outputs
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] 代码生成失败
    exit /b 1
)
echo [SUCCESS] 代码生成完成
echo.

echo [INFO] 3/3 运行代码分析...
flutter analyze
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] 代码分析发现问题
) else (
    echo [SUCCESS] 代码分析完成
)
echo.

echo [SUCCESS] 项目初始化完成！
echo.
echo 下一步：
echo   运行应用: dev.bat run
echo   运行测试: dev.bat test
exit /b 0

:run
echo [INFO] 运行应用（Web）...
flutter run -d chrome
exit /b 0

:test
echo [INFO] 运行测试...
flutter test --reporter expanded
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] 所有测试通过
) else (
    echo [ERROR] 测试失败
    exit /b 1
)
exit /b 0

:analyze
echo [INFO] 运行代码分析...
flutter analyze --fatal-infos
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] 代码分析通过
) else (
    echo [ERROR] 代码分析发现问题
    exit /b 1
)
exit /b 0

:format
echo [INFO] 格式化代码...
dart format .
echo [SUCCESS] 代码格式化完成
exit /b 0

:clean
echo [INFO] 清理构建缓存...
flutter clean
echo [SUCCESS] 清理完成
exit /b 0

:generate
echo [INFO] 生成 Drift 代码...
flutter pub run build_runner build --delete-conflicting-outputs
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] 代码生成完成
) else (
    echo [ERROR] 代码生成失败
    exit /b 1
)
exit /b 0

:coverage
echo [INFO] 运行测试并生成覆盖率...
flutter test --coverage
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] 测试完成
    echo [INFO] 覆盖率文件已生成: coverage\lcov.info
    echo.
    echo 要生成 HTML 报告，请安装 lcov 并运行:
    echo   genhtml coverage\lcov.info -o coverage\html
) else (
    echo [ERROR] 测试失败
    exit /b 1
)
exit /b 0

:doctor
echo [INFO] 检查开发环境...
flutter doctor -v
exit /b 0

:upgrade
echo [INFO] 检查过期依赖...
flutter pub outdated
echo.

set /p REPLY="是否更新所有依赖？(y/N) "
if /i "%REPLY%"=="y" (
    echo [INFO] 更新依赖...
    flutter pub upgrade

    echo [INFO] 重新生成 Drift 代码...
    flutter pub run build_runner build --delete-conflicting-outputs

    echo [SUCCESS] 依赖更新完成
) else (
    echo [INFO] 取消更新
)
exit /b 0
