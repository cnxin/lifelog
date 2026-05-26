package com.cnxin.lifelog;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "NativeBackupFile")
public class NativeBackupFilePlugin extends Plugin {
    @PluginMethod
    public void save(PluginCall call) {
        String fileName = sanitizeFileName(call.getString("fileName", "lifelog-backup.json"));
        String content = call.getString("content", "");
        if (content.isEmpty()) {
            call.reject("Missing backup content");
            return;
        }

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE, fileName);
        startActivityForResult(call, intent, "saveBackupResult");
    }

    @ActivityCallback
    private void saveBackupResult(PluginCall call, ActivityResult activityResult) {
        if (call == null) return;

        if (activityResult.getResultCode() != Activity.RESULT_OK || activityResult.getData() == null) {
            call.reject("Backup save canceled");
            return;
        }

        Uri uri = activityResult.getData().getData();
        if (uri == null) {
            call.reject("Missing destination uri");
            return;
        }

        String fileName = sanitizeFileName(call.getString("fileName", "lifelog-backup.json"));
        String content = call.getString("content", "");
        try {
            byte[] data = content.getBytes(StandardCharsets.UTF_8);
            try (OutputStream stream = getContext().getContentResolver().openOutputStream(uri)) {
                if (stream == null) throw new IOException("Cannot open destination file");
                stream.write(data);
            }

            JSObject result = new JSObject();
            result.put("fileName", fileName);
            result.put("path", uri.toString());
            result.put("size", data.length);
            call.resolve(result);
        } catch (IOException error) {
            call.reject("Failed to write backup file", error);
        }
    }

    private String sanitizeFileName(String value) {
        String cleaned = value == null ? "" : value.replaceAll("[\\\\/:*?\"<>|]", "_").trim();
        return cleaned.isEmpty() ? "lifelog-backup.json" : cleaned;
    }
}
