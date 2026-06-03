package com.cnxin.lifelog;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.BridgeActivity;
import org.json.JSONException;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private String pendingShareText;
    private String pendingDeepLink;
    private final Handler shareHandler = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeExternalBrowserPlugin.class);
        registerPlugin(NativeBackupFilePlugin.class);
        registerPlugin(NativeImageSharePlugin.class);
        captureShareText(getIntent());
        captureDeepLink(getIntent());
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        captureShareText(intent);
        captureDeepLink(intent);
        super.onNewIntent(intent);
        setIntent(intent);
        dispatchPendingShareText();
        dispatchPendingDeepLink();
    }

    @Override
    public void onResume() {
        super.onResume();
        dispatchPendingShareText();
        dispatchPendingDeepLink();
    }

    private void captureShareText(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) {
            return;
        }

        String type = intent.getType();
        if (type == null || !type.startsWith("text/")) {
            return;
        }

        CharSequence shared = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
        if (shared == null) {
            return;
        }

        String text = shared.toString().trim();
        if (!text.isEmpty()) {
            pendingShareText = text;
        }
    }

    private void dispatchPendingShareText() {
        if (bridge == null || pendingShareText == null || pendingShareText.isEmpty()) {
            return;
        }

        try {
            JSONObject payload = new JSONObject();
            payload.put("text", pendingShareText);
            String data = payload.toString();
            bridge.triggerWindowJSEvent("lifelog:android-share-text", data);
            shareHandler.postDelayed(() -> dispatchSharePayload(data), 400);
            shareHandler.postDelayed(() -> dispatchSharePayload(data), 1200);
            shareHandler.postDelayed(() -> dispatchSharePayload(data), 2500);
            pendingShareText = null;
        } catch (JSONException error) {
            pendingShareText = null;
        }
    }

    private void dispatchSharePayload(String data) {
        if (bridge != null) {
            bridge.triggerWindowJSEvent("lifelog:android-share-text", data);
        }
    }

    private void captureDeepLink(Intent intent) {
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction()) || intent.getData() == null) {
            return;
        }

        String url = intent.getData().toString();
        if (url.startsWith("lifelog://share/import")) {
            pendingDeepLink = url;
        }
    }

    private void dispatchPendingDeepLink() {
        if (bridge == null || pendingDeepLink == null || pendingDeepLink.isEmpty()) {
            return;
        }

        try {
            JSONObject payload = new JSONObject();
            payload.put("url", pendingDeepLink);
            String data = payload.toString();
            bridge.triggerWindowJSEvent("lifelog:deep-link", data);
            shareHandler.postDelayed(() -> dispatchDeepLinkPayload(data), 400);
            shareHandler.postDelayed(() -> dispatchDeepLinkPayload(data), 1200);
            pendingDeepLink = null;
        } catch (JSONException error) {
            pendingDeepLink = null;
        }
    }

    private void dispatchDeepLinkPayload(String data) {
        if (bridge != null) {
            bridge.triggerWindowJSEvent("lifelog:deep-link", data);
        }
    }
}
