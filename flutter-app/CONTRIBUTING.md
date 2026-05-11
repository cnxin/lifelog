# 贡献指南

感谢您对 LifeLog Flutter Demo 项目的关注！我们欢迎各种形式的贡献。

## 目录

- [行为准则](#行为准则)
- [如何贡献](#如何贡献)
- [开发流程](#开发流程)
- [代码规范](#代码规范)
- [提交规范](#提交规范)
- [测试要求](#测试要求)
- [文档要求](#文档要求)

---

## 行为准则

参与本项目即表示您同意遵守以下准则：

- 尊重所有贡献者
- 接受建设性批评
- 关注对社区最有利的事情
- 对其他社区成员表现出同理心

---

## 如何贡献

### 报告 Bug

在提交 Bug 报告前，请先搜索现有的 [Issues](https://github.com/your-repo/lifelog-flutter-demo/issues) 确保问题未被报告。

**Bug 报告应包含：**

1. **标题**：简洁描述问题
2. **环境信息**：
   - Flutter 版本（`flutter --version`）
   - 操作系统和版本
   - 设备型号（如果是移动端）
3. **复现步骤**：详细的步骤说明
4. **期望行为**：应该发生什么
5. **实际行为**：实际发生了什么
6. **截图/日志**：如果适用
7. **可能的解决方案**：如果有想法

**示例：**

```markdown
## Bug: 照片选择器在 Android 13 上崩溃

**环境：**
- Flutter 3.41.9
- Android 13 (API 33)
- Pixel 6

**复现步骤：**
1. 打开地点表单页面
2. 点击"添加照片"按钮
3. 选择"从相册选择"
4. 应用崩溃

**期望行为：**
打开系统相册选择器

**实际行为：**
应用崩溃，logcat 显示权限错误

**日志：**
```
java.lang.SecurityException: Permission denied
```

**可能的解决方案：**
需要在运行时请求 READ_MEDIA_IMAGES 权限
```

### 提出新功能

在提交功能请求前，请先搜索现有的 Issues 确保功能未被提出。

**功能请求应包含：**

1. **标题**：简洁描述功能
2. **问题描述**：这个功能解决什么问题？
3. **建议的解决方案**：您希望如何实现？
4. **替代方案**：考虑过其他方案吗？
5. **附加信息**：截图、原型、参考链接等

**示例：**

```markdown
## Feature: 支持导出为 PDF

**问题描述：**
用户希望将记忆导出为 PDF 格式，方便打印和分享。

**建议的解决方案：**
1. 在设置页面添加"导出为 PDF"选项
2. 使用 pdf 包生成 PDF 文件
3. 包含照片、文本、日期等信息
4. 支持自定义模板

**替代方案：**
- 导出为 HTML 然后转 PDF
- 使用第三方 PDF 服务

**附加信息：**
参考 Day One 的导出功能
```

### 提交代码

1. **Fork 项目**
2. **创建特性分支**：`git checkout -b feature/amazing-feature`
3. **提交更改**：`git commit -m 'Add some amazing feature'`
4. **推送到分支**：`git push origin feature/amazing-feature`
5. **开启 Pull Request**

---

## 开发流程

### 1. 设置开发环境

```bash
# 克隆您的 fork
git clone https://github.com/your-username/lifelog-flutter-demo.git
cd lifelog-flutter-demo

# 添加上游仓库
git remote add upstream https://github.com/original-repo/lifelog-flutter-demo.git

# 安装依赖
flutter pub get

# 生成 Drift 代码
flutter pub run build_runner build --delete-conflicting-outputs

# 运行应用
flutter run -d chrome
```

### 2. 保持同步

```bash
# 获取上游更新
git fetch upstream

# 合并到本地 main
git checkout main
git merge upstream/main

# 推送到您的 fork
git push origin main
```

### 3. 创建特性分支

```bash
# 从最新的 main 创建分支
git checkout main
git pull upstream main
git checkout -b feature/your-feature-name
```

### 4. 开发和测试

```bash
# 运行测试
flutter test

# 代码分析
flutter analyze

# 格式化代码
dart format .

# 运行应用
flutter run
```

### 5. 提交更改

```bash
# 添加更改
git add .

# 提交（遵循提交规范）
git commit -m "feat: add amazing feature"

# 推送到您的 fork
git push origin feature/your-feature-name
```

### 6. 创建 Pull Request

1. 访问您的 fork 页面
2. 点击 "New Pull Request"
3. 选择 base: main ← compare: feature/your-feature-name
4. 填写 PR 模板（见下文）
5. 提交 PR

---

## 代码规范

### Dart 代码风格

遵循 [Effective Dart](https://dart.dev/guides/language/effective-dart) 指南：

```dart
// ✅ 好的命名
class PersonDetailPage extends StatelessWidget { }
final String userName = 'John';
void fetchUserData() { }

// ❌ 不好的命名
class person_detail_page extends StatelessWidget { }
final String user_name = 'John';
void FetchUserData() { }

// ✅ 使用 const 构造函数
const Text('Hello');
const SizedBox(height: 16);

// ❌ 不必要的 new
new Text('Hello');

// ✅ 使用级联操作符
final person = Person()
  ..name = 'John'
  ..age = 30;

// ✅ 使用 async/await
Future<void> loadData() async {
  final data = await fetchData();
  setState(() => _data = data);
}

// ❌ 使用 .then()
void loadData() {
  fetchData().then((data) {
    setState(() => _data = data);
  });
}
```

### 文件组织

```dart
// 1. Dart imports
import 'dart:async';
import 'dart:io';

// 2. Flutter imports
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

// 3. Package imports
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

// 4. Relative imports
import '../models/person.dart';
import '../services/database_helper.dart';
```

### Widget 结构

```dart
class MyWidget extends StatelessWidget {
  // 1. 构造函数参数
  const MyWidget({
    super.key,
    required this.title,
    this.subtitle,
  });

  // 2. 字段
  final String title;
  final String? subtitle;

  // 3. 静态常量
  static const double _padding = 16.0;

  // 4. build 方法
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(_padding),
      child: Column(
        children: [
          _buildTitle(),
          if (subtitle != null) _buildSubtitle(),
        ],
      ),
    );
  }

  // 5. 私有辅助方法
  Widget _buildTitle() {
    return Text(title);
  }

  Widget _buildSubtitle() {
    return Text(subtitle!);
  }
}
```

### 注释规范

```dart
// ✅ 好的注释：解释为什么
// 使用 debounce 避免频繁的数据库写入
final _debouncer = Debouncer(milliseconds: 500);

// ❌ 不好的注释：重复代码
// 设置名字为 John
final name = 'John';

/// 文档注释：公共 API
/// 
/// 从数据库加载所有人物数据。
/// 
/// 返回按创建时间降序排列的人物列表。
/// 如果数据库为空，返回空列表。
Future<List<Person>> loadPeople() async {
  // 实现...
}
```

### 错误处理

```dart
// ✅ 具体的错误处理
try {
  await saveData();
} on DatabaseException catch (e) {
  _showError('数据库错误：${e.message}');
} on NetworkException catch (e) {
  _showError('网络错误：${e.message}');
} catch (e) {
  _showError('未知错误：$e');
}

// ❌ 吞掉所有错误
try {
  await saveData();
} catch (e) {
  // 什么都不做
}
```

---

## 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

### 格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type 类型

- **feat**: 新功能
- **fix**: Bug 修复
- **docs**: 文档更新
- **style**: 代码格式（不影响功能）
- **refactor**: 重构（既不是新功能也不是 Bug 修复）
- **perf**: 性能优化
- **test**: 测试相关
- **chore**: 构建/工具相关

### Scope 范围（可选）

- **ui**: UI 相关
- **db**: 数据库相关
- **api**: API 相关
- **notification**: 通知相关
- **photo**: 照片相关

### 示例

```bash
# 新功能
git commit -m "feat(photo): add photo compression"

# Bug 修复
git commit -m "fix(db): resolve migration crash on Android 13"

# 文档
git commit -m "docs: update deployment guide"

# 重构
git commit -m "refactor(ui): extract GlassCard widget"

# 性能优化
git commit -m "perf(db): add index on created_at column"

# 带详细说明
git commit -m "feat(notification): add birthday reminders

- Schedule notifications 1 day before birthday
- Support timezone configuration
- Add notification permission request

Closes #123"
```

---

## 测试要求

### 单元测试

为所有业务逻辑编写单元测试：

```dart
// test/models/person_test.dart
void main() {
  group('Person', () {
    test('should serialize to JSON correctly', () {
      final person = Person(
        id: '1',
        name: 'John',
        tags: ['friend'],
      );

      final json = person.toJson();

      expect(json['id'], '1');
      expect(json['name'], 'John');
      expect(json['tags'], ['friend']);
    });

    test('should deserialize from JSON correctly', () {
      final json = {
        'id': '1',
        'name': 'John',
        'tags': ['friend'],
      };

      final person = Person.fromJson(json);

      expect(person.id, '1');
      expect(person.name, 'John');
      expect(person.tags, ['friend']);
    });
  });
}
```

### Widget 测试

为关键 UI 组件编写 Widget 测试：

```dart
// test/widgets/glass_card_test.dart
void main() {
  testWidgets('GlassCard should render child', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: GlassCard(
            child: Text('Test'),
          ),
        ),
      ),
    );

    expect(find.text('Test'), findsOneWidget);
  });
}
```

### 运行测试

```bash
# 运行所有测试
flutter test

# 运行特定测试文件
flutter test test/models/person_test.dart

# 生成覆盖率报告
flutter test --coverage
genhtml coverage/lcov.info -o coverage/html
```

### 测试覆盖率要求

- 新功能：至少 80% 覆盖率
- Bug 修复：必须包含回归测试
- 重构：保持或提高现有覆盖率

---

## 文档要求

### 代码文档

```dart
/// 人物数据模型
///
/// 表示应用中的一个联系人，包含基本信息、标签、
/// 重要日期等。
class Person {
  /// 创建一个新的人物实例
  ///
  /// [name] 是必需的，其他字段可选。
  /// [id] 如果未提供，将自动生成 UUID。
  Person({
    String? id,
    required this.name,
    this.tags = const [],
  }) : id = id ?? const Uuid().v4();

  /// 唯一标识符
  final String id;

  /// 人物姓名
  final String name;

  /// 标签列表（如：朋友、家人、同事）
  final List<String> tags;
}
```

### README 更新

如果您的更改影响用户使用方式，请更新 README.md：

- 新功能：添加到功能列表
- 依赖变更：更新技术栈部分
- 配置变更：更新快速开始部分

### CHANGELOG 更新

在 CHANGELOG.md 中记录您的更改：

```markdown
## [Unreleased]

### Added
- 照片压缩功能，自动压缩大于 500KB 的图片

### Fixed
- 修复 Android 13 上照片选择器崩溃的问题

### Changed
- 将 minSdk 从 19 提升到 21
```

---

## Pull Request 模板

创建 PR 时，请填写以下信息：

```markdown
## 描述

简要描述这个 PR 做了什么。

## 相关 Issue

Closes #123

## 更改类型

- [ ] Bug 修复
- [ ] 新功能
- [ ] 重构
- [ ] 文档更新
- [ ] 性能优化
- [ ] 其他（请说明）

## 测试

描述您如何测试这些更改：

- [ ] 单元测试
- [ ] Widget 测试
- [ ] 手动测试（请描述步骤）

## 截图（如果适用）

添加截图展示 UI 更改。

## 检查清单

- [ ] 代码遵循项目的代码规范
- [ ] 已运行 `flutter analyze` 无警告
- [ ] 已运行 `flutter test` 所有测试通过
- [ ] 已添加/更新相关文档
- [ ] 已更新 CHANGELOG.md
- [ ] 提交信息遵循 Conventional Commits 规范
- [ ] 已在真机/模拟器上测试

## 附加信息

其他需要说明的信息。
```

---

## 代码审查流程

### 审查者职责

- 在 48 小时内响应 PR
- 提供建设性反馈
- 检查代码质量、测试、文档
- 批准或请求更改

### 贡献者职责

- 及时响应审查意见
- 解释设计决策
- 更新代码以解决反馈
- 保持 PR 范围小而专注

### 审查标准

**必须满足：**
- [ ] 代码功能正确
- [ ] 测试充分
- [ ] 文档完整
- [ ] 无明显性能问题
- [ ] 无安全漏洞

**建议满足：**
- [ ] 代码简洁易读
- [ ] 遵循最佳实践
- [ ] 考虑边界情况
- [ ] 错误处理完善

---

## 发布流程

### 版本号规则

遵循 [Semantic Versioning](https://semver.org/)：

- **主版本号**：不兼容的 API 更改
- **次版本号**：向后兼容的新功能
- **修订号**：向后兼容的 Bug 修复

### 发布步骤

1. 更新 `pubspec.yaml` 版本号
2. 更新 `CHANGELOG.md`
3. 创建 release 分支：`git checkout -b release/v1.1.0`
4. 运行完整测试套件
5. 创建 Git tag：`git tag v1.1.0`
6. 推送 tag：`git push origin v1.1.0`
7. 在 GitHub 创建 Release
8. 构建并发布到各平台

---

## 获取帮助

如果您有任何问题：

1. 查看 [README.md](README.md) 和其他文档
2. 搜索现有的 [Issues](https://github.com/your-repo/lifelog-flutter-demo/issues)
3. 在 [Discussions](https://github.com/your-repo/lifelog-flutter-demo/discussions) 提问
4. 加入我们的社区（如果有）

---

## 致谢

感谢所有贡献者！您的贡献让这个项目变得更好。

---

**再次感谢您的贡献！** ❤️
