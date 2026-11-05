import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { samplePlan } from "./sample.ts";
import { parseISODate } from "./stats.ts";

describe("sample plan", () => {
  it("sends Anooj home on Friday and gives Monish the showcase Saturday", () => {
    const today = "2026-11-03";
    assert.equal(parseISODate("2026-10-30").getDay(), 5);
    assert.equal(samplePlan(1, "2026-10-30", today)?.wfh, true);
    assert.equal(samplePlan(1, "2026-10-31", today), null);
    const saturday = samplePlan(3, "2026-10-31", today);
    assert.equal(saturday?.wfh, false);
    assert.equal(saturday?.clockIn, "10:00");
    assert.equal(saturday?.clockOut, "14:00");
  });
});
