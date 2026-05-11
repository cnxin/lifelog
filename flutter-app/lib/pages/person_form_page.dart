import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:uuid/uuid.dart';
import '../providers/providers.dart';
import '../models/person.dart';
import '../theme/app_theme.dart';
import '../widgets/glass_card.dart';

class PersonFormPage extends ConsumerStatefulWidget {
  final String? personId;
  const PersonFormPage({super.key, this.personId});

  @override
  ConsumerState<PersonFormPage> createState() => _PersonFormPageState();
}

class _PersonFormPageState extends ConsumerState<PersonFormPage> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _nicknameController = TextEditingController();
  final _notesController = TextEditingController();

  String _relationship = '朋友';
  String? _birthday;
  bool _birthdayIsLunar = false;
  bool _favorite = false;
  final List<PreferenceGroup> _preferences = [];
  final List<PreferenceGroup> _dislikes = [];
  final List<Anniversary> _anniversaries = [];

  bool get isEditing => widget.personId != null;
  static const relationships = ['朋友', '家人', '同事', '同学', '恋人', '其他'];

  @override
  void initState() {
    super.initState();
    if (isEditing) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _loadPerson());
    }
  }

  void _loadPerson() {
    final people = ref.read(peopleProvider).valueOrNull;
    final person = people?.where((p) => p.id == widget.personId).firstOrNull;
    if (person == null) return;
    _nameController.text = person.name;
    _nicknameController.text = person.nickname;
    _notesController.text = person.notes;
    setState(() {
      _relationship = person.relationship;
      _birthday = person.birthday;
      _birthdayIsLunar = person.birthdayIsLunar;
      _favorite = person.favorite;
      _preferences.addAll(person.preferences);
      _dislikes.addAll(person.dislikes);
      _anniversaries.addAll(person.anniversaries);
    });
  }

  @override
  void dispose() {
    _nameController.dispose();
    _nicknameController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final style = ref.watch(themeStyleProvider);
    final isDark = ref.watch(themeModeProvider);
    final colors = AppColors.fromStyle(style);

    return GradientBackground(
      colors: colors,
      isDark: isDark,
      child: Scaffold(
        body: SafeArea(
          child: Column(
            children: [
              // Top bar
              Padding(
                padding: const EdgeInsets.fromLTRB(8, 8, 8, 0),
                child: Row(
                  children: [
                    IconButton(
                      icon: Icon(Icons.arrow_back_ios_new, size: 20, color: colors.textMain),
                      onPressed: () => context.pop(),
                    ),
                    const Spacer(),
                    Text(
                      isEditing ? '编辑人物' : '新建人物',
                      style: TextStyle(fontFamily: 'Outfit', fontSize: 18, fontWeight: FontWeight.w600, color: colors.textMain),
                    ),
                    const Spacer(),
                    GestureDetector(
                      onTap: _save,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        decoration: BoxDecoration(
                          gradient: colors.primaryGradient,
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: const Text('保存', style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600)),
                      ),
                    ),
                    const SizedBox(width: 8),
                  ],
                ),
              ),

              Expanded(
                child: Form(
                  key: _formKey,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(24, 16, 24, 40),
                    children: [
                      // 名字
                      _FieldLabel(label: '姓名', colors: colors, required: true),
                      const SizedBox(height: 8),
                      GlassCard(
                        colors: colors,
                        padding: EdgeInsets.zero,
                        child: TextFormField(
                          controller: _nameController,
                          style: TextStyle(fontSize: 15, color: colors.textMain),
                          decoration: InputDecoration(
                            hintText: '输入姓名',
                            prefixIcon: Icon(Icons.person, size: 20, color: colors.textSub),
                            border: InputBorder.none,
                            filled: false,
                            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                          ),
                          validator: (v) => (v == null || v.trim().isEmpty) ? '请输入姓名' : null,
                        ),
                      ),
                      const SizedBox(height: 16),

                      // 昵称
                      _FieldLabel(label: '昵称', colors: colors),
                      const SizedBox(height: 8),
                      GlassCard(
                        colors: colors,
                        padding: EdgeInsets.zero,
                        child: TextFormField(
                          controller: _nicknameController,
                          style: TextStyle(fontSize: 15, color: colors.textMain),
                          decoration: InputDecoration(
                            hintText: '输入昵称（可选）',
                            prefixIcon: Icon(Icons.badge, size: 20, color: colors.textSub),
                            border: InputBorder.none,
                            filled: false,
                            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),

                      // 关系
                      _FieldLabel(label: '关系', colors: colors),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: relationships.map((r) {
                          final selected = r == _relationship;
                          return GestureDetector(
                            onTap: () => setState(() => _relationship = r),
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 160),
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                              decoration: BoxDecoration(
                                gradient: selected ? colors.primaryGradient : null,
                                color: selected ? null : colors.cardBg,
                                borderRadius: BorderRadius.circular(999),
                                border: selected ? null : Border.all(color: colors.line),
                                boxShadow: selected ? [colors.fabShadow] : [colors.shadow],
                              ),
                              child: Text(
                                r,
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: selected ? Colors.white : colors.textMain,
                                ),
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                      const SizedBox(height: 16),

                      // 生日
                      _FieldLabel(label: '生日', colors: colors),
                      const SizedBox(height: 8),
                      GlassCard(
                        colors: colors,
                        onTap: _pickBirthday,
                        child: Row(
                          children: [
                            Icon(Icons.cake, size: 20, color: colors.primary),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                _birthday ?? '选择日期',
                                style: TextStyle(
                                  fontSize: 15,
                                  color: _birthday != null ? colors.textMain : colors.textSub,
                                ),
                              ),
                            ),
                            if (_birthday != null)
                              GestureDetector(
                                onTap: () => setState(() => _birthdayIsLunar = !_birthdayIsLunar),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                  decoration: BoxDecoration(
                                    color: colors.softPurple,
                                    borderRadius: BorderRadius.circular(999),
                                  ),
                                  child: Text(
                                    _birthdayIsLunar ? '农历' : '公历',
                                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: colors.primary),
                                  ),
                                ),
                              ),
                            const SizedBox(width: 4),
                            Icon(Icons.chevron_right, size: 20, color: colors.textSub),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),

                      // 收藏
                      GlassCard(
                        colors: colors,
                        onTap: () => setState(() => _favorite = !_favorite),
                        child: Row(
                          children: [
                            Icon(
                              _favorite ? Icons.star_rounded : Icons.star_outline_rounded,
                              size: 22,
                              color: _favorite ? const Color(0xFFFDCB6E) : colors.textSub,
                            ),
                            const SizedBox(width: 12),
                            Text('收藏', style: TextStyle(fontSize: 15, color: colors.textMain)),
                            const Spacer(),
                            AnimatedContainer(
                              duration: const Duration(milliseconds: 200),
                              width: 44,
                              height: 26,
                              padding: const EdgeInsets.all(3),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(13),
                                color: _favorite ? colors.primary : colors.line,
                              ),
                              alignment: _favorite ? Alignment.centerRight : Alignment.centerLeft,
                              child: Container(
                                width: 20,
                                height: 20,
                                decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),

                      // 喜好
                      _GroupEditor(title: '喜好', icon: Icons.favorite_rounded, groups: _preferences, colors: colors, onChanged: () => setState(() {})),
                      const SizedBox(height: 16),

                      // 禁忌
                      _GroupEditor(title: '禁忌', icon: Icons.block_rounded, groups: _dislikes, colors: colors, isDislike: true, onChanged: () => setState(() {})),
                      const SizedBox(height: 24),

                      // 备注
                      _FieldLabel(label: '备注', colors: colors),
                      const SizedBox(height: 8),
                      GlassCard(
                        colors: colors,
                        padding: EdgeInsets.zero,
                        child: TextFormField(
                          controller: _notesController,
                          style: TextStyle(fontSize: 15, color: colors.textMain),
                          maxLines: 3,
                          decoration: InputDecoration(
                            hintText: '添加备注...',
                            prefixIcon: Padding(
                              padding: const EdgeInsets.only(bottom: 40),
                              child: Icon(Icons.note, size: 20, color: colors.textSub),
                            ),
                            border: InputBorder.none,
                            filled: false,
                            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _pickBirthday() async {
    final initial = _birthday != null ? DateTime.tryParse(_birthday!) : null;
    final picked = await showDatePicker(
      context: context,
      initialDate: initial ?? DateTime(2000, 1, 1),
      firstDate: DateTime(1920),
      lastDate: DateTime.now(),
    );
    if (picked != null) {
      setState(() {
        _birthday = '${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
      });
    }
  }

  void _save() {
    if (!_formKey.currentState!.validate()) return;
    final person = Person(
      id: widget.personId ?? const Uuid().v4(),
      name: _nameController.text.trim(),
      nickname: _nicknameController.text.trim(),
      relationship: _relationship,
      birthday: _birthday,
      birthdayIsLunar: _birthdayIsLunar,
      favorite: _favorite,
      preferences: _preferences,
      dislikes: _dislikes,
      anniversaries: _anniversaries,
      notes: _notesController.text.trim(),
    );
    if (isEditing) {
      ref.read(peopleProvider.notifier).updatePerson(person);
    } else {
      ref.read(peopleProvider.notifier).addPerson(person);
    }
    context.pop();
  }
}

class _FieldLabel extends StatelessWidget {
  final String label;
  final AppColors colors;
  final bool required;

  const _FieldLabel({required this.label, required this.colors, this.required = false});

  @override
  Widget build(BuildContext context) {
    return Text(
      required ? '$label *' : label,
      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: colors.textSub),
    );
  }
}

class _GroupEditor extends StatelessWidget {
  final String title;
  final IconData icon;
  final List<PreferenceGroup> groups;
  final AppColors colors;
  final bool isDislike;
  final VoidCallback onChanged;

  const _GroupEditor({
    required this.title,
    required this.icon,
    required this.groups,
    required this.colors,
    this.isDislike = false,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 18, color: colors.primary),
            const SizedBox(width: 8),
            Text(title, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: colors.primary)),
            const Spacer(),
            GestureDetector(
              onTap: () => _addGroup(context),
              child: Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(color: colors.softPurple, borderRadius: BorderRadius.circular(10)),
                child: Icon(Icons.add, size: 18, color: colors.primary),
              ),
            ),
          ],
        ),
        if (groups.isEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text('点击 + 添加$title', style: TextStyle(fontSize: 13, color: colors.textSub)),
          ),
        ...groups.asMap().entries.map((entry) {
          final idx = entry.key;
          final group = entry.value;
          return Padding(
            padding: const EdgeInsets.only(top: 8),
            child: GlassCard(
              colors: colors,
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(group.category, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: colors.textMain)),
                      const Spacer(),
                      GestureDetector(
                        onTap: () { groups.removeAt(idx); onChanged(); },
                        child: Icon(Icons.close, size: 16, color: colors.textSub),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      ...group.items.map((item) => Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: isDislike ? colors.softOrange : colors.softPurple,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(item, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: isDislike ? const Color(0xFFE17055) : colors.primary)),
                            const SizedBox(width: 4),
                            GestureDetector(
                              onTap: () {
                                groups[idx] = PreferenceGroup(category: group.category, items: [...group.items]..remove(item));
                                if (groups[idx].items.isEmpty) groups.removeAt(idx);
                                onChanged();
                              },
                              child: Icon(Icons.close, size: 12, color: isDislike ? const Color(0xFFE17055) : colors.primary),
                            ),
                          ],
                        ),
                      )),
                      GestureDetector(
                        onTap: () => _addItem(context, idx),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            border: Border.all(color: colors.line),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text('+', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: colors.textSub)),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        }),
      ],
    );
  }

  void _addGroup(BuildContext context) {
    final catCtrl = TextEditingController();
    final itemCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('添加$title分类'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: catCtrl, decoration: const InputDecoration(labelText: '分类名称'), autofocus: true),
            const SizedBox(height: 12),
            TextField(controller: itemCtrl, decoration: const InputDecoration(labelText: '项目（逗号分隔）', hintText: '例: 蓝色, 黑色')),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('取消')),
          TextButton(
            onPressed: () {
              final cat = catCtrl.text.trim();
              final items = itemCtrl.text.split(RegExp(r'[,，]')).map((s) => s.trim()).where((s) => s.isNotEmpty).toList();
              if (cat.isNotEmpty && items.isNotEmpty) { groups.add(PreferenceGroup(category: cat, items: items)); onChanged(); }
              Navigator.pop(ctx);
            },
            child: const Text('添加'),
          ),
        ],
      ),
    );
  }

  void _addItem(BuildContext context, int groupIdx) {
    final ctrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('添加到 ${groups[groupIdx].category}'),
        content: TextField(
          controller: ctrl,
          decoration: const InputDecoration(labelText: '项目名称'),
          autofocus: true,
          onSubmitted: (_) {
            final text = ctrl.text.trim();
            if (text.isNotEmpty) { groups[groupIdx] = PreferenceGroup(category: groups[groupIdx].category, items: [...groups[groupIdx].items, text]); onChanged(); }
            Navigator.pop(ctx);
          },
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('取消')),
          TextButton(
            onPressed: () {
              final text = ctrl.text.trim();
              if (text.isNotEmpty) { groups[groupIdx] = PreferenceGroup(category: groups[groupIdx].category, items: [...groups[groupIdx].items, text]); onChanged(); }
              Navigator.pop(ctx);
            },
            child: const Text('添加'),
          ),
        ],
      ),
    );
  }
}
