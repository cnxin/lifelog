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

class PlaceFormPage extends ConsumerStatefulWidget {
  final String? placeId;
  const PlaceFormPage({super.key, this.placeId});

  @override
  ConsumerState<PlaceFormPage> createState() => _PlaceFormPageState();
}

class _PlaceFormPageState extends ConsumerState<PlaceFormPage> {
  final _name = TextEditingController();
  final _city = TextEditingController(text: '杭州');
  final _area = TextEditingController();
  final _mall = TextEditingController();
  final _storeName = TextEditingController();
  final _address = TextEditingController();
  final _mapUrl = TextEditingController();
  final _sourceUrl = TextEditingController();
  final _platformLinks = TextEditingController();
  final _desc = TextEditingController();
  final _tags = TextEditingController();
  String _category = '餐厅';
  double _rating = 4.5;
  bool _favorite = false;
  List<String> _photosPaths = [];

  bool get isEditing => widget.placeId != null;
  static const categories = ['餐厅', '咖啡厅', '电影院', '景点', '酒店', '商场', '其他'];

  @override
  void initState() {
    super.initState();
    if (isEditing) WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  void _load() {
    final place = ref.read(placesProvider).valueOrNull?.where((p) => p.id == widget.placeId).firstOrNull;
    if (place == null) return;
    _name.text = place.name;
    _city.text = place.city;
    _area.text = place.area;
    _mall.text = place.mall;
    _storeName.text = place.storeName;
    _address.text = place.address;
    _mapUrl.text = place.mapUrl;
    _sourceUrl.text = place.sourceUrl;
    _platformLinks.text = place.platformLinks.map((link) => '${link.label}|${link.url}|${link.platform}').join('\n');
    _desc.text = place.desc;
    _tags.text = place.tags.join('，');
    setState(() {
      _category = place.category.isEmpty ? '餐厅' : place.category;
      _rating = place.rating == 0 ? 4.5 : place.rating;
      _favorite = place.favorite;
      _photosPaths = List.from(place.photos);
    });
  }

  @override
  void dispose() {
    _name.dispose();
    _city.dispose();
    _area.dispose();
    _mall.dispose();
    _storeName.dispose();
    _address.dispose();
    _mapUrl.dispose();
    _sourceUrl.dispose();
    _platformLinks.dispose();
    _desc.dispose();
    _tags.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.fromStyle(ref.watch(themeStyleProvider));
    return GradientBackground(
      colors: colors,
      isDark: ref.watch(themeModeProvider),
      child: Scaffold(
        body: SafeArea(
          child: Column(children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 8, 8, 0),
              child: Row(children: [
                IconButton(icon: Icon(Icons.arrow_back_ios_new, size: 20, color: colors.textMain), onPressed: () => context.pop()),
                const Spacer(),
                Text(isEditing ? '编辑地点' : '新建地点', style: TextStyle(fontFamily: 'Outfit', fontSize: 18, fontWeight: FontWeight.w600, color: colors.textMain)),
                const Spacer(),
                GestureDetector(onTap: _save, child: Container(padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8), decoration: BoxDecoration(gradient: colors.primaryGradient, borderRadius: BorderRadius.circular(14)), child: const Text('保存', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)))),
                const SizedBox(width: 8),
              ]),
            ),
            Expanded(
              child: ListView(padding: const EdgeInsets.fromLTRB(24, 16, 24, 40), children: [
                _Input(label: '名称 *', controller: _name, icon: Icons.place_rounded, colors: colors),
                const SizedBox(height: 16),
                Text('分类', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: colors.textSub)),
                const SizedBox(height: 8),
                Wrap(spacing: 8, runSpacing: 8, children: categories.map((cat) => _Choice(label: cat, selected: cat == _category, colors: colors, onTap: () => setState(() => _category = cat))).toList()),
                const SizedBox(height: 16),
                _Input(label: '城市', controller: _city, icon: Icons.location_city_rounded, colors: colors),
                const SizedBox(height: 16),
                Row(children: [Expanded(child: _Input(label: '区域', controller: _area, icon: Icons.map_rounded, colors: colors)), const SizedBox(width: 12), Expanded(child: _Input(label: '商场', controller: _mall, icon: Icons.store_mall_directory_rounded, colors: colors))]),
                const SizedBox(height: 16),
                _Input(label: '店铺/厅名', controller: _storeName, icon: Icons.storefront_rounded, colors: colors),
                const SizedBox(height: 16),
                Text('评分 ${_rating.toStringAsFixed(1)}', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: colors.textSub)),
                Slider(value: _rating, min: 0, max: 5, divisions: 10, activeColor: colors.primary, onChanged: (v) => setState(() => _rating = v)),
                const SizedBox(height: 8),
                _Input(label: '地址', controller: _address, icon: Icons.route_rounded, colors: colors),
                const SizedBox(height: 16),
                _Input(label: '地图链接', controller: _mapUrl, icon: Icons.map_rounded, colors: colors),
                const SizedBox(height: 16),
                _Input(label: '来源链接', controller: _sourceUrl, icon: Icons.link_rounded, colors: colors),
                const SizedBox(height: 16),
                _Input(label: '平台链接（每行：名称|链接|平台）', controller: _platformLinks, icon: Icons.hub_rounded, colors: colors, maxLines: 3),
                const SizedBox(height: 16),
                _Input(label: '标签（逗号分隔）', controller: _tags, icon: Icons.sell_rounded, colors: colors),
                const SizedBox(height: 16),
                Text('照片', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: colors.textSub)),
                const SizedBox(height: 8),
                _PhotoPicker(photos: _photosPaths, colors: colors, onAdd: _addPhotos, onRemove: _removePhoto),
                const SizedBox(height: 16),
                _Input(label: '备注', controller: _desc, icon: Icons.note_rounded, colors: colors, maxLines: 3),
                const SizedBox(height: 16),
                GlassCard(colors: colors, onTap: () => setState(() => _favorite = !_favorite), child: Row(children: [Icon(_favorite ? Icons.star_rounded : Icons.star_outline_rounded, color: _favorite ? const Color(0xFFFDCB6E) : colors.textSub), const SizedBox(width: 12), Text('收藏', style: TextStyle(color: colors.textMain)), const Spacer(), Text(_favorite ? '已收藏' : '未收藏', style: TextStyle(color: colors.textSub, fontSize: 12))])),
              ]),
            ),
          ]),
        ),
      ),
    );
  }

  void _save() {
    if (_name.text.trim().isEmpty) return;
    final tags = _tags.text.split(RegExp(r'[,，]')).map((s) => s.trim()).where((s) => s.isNotEmpty).toList();
    final place = Place(
      id: widget.placeId ?? const Uuid().v4(),
      name: _name.text.trim(),
      province: '浙江省',
      city: _city.text.trim(),
      area: _area.text.trim(),
      mall: _mall.text.trim(),
      storeName: _storeName.text.trim(),
      category: _category,
      rating: _rating,
      address: _address.text.trim(),
      mapUrl: _mapUrl.text.trim(),
      sourceUrl: _sourceUrl.text.trim(),
      platformLinks: _parsePlatformLinks(),
      desc: _desc.text.trim(),
      tags: tags,
      photos: _photosPaths,
      favorite: _favorite,
    );
    ref.read(placesProvider.notifier).savePlace(place);
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

  List<PlaceExternalLink> _parsePlatformLinks() {
    return _platformLinks.text
        .split('\n')
        .map((line) => line.trim())
        .where((line) => line.isNotEmpty)
        .map((line) {
          final parts = line.split('|').map((part) => part.trim()).toList();
          return PlaceExternalLink(
            label: parts.isNotEmpty && parts[0].isNotEmpty ? parts[0] : '链接',
            url: parts.length > 1 ? parts[1] : '',
            platform: parts.length > 2 && parts[2].isNotEmpty ? parts[2] : 'custom',
          );
        })
        .where((link) => link.url.isNotEmpty)
        .toList();
  }
}

class _Input extends StatelessWidget {
  final String label;
  final TextEditingController controller;
  final IconData icon;
  final AppColors colors;
  final int maxLines;
  const _Input({required this.label, required this.controller, required this.icon, required this.colors, this.maxLines = 1});

  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: colors.textSub)),
    const SizedBox(height: 8),
    GlassCard(colors: colors, padding: EdgeInsets.zero, child: TextField(controller: controller, maxLines: maxLines, style: TextStyle(color: colors.textMain), decoration: InputDecoration(prefixIcon: Icon(icon, color: colors.textSub, size: 20), border: InputBorder.none, filled: false, contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14)))),
  ]);
}

class _Choice extends StatelessWidget {
  final String label;
  final bool selected;
  final AppColors colors;
  final VoidCallback onTap;
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
