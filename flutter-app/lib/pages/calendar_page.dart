import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../models/person.dart';
import '../models/lifelog_models.dart';
import '../providers/providers.dart';
import '../theme/app_theme.dart';
import '../widgets/glass_card.dart';

class CalendarPage extends ConsumerStatefulWidget {
  const CalendarPage({super.key});

  @override
  ConsumerState<CalendarPage> createState() => _CalendarPageState();
}

class _CalendarPageState extends ConsumerState<CalendarPage> {
  DateTime _focusedMonth = DateTime(DateTime.now().year, DateTime.now().month);

  @override
  Widget build(BuildContext context) {
    final peopleAsync = ref.watch(peopleProvider);
    final memoriesAsync = ref.watch(memoriesProvider);
    final style = ref.watch(themeStyleProvider);
    final colors = AppColors.fromStyle(style);
    final people = peopleAsync.valueOrNull;
    final memories = memoriesAsync.valueOrNull;

    if (people == null || memories == null) {
      if (peopleAsync.hasError) return Center(child: Text('${peopleAsync.error}'));
      if (memoriesAsync.hasError) return Center(child: Text('${memoriesAsync.error}'));
      return const Center(child: CircularProgressIndicator());
    }

    final events = _monthEvents(people, memories, _focusedMonth);
    final grouped = <int, List<_CalendarEvent>>{};
    for (final event in events) {
      grouped.putIfAbsent(event.day, () => []).add(event);
    }

    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(
          child: SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 20),
              child: Row(
                children: [
                  Expanded(child: Text('日历', style: Theme.of(context).textTheme.headlineLarge)),
                  _MonthButton(icon: Icons.chevron_left_rounded, colors: colors, onTap: () => _shiftMonth(-1)),
                  const SizedBox(width: 8),
                  _MonthButton(icon: Icons.chevron_right_rounded, colors: colors, onTap: () => _shiftMonth(1)),
                ],
              ),
            ),
          ),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: GlassCard(
              colors: colors,
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(16),
                          gradient: colors.primaryGradient,
                          boxShadow: [colors.avatarShadow],
                        ),
                        child: const Icon(Icons.calendar_month_rounded, color: Colors.white, size: 22),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              DateFormat('yyyy年 M月', 'zh_CN').format(_focusedMonth),
                              style: TextStyle(
                                fontFamily: 'Outfit',
                                fontSize: 22,
                                fontWeight: FontWeight.w700,
                                color: colors.textMain,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text('${events.length} 个日程与回忆', style: TextStyle(fontSize: 13, color: colors.textSub)),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  _CalendarGrid(month: _focusedMonth, eventDays: grouped.keys.toSet(), colors: colors),
                ],
              ),
            ),
          ),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 28, 24, 12),
            child: Row(
              children: [
                Icon(Icons.event_note_rounded, size: 20, color: colors.primary),
                const SizedBox(width: 8),
                Text(
                  '本月事件',
                  style: TextStyle(fontFamily: 'Outfit', fontSize: 18, fontWeight: FontWeight.w600, color: colors.textMain),
                ),
              ],
            ),
          ),
        ),
        if (events.isEmpty)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: GlassCard(
                colors: colors,
                padding: const EdgeInsets.all(24),
                child: Center(child: Text('这个月还没有记录。', style: TextStyle(color: colors.textSub))),
              ),
            ),
          )
        else
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            sliver: SliverList.separated(
              itemCount: events.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (_, i) => _EventCard(event: events[i], colors: colors),
            ),
          ),
        const SliverToBoxAdapter(child: SizedBox(height: 120)),
      ],
    );
  }

  void _shiftMonth(int delta) {
    setState(() {
      _focusedMonth = DateTime(_focusedMonth.year, _focusedMonth.month + delta);
    });
  }

  List<_CalendarEvent> _monthEvents(List<Person> people, List<MemoryEvent> memories, DateTime month) {
    final events = <_CalendarEvent>[];
    for (final person in people) {
      if (person.birthday != null) {
        final birthday = DateTime.tryParse(person.birthday!);
        if (birthday != null && birthday.month == month.month) {
          events.add(_CalendarEvent(day: birthday.day, title: '${person.name} 的生日', subtitle: person.relationship, type: _EventType.birthday));
        }
      }
      for (final anniversary in person.anniversaries) {
        final date = DateTime.tryParse(anniversary.date);
        if (date != null && date.month == month.month) {
          events.add(_CalendarEvent(day: date.day, title: anniversary.title, subtitle: person.name, type: _EventType.anniversary));
        }
      }
    }
    for (final memory in memories) {
      final date = DateTime.tryParse(memory.date);
      if (date != null && date.year == month.year && date.month == month.month) {
        events.add(_CalendarEvent(day: date.day, title: memory.title, subtitle: memory.mood, type: _EventType.memory));
      }
    }
    events.sort((a, b) {
      final byDay = a.day.compareTo(b.day);
      if (byDay != 0) return byDay;
      return a.title.compareTo(b.title);
    });
    return events;
  }
}

class _MonthButton extends StatelessWidget {
  final IconData icon;
  final AppColors colors;
  final VoidCallback onTap;

  const _MonthButton({required this.icon, required this.colors, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(color: colors.cardBg, borderRadius: BorderRadius.circular(14), border: Border.all(color: colors.line)),
        child: Icon(icon, color: colors.primary, size: 24),
      ),
    );
  }
}

class _CalendarGrid extends StatelessWidget {
  final DateTime month;
  final Set<int> eventDays;
  final AppColors colors;

  const _CalendarGrid({required this.month, required this.eventDays, required this.colors});

  @override
  Widget build(BuildContext context) {
    final firstDay = DateTime(month.year, month.month, 1);
    final daysInMonth = DateTime(month.year, month.month + 1, 0).day;
    final leading = firstDay.weekday % 7;
    final cells = leading + daysInMonth;
    final totalCells = cells <= 35 ? 35 : 42;

    return Column(
      children: [
        Row(
          children: ['日', '一', '二', '三', '四', '五', '六']
              .map((label) => Expanded(
                    child: Center(
                      child: Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: colors.textSub)),
                    ),
                  ))
              .toList(),
        ),
        const SizedBox(height: 10),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: totalCells,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 7, mainAxisSpacing: 8, crossAxisSpacing: 8),
          itemBuilder: (_, index) {
            final day = index - leading + 1;
            final inMonth = day >= 1 && day <= daysInMonth;
            final hasEvent = inMonth && eventDays.contains(day);
            return Container(
              decoration: BoxDecoration(
                color: hasEvent ? colors.softPurple : Colors.transparent,
                borderRadius: BorderRadius.circular(12),
                border: hasEvent ? Border.all(color: colors.primary.withAlpha(64)) : null,
              ),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  Text(
                    inMonth ? '$day' : '',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: hasEvent ? FontWeight.w700 : FontWeight.w500,
                      color: hasEvent ? colors.primary : colors.textMain,
                    ),
                  ),
                  if (hasEvent)
                    Positioned(
                      bottom: 6,
                      child: Container(
                        width: 4,
                        height: 4,
                        decoration: BoxDecoration(color: colors.secondary, shape: BoxShape.circle),
                      ),
                    ),
                ],
              ),
            );
          },
        ),
      ],
    );
  }
}

class _EventCard extends StatelessWidget {
  final _CalendarEvent event;
  final AppColors colors;

  const _EventCard({required this.event, required this.colors});

  @override
  Widget build(BuildContext context) {
    final icon = switch (event.type) {
      _EventType.birthday => Icons.cake_rounded,
      _EventType.anniversary => Icons.favorite_rounded,
      _EventType.memory => Icons.auto_stories_rounded,
    };
    final tint = event.type == _EventType.memory ? colors.softPurple : colors.softOrange;

    return GlassCard(
      colors: colors,
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(color: tint, borderRadius: BorderRadius.circular(16)),
            alignment: Alignment.center,
            child: Text(
              '${event.day}',
              style: TextStyle(fontFamily: 'Outfit', fontSize: 18, fontWeight: FontWeight.w700, color: colors.primary),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(event.title, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: colors.textMain)),
                if (event.subtitle.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(event.subtitle, style: TextStyle(fontSize: 12, color: colors.textSub)),
                ],
              ],
            ),
          ),
          Icon(icon, color: colors.primary, size: 21),
        ],
      ),
    );
  }
}

enum _EventType { birthday, anniversary, memory }

class _CalendarEvent {
  final int day;
  final String title;
  final String subtitle;
  final _EventType type;

  const _CalendarEvent({required this.day, required this.title, required this.subtitle, required this.type});
}
