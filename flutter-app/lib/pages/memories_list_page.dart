import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../models/lifelog_models.dart';
import '../models/person.dart';
import '../providers/providers.dart';
import '../theme/app_theme.dart';
import '../widgets/glass_card.dart';

class MemoriesListPage extends ConsumerStatefulWidget {
  const MemoriesListPage({super.key});

  @override
  ConsumerState<MemoriesListPage> createState() => _MemoriesListPageState();
}

class _MemoriesListPageState extends ConsumerState<MemoriesListPage> {
  final _searchController = TextEditingController();
  @override
  void dispose() { _searchController.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final memoriesAsync = ref.watch(memoriesProvider);
    final people = ref.watch(peopleProvider).valueOrNull ?? [];
    final places = ref.watch(placesProvider).valueOrNull ?? [];
    final query = ref.watch(memorySearchQueryProvider);
    final colors = AppColors.fromStyle(ref.watch(themeStyleProvider));
    final theme = Theme.of(context);

    return Stack(children: [
      Column(children: [
        SafeArea(bottom: false, child: Padding(padding: const EdgeInsets.fromLTRB(24, 16, 24, 0), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('记忆', style: theme.textTheme.headlineLarge),
          const SizedBox(height: 16),
          _SearchBox(controller: _searchController, query: query, hint: '搜索标题、内容、心情...', colors: colors, onChanged: (value) { ref.read(memorySearchQueryProvider.notifier).state = value; ref.read(memoriesProvider.notifier).search(value); }, onClear: () { _searchController.clear(); ref.read(memorySearchQueryProvider.notifier).state = ''; ref.read(memoriesProvider.notifier).search(''); }),
          const SizedBox(height: 16),
        ]))),
        Expanded(child: memoriesAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(child: Text('$e')),
          data: (memories) => ListView.separated(
            padding: const EdgeInsets.fromLTRB(24, 0, 24, 120),
            itemCount: memories.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (_, i) => _MemoryCard(memory: memories[i], people: people, places: places, colors: colors, colorVariant: i),
          ),
        )),
      ]),
      Positioned(right: 24, bottom: MediaQuery.of(context).padding.bottom + 100, child: GradientFAB(colors: colors, onPressed: () => context.push('/memories/new'))),
    ]);
  }
}

class _MemoryCard extends StatelessWidget {
  final MemoryEvent memory;
  final List<Person> people;
  final List<Place> places;
  final AppColors colors;
  final int colorVariant;
  const _MemoryCard({required this.memory, required this.people, required this.places, required this.colors, required this.colorVariant});

  @override
  Widget build(BuildContext context) {
    final personNames = people.where((p) => memory.personIds.contains(p.id)).map((p) => p.name).toList();
    final place = places.where((p) => p.id == memory.placeId).firstOrNull;
    return GlassCard(colors: colors, onTap: () => context.push('/memories/${memory.id}'), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Container(width: 58, height: 58, decoration: BoxDecoration(borderRadius: BorderRadius.circular(18), gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: colorVariant.isEven ? [colors.primary, colors.secondary] : [const Color(0xFF35C7D0), colors.primary]), boxShadow: [colors.avatarShadow]), child: const Icon(Icons.favorite_border_rounded, color: Colors.white, size: 28)),
      const SizedBox(width: 14),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(memory.title, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: colors.textMain)),
        const SizedBox(height: 5),
        Text(memory.date, style: TextStyle(fontSize: 12, color: colors.textSub)),
        const SizedBox(height: 8),
        if (personNames.isNotEmpty || place != null) Text([if (personNames.isNotEmpty) personNames.join('、'), if (place != null) place.name].join(' · '), style: TextStyle(fontSize: 12, color: colors.textSub), maxLines: 1, overflow: TextOverflow.ellipsis),
        if (memory.content.isNotEmpty) ...[const SizedBox(height: 8), Text(memory.content, style: TextStyle(fontSize: 13, color: colors.textMain, height: 1.35), maxLines: 2, overflow: TextOverflow.ellipsis)],
        const SizedBox(height: 8),
        Wrap(spacing: 6, runSpacing: 4, children: [
          _Pill(label: memory.mood, colors: colors, accent: true),
          ...memory.tags.take(3).map((tag) => _Pill(label: tag, colors: colors)),
        ]),
      ])),
      Icon(Icons.chevron_right, size: 20, color: colors.textSub.withAlpha(100)),
    ]));
  }
}

class _SearchBox extends StatelessWidget {
  final TextEditingController controller;
  final String query;
  final String hint;
  final AppColors colors;
  final ValueChanged<String> onChanged;
  final VoidCallback onClear;
  const _SearchBox({required this.controller, required this.query, required this.hint, required this.colors, required this.onChanged, required this.onClear});

  @override
  Widget build(BuildContext context) => ClipRRect(borderRadius: BorderRadius.circular(16), child: BackdropFilter(filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12), child: Container(padding: const EdgeInsets.symmetric(horizontal: 16), decoration: BoxDecoration(color: colors.cardBg, borderRadius: BorderRadius.circular(16), boxShadow: [colors.shadow]), child: Row(children: [
    Icon(Icons.search, size: 20, color: colors.textSub), const SizedBox(width: 12), Expanded(child: TextField(controller: controller, style: TextStyle(fontSize: 15, color: colors.textMain), decoration: InputDecoration(hintText: hint, hintStyle: TextStyle(color: colors.textSub, fontSize: 15), border: InputBorder.none, filled: false, contentPadding: const EdgeInsets.symmetric(vertical: 14)), onChanged: onChanged)), if (query.isNotEmpty) GestureDetector(onTap: onClear, child: Icon(Icons.close, size: 18, color: colors.textSub)),
  ]))));
}

class _Pill extends StatelessWidget {
  final String label;
  final AppColors colors;
  final bool accent;
  const _Pill({required this.label, required this.colors, this.accent = false});

  @override
  Widget build(BuildContext context) => Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4), decoration: BoxDecoration(color: accent ? colors.softOrange : colors.softPurple, borderRadius: BorderRadius.circular(999)), child: Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: accent ? const Color(0xFFE17055) : colors.primary)));
}
