import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:uuid/uuid.dart';
import '../models/lifelog_models.dart';
import '../providers/providers.dart';
import '../theme/app_theme.dart';
import '../widgets/glass_card.dart';
import '../services/photo_service.dart';

class MemoryFormPage extends ConsumerStatefulWidget {
  final String? memoryId;
  const MemoryFormPage({super.key, this.memoryId});

  @override
  ConsumerState<MemoryFormPage> createState() => _MemoryFormPageState();
}

class _MemoryFormPageState extends ConsumerState<MemoryFormPage> {
  final _title = TextEditingController();
  final _content = TextEditingController();
  final _tags = TextEditingController();
  String _date = DateTime.now().toIso8601String().substring(0, 10);
  String _mood = '日常';
  String _placeId = '';
  final Set<String> _personIds = {};
  List<String> _photosPaths = [];
  static const moods = ['日常', '开心', '轻松', '愉快', '感动', '难忘'];
  bool get isEditing => widget.memoryId != null;

  @override
  void initState() { super.initState(); if (isEditing) WidgetsBinding.instance.addPostFrameCallback((_) => _load()); }
  void _load() {
    final memory = ref.read(memoriesProvider).valueOrNull?.where((m) => m.id == widget.memoryId).firstOrNull;
    if (memory == null) return;
    _title.text = memory.title; _content.text = memory.content; _tags.text = memory.tags.join('，');
    setState(() { _date = memory.date; _mood = memory.mood; _placeId = memory.placeId; _personIds.addAll(memory.personIds); _photosPaths = List.from(memory.photos); });
  }
  @override
  void dispose() { _title.dispose(); _content.dispose(); _tags.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.fromStyle(ref.watch(themeStyleProvider));
    final people = ref.watch(peopleProvider).valueOrNull ?? [];
    final places = ref.watch(placesProvider).valueOrNull ?? [];
    return GradientBackground(colors: colors, isDark: ref.watch(themeModeProvider), child: Scaffold(body: SafeArea(child: Column(children: [
      Padding(padding: const EdgeInsets.fromLTRB(8, 8, 8, 0), child: Row(children: [
        IconButton(icon: Icon(Icons.arrow_back_ios_new, size: 20, color: colors.textMain), onPressed: () => context.pop()), const Spacer(),
        Text(isEditing ? '编辑记忆' : '新建记忆', style: TextStyle(fontFamily: 'Outfit', fontSize: 18, fontWeight: FontWeight.w600, color: colors.textMain)), const Spacer(),
        GestureDetector(onTap: _save, child: Container(padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8), decoration: BoxDecoration(gradient: colors.primaryGradient, borderRadius: BorderRadius.circular(14)), child: const Text('保存', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)))), const SizedBox(width: 8),
      ])),
      Expanded(child: ListView(padding: const EdgeInsets.fromLTRB(24, 16, 24, 40), children: [
        _Input(label: '标题 *', controller: _title, icon: Icons.title_rounded, colors: colors), const SizedBox(height: 16),
        Text('日期', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: colors.textSub)), const SizedBox(height: 8),
        GlassCard(colors: colors, onTap: _pickDate, child: Row(children: [Icon(Icons.calendar_today_rounded, size: 18, color: colors.primary), const SizedBox(width: 12), Text(_date, style: TextStyle(color: colors.textMain)), const Spacer(), Icon(Icons.chevron_right, color: colors.textSub)])), const SizedBox(height: 16),
        Text('心情', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: colors.textSub)), const SizedBox(height: 8),
        Wrap(spacing: 8, runSpacing: 8, children: moods.map((m) => _Choice(label: m, selected: m == _mood, colors: colors, onTap: () => setState(() => _mood = m))).toList()), const SizedBox(height: 16),
        Text('相关人物', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: colors.textSub)), const SizedBox(height: 8),
        Wrap(spacing: 8, runSpacing: 8, children: people.map((p) => _Choice(label: p.name, selected: _personIds.contains(p.id), colors: colors, onTap: () => setState(() { if (_personIds.contains(p.id)) { _personIds.remove(p.id); } else { _personIds.add(p.id); } }))).toList()), const SizedBox(height: 16),
        Text('地点', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: colors.textSub)), const SizedBox(height: 8),
        Wrap(spacing: 8, runSpacing: 8, children: places.map((p) => _Choice(label: p.name, selected: _placeId == p.id, colors: colors, onTap: () => setState(() => _placeId = _placeId == p.id ? '' : p.id))).toList()), const SizedBox(height: 16),
        _Input(label: '标签（逗号分隔）', controller: _tags, icon: Icons.sell_rounded, colors: colors), const SizedBox(height: 16),
        Text('照片', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: colors.textSub)), const SizedBox(height: 8),
        _PhotoPicker(photos: _photosPaths, colors: colors, onAdd: _addPhotos, onRemove: _removePhoto), const SizedBox(height: 16),
        _Input(label: '内容', controller: _content, icon: Icons.notes_rounded, colors: colors, maxLines: 5),
      ])),
    ]))));
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(context: context, initialDate: DateTime.tryParse(_date) ?? DateTime.now(), firstDate: DateTime(2000), lastDate: DateTime(2100));
    if (picked != null) setState(() => _date = '${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}');
  }

  void _save() {
    if (_title.text.trim().isEmpty) return;
    final tags = _tags.text.split(RegExp(r'[,，]')).map((s) => s.trim()).where((s) => s.isNotEmpty).toList();
    ref.read(memoriesProvider.notifier).saveMemory(MemoryEvent(id: widget.memoryId ?? const Uuid().v4(), title: _title.text.trim(), date: _date, personIds: _personIds.toList(), placeId: _placeId, mood: _mood, content: _content.text.trim(), tags: tags, photos: _photosPaths));
    context.pop();
  }

  Future<void> _addPhotos() async {
    final paths = await PhotoService().pickMultiplePhotos();
    if (paths.isNotEmpty) {
      setState(() => _photosPaths.addAll(paths));
    }
  }

  void _removePhoto(int index) {
    setState(() => _photosPaths.removeAt(index));
  }
}

class _Input extends StatelessWidget {
  final String label; final TextEditingController controller; final IconData icon; final AppColors colors; final int maxLines;
  const _Input({required this.label, required this.controller, required this.icon, required this.colors, this.maxLines = 1});
  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: colors.textSub)), const SizedBox(height: 8), GlassCard(colors: colors, padding: EdgeInsets.zero, child: TextField(controller: controller, maxLines: maxLines, style: TextStyle(color: colors.textMain), decoration: InputDecoration(prefixIcon: Icon(icon, color: colors.textSub, size: 20), border: InputBorder.none, filled: false, contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14))))]);
}

class _Choice extends StatelessWidget {
  final String label; final bool selected; final AppColors colors; final VoidCallback onTap;
  const _Choice({required this.label, required this.selected, required this.colors, required this.onTap});
  @override
  Widget build(BuildContext context) => GestureDetector(onTap: onTap, child: AnimatedContainer(duration: const Duration(milliseconds: 160), padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9), decoration: BoxDecoration(gradient: selected ? colors.primaryGradient : null, color: selected ? null : colors.cardBg, borderRadius: BorderRadius.circular(999), border: selected ? null : Border.all(color: colors.line), boxShadow: [colors.shadow]), child: Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: selected ? Colors.white : colors.textMain))));
}

class _PhotoPicker extends StatelessWidget {
  final List<String> photos;
  final AppColors colors;
  final VoidCallback onAdd;
  final void Function(int) onRemove;

  const _PhotoPicker({required this.photos, required this.colors, required this.onAdd, required this.onRemove});

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      colors: colors,
      padding: const EdgeInsets.all(12),
      child: Column(
        children: [
          if (photos.isNotEmpty)
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: photos.length,
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 3,
                crossAxisSpacing: 8,
                mainAxisSpacing: 8,
              ),
              itemBuilder: (_, index) => Stack(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Image.file(
                      File(photos[index]),
                      width: double.infinity,
                      height: double.infinity,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => Container(
                        color: colors.softPurple,
                        child: Icon(Icons.broken_image_rounded, color: colors.primary),
                      ),
                    ),
                  ),
                  Positioned(
                    top: 4,
                    right: 4,
                    child: GestureDetector(
                      onTap: () => onRemove(index),
                      child: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: Colors.black54,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.close, color: Colors.white, size: 16),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          if (photos.isNotEmpty) const SizedBox(height: 12),
          GestureDetector(
            onTap: onAdd,
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(
                border: Border.all(color: colors.line, width: 2, style: BorderStyle.solid),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.add_photo_alternate_rounded, color: colors.primary, size: 20),
                  const SizedBox(width: 8),
                  Text('添加照片', style: TextStyle(color: colors.primary, fontWeight: FontWeight.w600)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
