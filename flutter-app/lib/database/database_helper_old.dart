import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../models/person.dart';
import '../models/lifelog_models.dart';

class DatabaseHelper {
  static const _storageKey = 'lifelog_flutter_state_v1';

  static final DatabaseHelper _instance = DatabaseHelper._internal();
  factory DatabaseHelper() => _instance;
  DatabaseHelper._internal();

  final List<Person> _people = [];
  final List<Place> _places = [];
  final List<MemoryEvent> _memories = [];
  bool _initialized = false;

  Future<void> _ensureInitialized() async {
    if (_initialized) return;
    _initialized = true;
    final restored = await _restore();
    if (!restored) await insertSeedData();
  }

  Future<bool> _restore() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_storageKey);
    if (raw == null || raw.isEmpty) return false;
    try {
      final decoded = jsonDecode(raw) as Map<String, dynamic>;
      final state = LifeLogState.fromJson(decoded);
      _people
        ..clear()
        ..addAll(state.people);
      _places
        ..clear()
        ..addAll(state.places);
      _memories
        ..clear()
        ..addAll(state.memories);
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> _persist() async {
    final prefs = await SharedPreferences.getInstance();
    final state = LifeLogState(people: _people, places: _places, memories: _memories);
    await prefs.setString(_storageKey, jsonEncode(state.toJson()));
  }

  Future<LifeLogState> getState() async {
    await _ensureInitialized();
    return LifeLogState(
      people: await getAllPeople(),
      places: await getAllPlaces(),
      memories: await getAllMemories(),
    );
  }

  Future<String> exportJson() async {
    await _ensureInitialized();
    final state = LifeLogState(people: _people, places: _places, memories: _memories);
    return const JsonEncoder.withIndent('  ').convert(state.toJson());
  }

  Future<void> importJson(String raw) async {
    final decoded = jsonDecode(raw);
    if (decoded is! Map) throw const FormatException('Invalid LifeLog data');
    final state = LifeLogState.fromJson(Map<String, dynamic>.from(decoded));
    _people
      ..clear()
      ..addAll(state.people);
    _places
      ..clear()
      ..addAll(state.places);
    _memories
      ..clear()
      ..addAll(state.memories);
    _initialized = true;
    await _persist();
  }

  Future<void> resetSeedData() async {
    await _ensureInitialized();
    _people.clear();
    _places.clear();
    _memories.clear();
    await insertSeedData();
  }

  Future<List<Person>> getAllPeople() async {
    await _ensureInitialized();
    final sorted = List<Person>.from(_people);
    sorted.sort((a, b) {
      if (a.favorite != b.favorite) return a.favorite ? -1 : 1;
      return a.name.compareTo(b.name);
    });
    return sorted;
  }

  Future<Person?> getPerson(String id) async {
    await _ensureInitialized();
    try {
      return _people.firstWhere((p) => p.id == id);
    } catch (_) {
      return null;
    }
  }

  Future<void> savePerson(Person person) async {
    await _ensureInitialized();
    final idx = _people.indexWhere((p) => p.id == person.id);
    if (idx >= 0) {
      _people[idx] = person;
    } else {
      _people.add(person);
    }
    await _persist();
  }

  Future<void> deletePerson(String id) async {
    await _ensureInitialized();
    _people.removeWhere((p) => p.id == id);
    for (var i = 0; i < _memories.length; i++) {
      final memory = _memories[i];
      _memories[i] = memory.copyWith(personIds: memory.personIds.where((pid) => pid != id).toList());
    }
    await _persist();
  }

  Future<List<Person>> searchPeople(String query) async {
    await _ensureInitialized();
    final q = query.toLowerCase();
    final results = _people.where((p) =>
      p.name.toLowerCase().contains(q) ||
      p.nickname.toLowerCase().contains(q) ||
      p.relationship.toLowerCase().contains(q)
    ).toList();
    results.sort((a, b) {
      if (a.favorite != b.favorite) return a.favorite ? -1 : 1;
      return a.name.compareTo(b.name);
    });
    return results;
  }

  Future<List<Place>> getAllPlaces() async {
    await _ensureInitialized();
    final sorted = List<Place>.from(_places);
    sorted.sort((a, b) {
      if (a.favorite != b.favorite) return a.favorite ? -1 : 1;
      return a.name.compareTo(b.name);
    });
    return sorted;
  }

  Future<void> savePlace(Place place) async {
    await _ensureInitialized();
    final idx = _places.indexWhere((p) => p.id == place.id);
    if (idx >= 0) {
      _places[idx] = place;
    } else {
      _places.add(place);
    }
    await _persist();
  }

  Future<void> deletePlace(String id) async {
    await _ensureInitialized();
    _places.removeWhere((p) => p.id == id);
    for (var i = 0; i < _memories.length; i++) {
      final memory = _memories[i];
      if (memory.placeId == id) _memories[i] = memory.copyWith(placeId: '');
    }
    await _persist();
  }

  Future<List<Place>> searchPlaces(String query) async {
    await _ensureInitialized();
    final q = query.toLowerCase();
    final results = _places.where((p) =>
      p.name.toLowerCase().contains(q) ||
      p.city.toLowerCase().contains(q) ||
      p.category.toLowerCase().contains(q) ||
      p.address.toLowerCase().contains(q) ||
      p.tags.any((tag) => tag.toLowerCase().contains(q))
    ).toList();
    results.sort((a, b) {
      if (a.favorite != b.favorite) return a.favorite ? -1 : 1;
      return a.name.compareTo(b.name);
    });
    return results;
  }

  Future<List<MemoryEvent>> getAllMemories() async {
    await _ensureInitialized();
    final sorted = List<MemoryEvent>.from(_memories);
    sorted.sort((a, b) => b.date.compareTo(a.date));
    return sorted;
  }

  Future<void> saveMemory(MemoryEvent memory) async {
    await _ensureInitialized();
    final idx = _memories.indexWhere((m) => m.id == memory.id);
    if (idx >= 0) {
      _memories[idx] = memory;
    } else {
      _memories.add(memory);
    }
    await _persist();
  }

  Future<void> deleteMemory(String id) async {
    await _ensureInitialized();
    _memories.removeWhere((m) => m.id == id);
    await _persist();
  }

  Future<List<MemoryEvent>> searchMemories(String query) async {
    await _ensureInitialized();
    final q = query.toLowerCase();
    final results = _memories.where((m) =>
      m.title.toLowerCase().contains(q) ||
      m.content.toLowerCase().contains(q) ||
      m.mood.toLowerCase().contains(q) ||
      m.tags.any((tag) => tag.toLowerCase().contains(q))
    ).toList();
    results.sort((a, b) => b.date.compareTo(a.date));
    return results;
  }

  Future<void> insertSeedData() async {
    if (_people.isNotEmpty || _places.isNotEmpty || _memories.isNotEmpty) return;

    _people.addAll(const [
      Person(
        id: 'p1',
        name: '小明',
        nickname: '明明',
        relationship: '朋友',
        birthday: '1999-04-15',
        favorite: true,
        preferences: [
          PreferenceGroup(category: '颜色', items: ['蓝色', '黑色']),
          PreferenceGroup(category: '食物', items: ['火锅', '寿司']),
          PreferenceGroup(category: '饮品', items: ['美式咖啡']),
        ],
        dislikes: [
          PreferenceGroup(category: '过敏', items: ['花生']),
          PreferenceGroup(category: '食物', items: ['香菜']),
        ],
        anniversaries: [Anniversary(title: '生日', date: '1999-04-15')],
        notes: '喜欢安静靠窗的位置。',
      ),
      Person(
        id: 'p2',
        name: '小红',
        relationship: '同事',
        birthday: '2000-09-01',
        favorite: true,
        preferences: [
          PreferenceGroup(category: '电影', items: ['悬疑', '动画']),
          PreferenceGroup(category: '饮品', items: ['抹茶拿铁']),
          PreferenceGroup(category: '动物', items: ['猫']),
        ],
        dislikes: [PreferenceGroup(category: '口味', items: ['太辣'])],
        anniversaries: [Anniversary(title: '相识日', date: '2024-09-01')],
        notes: '适合约电影和咖啡。',
      ),
      Person(
        id: 'p3',
        name: '妈妈',
        relationship: '家人',
        birthday: '1976-11-18',
        favorite: true,
        preferences: [
          PreferenceGroup(category: '礼物', items: ['暖色围巾', '实用小家电']),
          PreferenceGroup(category: '食物', items: ['清淡菜']),
          PreferenceGroup(category: '活动', items: ['散步']),
        ],
        dislikes: [PreferenceGroup(category: '口味', items: ['太甜'])],
        anniversaries: [Anniversary(title: '生日', date: '1976-11-18')],
        notes: '送礼优先考虑实用。',
      ),
    ]);

    _places.addAll(const [
      Place(
        id: 'l1',
        name: '海底捞',
        province: '浙江省',
        city: '杭州',
        area: '拱墅区',
        mall: '万达广场',
        storeName: '万达店',
        category: '餐厅',
        rating: 4.8,
        address: '杭州市拱墅区万达广场 5F',
        desc: '服务稳定，适合多人聚餐。',
        tags: ['火锅', '聚餐'],
        favorite: true,
      ),
      Place(
        id: 'l2',
        name: 'Blue Bottle',
        province: '浙江省',
        city: '杭州',
        area: '上城区',
        mall: '湖滨银泰',
        storeName: '湖滨店',
        category: '咖啡厅',
        rating: 4.6,
        address: '杭州市上城区湖滨银泰商圈',
        desc: '环境安静，适合聊天。',
        tags: ['咖啡', '安静'],
      ),
      Place(
        id: 'l3',
        name: '万达影城',
        province: '浙江省',
        city: '杭州',
        area: '拱墅区',
        mall: '万达广场',
        storeName: 'IMAX 厅',
        category: '电影院',
        rating: 4.3,
        address: '杭州市拱墅区万达广场 6F',
        desc: '音效不错，周末排队久。',
        tags: ['电影', '商场'],
      ),
    ]);

    _memories.addAll(const [
      MemoryEvent(
        id: 'm1',
        title: '和小明吃火锅',
        date: '2026-04-24',
        personIds: ['p1'],
        placeId: 'l1',
        mood: '轻松',
        content: '小明很喜欢番茄锅和虾滑，下次可以提前排号。',
        tags: ['聚餐', '火锅'],
      ),
      MemoryEvent(
        id: 'm2',
        title: '周末看电影',
        date: '2026-04-26',
        personIds: ['p2'],
        placeId: 'l3',
        mood: '愉快',
        content: '看完电影后聊了很久，附近咖啡店可以作为下次备选。',
        tags: ['电影'],
      ),
    ]);
    await _persist();
  }
}