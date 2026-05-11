import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../models/lifelog_models.dart';
import '../providers/providers.dart';
import '../theme/app_theme.dart';
import '../widgets/glass_card.dart';

class PlaceDetailPage extends ConsumerWidget {
  final String placeId;
  const PlaceDetailPage({super.key, required this.placeId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final placesAsync = ref.watch(placesProvider);
    final colors = AppColors.fromStyle(ref.watch(themeStyleProvider));

    return placesAsync.when(
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (e, _) => Scaffold(body: Center(child: Text('$e'))),
      data: (places) {
        final place = places.where((p) => p.id == placeId).firstOrNull;
        if (place == null) return const Scaffold(body: Center(child: Text('地点不存在')));
        return GradientBackground(
          colors: colors,
          isDark: ref.watch(themeModeProvider),
          child: Scaffold(
            body: CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: SafeArea(
                    bottom: false,
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(8, 8, 8, 0),
                      child: Row(
                        children: [
                          IconButton(icon: Icon(Icons.arrow_back_ios_new, size: 20, color: colors.textMain), onPressed: () => context.pop()),
                          const Spacer(),
                          IconButton(icon: Icon(Icons.edit, color: colors.textSub), onPressed: () => context.push('/places/${place.id}/edit')),
                          IconButton(icon: Icon(Icons.delete_outline, color: colors.textSub), onPressed: () => _delete(context, ref, place, colors)),
                        ],
                      ),
                    ),
                  ),
                ),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(24, 8, 24, 120),
                  sliver: SliverList(
                    delegate: SliverChildListDelegate([
                      Container(
                        height: 132,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(28),
                          gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [colors.secondary, colors.primary]),
                          boxShadow: [colors.avatarShadow],
                        ),
                        child: const Icon(Icons.place_rounded, color: Colors.white, size: 48),
                      ),
                      const SizedBox(height: 20),
                      Text(place.name, style: TextStyle(fontFamily: 'Outfit', fontSize: 26, fontWeight: FontWeight.w700, color: colors.textMain)),
                      const SizedBox(height: 8),
                      Row(children: [
                        _Tag(label: place.category, colors: colors),
                        const SizedBox(width: 8),
                        const Icon(Icons.star_rounded, size: 16, color: Color(0xFFFDCB6E)),
                        const SizedBox(width: 3),
                        Text(place.rating.toStringAsFixed(1), style: TextStyle(color: colors.textSub, fontWeight: FontWeight.w600)),
                      ]),
                      const SizedBox(height: 18),
                      _InfoCard(title: '位置', icon: Icons.location_on_rounded, colors: colors, child: Text([place.province, place.city, place.area, place.mall, place.storeName].where((s) => s.isNotEmpty).join(' · '), style: TextStyle(color: colors.textMain, height: 1.5))),
                      if (place.address.isNotEmpty) _InfoCard(title: '地址', icon: Icons.map_rounded, colors: colors, child: Text(place.address, style: TextStyle(color: colors.textMain, height: 1.5))),
                      if (place.mapUrl.isNotEmpty || place.sourceUrl.isNotEmpty || place.platformLinks.isNotEmpty)
                        _InfoCard(
                          title: '外部链接',
                          icon: Icons.link_rounded,
                          colors: colors,
                          child: Column(
                            children: [
                              if (place.mapUrl.isNotEmpty) _LinkRow(label: '地图', value: place.mapUrl, colors: colors),
                              if (place.sourceUrl.isNotEmpty) _LinkRow(label: '来源', value: place.sourceUrl, colors: colors),
                              ...place.platformLinks.map((link) => _LinkRow(label: link.label, value: link.url, colors: colors)),
                            ],
                          ),
                        ),
                      if (place.desc.isNotEmpty) _InfoCard(title: '备注', icon: Icons.note_rounded, colors: colors, child: Text(place.desc, style: TextStyle(color: colors.textMain, height: 1.5))),
                      if (place.photos.isNotEmpty) _InfoCard(title: '照片', icon: Icons.photo_library_rounded, colors: colors, child: _PhotoGrid(photos: place.photos, colors: colors)),
                      if (place.tags.isNotEmpty) _InfoCard(title: '标签', icon: Icons.sell_rounded, colors: colors, child: Wrap(spacing: 6, runSpacing: 6, children: place.tags.map((tag) => _Tag(label: tag, colors: colors)).toList())),
                    ]),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _delete(BuildContext context, WidgetRef ref, Place place, AppColors colors) {
    showDialog(context: context, builder: (ctx) => AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: const Text('确认删除'),
      content: Text('确定要删除 ${place.name} 吗？'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('取消')),
        TextButton(onPressed: () { ref.read(placesProvider.notifier).deletePlace(place.id); Navigator.pop(ctx); context.pop(); }, style: TextButton.styleFrom(foregroundColor: const Color(0xFFE17055)), child: const Text('删除')),
      ],
    ));
  }
}

class _InfoCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final AppColors colors;
  final Widget child;
  const _InfoCard({required this.title, required this.icon, required this.colors, required this.child});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: GlassCard(colors: colors, padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [Icon(icon, size: 18, color: colors.primary), const SizedBox(width: 8), Text(title, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: colors.primary))]),
      const SizedBox(height: 12),
      child,
    ])),
  );
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

class _LinkRow extends StatelessWidget {
  final String label;
  final String value;
  final AppColors colors;

  const _LinkRow({required this.label, required this.value, required this.colors});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () async {
          await Clipboard.setData(ClipboardData(text: value));
          if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('已复制 $label 链接')));
        },
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(color: colors.softPurple, borderRadius: BorderRadius.circular(999)),
              child: Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: colors.primary)),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13, color: colors.textMain)),
            ),
            Icon(Icons.copy_rounded, size: 16, color: colors.textSub),
          ],
        ),
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  final String label;
  final AppColors colors;
  const _Tag({required this.label, required this.colors});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
    decoration: BoxDecoration(color: colors.softPurple, borderRadius: BorderRadius.circular(999)),
    child: Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: colors.primary)),
  );
}
