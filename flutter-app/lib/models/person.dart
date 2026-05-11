class PreferenceGroup {
  final String category;
  final List<String> items;

  const PreferenceGroup({required this.category, required this.items});

  Map<String, dynamic> toJson() => {'category': category, 'items': items};
  Map<String, dynamic> toMap() => toJson();

  factory PreferenceGroup.fromJson(Map<String, dynamic> map) {
    return PreferenceGroup(
      category: map['category'] as String? ?? '',
      items: (map['items'] as List?)?.map((item) => item.toString()).toList() ?? [],
    );
  }

  factory PreferenceGroup.fromMap(Map<String, dynamic> map) => PreferenceGroup.fromJson(map);
}

class Anniversary {
  final String title;
  final String date;

  const Anniversary({required this.title, required this.date});

  Map<String, dynamic> toJson() => {'title': title, 'date': date};
  Map<String, dynamic> toMap() => toJson();

  factory Anniversary.fromJson(Map<String, dynamic> map) {
    return Anniversary(
      title: map['title'] as String? ?? '',
      date: map['date'] as String? ?? '',
    );
  }

  factory Anniversary.fromMap(Map<String, dynamic> map) => Anniversary.fromJson(map);
}

class Person {
  final String id;
  final String name;
  final String nickname;
  final String relationship;
  final String? birthday;
  final bool birthdayIsLunar;
  final bool favorite;
  final List<PreferenceGroup> preferences;
  final List<PreferenceGroup> dislikes;
  final List<Anniversary> anniversaries;
  final String notes;

  const Person({
    required this.id,
    required this.name,
    this.nickname = '',
    required this.relationship,
    this.birthday,
    this.birthdayIsLunar = false,
    this.favorite = false,
    this.preferences = const [],
    this.dislikes = const [],
    this.anniversaries = const [],
    this.notes = '',
  });

  Person copyWith({
    String? id,
    String? name,
    String? nickname,
    String? relationship,
    String? birthday,
    bool? birthdayIsLunar,
    bool? favorite,
    List<PreferenceGroup>? preferences,
    List<PreferenceGroup>? dislikes,
    List<Anniversary>? anniversaries,
    String? notes,
  }) {
    return Person(
      id: id ?? this.id,
      name: name ?? this.name,
      nickname: nickname ?? this.nickname,
      relationship: relationship ?? this.relationship,
      birthday: birthday ?? this.birthday,
      birthdayIsLunar: birthdayIsLunar ?? this.birthdayIsLunar,
      favorite: favorite ?? this.favorite,
      preferences: preferences ?? this.preferences,
      dislikes: dislikes ?? this.dislikes,
      anniversaries: anniversaries ?? this.anniversaries,
      notes: notes ?? this.notes,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'nickname': nickname,
      'relationship': relationship,
      'birthday': birthday,
      'birthdayIsLunar': birthdayIsLunar,
      'favorite': favorite,
      'preferences': preferences.map((g) => g.toJson()).toList(),
      'dislikes': dislikes.map((g) => g.toJson()).toList(),
      'anniversaries': anniversaries.map((a) => a.toJson()).toList(),
      'notes': notes,
    };
  }

  Map<String, dynamic> toMap() => toJson();

  factory Person.fromJson(Map<String, dynamic> map) {
    return Person(
      id: map['id'] as String? ?? '',
      name: map['name'] as String? ?? '',
      nickname: map['nickname'] as String? ?? '',
      relationship: map['relationship'] as String? ?? '',
      birthday: map['birthday'] as String?,
      birthdayIsLunar: _boolValue(map['birthdayIsLunar']),
      favorite: _boolValue(map['favorite']),
      preferences: _decodeGroups(map['preferences']),
      dislikes: _decodeGroups(map['dislikes']),
      anniversaries: _decodeAnniversaries(map['anniversaries']),
      notes: map['notes'] as String? ?? '',
    );
  }

  factory Person.fromMap(Map<String, dynamic> map) => Person.fromJson(map);

  static bool _boolValue(Object? value) => value == true || value == 1;

  static List<PreferenceGroup> _decodeGroups(Object? value) {
    if (value is List) {
      return value.whereType<Map>().map((m) => PreferenceGroup.fromJson(Map<String, dynamic>.from(m))).toList();
    }
    if (value is String && value.isNotEmpty) {
      return value.split('|').where((s) => s.isNotEmpty).map((segment) {
        final parts = segment.split(':');
        return PreferenceGroup(
          category: parts[0],
          items: parts.length > 1 ? parts[1].split(',').where((s) => s.isNotEmpty).toList() : <String>[],
        );
      }).toList();
    }
    return [];
  }

  static List<Anniversary> _decodeAnniversaries(Object? value) {
    if (value is List) {
      return value.whereType<Map>().map((m) => Anniversary.fromJson(Map<String, dynamic>.from(m))).toList();
    }
    if (value is String && value.isNotEmpty) {
      return value.split('|').where((s) => s.isNotEmpty).map((segment) {
        final parts = segment.split(':');
        return Anniversary(title: parts[0], date: parts.length > 1 ? parts[1] : '');
      }).toList();
    }
    return [];
  }
}
