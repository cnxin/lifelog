import 'package:drift/drift.dart';

class People extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get uuid => text().unique()();
  TextColumn get name => text()();
  TextColumn get relation => text().withDefault(const Constant(''))();
  TextColumn get birthday => text().withDefault(const Constant(''))();
  TextColumn get anniversary => text().withDefault(const Constant(''))();
  TextColumn get phone => text().withDefault(const Constant(''))();
  TextColumn get email => text().withDefault(const Constant(''))();
  TextColumn get address => text().withDefault(const Constant(''))();
  TextColumn get notes => text().withDefault(const Constant(''))();
  TextColumn get tags => text().withDefault(const Constant('[]'))();
  TextColumn get photos => text().withDefault(const Constant('[]'))();
  BoolColumn get favorite => boolean().withDefault(const Constant(false))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
}

class Places extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get uuid => text().unique()();
  TextColumn get name => text()();
  TextColumn get province => text().withDefault(const Constant(''))();
  TextColumn get city => text().withDefault(const Constant(''))();
  TextColumn get area => text().withDefault(const Constant(''))();
  TextColumn get mall => text().withDefault(const Constant(''))();
  TextColumn get storeName => text().withDefault(const Constant(''))();
  TextColumn get category => text().withDefault(const Constant(''))();
  RealColumn get rating => real().withDefault(const Constant(0.0))();
  TextColumn get address => text().withDefault(const Constant(''))();
  TextColumn get mapUrl => text().withDefault(const Constant(''))();
  TextColumn get sourceUrl => text().withDefault(const Constant(''))();
  TextColumn get platformLinks => text().withDefault(const Constant('[]'))();
  TextColumn get desc => text().withDefault(const Constant(''))();
  TextColumn get tags => text().withDefault(const Constant('[]'))();
  TextColumn get photos => text().withDefault(const Constant('[]'))();
  BoolColumn get favorite => boolean().withDefault(const Constant(false))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
}

class Memories extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get uuid => text().unique()();
  TextColumn get title => text()();
  TextColumn get date => text()();
  TextColumn get personIds => text().withDefault(const Constant('[]'))();
  TextColumn get placeId => text().withDefault(const Constant(''))();
  TextColumn get mood => text().withDefault(const Constant(''))();
  TextColumn get content => text().withDefault(const Constant(''))();
  TextColumn get tags => text().withDefault(const Constant('[]'))();
  TextColumn get photos => text().withDefault(const Constant('[]'))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
}
