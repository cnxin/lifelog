import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../models/lifelog_models.dart';
import '../providers/providers.dart';
import '../theme/app_theme.dart';
import '../widgets/glass_card.dart';

class PlacesListPage extends ConsumerStatefulWidget {
  const PlacesListPage({super.key});

  @override
  ConsumerState<PlacesListPage> createState() => _PlacesListPageState();
}

class _PlacesListPageState extends ConsumerState<PlacesListPage> {
  final _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final placesAsync = ref.watch(placesProvider);
    final query = ref.watch(placeSearchQueryProvider);
    final colors = AppColors.fromStyle(ref.watch(themeStyleProvider));
    final theme = Theme.of(context);

    return Stack(
      children: [
        Column(
          children: [
            SafeArea(
              bottom: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 16, 24, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('地点', style: theme.textTheme.headlineLarge),
                    const SizedBox(height: 16),
                    _SearchBox(
                      controller: _searchController,
                      query: query,
                      hint: '搜索地点、城市、分类...',
                      colors: colors,
                      onChanged: (value) {
                        ref.read(placeSearchQueryProvider.notifier).state = value;
                        ref.read(placesProvider.notifier).search(value);
                      },
                      onClear: () {
                        _searchController.clear();
                        ref.read(placeSearchQueryProvider.notifier).state = '';
                        ref.read(placesProvider.notifier).search('');
                      },
                    ),
                    const SizedBox(height: 16),
                  ],
                ),
              ),
            ),
            Expanded(
              child: placesAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(child: Text('$e')),
                data: (places) => ListView.separated(
                  padding: const EdgeInsets.fromLTRB(24, 0, 24, 120),
                  itemCount: places.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (_, i) => _PlaceCard(place: places[i], colors: colors, colorVariant: i),
                ),
              ),
            ),
          ],
        ),
        Positioned(
          right: 24,
          bottom: MediaQuery.of(context).padding.bottom + 100,
          child: GradientFAB(colors: colors, onPressed: () => context.push('/places/new')),
        ),
      ],
    );
  }
}

class _PlaceCard extends ConsumerWidget {
  final Place place;
  final AppColors colors;
  final int colorVariant;

  const _PlaceCard({required this.place, required this.colors, required this.colorVariant});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return GlassCard(
      colors: colors,
      onTap: () => context.push('/places/${place.id}'),
      child: Row(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: colorVariant.isEven ? [colors.secondary, colors.primary] : [const Color(0xFF35C7D0), colors.primary],
              ),
              boxShadow: [colors.avatarShadow],
            ),
            child: const Icon(Icons.place_rounded, color: Colors.white, size: 30),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(child: Text(place.name, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: colors.textMain))),
                    if (place.favorite) const Icon(Icons.star_rounded, size: 16, color: Color(0xFFFDCB6E)),
                  ],
                ),
                const SizedBox(height: 5),
                Text(
                  [place.city, place.area, place.mall].where((s) => s.isNotEmpty).join(' · '),
                  style: TextStyle(fontSize: 12, color: colors.textSub),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    _Pill(label: place.category, colors: colors),
                    const SizedBox(width: 8),
                    const Icon(Icons.star_rounded, size: 14, color: Color(0xFFFDCB6E)),
                    const SizedBox(width: 2),
                    Text(place.rating.toStringAsFixed(1), style: TextStyle(fontSize: 12, color: colors.textSub, fontWeight: FontWeight.w600)),
                  ],
                ),
                if (place.tags.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 6,
                    children: place.tags.take(3).map((tag) => _Pill(label: tag, colors: colors, small: true)).toList(),
                  ),
                ],
              ],
            ),
          ),
          Icon(Icons.chevron_right, size: 20, color: colors.textSub.withAlpha(100)),
        ],
      ),
    );
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
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(color: colors.cardBg, borderRadius: BorderRadius.circular(16), boxShadow: [colors.shadow]),
          child: Row(
            children: [
              Icon(Icons.search, size: 20, color: colors.textSub),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: controller,
                  style: TextStyle(fontSize: 15, color: colors.textMain),
                  decoration: InputDecoration(hintText: hint, hintStyle: TextStyle(color: colors.textSub, fontSize: 15), border: InputBorder.none, filled: false, contentPadding: const EdgeInsets.symmetric(vertical: 14)),
                  onChanged: onChanged,
                ),
              ),
              if (query.isNotEmpty) GestureDetector(onTap: onClear, child: Icon(Icons.close, size: 18, color: colors.textSub)),
            ],
          ),
        ),
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  final String label;
  final AppColors colors;
  final bool small;
  const _Pill({required this.label, required this.colors, this.small = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: small ? 8 : 10, vertical: small ? 4 : 5),
      decoration: BoxDecoration(color: colors.softPurple, borderRadius: BorderRadius.circular(999)),
      child: Text(label, style: TextStyle(fontSize: small ? 11 : 12, fontWeight: FontWeight.w600, color: colors.primary)),
    );
  }
}
