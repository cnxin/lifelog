import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../models/lifelog_models.dart';
import '../providers/providers.dart';
import '../theme/app_theme.dart';
import '../widgets/glass_card.dart';

class MemoryDetailPage extends ConsumerWidget {
  final String memoryId;
  const MemoryDetailPage({super.key, required this.memoryId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final memories = ref.watch(memoriesProvider).valueOrNull ?? [];
    final people = ref.watch(peopleProvider).valueOrNull ?? [];
    final places = ref.watch(placesProvider).valueOrNull ?? [];
    final colors = AppColors.fromStyle(ref.watch(themeStyleProvider));
    final memory = memories.where((m) => m.id == memoryId).firstOrNull;

    if (memory == null) return GradientBackground(colors: colors, child: const Scaffold(body: Center(child: Text('记忆不存在'))));
    final personNames = people.where((p) => memory.personIds.contains(p.id)).map((p) => p.name).toList();
    final place = places.where((p) => p.id == memory.placeId).firstOrNull;

    return GradientBackground(colors: colors, isDark: ref.watch(themeModeProvider), child: Scaffold(body: CustomScrollView(slivers: [
      SliverToBoxAdapter(child: SafeArea(bottom: false, child: Padding(padding: const EdgeInsets.fromLTRB(8, 8, 8, 0), child: Row(children: [
        IconButton(icon: Icon(Icons.arrow_back_ios_new, size: 20, color: colors.textMain), onPressed: () => context.pop()),
        const Spacer(),
        IconButton(icon: Icon(Icons.edit, color: colors.textSub), onPressed: () => context.push('/memories/${memory.id}/edit')),
        IconButton(icon: Icon(Icons.delete_outline, color: colors.textSub), onPressed: () => _delete(context, ref, memory)),
      ])))),
      SliverPadding(padding: const EdgeInsets.fromLTRB(24, 8, 24, 120), sliver: SliverList(delegate: SliverChildListDelegate([
        Container(height: 120, decoration: BoxDecoration(borderRadius: BorderRadius.circular(28), gradient: colors.primaryGradient, boxShadow: [colors.avatarShadow]), child: const Icon(Icons.auto_stories_rounded, color: Colors.white, size: 46)),
        const SizedBox(height: 20),
        Text(memory.title, style: TextStyle(fontFamily: 'Outfit', fontSize: 26, fontWeight: FontWeight.w700, color: colors.textMain)),
        const SizedBox(height: 8),
        Wrap(spacing: 8, runSpacing: 6, children: [_Tag(label: memory.mood, colors: colors, accent: true), ...memory.tags.map((tag) => _Tag(label: tag, colors: colors))]),
        const SizedBox(height: 18),
        _InfoCard(title: '日期', icon: Icons.calendar_today_rounded, colors: colors, child: Text(memory.date, style: TextStyle(color: colors.textMain))),
        if (personNames.isNotEmpty) _InfoCard(title: '相关人物', icon: Icons.people_rounded, colors: colors, child: Text(personNames.join('、'), style: TextStyle(color: colors.textMain))),
        if (place != null) _InfoCard(title: '地点', icon: Icons.place_rounded, colors: colors, child: Text(place.name, style: TextStyle(color: colors.textMain))),
        if (memory.photos.isNotEmpty) _InfoCard(title: '照片', icon: Icons.photo_library_rounded, colors: colors, child: _PhotoGrid(photos: memory.photos, colors: colors)),
        if (memory.content.isNotEmpty) _InfoCard(title: '内容', icon: Icons.notes_rounded, colors: colors, child: Text(memory.content, style: TextStyle(color: colors.textMain, height: 1.55))),
      ]))),
    ])));
  }

  void _delete(BuildContext context, WidgetRef ref, MemoryEvent memory) {
    showDialog(context: context, builder: (ctx) => AlertDialog(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)), title: const Text('确认删除'), content: Text('确定要删除 ${memory.title} 吗？'), actions: [
      TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('取消')),
      TextButton(onPressed: () { ref.read(memoriesProvider.notifier).deleteMemory(memory.id); Navigator.pop(ctx); context.pop(); }, style: TextButton.styleFrom(foregroundColor: const Color(0xFFE17055)), child: const Text('删除')),
    ]));
  }
}

class _InfoCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final AppColors colors;
  final Widget child;
  const _InfoCard({required this.title, required this.icon, required this.colors, required this.child});

  @override
  Widget build(BuildContext context) => Padding(padding: const EdgeInsets.only(bottom: 12), child: GlassCard(colors: colors, padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Row(children: [Icon(icon, size: 18, color: colors.primary), const SizedBox(width: 8), Text(title, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: colors.primary))]),
    const SizedBox(height: 12), child,
  ])));
}

class _PhotoGrid extends StatelessWidget {
  final List<String> photos;
  final AppColors colors;

  const _PhotoGrid({required this.photos, required this.colors});

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: photos.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 3, crossAxisSpacing: 8, mainAxisSpacing: 8),
      itemBuilder: (_, index) => ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: Container(
          color: colors.softPurple,
          child: _isLocalFile(photos[index])
              ? Image.file(
                  File(photos[index]),
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => Icon(Icons.broken_image_rounded, color: colors.primary),
                )
              : Image.network(
                  photos[index],
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => Icon(Icons.broken_image_rounded, color: colors.primary),
                ),
        ),
      ),
    );
  }

  bool _isLocalFile(String path) {
    return path.startsWith('/') || path.contains(':\\') || !path.startsWith('http');
  }
}

class _Tag extends StatelessWidget {
  final String label;
  final AppColors colors;
  final bool accent;
  const _Tag({required this.label, required this.colors, this.accent = false});
  @override
  Widget build(BuildContext context) => Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5), decoration: BoxDecoration(color: accent ? colors.softOrange : colors.softPurple, borderRadius: BorderRadius.circular(999)), child: Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: accent ? const Color(0xFFE17055) : colors.primary)));
}
