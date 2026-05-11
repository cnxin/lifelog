import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../database/database_helper.dart';
import '../models/person.dart';
import '../models/lifelog_models.dart';
import '../theme/app_theme.dart';
import '../services/notification_service.dart';

final databaseProvider = Provider<DatabaseHelper>((ref) => DatabaseHelper());
final notificationServiceProvider = Provider<NotificationService>((ref) => NotificationService());

final themeStyleProvider = StateProvider<AppThemeStyle>((ref) => AppThemeStyle.classic);
final themeModeProvider = StateProvider<bool>((ref) => false);
final notificationsEnabledProvider = StateProvider<bool>((ref) => false);

final searchQueryProvider = StateProvider<String>((ref) => '');
final placeSearchQueryProvider = StateProvider<String>((ref) => '');
final memorySearchQueryProvider = StateProvider<String>((ref) => '');

final peopleProvider = AsyncNotifierProvider<PeopleNotifier, List<Person>>(PeopleNotifier.new);
final placesProvider = AsyncNotifierProvider<PlacesNotifier, List<Place>>(PlacesNotifier.new);
final memoriesProvider = AsyncNotifierProvider<MemoriesNotifier, List<MemoryEvent>>(MemoriesNotifier.new);

class PeopleNotifier extends AsyncNotifier<List<Person>> {
  DatabaseHelper get _db => ref.read(databaseProvider);

  @override
  Future<List<Person>> build() async {
    await _db.insertSeedData();
    return _db.getAllPeople();
  }

  Future<void> addPerson(Person person) async {
    await _db.savePerson(person);
    state = AsyncData(await _db.getAllPeople());
    ref.invalidate(memoriesProvider);
    await _updateNotifications();
  }

  Future<void> updatePerson(Person person) async {
    await _db.savePerson(person);
    state = AsyncData(await _db.getAllPeople());
    ref.invalidate(memoriesProvider);
    await _updateNotifications();
  }

  Future<void> deletePerson(String id) async {
    await _db.deletePerson(id);
    state = AsyncData(await _db.getAllPeople());
    ref.invalidate(memoriesProvider);
    await _updateNotifications();
  }

  Future<void> _updateNotifications() async {
    if (ref.read(notificationsEnabledProvider)) {
      final people = state.valueOrNull ?? [];
      await ref.read(notificationServiceProvider).schedulePersonReminders(people);
    }
  }

  Future<void> toggleFavorite(String id) async {
    final current = state.valueOrNull?.firstWhere((p) => p.id == id);
    if (current == null) return;
    await _db.savePerson(current.copyWith(favorite: !current.favorite));
    state = AsyncData(await _db.getAllPeople());
  }

  Future<void> search(String query) async {
    state = AsyncData(query.isEmpty ? await _db.getAllPeople() : await _db.searchPeople(query));
  }
}

class PlacesNotifier extends AsyncNotifier<List<Place>> {
  DatabaseHelper get _db => ref.read(databaseProvider);

  @override
  Future<List<Place>> build() async {
    await _db.insertSeedData();
    return _db.getAllPlaces();
  }

  Future<void> savePlace(Place place) async {
    await _db.savePlace(place);
    state = AsyncData(await _db.getAllPlaces());
    ref.invalidate(memoriesProvider);
  }

  Future<void> deletePlace(String id) async {
    await _db.deletePlace(id);
    state = AsyncData(await _db.getAllPlaces());
    ref.invalidate(memoriesProvider);
  }

  Future<void> toggleFavorite(String id) async {
    final current = state.valueOrNull?.firstWhere((p) => p.id == id);
    if (current == null) return;
    await _db.savePlace(current.copyWith(favorite: !current.favorite));
    state = AsyncData(await _db.getAllPlaces());
  }

  Future<void> search(String query) async {
    state = AsyncData(query.isEmpty ? await _db.getAllPlaces() : await _db.searchPlaces(query));
  }
}

class MemoriesNotifier extends AsyncNotifier<List<MemoryEvent>> {
  DatabaseHelper get _db => ref.read(databaseProvider);

  @override
  Future<List<MemoryEvent>> build() async {
    await _db.insertSeedData();
    return _db.getAllMemories();
  }

  Future<void> saveMemory(MemoryEvent memory) async {
    await _db.saveMemory(memory);
    state = AsyncData(await _db.getAllMemories());
  }

  Future<void> deleteMemory(String id) async {
    await _db.deleteMemory(id);
    state = AsyncData(await _db.getAllMemories());
  }

  Future<void> search(String query) async {
    state = AsyncData(query.isEmpty ? await _db.getAllMemories() : await _db.searchMemories(query));
  }
}
