package com.cnxin.lifelog.widget;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import com.cnxin.lifelog.MainActivity;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {
    @PluginMethod
    public void update(PluginCall call) {
        String json = call.getString("json");
        try {
            if (json == null || new JSONObject(json).optInt("version") != 1) {
                call.reject("Invalid widget payload");
                return;
            }
            Context context = getContext();
            context.getSharedPreferences("lifelog_widget", Context.MODE_PRIVATE)
                .edit().putString("payload", json).apply();
            // A class-name component allows the independently buildable bridge
            // commit before F2 supplies/registers the actual provider class.
            ComponentName provider = new ComponentName(context, "com.cnxin.lifelog.widget.DayWidgetProvider");
            int[] ids = AppWidgetManager.getInstance(context).getAppWidgetIds(provider);
            if (ids.length > 0) {
                Intent update = new Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE).setComponent(provider);
                update.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
                context.sendBroadcast(update);
            }
            call.resolve();
        } catch (JSONException error) {
            call.reject("Invalid widget JSON", error);
        }
    }

    @PluginMethod
    public void consumeLaunchDayId(PluginCall call) {
        String id = MainActivity.consumeWidgetDayId();
        JSObject result = new JSObject();
        result.put("dayId", id == null ? JSONObject.NULL : id);
        call.resolve(result);
    }
}
