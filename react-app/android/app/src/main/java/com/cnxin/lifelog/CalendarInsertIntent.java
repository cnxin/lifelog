package com.cnxin.lifelog;

import android.content.Context;
import android.content.Intent;
import android.provider.CalendarContract;
import java.util.Calendar;
import java.util.GregorianCalendar;
import java.util.TimeZone;

/** Intent assembly only: no calendar permission or ContentProvider writes. */
final class CalendarInsertIntent {
    private CalendarInsertIntent() {}

    static Intent create(String title, String description, String startDate, String rrule, TimeZone zone) {
        if (title == null || title.trim().isEmpty() || startDate == null ||
            !startDate.matches("\\d{4}-\\d{2}-\\d{2}")) {
            throw new IllegalArgumentException("Invalid calendar event");
        }
        if (rrule != null && !"FREQ=YEARLY".equals(rrule)) {
            throw new IllegalArgumentException("Unsupported recurrence");
        }
        String[] parts = startDate.split("-");
        int year = Integer.parseInt(parts[0]);
        int month = Integer.parseInt(parts[1]) - 1;
        int day = Integer.parseInt(parts[2]);
        Calendar validation = new GregorianCalendar(TimeZone.getTimeZone("UTC"));
        validation.clear();
        validation.setLenient(false);
        validation.set(year, month, day);
        validation.getTimeInMillis(); // Reject dates such as February 30 before launching.

        Calendar start = new GregorianCalendar(zone);
        start.clear();
        start.set(year, month, day, 0, 0, 0);
        Calendar end = (Calendar) start.clone();
        end.add(Calendar.DAY_OF_MONTH, 1); // Local next midnight, including 23/25-hour DST days.
        Intent intent = new Intent(Intent.ACTION_INSERT)
            .setDataAndType(CalendarContract.Events.CONTENT_URI, "vnd.android.cursor.dir/event")
            .putExtra(CalendarContract.Events.TITLE, title)
            .putExtra(CalendarContract.Events.DESCRIPTION, description == null ? "" : description)
            .putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, start.getTimeInMillis())
            .putExtra(CalendarContract.EXTRA_EVENT_END_TIME, end.getTimeInMillis())
            .putExtra(CalendarContract.EXTRA_EVENT_ALL_DAY, true);
        if (rrule != null) intent.putExtra(CalendarContract.Events.RRULE, rrule);
        // No standard ACTION_INSERT reminder extra; the receiving app chooses its defaults.
        return intent;
    }

    static boolean isAvailable(Context context, Intent intent) {
        return intent.resolveActivity(context.getPackageManager()) != null;
    }
}
