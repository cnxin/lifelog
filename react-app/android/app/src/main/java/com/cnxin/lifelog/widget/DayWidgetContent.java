package com.cnxin.lifelog.widget;

import java.text.NumberFormat;
import java.text.ParseException;
import java.text.ParsePosition;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import org.json.JSONException;
import org.json.JSONObject;

/** Calendar-only presentation logic; no Android API or lunar calculation. */
public final class DayWidgetContent {
    public final String id, title, category, prefix, count, suffix, date;
    public final boolean empty, today;
    private DayWidgetContent(String id, String title, String category, String prefix,
            String count, String suffix, String date, boolean empty, boolean today) {
        this.id = id; this.title = title; this.category = category; this.prefix = prefix;
        this.count = count; this.suffix = suffix; this.date = date;
        this.empty = empty; this.today = today;
    }
    private static DayWidgetContent empty() {
        return new DayWidgetContent("", "记下第一个日子", "倒数日", "", "", "", "点击打开日子", true, false);
    }
    public static DayWidgetContent fromPayload(String json, String localToday) {
        if (json == null) return empty();
        try {
            JSONObject payload = new JSONObject(json);
            if (payload.optInt("version") != 1) return empty();
            JSONObject day = payload.optJSONObject("featured");
            if (day == null || day.optString("title").trim().isEmpty()) return empty();
            String next = day.optString("nextDate");
            int delta = dayDifference(localToday, next);
            return new DayWidgetContent(day.optString("id"), day.optString("title"),
                day.optString("category", "纪念日"), delta == 0 ? "就是今天" : delta > 0 ? "还有" : "已经",
                delta == 0 ? "" : NumberFormat.getIntegerInstance().format(Math.abs(delta)),
                delta == 0 ? "" : "天", next.replace('-', '.'), false, delta == 0);
        } catch (JSONException | ParseException error) {
            return empty();
        }
    }
    public static int dayDifference(String from, String to) throws ParseException {
        return (int) ((ordinal(to) - ordinal(from)) / 86400000L);
    }
    private static long ordinal(String value) throws ParseException {
        if (value == null || !value.matches("\\d{4}-\\d{2}-\\d{2}")) throw new ParseException("Invalid date", 0);
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT);
        format.setTimeZone(TimeZone.getTimeZone("UTC"));
        format.setLenient(false);
        ParsePosition position = new ParsePosition(0);
        Date parsed = format.parse(value, position);
        if (parsed == null || position.getIndex() != value.length()) throw new ParseException("Invalid date", 0);
        return parsed.getTime();
    }
    public static String localToday() {
        Calendar local = Calendar.getInstance();
        return String.format(Locale.ROOT, "%04d-%02d-%02d", local.get(Calendar.YEAR),
            local.get(Calendar.MONTH) + 1, local.get(Calendar.DAY_OF_MONTH));
    }
}
