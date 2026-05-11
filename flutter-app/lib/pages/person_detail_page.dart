import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/providers.dart';
import '../models/person.dart';
import '../theme/app_theme.dart';
import '../widgets/glass_card.dart';

class PersonDetailPage extends ConsumerWidget {
  final String personId;
  const PersonDetailPage({super.key, required this.personId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final peopleAsync = ref.watch(peopleProvider);
    final style = ref.watch(themeStyleProvider);
    final colors = AppColors.fromStyle(style);

    return peopleAsync.when(
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (e, _) => Scaffold(body: Center(child: Text('$e'))),
      data: (people) {
        final person = people.where((p) => p.id == personId).firstOrNull;
        if (person == null) {
          return GradientBackground(
            colors: colors,
            child: Scaffold(appBar: AppBar(), body: const Center(child: Text('人物不存在'))),
          );
        }
        return GradientBackground(
          colors: colors,
          child: Scaffold(
            body: _DetailBody(person: person, colors: colors),
            floatingActionButton: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                GradientFAB(
                  colors: colors,
                  icon: Icons.edit,
                  onPressed: () => context.push('/people/${person.id}/edit'),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _DetailBody extends ConsumerWidget {
  final Person person;
  final AppColors colors;

  const _DetailBody({required this.person, required this.colors});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(
          child: SafeArea(
            bottom: false,
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
                      IconButton(
                        icon: Icon(Icons.delete_outline, size: 22, color: colors.textSub),
                        onPressed: () => _confirmDelete(context, ref),
                      ),
                    ],
                  ),
                ),

                // Profile header
                const SizedBox(height: 8),
                GradientAvatar(
                  name: person.name,
                  size: 82,
                  borderRadius: 28,
                  fontSize: 26,
                  colors: colors,
                ),
                const SizedBox(height: 16),
                Text(
                  person.name,
                  style: TextStyle(
                    fontFamily: 'Outfit',
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    color: colors.textMain,
                  ),
                ),
                if (person.nickname.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(person.nickname, style: TextStyle(fontSize: 14, color: colors.textSub)),
                ],
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(
                    color: colors.softPurple,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    person.relationship,
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: colors.primary),
                  ),
                ),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ),

        // Info sections
        SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          sliver: SliverList(
            delegate: SliverChildListDelegate([
              if (person.birthday != null)
                _InfoCard(
                  icon: Icons.cake,
                  title: '生日',
                  colors: colors,
                  child: Row(
                    children: [
                      Text(
                        person.birthday!,
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: colors.textMain),
                      ),
                      if (person.birthdayIsLunar) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: colors.softOrange,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text('农历', style: TextStyle(fontSize: 11, color: colors.primary, fontWeight: FontWeight.w600)),
                        ),
                      ],
                    ],
                  ),
                ),

              if (person.anniversaries.isNotEmpty)
                _InfoCard(
                  icon: Icons.event,
                  title: '纪念日',
                  colors: colors,
                  child: Column(
                    children: person.anniversaries.map((a) => Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(a.title, style: TextStyle(fontSize: 14, color: colors.textMain)),
                          Text(a.date, style: TextStyle(fontSize: 13, color: colors.textSub)),
                        ],
                      ),
                    )).toList(),
                  ),
                ),

              if (person.preferences.isNotEmpty)
                _InfoCard(
                  icon: Icons.favorite_rounded,
                  title: '喜好',
                  colors: colors,
                  child: _PreferenceTags(groups: person.preferences, colors: colors),
                ),

              if (person.dislikes.isNotEmpty)
                _InfoCard(
                  icon: Icons.block_rounded,
                  title: '禁忌',
                  colors: colors,
                  child: _PreferenceTags(groups: person.dislikes, colors: colors, isDislike: true),
                ),

              if (person.notes.isNotEmpty)
                _InfoCard(
                  icon: Icons.note_rounded,
                  title: '备注',
                  colors: colors,
                  child: Text(
                    person.notes,
                    style: TextStyle(fontSize: 14, color: colors.textMain, height: 1.5),
                  ),
                ),

              const SizedBox(height: 120),
            ]),
          ),
        ),
      ],
    );
  }

  void _confirmDelete(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('确认删除'),
        content: Text('确定要删除 ${person.name} 吗？'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('取消')),
          TextButton(
            onPressed: () {
              ref.read(peopleProvider.notifier).deletePerson(person.id);
              Navigator.pop(ctx);
              context.pop();
            },
            style: TextButton.styleFrom(foregroundColor: const Color(0xFFE17055)),
            child: const Text('删除'),
          ),
        ],
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final AppColors colors;
  final Widget child;

  const _InfoCard({required this.icon, required this.title, required this.colors, required this.child});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: GlassCard(
        colors: colors,
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 18, color: colors.primary),
                const SizedBox(width: 8),
                Text(
                  title,
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: colors.primary),
                ),
              ],
            ),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}

class _PreferenceTags extends StatelessWidget {
  final List<PreferenceGroup> groups;
  final AppColors colors;
  final bool isDislike;

  const _PreferenceTags({required this.groups, required this.colors, this.isDislike = false});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: groups.map((group) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(group.category, style: TextStyle(fontSize: 12, color: colors.textSub, fontWeight: FontWeight.w500)),
            const SizedBox(height: 6),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: group.items.map((item) => Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: isDislike ? colors.softOrange : colors.softPurple,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  item,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: isDislike ? const Color(0xFFE17055) : colors.primary,
                  ),
                ),
              )).toList(),
            ),
          ],
        ),
      )).toList(),
    );
  }
}
