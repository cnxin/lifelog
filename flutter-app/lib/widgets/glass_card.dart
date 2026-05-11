import 'dart:ui';
import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class GlassCard extends StatefulWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final double borderRadius;
  final VoidCallback? onTap;
  final AppColors colors;

  const GlassCard({
    super.key,
    required this.child,
    required this.colors,
    this.padding,
    this.borderRadius = 20,
    this.onTap,
  });

  @override
  State<GlassCard> createState() => _GlassCardState();
}

class _GlassCardState extends State<GlassCard> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: widget.onTap != null ? (_) => setState(() => _pressed = true) : null,
      onTapUp: widget.onTap != null ? (_) { setState(() => _pressed = false); widget.onTap!(); } : null,
      onTapCancel: widget.onTap != null ? () => setState(() => _pressed = false) : null,
      child: AnimatedScale(
        scale: _pressed ? 0.985 : 1.0,
        duration: const Duration(milliseconds: 160),
        curve: Curves.easeOut,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(widget.borderRadius),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              decoration: BoxDecoration(
                color: widget.colors.cardBg,
                borderRadius: BorderRadius.circular(widget.borderRadius),
                border: Border.all(color: widget.colors.line, width: 1),
                boxShadow: [_pressed ? widget.colors.pressShadow : widget.colors.shadow],
              ),
              padding: widget.padding ?? const EdgeInsets.all(14),
              child: widget.child,
            ),
          ),
        ),
      ),
    );
  }
}

class GradientAvatar extends StatelessWidget {
  final String name;
  final double size;
  final double borderRadius;
  final double fontSize;
  final AppColors colors;
  final int colorVariant;

  const GradientAvatar({
    super.key,
    required this.name,
    required this.colors,
    this.size = 48,
    this.borderRadius = 50,
    this.fontSize = 20,
    this.colorVariant = 0,
  });

  @override
  Widget build(BuildContext context) {
    final gradients = [
      [colors.primary, colors.secondary],
      [const Color(0xFF35C7D0), colors.primary],
      [const Color(0xFFFF8FB0), colors.secondary],
      [colors.primaryLight, colors.primary],
    ];
    final gradient = gradients[colorVariant % gradients.length];

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        borderRadius: borderRadius >= 50
            ? BorderRadius.circular(size / 2)
            : BorderRadius.circular(borderRadius),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: gradient,
        ),
        boxShadow: [colors.avatarShadow],
      ),
      alignment: Alignment.center,
      child: Text(
        name.isNotEmpty ? name.characters.first : '?',
        style: TextStyle(
          color: Colors.white,
          fontSize: fontSize,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class GradientFAB extends StatelessWidget {
  final VoidCallback onPressed;
  final IconData icon;
  final AppColors colors;

  const GradientFAB({
    super.key,
    required this.onPressed,
    required this.colors,
    this.icon = Icons.add,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onPressed,
      child: Container(
        width: 56,
        height: 56,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(28),
          gradient: colors.primaryGradient,
          boxShadow: [colors.fabShadow],
        ),
        child: Icon(icon, color: Colors.white, size: 24),
      ),
    );
  }
}

class GradientBackground extends StatelessWidget {
  final Widget child;
  final AppColors colors;
  final bool isDark;

  const GradientBackground({
    super.key,
    required this.child,
    required this.colors,
    this.isDark = false,
  });

  @override
  Widget build(BuildContext context) {
    if (isDark) {
      return Container(
        color: const Color(0xFF1A1A2E),
        child: child,
      );
    }

    return Container(
      decoration: BoxDecoration(
        color: colors.bgColor,
        gradient: RadialGradient(
          center: const Alignment(-0.68, -0.72),
          radius: 0.6,
          colors: [colors.primary.withAlpha(26), Colors.transparent],
          stops: const [0.0, 1.0],
        ),
      ),
      child: Stack(
        children: [
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: const Alignment(0.84, 0.72),
                  radius: 0.7,
                  colors: [colors.secondary.withAlpha(26), Colors.transparent],
                  stops: const [0.0, 1.0],
                ),
              ),
            ),
          ),
          child,
        ],
      ),
    );
  }
}

class GlassBottomNav extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;
  final AppColors colors;

  const GlassBottomNav({
    super.key,
    required this.currentIndex,
    required this.onTap,
    required this.colors,
  });

  static const _items = [
    (Icons.home_rounded, Icons.home_outlined, '首页'),
    (Icons.people_rounded, Icons.people_outlined, '人物'),
    (Icons.place_rounded, Icons.place_outlined, '地点'),
    (Icons.auto_stories_rounded, Icons.auto_stories_outlined, '记忆'),
    (Icons.calendar_month_rounded, Icons.calendar_month_outlined, '日历'),
    (Icons.settings_rounded, Icons.settings_outlined, '设置'),
  ];

  @override
  Widget build(BuildContext context) {
    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: Container(
          decoration: BoxDecoration(
            color: colors.cardBg,
            border: Border(top: BorderSide(color: colors.line, width: 1)),
          ),
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(context).padding.bottom + 8,
            top: 8,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: List.generate(_items.length, (i) {
              final active = i == currentIndex;
              final item = _items[i];
              return GestureDetector(
                onTap: () => onTap(i),
                behavior: HitTestBehavior.opaque,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  curve: Curves.easeOut,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  transform: Matrix4.translationValues(0, active ? -2 : 0, 0),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        active ? item.$1 : item.$2,
                        size: 22,
                        color: active ? colors.primary : colors.textSub,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        item.$3,
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: active ? colors.primary : colors.textSub,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }),
          ),
        ),
      ),
    );
  }
}
