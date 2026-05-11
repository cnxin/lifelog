import 'dart:io';
import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;
import 'dart:convert';
import '../models/person.dart';
import '../models/lifelog_models.dart';
import 'tables.dart';

part 'app_database.g.dart';

@DriftDatabase(tables: [People, Places, Memories])
class AppDatabase extends _$AppDatabase {
  AppDatabase() : super(_openConnection());

  @override
  int get schemaVersion => 1;

  // People operations
  Future<List<Person>> getAllPeople() async {
    final rows = await select(people).get();
    return rows.map(_personFromRow).toList();
  }

  Future<Person?> getPersonById(String uuid) async {
    final row = await (select(people)..where((p) => p.uuid.equals(uuid))).getSingleOrNull();
    return row != null ? _personFromRow(row) : null;
  }

  Future<void> insertPerson(Person person) async {
    await into(people).insert(
      PeopleCompanion.insert(
        uuid: person.id,
        name: person.name,
        relation: Value(person.relation),
        birthday: Value(person.birthday),
        anniversary: Value(person.anniversary),
        phone: Value(person.phone),
        email: Value(person.email),
        address: Value(person.address),
        notes: Value(person.notes),
        tags: Value(jsonEncode(person.tags)),
        photos: Value(jsonEncode(person.photos)),
        favorite: Value(person.favorite),
      ),
      mode: InsertMode.insertOrReplace,
    );
  }

  Future<void> updatePerson(Person person) async {
    await (update(people)..where((p) => p.uuid.equals(person.id))).write(
      PeopleCompanion(
        name: Value(person.name),
        relation: Value(person.relation),
        birthday: Value(person.birthday),
        anniversary: Value(person.anniversary),
        phone: Value(person.phone),
        email: Value(person.email),
        address: Value(person.address),
        notes: Value(person.notes),
        tags: Value(jsonEncode(person.tags)),
        photos: Value(jsonEncode(person.photos)),
        favorite: Value(person.favorite),
      ),
    );
  }

  Future<void> deletePerson(String uuid) async {
    await (delete(people)..where((p) => p.uuid.equals(uuid))).go();
  }

  Future<List<Person>> searchPeople(String query) async {
    final rows = await (select(people)
          ..where((p) => p.name.like('%$query%') | p.relation.like('%$query%') | p.notes.like('%$query%')))
        .get();
    return rows.map(_personFromRow).toList();
  }

  // Places operations
  Future<List<Place>> getAllPlaces() async {
    final rows = await select(places).get();
    return rows.map(_placeFromRow).toList();
  }

  Future<Place?> getPlaceById(String uuid) async {
    final row = await (select(places)..where((p) => p.uuid.equals(uuid))).getSingleOrNull();
    return row != null ? _placeFromRow(row) : null;
  }

  Future<void> insertPlace(Place place) async {
    await into(places).insert(
      PlacesCompanion.insert(
        uuid: place.id,
        name: place.name,
        province: Value(place.province),
        city: Value(place.city),
        area: Value(place.area),
        mall: Value(place.mall),
        storeName: Value(place.storeName),
        category: Value(place.category),
        rating: Value(place.rating),
        address: Value(place.address),
        mapUrl: Value(place.mapUrl),
        sourceUrl: Value(place.sourceUrl),
        platformLinks: Value(jsonEncode(place.platformLinks.map((l) => l.toJson()).toList())),
        desc: Value(place.desc),
        tags: Value(jsonEncode(place.tags)),
        photos: Value(jsonEncode(place.photos)),
        favorite: Value(place.favorite),
      ),
      mode: InsertMode.insertOrReplace,
    );
  }

  Future<void> updatePlace(Place place) async {
    await (update(places)..where((p) => p.uuid.equals(place.id))).write(
      PlacesCompanion(
        name: Value(place.name),
        province: Value(place.province),
        city: Value(place.city),
        area: Value(place.area),
        mall: Value(place.mall),
        storeName: Value(place.storeName),
        category: Value(place.category),
        rating: Value(place.rating),
        address: Value(place.address),
        mapUrl: Value(place.mapUrl),
        sourceUrl: Value(place.sourceUrl),
        platformLinks: Value(jsonEncode(place.platformLinks.map((l) => l.toJson()).toList())),
        desc: Value(place.desc),
        tags: Value(jsonEncode(place.tags)),
        photos: Value(jsonEncode(place.photos)),
        favorite: Value(place.favorite),
      ),
    );
  }

  Future<void> deletePlace(String uuid) async {
    await (delete(places)..where((p) => p.uuid.equals(uuid))).go();
  }

  Future<List<Place>> searchPlaces(String query) async {
    final rows = await (select(places)
          ..where((p) => p.name.like('%$query%') | p.category.like('%$query%') | p.desc.like('%$query%')))
        .get();
    return rows.map(_placeFromRow).toList();
  }

  // Memories operations
  Future<List<MemoryEvent>> getAllMemories() async {
    final rows = await (select(memories)..orderBy([(m) => OrderingTerm.desc(m.date)])).get();
    return rows.map(_memoryFromRow).toList();
  }

  Future<MemoryEvent?> getMemoryById(String uuid) async {
    final row = await (select(memories)..where((m) => m.uuid.equals(uuid))).getSingleOrNull();
    return row != null ? _memoryFromRow(row) : null;
  }

  Future<void> insertMemory(MemoryEvent memory) async {
    await into(memories).insert(
      MemoriesCompanion.insert(
        uuid: memory.id,
        title: memory.title,
        date: memory.date,
        personIds: Value(jsonEncode(memory.personIds)),
        placeId: Value(memory.placeId),
        mood: Value(memory.mood),
        content: Value(memory.content),
        tags: Value(jsonEncode(memory.tags)),
        photos: Value(jsonEncode(memory.photos)),
      ),
      mode: InsertMode.insertOrReplace,
    );
  }

  Future<void> updateMemory(MemoryEvent memory) async {
    await (update(memories)..where((m) => m.uuid.equals(memory.id))).write(
      MemoriesCompanion(
        title: Value(memory.title),
        date: Value(memory.date),
        personIds: Value(jsonEncode(memory.personIds)),
        placeId: Value(memory.placeId),
        mood: Value(memory.mood),
        content: Value(memory.content),
        tags: Value(jsonEncode(memory.tags)),
        photos: Value(jsonEncode(memory.photos)),
      ),
    );
  }

  Future<void> deleteMemory(String uuid) async {
    await (delete(memories)..where((m) => m.uuid.equals(uuid))).go();
  }

  Future<List<MemoryEvent>> searchMemories(String query) async {
    final rows = await (select(memories)
          ..where((m) => m.title.like('%$query%') | m.content.like('%$query%'))
          ..orderBy([(m) => OrderingTerm.desc(m.date)]))
        .get();
    return rows.map(_memoryFromRow).toList();
  }

  // Helper methods
  Person _personFromRow(PersonData row) {
    return Person(
      id: row.uuid,
      name: row.name,
      relation: row.relation,
      birthday: row.birthday,
      anniversary: row.anniversary,
      phone: row.phone,
      email: row.email,
      address: row.address,
      notes: row.notes,
      tags: (jsonDecode(row.tags) as List).map((e) => e.toString()).toList(),
      photos: (jsonDecode(row.photos) as List).map((e) => e.toString()).toList(),
      favorite: row.favorite,
    );
  }

  Place _placeFromRow(PlaceData row) {
    return Place(
      id: row.uuid,
      name: row.name,
      province: row.province,
      city: row.city,
      area: row.area,
      mall: row.mall,
      storeName: row.storeName,
      category: row.category,
      rating: row.rating,
      address: row.address,
      mapUrl: row.mapUrl,
      sourceUrl: row.sourceUrl,
      platformLinks: (jsonDecode(row.platformLinks) as List)
          .map((e) => PlaceExternalLink.fromJson(e as Map<String, dynamic>))
          .toList(),
      desc: row.desc,
      tags: (jsonDecode(row.tags) as List).map((e) => e.toString()).toList(),
      photos: (jsonDecode(row.photos) as List).map((e) => e.toString()).toList(),
      favorite: row.favorite,
    );
  }

  MemoryEvent _memoryFromRow(MemoryData row) {
    return MemoryEvent(
      id: row.uuid,
      title: row.title,
      date: row.date,
      personIds: (jsonDecode(row.personIds) as List).map((e) => e.toString()).toList(),
      placeId: row.placeId,
      mood: row.mood,
      content: row.content,
      tags: (jsonDecode(row.tags) as List).map((e) => e.toString()).toList(),
      photos: (jsonDecode(row.photos) as List).map((e) => e.toString()).toList(),
    );
  }
}

LazyDatabase _openConnection() {
  return LazyDatabase(() async {
    final dbFolder = await getApplicationDocumentsDirectory();
    final file = File(p.join(dbFolder.path, 'lifelog.db'));
    return NativeDatabase(file);
  });
}
