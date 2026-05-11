import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/providers.dart';
import '../theme/app_theme.dart';
import '../widgets/glass_card.dart';

class PlaceholderPage extends ConsumerWidget {
  final String title;
  final IconData icon;
  final String description;

  const PlaceholderPage({
    super.key,
    required this.title,
    required this.icon,
    required this.description,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final style = ref.watch(themeStyleProvider);
    final colors = AppColors.fromStyle(style);
    final theme = Theme.of(context);

    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(
          child: SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
              child: Text(title, style: theme.textTheme.headlineLarge),
            ),
          ),
        ),
        SliverFillRemaining(
          hasScrollBody: false,
          child: Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 48),
              child: GlassCard(
                colors: colors,
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 72,
                      height: 72,
                      decoration: BoxDecoration(
                        color: colors.softPurple,
                        borderRadius: BorderRadius.circular(24),
                      ),
                      child: Icon(icon, size: 36, color: colors.primary.withAlpha(120)),
                    ),
                    const SizedBox(height: 20),
                    Text(
                      title,
                      style: TextStyle(
                        fontFamily: 'Outfit',
                        fontSize: 20,
                        fontWeight: FontWeight.w600,
                        color: colors.textMain,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      description,
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 14, color: colors.textSub),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
