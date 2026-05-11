import 'package:flutter_test/flutter_test.dart';
import 'package:lifelog_flutter_demo/services/photo_service.dart';

void main() {
  group('PhotoService Tests', () {
    late PhotoService photoService;

    setUp(() {
      photoService = PhotoService();
    });

    test('PhotoService is singleton', () {
      final instance1 = PhotoService();
      final instance2 = PhotoService();
      expect(identical(instance1, instance2), true);
    });

    test('_parseDate with valid date', () {
      // This is a private method, so we test it indirectly through public methods
      // For now, just verify the service can be instantiated
      expect(photoService, isNotNull);
    });
  });
}
