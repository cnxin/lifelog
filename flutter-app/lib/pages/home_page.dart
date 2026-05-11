import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../providers/providers.dart';
import '../models/person.dart';
import '../models/lifelog_models.dart';
import '../theme/app_theme.dart';
import '../widgets/glass_card.dart';

class HomePage extends ConsumerWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final peopleAsync = ref.watch(peopleProvider);
    final placesAsync = ref.watch(placesProvider);
    final memoriesAsync = ref.watch(memoriesProvider);
    final style = ref.watch(themeStyleProvider);
    final colors = AppColors.fromStyle(style);

    final people = peopleAsync.valueOrNull;
    final places = placesAsync.valueOrNull;
    final memories = memoriesAsync.valueOrNull;

    if (people == null || places == null || memories == null) {
      if (peopleAsync.hasError) return Center(child: Text('${peopleAsync.error}'));
      if (placesAsync.hasError) return Center(child: Text('${placesAsync.error}'));
      if (memoriesAsync.hasError) return Center(child: Text('${memoriesAsync.error}'));
      return const Center(child: CircularProgressIndicator());
    }

    return _DashboardView(people: people, places: places, memories: memories, colors: colors);
  }
}

class _DashboardView extends StatelessWidget {
  final List<Person> people;
  final List<Place> places;
  final List<MemoryEvent> memories;
  final AppColors colors;

  const _DashboardView({
    required this.people,
    required this.places,
    required this.memories,
    required this.colors,
  });

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final upcoming = _getUpcomingBirthdays(people, now);
    final favoritePeople = people.where((p) => p.favorite).toList();
    final favoritePlaces = places.where((p) => p.favorite).toList();
    final recentMemories = memories.take(3).toList();
    final theme = Theme.of(context);

    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(
          child: SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 20),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          DateFormat('yyyy年M月d日 EEEE', 'zh_CN').format(now).toUpperCase(),
                          style: theme.textTheme.labelMedium,
                        ),
                        const SizedBox(height: 6),
                        Text(_getGreeting(now), style: theme.textTheme.headlineLarge),
                        const SizedBox(height: 4),
                        Text(
                          '记录 ${people.length} 位重要的人、${places.length} 个地点、${memories.length} 段回忆',
                          style: theme.textTheme.bodyMedium,
                        ),
                      ],
                    ),
                  ),
                  GradientAvatar(name: 'L', size: 48, colors: colors),
                ],
              ),
            ),
          ),
        ),
        if (upcoming.isNotEmpty)
          SliverToBoxAdapter(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(24, 0, 24, 12),
                  child: _SectionHeader(title: '近期生日', icon: Icons.cake, colors: colors),
                ),
                SizedBox(
                  height: 120,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    itemCount: upcoming.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 16),
                    itemBuilder: (_, i) => _AnniversaryCard(
                      entry: upcoming[i],
                      colors: colors,
                      isSecondary: i.isOdd,
                    ),
                  ),
                ),
              ],
            ),
          ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
            child: _SectionHeader(title: '概览', icon: Icons.dashboard_rounded, colors: colors),
          ),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 12, 24, 0),
            child: GlassCard(
              colors: colors,
              padding: const EdgeInsets.all(14),
              child: Column(
                children: [
                  Row(
                    children: [
                      _MetricTile(value: '${people.length}', label: '人物', bgColor: colors.softPurple, colors: colors),
                      const SizedBox(width: 10),
                      _MetricTile(value: '${places.length}', label: '地点', bgColor: colors.softOrange, colors: colors),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      _MetricTile(value: '${memories.length}', label: '记忆', bgColor: colors.softPurple, colors: colors),
                      const SizedBox(width: 10),
                      _MetricTile(
                        value: '${favoritePeople.length + favoritePlaces.length}',
                        label: '收藏',
                        bgColor: colors.softOrange,
                        colors: colors,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 16, 24, 0),
            child: Row(
              children: [
                Expanded(child: _QuickMemoryCard(colors: colors)),
                const SizedBox(width: 12),
                _CalendarShortcut(colors: colors),
              ],
            ),
          ),
        ),
        if (favoritePeople.isNotEmpty) ...[
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 28, 24, 12),
              child: _SectionHeader(title: '收藏人物', icon: Icons.star_rounded, colors: colors),
            ),
          ),
          SliverToBoxAdapter(
            child: SizedBox(
              height: 100,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 24),
                itemCount: favoritePeople.length,
                separatorBuilder: (_, __) => const SizedBox(width: 16),
                itemBuilder: (_, i) => _FavoriteItem(person: favoritePeople[i], colors: colors, colorVariant: i),
              ),
            ),
          ),
        ],
        if (favoritePlaces.isNotEmpty) ...[
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 28, 24, 12),
              child: _SectionHeader(title: '收藏地点', icon: Icons.place_rounded, colors: colors),
            ),
          ),
          SliverToBoxAdapter(
            child: SizedBox(
              height: 112,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 24),
                itemCount: favoritePlaces.length,
                separatorBuilder: (_, __) => const SizedBox(width: 14),
                itemBuilder: (_, i) => _FavoritePlaceCard(place: favoritePlaces[i], colors: colors, colorVariant: i),
              ),
            ),
          ),
        ],
        if (recentMemories.isNotEmpty) ...[
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 28, 24, 12),
              child: _SectionHeader(title: '最近回忆', icon: Icons.auto_stories_rounded, colors: colors),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            sliver: SliverList.separated(
              itemCount: recentMemories.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (_, i) => _RecentMemoryCard(
                memory: recentMemories[i],
                people: people,
                places: places,
                colors: colors,
              ),
            ),
          ),
        ],
        const SliverToBoxAdapter(child: SizedBox(height: 120)),
      ],
    );
  }

  String _getGreeting(DateTime now) {
    final hour = now.hour;
    if (hour < 6) return '夜深了';
    if (hour < 12) return '早上好';
    if (hour < 18) return '下午好';
    return '晚上好';
  }

  List<_UpcomingBirthday> _getUpcomingBirthdays(List<Person> people, DateTime now) {
    final results = <_UpcomingBirthday>[];
    for (final person in people) {
      if (person.birthday == null) continue;
      try {
        final bd = DateTime.parse(person.birthday!);
        var next = DateTime(now.year, bd.month, bd.day);
        if (next.isBefore(now)) next = DateTime(now.year + 1, bd.month, bd.day);
        final days = next.difference(DateTime(now.year, now.month, now.day)).inDays;
        if (days <= 60) results.add(_UpcomingBirthday(person: person, daysUntil: days));
      } catch (_) {}
    }
    results.sort((a, b) => a.daysUntil.compareTo(b.daysUntil));
    return results;
  }
}

class _UpcomingBirthday {
  final Person person;
  final int daysUntil;
  const _UpcomingBirthday({required this.person, required this.daysUntil});
}

class _SectionHeader extends StatelessWidget {
  final String title;
  final IconData icon;
  final AppColors colors;

  const _SectionHeader({required this.title, required this.icon, required this.colors});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 20, color: colors.primary),
        const SizedBox(width: 8),
        Text(
          title,
          style: TextStyle(
            fontFamily: 'Outfit',
            fontSize: 18,
            fontWeight: FontWeight.w600,
            color: colors.textMain,
          ),
        ),
      ],
    );
  }
}

class _AnniversaryCard extends StatelessWidget {
  final _UpcomingBirthday entry;
  final AppColors colors;
  final bool isSecondary;

  const _AnniversaryCard({required this.entry, required this.colors, this.isSecondary = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 148,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: isSecondary ? colors.secondaryGradient : colors.primaryToLightGradient,
        boxShadow: [colors.shadow],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            '${entry.person.name} 的生日',
            style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w500),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                entry.daysUntil == 0 ? '今天!' : '${entry.daysUntil}',
                style: const TextStyle(
                  fontFamily: 'Outfit',
                  color: Colors.white,
                  fontSize: 28,
                  fontWeight: FontWeight.w700,
                ),
              ),
              if (entry.daysUntil > 0) ...[
                const SizedBox(width: 4),
                const Text('天后', style: TextStyle(color: Colors.white70, fontSize: 13)),
              ],
            ],
          ),
          Text(entry.person.birthday ?? '', style: const TextStyle(color: Colors.white70, fontSize: 12)),
        ],
      ),
    );
  }
}

class _MetricTile extends StatelessWidget {
  final String value;
  final String label;
  final Color bgColor;
  final AppColors colors;

  const _MetricTile({required this.value, required this.label, required this.bgColor, required this.colors});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        constraints: const BoxConstraints(minHeight: 76),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: bgColor, borderRadius: BorderRadius.circular(16)),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              value,
              style: TextStyle(
                fontFamily: 'Outfit',
                fontSize: 24,
                fontWeight: FontWeight.w700,
                color: colors.primary,
              ),
            ),
            const SizedBox(height: 2),
            Text(label, style: TextStyle(fontSize: 12, color: colors.textSub)),
          ],
        ),
      ),
    );
  }
}

class _QuickMemoryCard extends StatelessWidget {
  final AppColors colors;
  const _QuickMemoryCard({required this.colors});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.go('/memories/new'),
      child: Container(
        constraints: const BoxConstraints(minHeight: 82),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(22),
          gradient: colors.primaryGradient,
          boxShadow: [BoxShadow(color: colors.primary.withAlpha(41), blurRadius: 26, offset: const Offset(0, 14))],
        ),
        child: const Row(
          children: [
            _QuickMemoryIcon(),
            SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('快速记录', style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w600)),
                  SizedBox(height: 4),
                  Text('记录一个新的回忆...', style: TextStyle(color: Colors.white70, fontSize: 13)),
                ],
              ),
            ),
            Icon(Icons.arrow_forward_ios, color: Colors.white70, size: 16),
          ],
        ),
      ),
    );
  }
}

class _QuickMemoryIcon extends StatelessWidget {
  const _QuickMemoryIcon();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(16)),
      child: const Icon(Icons.edit_note_rounded, color: Colors.white, size: 22),
    );
  }
}

class _CalendarShortcut extends StatelessWidget {
  final AppColors colors;
  const _CalendarShortcut({required this.colors});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.go('/calendar'),
      child: Container(
        width: 82,
        height: 82,
        decoration: BoxDecoration(
          color: colors.cardBg,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: colors.line),
          boxShadow: [colors.shadow],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.calendar_month_rounded, color: colors.primary, size: 26),
            const SizedBox(height: 6),
            Text('日历', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: colors.textMain)),
          ],
        ),
      ),
    );
  }
}

class _FavoriteItem extends StatelessWidget {
  final Person person;
  final AppColors colors;
  final int colorVariant;

  const _FavoriteItem({required this.person, required this.colors, required this.colorVariant});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        GradientAvatar(
          name: person.name,
          size: 60,
          borderRadius: 20,
          fontSize: 22,
          colors: colors,
          colorVariant: colorVariant,
        ),
        const SizedBox(height: 8),
        Text(person.name, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: colors.textMain)),
      ],
    );
  }
}

class _FavoritePlaceCard extends StatelessWidget {
  final Place place;
  final AppColors colors;
  final int colorVariant;

  const _FavoritePlaceCard({required this.place, required this.colors, required this.colorVariant});

  @override
  Widget build(BuildContext context) {
    final gradients = [colors.primaryGradient, colors.secondaryGradient, colors.primaryToLightGradient];
    return GestureDetector(
      onTap: () => context.go('/places/${place.id}'),
      child: Container(
        width: 178,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          gradient: gradients[colorVariant % gradients.length],
          boxShadow: [colors.shadow],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Icon(Icons.place_rounded, color: Colors.white, size: 24),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  place.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 3),
                Text(
                  [place.city, place.area].where((s) => s.isNotEmpty).join(' · '),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: Colors.white70, fontSize: 12),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _RecentMemoryCard extends StatelessWidget {
  final MemoryEvent memory;
  final List<Person> people;
  final List<Place> places;
  final AppColors colors;

  const _RecentMemoryCard({required this.memory, required this.people, required this.places, required this.colors});

  @override
  Widget build(BuildContext context) {
    final names = people.where((p) => memory.personIds.contains(p.id)).map((p) => p.name).join('、');
    final place = places.where((p) => p.id == memory.placeId).map((p) => p.name).firstOrNull ?? '';
    final meta = [memory.date, if (names.isNotEmpty) names, if (place.isNotEmpty) place].join(' · ');

    return GlassCard(
      colors: colors,
      onTap: () => context.go('/memories/${memory.id}'),
      padding: const EdgeInsets.all(16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(color: colors.softPurple, borderRadius: BorderRadius.circular(15)),
            child: Icon(Icons.auto_stories_rounded, color: colors.primary, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  memory.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: colors.textMain),
                ),
                const SizedBox(height: 4),
                Text(meta, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: colors.textSub)),
                if (memory.content.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    memory.content,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 13, height: 1.35, color: colors.textMain),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
