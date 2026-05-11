# 运行 Drift 代码生成

echo "开始生成 Drift 数据库代码..."

# 清理旧的生成文件
if [ -f "lib/database/app_database.g.dart" ]; then
    rm lib/database/app_database.g.dart
    echo "已删除旧的生成文件"
fi

# 运行 build_runner
flutter pub run build_runner build --delete-conflicting-outputs

echo "代码生成完成！"
echo "生成的文件: lib/database/app_database.g.dart"
