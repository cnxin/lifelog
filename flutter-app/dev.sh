#!/bin/bash

# LifeLog Flutter Demo - 开发辅助脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# 检查 Flutter 是否安装
check_flutter() {
    if ! command -v flutter &> /dev/null; then
        print_error "Flutter 未安装或不在 PATH 中"
        echo "请访问 https://flutter.dev/docs/get-started/install 安装 Flutter"
        exit 1
    fi
    print_success "Flutter 已安装"
}

# 显示帮助信息
show_help() {
    echo "LifeLog Flutter Demo - 开发辅助脚本"
    echo ""
    echo "用法: ./dev.sh [命令]"
    echo ""
    echo "命令:"
    echo "  setup       - 初始化项目（安装依赖、生成代码）"
    echo "  run         - 运行应用（Web）"
    echo "  test        - 运行测试"
    echo "  analyze     - 代码分析"
    echo "  format      - 格式化代码"
    echo "  clean       - 清理构建缓存"
    echo "  generate    - 生成 Drift 代码"
    echo "  coverage    - 生成测试覆盖率报告"
    echo "  doctor      - 检查开发环境"
    echo "  upgrade     - 更新依赖"
    echo "  help        - 显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  ./dev.sh setup      # 初始化项目"
    echo "  ./dev.sh run        # 运行应用"
    echo "  ./dev.sh test       # 运行测试"
}

# 初始化项目
setup_project() {
    print_info "初始化项目..."

    print_info "1/3 安装依赖..."
    flutter pub get
    print_success "依赖安装完成"

    print_info "2/3 生成 Drift 代码..."
    flutter pub run build_runner build --delete-conflicting-outputs
    print_success "代码生成完成"

    print_info "3/3 运行代码分析..."
    flutter analyze
    print_success "代码分析完成"

    print_success "项目初始化完成！"
    echo ""
    echo "下一步："
    echo "  运行应用: ./dev.sh run"
    echo "  运行测试: ./dev.sh test"
}

# 运行应用
run_app() {
    print_info "运行应用（Web）..."
    flutter run -d chrome
}

# 运行测试
run_tests() {
    print_info "运行测试..."
    flutter test --reporter expanded

    if [ $? -eq 0 ]; then
        print_success "所有测试通过"
    else
        print_error "测试失败"
        exit 1
    fi
}

# 代码分析
analyze_code() {
    print_info "运行代码分析..."
    flutter analyze --fatal-infos

    if [ $? -eq 0 ]; then
        print_success "代码分析通过"
    else
        print_error "代码分析发现问题"
        exit 1
    fi
}

# 格式化代码
format_code() {
    print_info "格式化代码..."
    dart format .
    print_success "代码格式化完成"
}

# 清理构建
clean_build() {
    print_info "清理构建缓存..."
    flutter clean
    print_success "清理完成"
}

# 生成 Drift 代码
generate_code() {
    print_info "生成 Drift 代码..."
    flutter pub run build_runner build --delete-conflicting-outputs
    print_success "代码生成完成"
}

# 生成测试覆盖率
generate_coverage() {
    print_info "运行测试并生成覆盖率..."
    flutter test --coverage

    if [ $? -eq 0 ]; then
        print_success "测试完成"

        if command -v lcov &> /dev/null; then
            print_info "生成 HTML 报告..."
            genhtml coverage/lcov.info -o coverage/html
            print_success "覆盖率报告已生成: coverage/html/index.html"

            # 尝试打开报告
            if command -v xdg-open &> /dev/null; then
                xdg-open coverage/html/index.html
            elif command -v open &> /dev/null; then
                open coverage/html/index.html
            fi
        else
            print_warning "lcov 未安装，无法生成 HTML 报告"
            echo "安装 lcov: sudo apt-get install lcov (Linux) 或 brew install lcov (macOS)"
        fi
    else
        print_error "测试失败"
        exit 1
    fi
}

# 检查开发环境
check_doctor() {
    print_info "检查开发环境..."
    flutter doctor -v
}

# 更新依赖
upgrade_deps() {
    print_info "检查过期依赖..."
    flutter pub outdated

    echo ""
    read -p "是否更新所有依赖？(y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "更新依赖..."
        flutter pub upgrade

        print_info "重新生成 Drift 代码..."
        flutter pub run build_runner build --delete-conflicting-outputs

        print_success "依赖更新完成"
    else
        print_info "取消更新"
    fi
}

# 主函数
main() {
    # 检查 Flutter
    check_flutter

    # 解析命令
    case "${1:-help}" in
        setup)
            setup_project
            ;;
        run)
            run_app
            ;;
        test)
            run_tests
            ;;
        analyze)
            analyze_code
            ;;
        format)
            format_code
            ;;
        clean)
            clean_build
            ;;
        generate)
            generate_code
            ;;
        coverage)
            generate_coverage
            ;;
        doctor)
            check_doctor
            ;;
        upgrade)
            upgrade_deps
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "未知命令: $1"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# 运行主函数
main "$@"
