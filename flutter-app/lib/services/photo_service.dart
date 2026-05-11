import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:image_picker/image_picker.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';

class PhotoService {
  static final PhotoService _instance = PhotoService._internal();
  factory PhotoService() => _instance;
  PhotoService._internal();

  final ImagePicker _picker = ImagePicker();
  final Uuid _uuid = const Uuid();

  Future<String?> pickAndSavePhoto({bool fromCamera = false}) async {
    try {
      final XFile? image = await _picker.pickImage(
        source: fromCamera ? ImageSource.camera : ImageSource.gallery,
        maxWidth: 1920,
        maxHeight: 1920,
        imageQuality: 85,
      );

      if (image == null) return null;

      final compressed = await _compressImage(image.path);
      if (compressed == null) return image.path;

      final saved = await _saveToAppDirectory(compressed);
      return saved;
    } catch (e) {
      if (kDebugMode) print('Photo pick error: $e');
      return null;
    }
  }

  Future<List<String>> pickMultiplePhotos() async {
    try {
      final List<XFile> images = await _picker.pickMultiImage(
        maxWidth: 1920,
        maxHeight: 1920,
        imageQuality: 85,
      );

      final List<String> paths = [];
      for (final image in images) {
        final compressed = await _compressImage(image.path);
        final path = compressed ?? image.path;
        final saved = await _saveToAppDirectory(path);
        if (saved != null) paths.add(saved);
      }
      return paths;
    } catch (e) {
      if (kDebugMode) print('Multiple photos pick error: $e');
      return [];
    }
  }

  Future<String?> _compressImage(String path) async {
    try {
      final file = File(path);
      final bytes = await file.readAsBytes();

      if (bytes.length < 500 * 1024) return path;

      final dir = await getTemporaryDirectory();
      final targetPath = '${dir.path}/compressed_${_uuid.v4()}.jpg';

      final result = await FlutterImageCompress.compressAndGetFile(
        path,
        targetPath,
        quality: 80,
        minWidth: 1920,
        minHeight: 1920,
      );

      return result?.path;
    } catch (e) {
      if (kDebugMode) print('Compress error: $e');
      return null;
    }
  }

  Future<String?> _saveToAppDirectory(String sourcePath) async {
    try {
      final dir = await getApplicationDocumentsDirectory();
      final photosDir = Directory('${dir.path}/photos');
      if (!await photosDir.exists()) {
        await photosDir.create(recursive: true);
      }

      final ext = sourcePath.split('.').last;
      final filename = '${_uuid.v4()}.$ext';
      final targetPath = '${photosDir.path}/$filename';

      final sourceFile = File(sourcePath);
      await sourceFile.copy(targetPath);

      return targetPath;
    } catch (e) {
      if (kDebugMode) print('Save error: $e');
      return null;
    }
  }

  Future<void> deletePhoto(String path) async {
    try {
      final file = File(path);
      if (await file.exists()) {
        await file.delete();
      }
    } catch (e) {
      if (kDebugMode) print('Delete error: $e');
    }
  }

  Future<void> deletePhotos(List<String> paths) async {
    for (final path in paths) {
      await deletePhoto(path);
    }
  }
}
