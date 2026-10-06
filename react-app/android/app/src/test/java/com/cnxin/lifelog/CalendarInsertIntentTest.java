package com.cnxin.lifelog;

import static org.junit.Assert.*;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.ResolveInfo;
import android.provider.CalendarContract;
import java.util.Calendar;
import java.util.HashSet;
import java.util.Set;
import java.util.TimeZone;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.Shadows;
import org.robolectric.annotation.Config;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 28, manifest = Config.NONE)
public class CalendarInsertIntentTest {
    private Intent create(String date, String rrule, String zone) {
        return CalendarInsertIntent.create("纪念日", "备注\n\n来自 LifeLog · 日子", date, rrule, TimeZone.getTimeZone(zone));
    }

    @Test public void realIntentContainsTitleSourceAllDayLocalMidnightsAndSolarRule() {
        Intent intent = create("2027-05-20", "FREQ=YEARLY", "Asia/Shanghai");
        assertEquals(Intent.ACTION_INSERT, intent.getAction());
        assertEquals(CalendarContract.Events.CONTENT_URI, intent.getData());
        assertEquals("vnd.android.cursor.dir/event", intent.getType());
        assertEquals("纪念日", intent.getStringExtra(CalendarContract.Events.TITLE));
        assertEquals("备注\n\n来自 LifeLog · 日子", intent.getStringExtra(CalendarContract.Events.DESCRIPTION));
        assertEquals("FREQ=YEARLY", intent.getStringExtra(CalendarContract.Events.RRULE));
        assertTrue(intent.getBooleanExtra(CalendarContract.EXTRA_EVENT_ALL_DAY, false));
        Calendar begin = Calendar.getInstance(TimeZone.getTimeZone("Asia/Shanghai"));
        begin.setTimeInMillis(intent.getLongExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, -1));
        assertEquals(2027, begin.get(Calendar.YEAR)); assertEquals(Calendar.MAY, begin.get(Calendar.MONTH));
        assertEquals(20, begin.get(Calendar.DAY_OF_MONTH)); assertEquals(0, begin.get(Calendar.HOUR_OF_DAY));
        assertEquals(0, begin.get(Calendar.MINUTE)); assertEquals(0, begin.get(Calendar.SECOND));
        Calendar end = Calendar.getInstance(TimeZone.getTimeZone("Asia/Shanghai"));
        end.setTimeInMillis(intent.getLongExtra(CalendarContract.EXTRA_EVENT_END_TIME, -1));
        assertEquals(21, end.get(Calendar.DAY_OF_MONTH)); assertEquals(0, end.get(Calendar.HOUR_OF_DAY));
    }

    @Test public void noRecurrenceAndNoNonStandardReminderExtras() {
        Intent intent = create("2027-02-06", null, "Asia/Shanghai");
        assertFalse(intent.hasExtra(CalendarContract.Events.RRULE));
        Set<String> expected = new HashSet<>();
        expected.add(CalendarContract.Events.TITLE); expected.add(CalendarContract.Events.DESCRIPTION);
        expected.add(CalendarContract.EXTRA_EVENT_BEGIN_TIME); expected.add(CalendarContract.EXTRA_EVENT_END_TIME);
        expected.add(CalendarContract.EXTRA_EVENT_ALL_DAY);
        assertEquals(expected, intent.getExtras().keySet());
    }

    @Test public void daylightSavingEndIsNextLocalMidnightNotFixed24Hours() {
        for (String date : new String[] { "2026-03-08", "2026-11-01" }) {
            Intent intent = create(date, null, "America/New_York");
            long duration = intent.getLongExtra(CalendarContract.EXTRA_EVENT_END_TIME, -1) -
                intent.getLongExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, -1);
            assertEquals((date.endsWith("03-08") ? 23 : 25) * 3600000L, duration);
        }
    }

    @Test public void malformedDatesAndUnsupportedRecurrenceAreRejected() {
        for (String date : new String[] { "2026-02-30", "2026-13-01", "2026-00-01", "2026-1-01", "" }) {
            assertThrows(IllegalArgumentException.class, () -> create(date, null, "UTC"));
        }
        assertThrows(IllegalArgumentException.class, () -> create("2026-10-06", "FREQ=MONTHLY", "UTC"));
    }

    @Test public void handlerAvailabilityIsResolvedWithoutCalendarAccess() {
        Intent intent = create("2026-10-06", null, "UTC");
        assertFalse(CalendarInsertIntent.isAvailable(RuntimeEnvironment.getApplication(), intent));
        ResolveInfo handler = new ResolveInfo();
        handler.activityInfo = new ActivityInfo(); handler.activityInfo.packageName = "test.calendar";
        handler.activityInfo.name = "test.calendar.Insert"; handler.isDefault = true;
        Shadows.shadowOf(RuntimeEnvironment.getApplication().getPackageManager()).addResolveInfoForIntent(intent, handler);
        assertTrue(CalendarInsertIntent.isAvailable(RuntimeEnvironment.getApplication(), intent));
    }
}
