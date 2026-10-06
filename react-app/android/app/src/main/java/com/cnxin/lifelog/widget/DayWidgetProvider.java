package com.cnxin.lifelog.widget;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;
import com.cnxin.lifelog.MainActivity;
import com.cnxin.lifelog.R;
import java.util.Calendar;

public class DayWidgetProvider extends AppWidgetProvider {
    private static final int DAILY_REQUEST = 73005;
    private static ComponentName component(Context context) {
        return new ComponentName(context, DayWidgetProvider.class);
    }
    public static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(component(context));
        if (ids.length > 0) new DayWidgetProvider().onUpdate(context, manager, ids);
    }
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        String json = context.getSharedPreferences("lifelog_widget", Context.MODE_PRIVATE).getString("payload", null);
        DayWidgetContent day = DayWidgetContent.fromPayload(json, DayWidgetContent.localToday());
        for (int id : ids) render(context, manager, id, day);
        scheduleDaily(context);
    }
    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, android.os.Bundle options) {
        onUpdate(context, manager, new int[] { id });
    }
    private static void render(Context context, AppWidgetManager manager, int id, DayWidgetContent day) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_day);
        int background = "生日".equals(day.category) ? R.drawable.widget_day_amber
            : "倒数日".equals(day.category) ? R.drawable.widget_day_sage : R.drawable.widget_day_rose;
        views.setInt(R.id.widget_root, "setBackgroundResource", background);
        views.setTextViewText(R.id.widget_title, day.title);
        views.setTextViewText(R.id.widget_prefix, day.prefix);
        views.setTextViewText(R.id.widget_count, day.count);
        views.setTextViewText(R.id.widget_suffix, day.suffix);
        views.setTextViewText(R.id.widget_years, day.yearsLabel);
        views.setViewVisibility(R.id.widget_years, day.yearsLabel.isEmpty() ? View.GONE : View.VISIBLE);
        views.setTextViewText(R.id.widget_date, day.date);
        views.setViewVisibility(R.id.widget_number_row, day.empty ? View.GONE : View.VISIBLE);
        views.setViewVisibility(R.id.widget_count, day.today ? View.GONE : View.VISIBLE);
        views.setViewVisibility(R.id.widget_suffix, day.today ? View.GONE : View.VISIBLE);
        views.setTextViewTextSize(R.id.widget_prefix, TypedValue.COMPLEX_UNIT_SP, day.today ? 20 : 12);
        int width = Math.max(110, manager.getAppWidgetOptions(id).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 110));
        float scale = context.getResources().getConfiguration().fontScale;
        float space = Math.max(24, width - 24 - 44 * scale);
        float countSize = Math.max(12, Math.min(32, space / (Math.max(1, day.count.length()) * .65f * scale)));
        views.setTextViewTextSize(R.id.widget_count, TypedValue.COMPLEX_UNIT_SP, countSize);
        views.setContentDescription(R.id.widget_root, day.empty ? day.title : day.title + "，" + day.prefix + day.count + day.suffix
            + (day.yearsLabel.isEmpty() ? "" : "，" + day.yearsLabel) + "，" + day.date);
        Intent launch = new Intent(context, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (!day.empty && !day.id.isEmpty()) launch.putExtra("day_id", day.id);
        PendingIntent click = PendingIntent.getActivity(context, id, launch,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, click);
        manager.updateAppWidget(id, views);
    }
    private static PendingIntent dailyIntent(Context context) {
        Intent update = new Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE).setComponent(component(context));
        update.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS,
            AppWidgetManager.getInstance(context).getAppWidgetIds(component(context)));
        return PendingIntent.getBroadcast(context, DAILY_REQUEST, update,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    public static void scheduleDaily(Context context) {
        if (AppWidgetManager.getInstance(context).getAppWidgetIds(component(context)).length == 0) return;
        Calendar next = Calendar.getInstance();
        next.set(Calendar.HOUR_OF_DAY, 0); next.set(Calendar.MINUTE, 5);
        next.set(Calendar.SECOND, 0); next.set(Calendar.MILLISECOND, 0);
        if (next.getTimeInMillis() <= System.currentTimeMillis()) next.add(Calendar.DAY_OF_MONTH, 1);
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        alarms.setInexactRepeating(AlarmManager.RTC, next.getTimeInMillis(), AlarmManager.INTERVAL_DAY, dailyIntent(context));
    }
    @Override public void onEnabled(Context context) { scheduleDaily(context); }
    @Override public void onDisabled(Context context) {
        ((AlarmManager) context.getSystemService(Context.ALARM_SERVICE)).cancel(dailyIntent(context));
    }
}
