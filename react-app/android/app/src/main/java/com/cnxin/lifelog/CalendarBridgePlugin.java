package com.cnxin.lifelog;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.TimeZone;

@CapacitorPlugin(name = "CalendarBridge")
public class CalendarBridgePlugin extends Plugin {
    @PluginMethod
    public void insert(PluginCall call) {
        try {
            if (!Boolean.TRUE.equals(call.getBoolean("allDay", false))) {
                call.reject("Only all-day events are supported");
                return;
            }
            Intent intent = CalendarInsertIntent.create(call.getString("title"),
                call.getString("description", ""), call.getString("startDate"),
                call.getString("rrule"), TimeZone.getDefault());
            if (!CalendarInsertIntent.isAvailable(getContext(), intent)) {
                noCalendar(call);
                return;
            }
            getActivity().startActivity(intent);
            JSObject result = new JSObject();
            result.put("ok", true); // The insert editor opened; saving is up to the user.
            call.resolve(result);
        } catch (ActivityNotFoundException error) {
            noCalendar(call); // Handler may disappear between resolution and launch.
        } catch (IllegalArgumentException | SecurityException error) {
            call.reject("Unable to open calendar", error);
        }
    }

    private void noCalendar(PluginCall call) {
        JSObject result = new JSObject();
        result.put("ok", false);
        result.put("reason", "no-calendar-app");
        call.resolve(result);
    }
}
