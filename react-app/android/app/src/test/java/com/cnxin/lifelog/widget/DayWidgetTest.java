package com.cnxin.lifelog.widget;

import static org.junit.Assert.*;
import org.junit.Test;
import org.json.JSONObject;
import java.text.ParseException;
import java.util.TimeZone;

public class DayWidgetTest {
    private String payload(String next) throws Exception {
        return new JSONObject().put("version", 1).put("featured", new JSONObject()
            .put("id", "one").put("title", "订婚").put("category", "纪念日")
            .put("nextDate", next)).toString();
    }
    @Test public void todayHasNoNumberOrSuffix() throws Exception {
        DayWidgetContent c = DayWidgetContent.fromPayload(payload("2026-09-30"), "2026-09-30");
        assertEquals("就是今天", c.prefix); assertEquals("", c.count); assertEquals("", c.suffix);
        assertTrue(c.today); assertFalse(c.empty); assertEquals("one", c.id);
    }
    @Test public void futureCountsCalendarDays() throws Exception {
        DayWidgetContent c = DayWidgetContent.fromPayload(payload("2026-10-03"), "2026-09-30");
        assertEquals("还有", c.prefix); assertEquals("3", c.count); assertEquals("天", c.suffix);
        assertEquals("2026.10.03", c.date);
    }
    @Test public void pastUsesElapsedNotNegativeCount() throws Exception {
        DayWidgetContent c = DayWidgetContent.fromPayload(payload("2026-09-29"), "2026-09-30");
        assertEquals("已经", c.prefix); assertEquals("1", c.count); assertEquals("天", c.suffix);
    }
    @Test public void emptyPayloadAndNullFeaturedUseTheAddPrompt() {
        for (String json : new String[] { null, "{}", "{\"version\":1,\"featured\":null}" }) {
            DayWidgetContent c = DayWidgetContent.fromPayload(json, "2026-09-30");
            assertTrue(c.empty); assertEquals("记下第一个日子", c.title); assertEquals("", c.id);
        }
    }
    @Test public void invalidPayloadIsSafe() throws Exception {
        for (String json : new String[] { "broken", payload("2026-02-30"), "{\"version\":2}" })
            assertTrue(DayWidgetContent.fromPayload(json, "2026-09-30").empty);
    }
    @Test public void dstCannotChangeCalendarDayDifference() throws Exception {
        TimeZone previous = TimeZone.getDefault();
        try {
            TimeZone.setDefault(TimeZone.getTimeZone("America/New_York"));
            assertEquals(2, DayWidgetContent.dayDifference("2026-03-07", "2026-03-09"));
            assertEquals(2, DayWidgetContent.dayDifference("2026-10-31", "2026-11-02"));
        } finally { TimeZone.setDefault(previous); }
    }
    @Test public void leapAndYearBoundaryAreCorrect() throws Exception {
        assertEquals(2, DayWidgetContent.dayDifference("2024-02-28", "2024-03-01"));
        assertEquals(1, DayWidgetContent.dayDifference("2026-12-31", "2027-01-01"));
    }
    @Test(expected = ParseException.class) public void strictDatesRejectOverflow() throws Exception {
        DayWidgetContent.dayDifference("2026-09-30", "2026-02-30");
    }
}
