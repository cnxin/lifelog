package com.cnxin.lifelog;

import android.Manifest;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;

@CapacitorPlugin(name = "NativeImageShare")
public class NativeImageSharePlugin extends Plugin {
    @PluginMethod
    public void saveToGallery(PluginCall call) {
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P
            && ContextCompat.checkSelfPermission(getContext(), Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(getActivity(), new String[] { Manifest.permission.WRITE_EXTERNAL_STORAGE }, 4107);
            call.reject("需要授权存储权限后再保存二维码到相册");
            return;
        }

        String fileName = sanitizePngFileName(call.getString("fileName", "lifelog-qr.png"));
        byte[] data;
        try {
            data = decodeBase64Content(call);
        } catch (IllegalArgumentException error) {
            call.reject("Invalid image data", error);
            return;
        }

        try {
            Uri uri = savePngToGallery(fileName, data);
            JSObject result = new JSObject();
            result.put("fileName", fileName);
            result.put("uri", uri.toString());
            result.put("size", data.length);
            call.resolve(result);
        } catch (IOException error) {
            call.reject("Failed to save image", error);
        }
    }

    @PluginMethod
    public void share(PluginCall call) {
        String fileName = sanitizePngFileName(call.getString("fileName", "lifelog-qr.png"));
        String title = call.getString("title", "分享 LifeLog 二维码");
        byte[] data;
        try {
            data = decodeBase64Content(call);
        } catch (IllegalArgumentException error) {
            call.reject("Invalid image data", error);
            return;
        }

        try {
            File imageFile = new File(getContext().getCacheDir(), fileName);
            try (FileOutputStream stream = new FileOutputStream(imageFile)) {
                stream.write(data);
            }

            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", imageFile);
            Intent shareIntent = new Intent(Intent.ACTION_SEND);
            shareIntent.setType("image/png");
            shareIntent.putExtra(Intent.EXTRA_STREAM, uri);
            shareIntent.setClipData(ClipData.newUri(getContext().getContentResolver(), fileName, uri));
            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            Intent chooser = Intent.createChooser(shareIntent, title);
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getContext().startActivity(chooser);

            JSObject result = new JSObject();
            result.put("shared", true);
            call.resolve(result);
        } catch (IOException error) {
            call.reject("Failed to prepare image", error);
        } catch (ActivityNotFoundException error) {
            call.reject("No app can share this image", error);
        }
    }

    private Uri savePngToGallery(String fileName, byte[] data) throws IOException {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            File directory = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), "LifeLog");
            if (!directory.exists() && !directory.mkdirs()) {
                throw new IOException("Cannot create gallery directory");
            }
            File imageFile = new File(directory, fileName);
            try (FileOutputStream stream = new FileOutputStream(imageFile)) {
                stream.write(data);
            }

            ContentValues values = new ContentValues();
            values.put(MediaStore.Images.Media.DISPLAY_NAME, fileName);
            values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
            values.put(MediaStore.Images.Media.DATA, imageFile.getAbsolutePath());
            Uri uri = getContext().getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
            return uri == null ? Uri.fromFile(imageFile) : uri;
        }

        ContentValues values = new ContentValues();
        values.put(MediaStore.Images.Media.DISPLAY_NAME, fileName);
        values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
        values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/LifeLog");
        values.put(MediaStore.Images.Media.IS_PENDING, 1);

        Uri collection = MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
        Uri uri = getContext().getContentResolver().insert(collection, values);
        if (uri == null) {
            throw new IOException("Cannot create gallery image");
        }

        try (OutputStream stream = getContext().getContentResolver().openOutputStream(uri)) {
            if (stream == null) throw new IOException("Cannot open gallery image");
            stream.write(data);
        }

        values.clear();
        values.put(MediaStore.Images.Media.IS_PENDING, 0);
        getContext().getContentResolver().update(uri, values, null, null);

        return uri;
    }

    private byte[] decodeBase64Content(PluginCall call) {
        String base64Content = call.getString("base64Content", "");
        if (base64Content.contains(",")) {
            base64Content = base64Content.substring(base64Content.indexOf(",") + 1);
        }
        if (base64Content.isEmpty()) {
            throw new IllegalArgumentException("Missing image data");
        }
        return Base64.decode(base64Content, Base64.DEFAULT);
    }

    private String sanitizePngFileName(String value) {
        String cleaned = value == null ? "" : value.replaceAll("[\\\\/:*?\"<>|]", "_").trim();
        if (cleaned.isEmpty()) cleaned = "lifelog-qr.png";
        return cleaned.toLowerCase().endsWith(".png") ? cleaned : cleaned + ".png";
    }
}
