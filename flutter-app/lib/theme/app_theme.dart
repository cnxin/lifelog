import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

enum AppThemeStyle {
  classic,
  cream,
  mint,
  mist;

  String get label => ['Classic', 'Cream', 'Mint', 'Mist'][index];
  String get description => ['薰衣草紫', '焦糖棕', '薄荷绿', '雾灰'][index];
}

class AppColors {
  final Color primary;
  final Color primaryLight;
  final Color secondary;
  final Color bgColor;
  final Color cardBg;
  final Color cardSolid;
  final Color textMain;
  final Color textSub;
  final Color line;
  final Color softPurple;
  final Color softOrange;
  final BoxShadow shadow;
  final BoxShadow pressShadow;
  final BoxShadow avatarShadow;
  final BoxShadow fabShadow;
  final List<Color> gradientColors;

  const AppColors({
    required this.primary,
    required this.primaryLight,
    required this.secondary,
    required this.bgColor,
    required this.cardBg,
    required this.cardSolid,
    required this.textMain,
    required this.textSub,
    required this.line,
    required this.softPurple,
    required this.softOrange,
    required this.shadow,
    required this.pressShadow,
    required this.avatarShadow,
    required this.fabShadow,
    required this.gradientColors,
  });

  Gradient get primaryGradient => LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [primary, secondary],
  );

  Gradient get primaryToLightGradient => LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [primary, primaryLight],
  );

  Gradient get secondaryGradient => LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: gradientColors,
  );

  static const classic = AppColors(
    primary: Color(0xFF7C8CF8),
    primaryLight: Color(0xFFAEB8FF),
    secondary: Color(0xFFF5A3AE),
    bgColor: Color(0xFFFAFBFF),
    cardBg: Color(0xF0FFFFFF),
    cardSolid: Color(0xFFFFFFFF),
    textMain: Color(0xFF20263A),
    textSub: Color(0xFF737B91),
    line: Color(0x1A7C8CF8),
    softPurple: Color(0x177C8CF8),
    softOrange: Color(0x1FF5A3AE),
    shadow: BoxShadow(color: Color(0x0D37416E), blurRadius: 22, offset: Offset(0, 8)),
    pressShadow: BoxShadow(color: Color(0x1437416E), blurRadius: 14, offset: Offset(0, 4)),
    avatarShadow: BoxShadow(color: Color(0x3D6C5CE7), blurRadius: 22, offset: Offset(0, 10)),
    fabShadow: BoxShadow(color: Color(0x335B6CFF), blurRadius: 20, offset: Offset(0, 10)),
    gradientColors: [Color(0xFFF5ADB7), Color(0xFFFF9A8D)],
  );

  static const cream = AppColors(
    primary: Color(0xFF9F7B55),
    primaryLight: Color(0xFFD7BEA1),
    secondary: Color(0xFFEAD7BD),
    bgColor: Color(0xFFFFF7EA),
    cardBg: Color(0xE6FFFCF6),
    cardSolid: Color(0xFFFFFDF8),
    textMain: Color(0xFF4D4033),
    textSub: Color(0xFF8A7258),
    line: Color(0x24B08553),
    softPurple: Color(0x179F7B55),
    softOrange: Color(0x3DE8CDA6),
    shadow: BoxShadow(color: Color(0x0F75583A), blurRadius: 24, offset: Offset(0, 10)),
    pressShadow: BoxShadow(color: Color(0x1775583A), blurRadius: 16, offset: Offset(0, 5)),
    avatarShadow: BoxShadow(color: Color(0x3D75583A), blurRadius: 22, offset: Offset(0, 10)),
    fabShadow: BoxShadow(color: Color(0x3375583A), blurRadius: 20, offset: Offset(0, 10)),
    gradientColors: [Color(0xFFEAD7BD), Color(0xFFD7BEA1)],
  );

  static const mint = AppColors(
    primary: Color(0xFF12B886),
    primaryLight: Color(0xFF8CEFD8),
    secondary: Color(0xFF4DABF7),
    bgColor: Color(0xFFEFFFF8),
    cardBg: Color(0xE6F8FFFC),
    cardSolid: Color(0xFFFBFFFD),
    textMain: Color(0xFF123F38),
    textSub: Color(0xFF4D8B7D),
    line: Color(0x2912B886),
    softPurple: Color(0x2112B886),
    softOrange: Color(0x334DABF7),
    shadow: BoxShadow(color: Color(0x1412B886), blurRadius: 26, offset: Offset(0, 12)),
    pressShadow: BoxShadow(color: Color(0x1F12B886), blurRadius: 16, offset: Offset(0, 5)),
    avatarShadow: BoxShadow(color: Color(0x3D12B886), blurRadius: 22, offset: Offset(0, 10)),
    fabShadow: BoxShadow(color: Color(0x3312B886), blurRadius: 20, offset: Offset(0, 10)),
    gradientColors: [Color(0xFF4DABF7), Color(0xFF8CEFD8)],
  );

  static const mist = AppColors(
    primary: Color(0xFF4B5563),
    primaryLight: Color(0xFF9CA3AF),
    secondary: Color(0xFFC5CBD3),
    bgColor: Color(0xFFF3F4F6),
    cardBg: Color(0xF0FFFFFF),
    cardSolid: Color(0xFFFFFFFF),
    textMain: Color(0xFF1F2937),
    textSub: Color(0xFF6B7280),
    line: Color(0x171F2937),
    softPurple: Color(0x0F4B5563),
    softOrange: Color(0x1F9CA3AF),
    shadow: BoxShadow(color: Color(0x0A111827), blurRadius: 18, offset: Offset(0, 6)),
    pressShadow: BoxShadow(color: Color(0x12111827), blurRadius: 12, offset: Offset(0, 3)),
    avatarShadow: BoxShadow(color: Color(0x3D4B5563), blurRadius: 22, offset: Offset(0, 10)),
    fabShadow: BoxShadow(color: Color(0x334B5563), blurRadius: 20, offset: Offset(0, 10)),
    gradientColors: [Color(0xFF9CA3AF), Color(0xFF7B8796)],
  );

  static AppColors fromStyle(AppThemeStyle style) {
    switch (style) {
      case AppThemeStyle.classic: return classic;
      case AppThemeStyle.cream: return cream;
      case AppThemeStyle.mint: return mint;
      case AppThemeStyle.mist: return mist;
    }
  }
}

class AppTheme {
  static ThemeData build(AppColors colors, {bool isDark = false}) {
    final brightness = isDark ? Brightness.dark : Brightness.light;
    final bg = isDark ? const Color(0xFF1A1A2E) : colors.bgColor;
    final cardBg = isDark ? const Color(0xD924243A) : colors.cardSolid;
    final textMain = isDark ? const Color(0xFFF8F9FA) : colors.textMain;
    final textSub = isDark ? const Color(0xFFB2BEC3) : colors.textSub;

    final colorScheme = ColorScheme(
      brightness: brightness,
      primary: colors.primary,
      onPrimary: Colors.white,
      primaryContainer: colors.softPurple,
      onPrimaryContainer: colors.primary,
      secondary: colors.secondary,
      onSecondary: Colors.white,
      secondaryContainer: colors.softOrange,
      onSecondaryContainer: colors.textMain,
      tertiary: colors.primaryLight,
      onTertiary: colors.textMain,
      tertiaryContainer: colors.softPurple,
      onTertiaryContainer: colors.primary,
      error: const Color(0xFFE17055),
      onError: Colors.white,
      errorContainer: const Color(0x1FE17055),
      onErrorContainer: const Color(0xFFE17055),
      surface: bg,
      onSurface: textMain,
      onSurfaceVariant: textSub,
      outline: colors.line,
      outlineVariant: colors.line,
      surfaceContainerLowest: cardBg,
      surfaceContainerLow: cardBg,
      surfaceContainer: cardBg,
      surfaceContainerHigh: colors.softPurple,
      surfaceContainerHighest: colors.softPurple,
    );

    final headingFamily = GoogleFonts.outfit().fontFamily;
    final bodyFamily = GoogleFonts.inter().fontFamily;

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: Colors.transparent,
      textTheme: TextTheme(
        headlineLarge: TextStyle(fontFamily: headingFamily, fontSize: 28, fontWeight: FontWeight.w700, color: textMain, height: 1.18),
        headlineMedium: TextStyle(fontFamily: headingFamily, fontSize: 24, fontWeight: FontWeight.w700, color: textMain),
        headlineSmall: TextStyle(fontFamily: headingFamily, fontSize: 22, fontWeight: FontWeight.w600, color: textMain),
        titleLarge: TextStyle(fontFamily: headingFamily, fontSize: 18, fontWeight: FontWeight.w600, color: textMain),
        titleMedium: TextStyle(fontFamily: bodyFamily, fontSize: 16, fontWeight: FontWeight.w600, color: textMain),
        titleSmall: TextStyle(fontFamily: bodyFamily, fontSize: 14, fontWeight: FontWeight.w600, color: textMain),
        bodyLarge: TextStyle(fontFamily: bodyFamily, fontSize: 15, fontWeight: FontWeight.w400, color: textMain),
        bodyMedium: TextStyle(fontFamily: bodyFamily, fontSize: 13, fontWeight: FontWeight.w400, color: textSub),
        bodySmall: TextStyle(fontFamily: bodyFamily, fontSize: 12, fontWeight: FontWeight.w400, color: textSub),
        labelLarge: TextStyle(fontFamily: bodyFamily, fontSize: 14, fontWeight: FontWeight.w600, color: textMain),
        labelMedium: TextStyle(fontFamily: bodyFamily, fontSize: 12, fontWeight: FontWeight.w700, color: colors.primary, letterSpacing: 0.04 * 12),
        labelSmall: TextStyle(fontFamily: bodyFamily, fontSize: 10, fontWeight: FontWeight.w600, color: textSub),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        foregroundColor: textMain,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(fontFamily: headingFamily, fontSize: 18, fontWeight: FontWeight.w600, color: textMain),
      ),
      navigationBarTheme: const NavigationBarThemeData(elevation: 0, backgroundColor: Colors.transparent),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(elevation: 0, highlightElevation: 0),
      cardTheme: const CardThemeData(elevation: 0, margin: EdgeInsets.zero),
      dividerTheme: DividerThemeData(color: colors.line, thickness: 1),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: colors.softPurple,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide(color: colors.primary, width: 2)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        hintStyle: TextStyle(color: textSub, fontSize: 15),
      ),
    );
  }
}
