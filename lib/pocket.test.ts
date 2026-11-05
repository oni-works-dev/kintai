import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clockIn, clockOut, markWfh, parseBook, saveDay, saveLeave, type Book, type PocketResult } from "./pocket.ts";

function unwrap(result: PocketResult): Book {
  if ("error" in result) assert.fail(result.error);
  return result.book;
}

const empty: Book = { days: [], leaves: [], nextId: 1 };

describe("phone log", () => {
  it("clocks a day in and out, and refuses a clock-out before clock-in", () => {
    const open = unwrap(clockIn(empty, "2026-11-05", "09:15"));
    assert.equal(open.days[0]?.clockIn, "09:15");
    assert.equal(unwrap(clockOut(open, "2026-11-05", "18:00")).days[0]?.clockOut, "18:00");
    const early = clockOut(open, "2026-11-05", "08:00");
    assert.equal("error" in early && early.error, "bad-time");
  });

  it("keeps one row per day and blocks future attendance", () => {
    const home = unwrap(markWfh(empty, "2026-11-05"));
    assert.equal("error" in clockIn(home, "2026-11-05", "09:00") && clockIn(home, "2026-11-05", "09:00").error, "already-wfh");
    const again = saveDay(home, { day: "2026-11-05", wfh: false, clockIn: "09:00", clockOut: "17:00", note: "" }, "2026-11-05");
    assert.equal("error" in again && again.error, "duplicate");
    const future = saveDay(empty, { day: "2026-11-06", wfh: false, clockIn: "09:00", clockOut: "", note: "" }, "2026-11-05");
    assert.equal("error" in future && future.error, "future");
  });

  it("rejects overlapping leave and keeps saved rows across a reload", () => {
    const first = unwrap(saveLeave(empty, { type: "vacation", start: "2026-11-02", end: "2026-11-04", note: "" }));
    const overlap = saveLeave(first, { type: "sick", start: "2026-11-04", end: "2026-11-04", note: "" });
    assert.equal("error" in overlap && overlap.error, "overlap");
    const raw = JSON.stringify({
      days: [{ id: 4, day: "2026-11-01", wfh: false, clockIn: "09:00", clockOut: "17:00", note: "" }, { id: "bad" }],
      leaves: first.leaves,
      nextId: 1,
    });
    const loaded = parseBook(raw);
    assert.equal(loaded.days.length, 1);
    assert.equal(unwrap(clockIn(loaded, "2026-11-05", "10:00")).days.find((row) => row.day === "2026-11-05")?.id, 5);
  });
});
