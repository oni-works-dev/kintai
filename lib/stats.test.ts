import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  chartAnchor,
  formatHours,
  hoursBetween,
  leaveTotals,
  monthBounds,
  monthGrid,
  parseDay,
  parseMonth,
  parseTime,
  rangesOverlap,
  shiftMonth,
  summarize,
  weekSeries,
  weekStart,
  type DayFact,
} from "./stats.ts";

function kindOf(days: DayFact[], iso: string): DayFact["kind"] {
  const day = days.find((item) => item.iso === iso);
  assert.ok(day, iso);
  return day.kind;
}

describe("time parsing", () => {
  it("rejects impossible dates and clock times", () => {
    assert.equal(parseDay("2026-02-31"), null);
    assert.equal(parseDay("2026-11-03"), "2026-11-03");
    assert.equal(parseTime("09:00:30"), "09:00");
    assert.equal(parseTime("24:00"), null);
    assert.equal(parseTime("09:60"), null);
    assert.equal(parseMonth("2026-13"), null);
    assert.equal(parseMonth("2026-11"), "2026-11");
  });

  it("counts hours on the same day only", () => {
    assert.equal(hoursBetween("09:00", "17:30"), 8.5);
    assert.equal(hoursBetween("09:00", "09:00"), 0);
    assert.equal(hoursBetween("17:00", "09:00"), null);
    assert.equal(formatHours(8.5), "8h 30m");
    assert.equal(formatHours(1), "1h");
    assert.equal(formatHours(0), "0m");
  });
});

describe("calendar", () => {
  it("starts weeks on Monday and walks months across years", () => {
    assert.equal(weekStart("2026-11-01"), "2026-10-26");
    assert.equal(weekStart("2026-11-02"), "2026-11-02");
    assert.equal(monthGrid("2026-11")[0], "2026-10-26");
    assert.equal(monthGrid("2026-11").at(-1), "2026-12-06");
    assert.equal(monthGrid("2026-11").length, 42);
    assert.equal(shiftMonth("2026-01", -1), "2025-12");
    assert.equal(shiftMonth("2026-12", 1), "2027-01");
    assert.equal(monthBounds("2026-11").end, "2026-11-30");
    assert.equal(chartAnchor("2026-10", "2026-11-03"), "2026-10-31");
    assert.equal(chartAnchor("2026-11", "2026-11-03"), "2026-11-03");
    assert.equal(chartAnchor("2026-12", "2026-11-03"), "2026-11-03");
  });

  it("treats a touching leave boundary as overlap", () => {
    assert.equal(rangesOverlap("2026-11-01", "2026-11-05", "2026-11-05", "2026-11-06"), true);
    assert.equal(rangesOverlap("2026-11-01", "2026-11-04", "2026-11-05", "2026-11-06"), false);
  });
});

describe("summarize", () => {
  const leaves = [
    { id: 1, type: "sick" as const, start: "2026-11-04", end: "2026-11-04" },
    { id: 2, type: "personal" as const, start: "2026-11-30", end: "2026-12-02" },
    { id: 3, type: "vacation" as const, start: "2026-12-24", end: "2026-12-26" },
  ];

  it("counts hours, open days, leave, and ignores today as missed", () => {
    const summary = summarize({
      month: "2026-11",
      today: "2026-11-05",
      attendance: [
        { id: 1, day: "2026-11-02", clockIn: "09:00", clockOut: "18:00" },
        { id: 2, day: "2026-11-03", clockIn: "09:00", clockOut: null },
      ],
      leaves,
    });
    assert.equal(summary.hours, 9);
    assert.equal(summary.worked, 2);
    assert.equal(summary.missed, 0);
    assert.equal(summary.leaveDays, 2);
    assert.equal(kindOf(summary.days, "2026-11-01"), "off");
    assert.equal(kindOf(summary.days, "2026-11-02"), "worked");
    assert.equal(kindOf(summary.days, "2026-11-03"), "open");
    assert.equal(kindOf(summary.days, "2026-11-04"), "leave");
    assert.equal(kindOf(summary.days, "2026-11-05"), "today");
    assert.equal(kindOf(summary.days, "2026-11-06"), "future");
    assert.equal(kindOf(summary.days, "2026-11-30"), "leave");
  });

  it("marks past empty weekdays missed and keeps weekend work", () => {
    const summary = summarize({
      month: "2026-11",
      today: "2026-11-05",
      attendance: [{ id: 1, day: "2026-11-01", clockIn: "10:00", clockOut: "12:00" }],
      leaves: [],
    });
    assert.equal(summary.hours, 2);
    assert.equal(summary.worked, 1);
    assert.equal(summary.missed, 3);
    assert.equal(kindOf(summary.days, "2026-11-01"), "worked");
    assert.equal(kindOf(summary.days, "2026-11-02"), "missed");
    assert.equal(kindOf(summary.days, "2026-11-05"), "today");
  });

  it("buckets weekly hours and does not double-count a shared leave day", () => {
    const weeks = weekSeries(
      [
        { id: 1, day: "2026-11-02", clockIn: "09:00", clockOut: "18:00" },
        { id: 2, day: "2025-01-06", clockIn: "09:00", clockOut: "12:00" },
      ],
      "2026-11-05",
    );
    assert.equal(weeks.length, 8);
    assert.equal(weeks.at(-1)?.start, weekStart("2026-11-05"));
    assert.equal(weeks.find((week) => week.start === "2026-11-02")?.hours, 9);
    assert.equal(
      weeks.some((week) => week.start === weekStart("2025-01-06")),
      false,
    );

    const totals = leaveTotals(
      [
        { id: 2, type: "vacation", start: "2026-11-04", end: "2026-11-05" },
        { id: 1, type: "sick", start: "2026-11-04", end: "2026-11-04" },
        ...leaves.slice(1),
      ],
      "2026-01-01",
      "2026-12-31",
    );
    assert.deepEqual(
      totals.map((row) => row.days),
      [4, 1, 3, 0],
    );
  });
});
