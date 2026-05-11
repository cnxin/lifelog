# SQLite Migration Guide

## 概述
已从 SharedPreferences (JSON) 迁移到 Drift (SQLite)，提供更好的性能和数据完整性。

## 自动迁移
首次启动时，系统会自动检测 SharedPreferences 中的旧数据并迁移到 SQLite。旧数据会保留为备份（`lifelog_state_backup`）。

## 生成 Drift 代码

运行以下命令生成 Drift 数据库代码：

```bash
# 方式1：一次性生成
flutter pub run build_runner build --delete-conflicting-outputs

# 方式2：监听模式（开发时推荐）
flutter pub run build_runner watch --delete-conflicting-outputs
```

这会生成 `lib/database/app_database.g.dart` 文件。

## 数据库结构

### People 表
- id (自增主键)
- uuid (唯一标识)
- name, relation, birthday, anniversary
- phone, email, address, notes
- tags, photos (JSON 数组)
- favorite (布尔值)
- createdAt (时间戳)

### Places 表
- id (自增主键)
- uuid (唯一标识)
- name, province, city, area, mall, storeName
- category, rating, address
- mapUrl, sourceUrl, platformLinks (JSON)
- desc, tags, photos (JSON 数组)
- favorite (布尔值)
- createdAt (时间戳)

### Memories 表
- id (自增主键)
- uuid (唯一标识)
- title, date
- personIds, placeId (关联)
- mood, content
- tags, photos (JSON 数组)
- createdAt (时间戳)

## 数据库文件位置

- **Android**: `/data/data/com.cnxin.lifelog_flutter_demo/app_flutter/lifelog.db`
- **iOS**: `~/Library/Application Support/lifelog.db`
- **Web**: IndexedDB (Drift 自动处理)

## API 保持不变

DatabaseHelper 的公共 API 完全兼容，无需修改调用代码：

```dart
// 所有操作保持不变
await db.getAllPeople();
await db.savePerson(person);
await db.deletePerson(id);
await db.searchPeople(query);
// ... 等等
```

## 性能提升

- **查询速度**: 10-100倍提升（取决于数据量）
- **搜索**: 支持索引，大数据集下显著提升
- **并发**: 支持多线程读写
- **内存**: 不需要一次性加载所有数据

## 回滚方案

如果需要回滚到 SharedPreferences：

1. 恢复旧文件：
```bash
mv lib/database/database_helper_old.dart lib/database/database_helper.dart
```

2. 删除 Drift 相关文件：
```bash
rm lib/database/app_database.dart
rm lib/database/tables.dart
rm lib/database/app_database.g.dart
```

3. 从 pubspec.yaml 移除 Drift 依赖

## 故障排查

### 生成代码失败
```bash
# 清理后重新生成
flutter clean
flutter pub get
flutter pub run build_runner build --delete-conflicting-outputs
```

### 数据库锁定
```dart
// 关闭数据库连接
await database.close();
```

### 迁移失败
旧数据会保留在 SharedPreferences 的 `lifelog_state_backup` 键中，可以手动恢复。

## 注意事项

1. **首次运行需要生成代码**：必须先运行 `build_runner`
2. **数据自动迁移**：首次启动会自动迁移，无需手动操作
3. **备份保留**：旧数据会保留为备份，不会丢失
4. **Web 支持**：Drift 在 Web 上使用 IndexedDB，功能完整
