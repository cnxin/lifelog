package com.cnxin.lifelog;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
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
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

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
    public void canInstallPackages(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", canRequestPackageInstalls());
        call.resolve(result);
    }

    @PluginMethod
    public void openInstallPermissionSettings(PluginCall call) {
        Intent intent;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Uri uri = Uri.parse("package:" + getContext().getPackageName());
            intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, uri);
        } else {
            intent = new Intent(Settings.ACTION_SECURITY_SETTINGS);
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        try {
            getContext().startActivity(intent);
            JSObject result = new JSObject();
            result.put("opened", true);
            call.resolve(result);
        } catch (ActivityNotFoundException error) {
            call.reject("Cannot open install permission settings", error);
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
        String expectedSha256 = call.getString("expectedSha256", "").trim().toLowerCase();
        Double expectedSizeValue = call.getDouble("expectedSize", 0D);
        long expectedSize = expectedSizeValue == null ? 0L : Math.max(0L, Math.round(expectedSizeValue));
        execute(() -> downloadAndInstallApk(call, url, fileName, fallbackUrl, expectedSha256, expectedSize));
    }

    private void downloadAndInstallApk(PluginCall call, String url, String fileName, String fallbackUrl, String expectedSha256, long expectedSize) {
        File apkFile = new File(getContext().getCacheDir(), fileName);
        try {
            downloadToFile(url, apkFile, expectedSha256, expectedSize);
            getBridge().executeOnMainThread(() -> openDownloadedApk(call, apkFile, fallbackUrl));
        } catch (Exception error) {
            if (!fallbackUrl.isEmpty() && !fallbackUrl.equals(url)) {
                try {
                    if (apkFile.exists() && !apkFile.delete()) {
                        // Best effort cleanup before retrying the备用源。
                    }
                    notifyApkProgress("fallback", 0, 0, apkFile.getName(), error.getMessage());
                    downloadToFile(fallbackUrl, apkFile, expectedSha256, expectedSize);
                    getBridge().executeOnMainThread(() -> openDownloadedApk(call, apkFile, ""));
                    return;
                } catch (Exception fallbackError) {
                    getBridge().executeOnMainThread(() -> openFallbackOrReject(call, fallbackUrl, fallbackError));
                    return;
                }
            }
            getBridge().executeOnMainThread(() -> openFallbackOrReject(call, fallbackUrl, error));
        }
    }

    private void openDownloadedApk(PluginCall call, File apkFile, String fallbackUrl) {
        try {
            if (!canRequestPackageInstalls()) {
                openInstallPermissionSettings(call);
                return;
            }

            notifyApkProgress("opening", apkFile.length(), apkFile.length(), apkFile.getName(), "");
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
                notifyApkProgress("fallback", 0, 0, "", originalError.getMessage());
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
        notifyApkProgress("failed", 0, 0, "", originalError.getMessage());
        call.reject("Failed to download or open APK", originalError);
    }

    private void downloadToFile(String rawUrl, File targetFile, String expectedSha256, long expectedSize) throws IOException {
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

            long contentLength = connection.getContentLengthLong();
            long totalBytes = contentLength > 0 ? contentLength : Math.max(0, expectedSize);
            notifyApkProgress("downloading", 0, totalBytes, targetFile.getName(), "");
            try (BufferedInputStream input = new BufferedInputStream(connection.getInputStream());
                 FileOutputStream output = new FileOutputStream(targetFile, false)) {
                byte[] buffer = new byte[8192];
                int bytesRead;
                long downloadedBytes = 0;
                long lastNotifiedBytes = 0;
                while ((bytesRead = input.read(buffer)) != -1) {
                    output.write(buffer, 0, bytesRead);
                    downloadedBytes += bytesRead;
                    if (downloadedBytes - lastNotifiedBytes >= 131072 || downloadedBytes == totalBytes) {
                        notifyApkProgress("downloading", downloadedBytes, totalBytes, targetFile.getName(), "");
                        lastNotifiedBytes = downloadedBytes;
                    }
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

            notifyApkProgress("verifying", targetFile.length(), targetFile.length(), targetFile.getName(), "");
            String actualSha256 = getSha256(targetFile);
            if (!expectedSha256.isEmpty() && !expectedSha256.equals(actualSha256)) {
                throw new IOException("APK SHA256 mismatch: " + actualSha256);
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

    private String getSha256(File file) throws IOException {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (DigestInputStream input = new DigestInputStream(new FileInputStream(file), digest)) {
                byte[] buffer = new byte[8192];
                while (input.read(buffer) != -1) {
                    // DigestInputStream updates the digest as bytes are read.
                }
            }
            StringBuilder builder = new StringBuilder();
            for (byte item : digest.digest()) {
                builder.append(String.format("%02x", item));
            }
            return builder.toString();
        } catch (NoSuchAlgorithmException error) {
            throw new IOException("SHA-256 is not available", error);
        }
    }

    private void notifyApkProgress(String stage, long bytesRead, long totalBytes, String fileName, String message) {
        JSObject progress = new JSObject();
        progress.put("stage", stage);
        progress.put("bytesRead", bytesRead);
        progress.put("totalBytes", totalBytes);
        progress.put("percent", totalBytes > 0 ? Math.min(100, Math.round((bytesRead * 100.0) / totalBytes)) : 0);
        progress.put("fileName", fileName == null ? "" : fileName);
        progress.put("message", message == null ? "" : message);
        getBridge().executeOnMainThread(() -> notifyListeners("apkDownloadProgress", progress));
    }

    private boolean canRequestPackageInstalls() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.O || getContext().getPackageManager().canRequestPackageInstalls();
    }
}
