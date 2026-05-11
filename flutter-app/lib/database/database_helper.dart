import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/person.dart';
import '../models/lifelog_models.dart';
import 'app_database.dart';

class DatabaseHelper {
  static final DatabaseHelper _instance = DatabaseHelper._internal();
  factory DatabaseHelper() => _instance;
  DatabaseHelper._internal();

  AppDatabase? _database;
  SharedPreferences? _prefs;
  bool _initialized = false;
  bool _migrated = false;

  Future<void> _ensureInitialized() async {
    if (_initialized) return;
    _database = AppDatabase();
    _prefs = await SharedPreferences.getInstance();
    _initialized = true;

    // Auto-migrate from SharedPreferences to SQLite
    if (!_migrated && _prefs!.containsKey('lifelog_state')) {
      await _migrateFromSharedPreferences();
      _migrated = true;
    }
  }

  Future<void> _migrateFromSharedPreferences() async {
    try {
      final jsonStr = _prefs!.getString('lifelog_state');
      if (jsonStr == null || jsonStr.isEmpty) return;

      final json = jsonDecode(jsonStr) as Map<String, dynamic>;
      final state = LifeLogState.fromJson(json);

      // Migrate people
      for (final person in state.people) {
        await _database!.insertPerson(person);
      }

      // Migrate places
      for (final place in state.places) {
        await _database!.insertPlace(place);
      }

      // Migrate memories
      for (final memory in state.memories) {
        await _database!.insertMemory(memory);
      }

      // Keep SharedPreferences as backup
      await _prefs!.setString('lifelog_state_backup', jsonStr);
    } catch (e) {
      // Migration failed, keep using SharedPreferences
      print('Migration failed: $e');
    }
  }

  // People operations
  Future<List<Person>> getAllPeople() async {
    await _ensureInitialized();
    return await _database!.getAllPeople();
  }

  Future<void> savePerson(Person person) async {
    await _ensureInitialized();
    final existing = await _database!.getPersonById(person.id);
    if (existing != null) {
      await _database!.updatePerson(person);
    } else {
      await _database!.insertPerson(person);
    }
  }

  Future<void> deletePerson(String id) async {
    await _ensureInitialized();
    await _database!.deletePerson(id);
  }

  Future<List<Person>> searchPeople(String query) async {
    await _ensureInitialized();
    return await _database!.searchPeople(query);
  }

  // Places operations
  Future<List<Place>> getAllPlaces() async {
    await _ensureInitialized();
    return await _database!.getAllPlaces();
  }

  Future<void> savePlace(Place place) async {
    await _ensureInitialized();
    final existing = await _database!.getPlaceById(place.id);
    if (existing != null) {
      await _database!.updatePlace(place);
    } else {
      await _database!.insertPlace(place);
    }
  }

  Future<void> deletePlace(String id) async {
    await _ensureInitialized();
    await _database!.deletePlace(id);
  }

  Future<List<Place>> searchPlaces(String query) async {
    await _ensureInitialized();
    return await _database!.searchPlaces(query);
  }

  // Memories operations
  Future<List<MemoryEvent>> getAllMemories() async {
    await _ensureInitialized();
    return await _database!.getAllMemories();
  }

  Future<void> saveMemory(MemoryEvent memory) async {
    await _ensureInitialized();
    final existing = await _database!.getMemoryById(memory.id);
    if (existing != null) {
      await _database!.updateMemory(memory);
    } else {
      await _database!.insertMemory(memory);
    }
  }

  Future<void> deleteMemory(String id) async {
    await _ensureInitialized();
    await _database!.deleteMemory(id);
  }

  Future<List<MemoryEvent>> searchMemories(String query) async {
    await _ensureInitialized();
    return await _database!.searchMemories(query);
  }

  // Seed data
  Future<void> insertSeedData() async {
    await _ensureInitialized();
    final people = await getAllPeople();
    if (people.isNotEmpty) return;

    // Insert seed data
    await _database!.insertPerson(Person(
      id: '1',
      name: '张三',
      relation: '朋友',
      birthday: '1990-05-15',
      phone: '13800138000',
      tags: ['同事', '技术'],
      favorite: true,
    ));

    await _database!.insertPlace(Place(
      id: '1',
      name: '星巴克',
      city: '杭州',
      area: '西湖区',
      category: '咖啡厅',
      rating: 4.5,
      tags: ['咖啡', '工作'],
      favorite: true,
    ));

    await _database!.insertMemory(MemoryEvent(
      id: '1',
      title: '周末聚会',
      date: DateTime.now().toIso8601String().substring(0, 10),
      personIds: ['1'],
      placeId: '1',
      mood: '开心',
      content: '和朋友们一起喝咖啡聊天',
      tags: ['聚会', '咖啡'],
    ));
  }

  // Export/Import
  Future<String> exportJson() async {
    await _ensureInitialized();
    final people = await getAllPeople();
    final places = await getAllPlaces();
    final memories = await getAllMemories();
    final state = LifeLogState(people: people, places: places, memories: memories);
    return const JsonEncoder.withIndent('  ').convert(state.toJson());
  }

  Future<void> importJson(String jsonStr) async {
    await _ensureInitialized();
    final json = jsonDecode(jsonStr) as Map<String, dynamic>;
    final state = LifeLogState.fromJson(json);

    // Clear existing data
    final existingPeople = await getAllPeople();
    for (final person in existingPeople) {
      await deletePerson(person.id);
    }
    final existingPlaces = await getAllPlaces();
    for (final place in existingPlaces) {
      await deletePlace(place.id);
    }
    final existingMemories = await getAllMemories();
    for (final memory in existingMemories) {
      await deleteMemory(memory.id);
    }

    // Import new data
    for (final person in state.people) {
      await _database!.insertPerson(person);
    }
    for (final place in state.places) {
      await _database!.insertPlace(place);
    }
    for (final memory in state.memories) {
      await _database!.insertMemory(memory);
    }
  }

  Future<void> resetSeedData() async {
    await _ensureInitialized();

    // Clear all data
    final people = await getAllPeople();
    for (final person in people) {
      await deletePerson(person.id);
    }
    final places = await getAllPlaces();
    for (final place in places) {
      await deletePlace(place.id);
    }
    final memories = await getAllMemories();
    for (final memory in memories) {
      await deleteMemory(memory.id);
    }

    // Re-insert seed data
    await insertSeedData();
  }
}
