import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  attendanceRate,
  buildSlice,
  currentStreak,
  longestRun,
  matchesStatus,
  resolveSpan,
  trendOf,
} from "./board.ts";

describe("attendance math", () => {
  it("rates present days against missed days and ignores an even split of zero", () => {
    assert.equal(attendanceRate({ worked: 2, wfh: 1, missed: 1 }), 75);
    assert.equal(attendanceRate({ worked: 0, wfh: 0, missed: 0 }), null);
    assert.equal(trendOf(80, 70), "up");
    assert.equal(trendOf(70, 70), "flat");
    assert.equal(trendOf(null, 70), "na");
  });

  it("flags late arrivals, half-days, and hours against an 8h day", () => {
    const slice = buildSlice(
      { id: 2, name: "Hebbar" },
      "2026-11",
      "2026-11-06",
      [
        { id: 1, day: "2026-11-02", clockIn: "10:30", clockOut: "18:30" },
        { id: 2, day: "2026-11-03", clockIn: "09:00", clockOut: "13:00" },
      ],
      [],
    );
    assert.equal(slice.lateDays, 1);
    assert.equal(slice.halfDays, 1);
    assert.equal(slice.shortDays, 1);
    assert.equal(slice.netHours, -4);
    assert.equal(slice.avgClockIn, "09:45");
    assert.equal(slice.month.missed, 2);
    assert.equal(slice.rate, 50);
    assert.equal(slice.today.key, "none");
    assert.equal(matchesStatus(slice, "none"), true);
    assert.equal(matchesStatus(slice, "late"), false);
  });

  it("keeps a streak through the weekend and stops on leave", () => {
    const worked = { id: 1, day: "2026-11-03", clockIn: "09:00", clockOut: "17:00" };
    const friday = { id: 2, day: "2026-11-05", clockIn: "09:00", clockOut: "17:00" };
    const wfh = { id: 3, day: "2026-11-06", wfh: true, clockIn: null, clockOut: null };
    assert.equal(currentStreak("2026-11-09", [friday, wfh], []), 2);
    assert.equal(
      currentStreak("2026-11-06", [worked, friday], [{ id: 9, type: "vacation", start: "2026-11-04", end: "2026-11-04" }]),
      1,
    );
    assert.equal(longestRun("2026-11-01", "2026-11-09", "2026-11-09", [friday, wfh], []), 2);
  });

  it("resolves a month, a year, and all time", () => {
    const month = resolveSpan({ month: "2026-11" }, "2026-11-03", "2026-10-01", "2026-11-03");
    assert.equal(month.kind, "month");
    assert.equal(month.start, "2026-11-01");
    assert.equal(month.end, "2026-11-30");
    assert.equal(month.previous?.start, "2026-10-01");

    const year = resolveSpan({ span: "2026", month: "2026-11" }, "2026-11-03", "2026-08-11", "2026-11-27");
    assert.equal(year.kind, "year");
    assert.equal(year.start, "2026-08-11");
    assert.equal(year.end, "2026-11-27");
    assert.equal(year.month, "2026-11");
    assert.equal(year.previous, null);

    const empty = resolveSpan({ span: "2025", month: "2026-11" }, "2026-11-03", "2026-08-11", "2026-11-27");
    assert.equal(empty.end < empty.start, true);

    const all = resolveSpan({ span: "all" }, "2026-11-03", "2026-10-01", "2026-12-02");
    assert.equal(all.start, "2026-10-01");
    assert.equal(all.end, "2026-12-02");
    assert.equal(all.previous, null);

    const slice = buildSlice(
      { id: 1, name: "Hebbar" },
      { start: "2026-01-01", end: "2026-12-31", previous: null },
      "2026-11-06",
      [
        { id: 1, day: "2026-01-05", clockIn: "09:00", clockOut: "17:00" },
        { id: 2, day: "2026-11-02", clockIn: "10:30", clockOut: "18:30" },
      ],
      [],
    );
    assert.equal(slice.month.worked, 2);
    assert.equal(slice.lateDays, 1);
    assert.equal(slice.prevRate, null);
  });
});
