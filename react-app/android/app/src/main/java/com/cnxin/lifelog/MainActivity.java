package com.cnxin.lifelog;

import android.os.Bundle;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.drawable.ColorDrawable;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.cnxin.lifelog.widget.WidgetBridgePlugin;

public class MainActivity extends BridgeActivity {
    private static String widgetDayId;
    public static synchronized String consumeWidgetDayId() {
        String id = widgetDayId;
        widgetDayId = null;
        return id;
    }
    private static synchronized void captureWidgetDayId(Intent intent) {
        String id = intent == null ? null : intent.getStringExtra("day_id");
        widgetDayId = id != null && !id.isEmpty() && id.length() <= 500 ? id : null;
        if (intent != null) intent.removeExtra("day_id");
    }
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeBackupFilePlugin.class);
        registerPlugin(WidgetBridgePlugin.class);
        // BridgeActivity routes the cold initial intent through our override.
        // Do not consume/remove its extra twice before JavaScript can read it.
        super.onCreate(savedInstanceState);
    }
    @Override
    protected void load() {
        // BridgeActivity has inflated the WebView but has not loaded its URL yet.
        applySystemThemeBackground();
        super.load();
    }
    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        applySystemThemeBackground();
    }
    private void applySystemThemeBackground() {
        // Resource qualifiers follow system uiMode, including before CSS paints.
        int color = getColor(R.color.lifelog_background);
        getWindow().setBackgroundDrawable(new ColorDrawable(color));
        WebView webView = findViewById(com.getcapacitor.android.R.id.webview);
        if (webView != null) webView.setBackgroundColor(color);
    }
    @Override
    protected void onNewIntent(Intent intent) {
        captureWidgetDayId(intent);
        super.onNewIntent(intent);
    }
}
