package com.cnxin.lifelog;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;

@CapacitorPlugin(name = "NativeExternalBrowser")
public class NativeExternalBrowserPlugin extends Plugin {
    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url", "").trim();
        if (url.isEmpty()) {
            call.reject("Missing url");
            return;
        }
        String packageName = call.getString("packageName", "").trim();

        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        intent.addCategory(Intent.CATEGORY_BROWSABLE);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        if (!packageName.isEmpty()) {
            intent.setPackage(packageName);
        }

        try {
            getContext().startActivity(intent);
            JSObject result = new JSObject();
            result.put("opened", true);
            call.resolve(result);
        } catch (ActivityNotFoundException error) {
            call.reject("No browser can open this url", error);
        }
    }

    @PluginMethod
    public void installApk(PluginCall call) {
        String url = call.getString("url", "").trim();
        if (url.isEmpty()) {
            call.reject("Missing url");
            return;
        }

        String fileName = sanitizeApkFileName(call.getString("fileName", ""));
        String fallbackUrl = call.getString("fallbackUrl", "").trim();
        execute(() -> downloadAndInstallApk(call, url, fileName, fallbackUrl));
    }

    private void downloadAndInstallApk(PluginCall call, String url, String fileName, String fallbackUrl) {
        File apkFile = new File(getContext().getCacheDir(), fileName);
        try {
            downloadToFile(url, apkFile);
            getBridge().executeOnMainThread(() -> openDownloadedApk(call, apkFile, fallbackUrl));
        } catch (Exception error) {
            getBridge().executeOnMainThread(() -> openFallbackOrReject(call, fallbackUrl, error));
        }
    }

    private void openDownloadedApk(PluginCall call, File apkFile, String fallbackUrl) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW);
            Uri apkUri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apkFile);
            intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);

            JSObject result = new JSObject();
            result.put("opened", true);
            result.put("path", apkFile.getAbsolutePath());
            call.resolve(result);
        } catch (Exception error) {
            openFallbackOrReject(call, fallbackUrl, error);
        }
    }

    private void openFallbackOrReject(PluginCall call, String fallbackUrl, Exception originalError) {
        if (!fallbackUrl.isEmpty()) {
            try {
                Intent fallbackIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(fallbackUrl));
                fallbackIntent.addCategory(Intent.CATEGORY_BROWSABLE);
                fallbackIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(fallbackIntent);
                JSObject result = new JSObject();
                result.put("opened", true);
                result.put("fallback", true);
                call.resolve(result);
                return;
            } catch (ActivityNotFoundException ignored) {
                // Fall through to reject with the original download/install error.
            }
        }
        call.reject("Failed to download or open APK", originalError);
    }

    private void downloadToFile(String rawUrl, File targetFile) throws IOException {
        HttpURLConnection connection = null;
        try {
            URL url = new URL(rawUrl);
            connection = (HttpURLConnection) url.openConnection();
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(60000);
            connection.setInstanceFollowRedirects(true);
            connection.setRequestProperty("Accept", "application/vnd.android.package-archive,application/octet-stream,*/*");
            connection.connect();

            int statusCode = connection.getResponseCode();
            if (statusCode < 200 || statusCode >= 300) {
                throw new IOException("APK download returned HTTP " + statusCode);
            }

            try (BufferedInputStream input = new BufferedInputStream(connection.getInputStream());
                 FileOutputStream output = new FileOutputStream(targetFile, false)) {
                byte[] buffer = new byte[8192];
                int bytesRead;
                while ((bytesRead = input.read(buffer)) != -1) {
                    output.write(buffer, 0, bytesRead);
                }
            }

            if (targetFile.length() < 1024) {
                throw new IOException("Downloaded APK is too small");
            }

            try (FileInputStream fileInput = new FileInputStream(targetFile)) {
                if (fileInput.read() != 'P' || fileInput.read() != 'K') {
                    throw new IOException("Downloaded file is not an APK archive");
                }
            }
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    private String sanitizeApkFileName(String value) {
        String cleaned = value == null ? "" : value.replaceAll("[\\\\/:*?\"<>|]", "_").trim();
        if (cleaned.isEmpty()) {
            cleaned = "lifelog-update.apk";
        }
        return cleaned.toLowerCase().endsWith(".apk") ? cleaned : cleaned + ".apk";
    }
}
