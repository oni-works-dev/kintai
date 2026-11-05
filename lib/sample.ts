import type { DatabaseSync } from "node:sqlite";
import { addDays, eachDate, parseISODate, todayISO, weekStart, type LeaveType } from "./stats.ts";

type Plan = { wfh: boolean; clockIn: string | null; clockOut: string | null };

type Profile = {
  miss: number;
  wfh: number;
  late: number;
  half: number;
  start: string;
  end: string;
  fridayWfh: boolean;
};

// ponytail: fixed personalities for the starter roster. A column belongs here once people can be added.
const PROFILES: Record<number, Profile> = {
  1: { miss: 31, wfh: 0, late: 11, half: 0, start: "09:05", end: "18:10", fridayWfh: true },
  2: { miss: 19, wfh: 13, late: 7, half: 17, start: "09:25", end: "18:40", fridayWfh: false },
  3: { miss: 41, wfh: 17, late: 0, half: 0, start: "08:55", end: "17:45", fridayWfh: false },
  4: { miss: 8, wfh: 9, late: 5, half: 6, start: "09:45", end: "17:20", fridayWfh: false },
};

function bucket(personId: number, iso: string): number {
  let hash = personId * 17;
  for (let index = 0; index < iso.length; index += 1) hash = (hash + iso.charCodeAt(index) * (index + 3)) % 97;
  return hash;
}

function shiftClock(clock: string, minutes: number): string {
  const [hour, minute] = clock.split(":").map(Number);
  const total = hour * 60 + minute + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function samplePlan(personId: number, iso: string, today: string): Plan | null {
  const showcase = addDays(weekStart(today), -2);
  if (personId === 3 && iso === showcase) return { wfh: false, clockIn: "10:00", clockOut: "14:00" };
  if (parseISODate(iso).getDay() % 6 === 0) return null;
  const profile = PROFILES[personId] ?? PROFILES[3];
  if (profile.fridayWfh && parseISODate(iso).getDay() === 5) {
    return { wfh: true, clockIn: null, clockOut: null };
  }
  const roll = bucket(personId, iso);
  if (roll % profile.miss === 0) return null;
  if (profile.wfh > 0 && roll % profile.wfh === 0) return { wfh: true, clockIn: null, clockOut: null };
  if (profile.half > 0 && roll % profile.half === 0) {
    return { wfh: false, clockIn: profile.start, clockOut: shiftClock(profile.start, 4 * 60) };
  }
  if (profile.late > 0 && roll % profile.late === 0) return { wfh: false, clockIn: "10:25", clockOut: "19:00" };
  const jitter = roll % 8;
  return {
    wfh: false,
    clockIn: shiftClock(profile.start, jitter),
    clockOut: shiftClock(profile.end, jitter),
  };
}

function plannedLeaves(today: string): { personId: number; type: LeaveType; start: string; end: string; note: string }[] {
  return [
    { personId: 1, type: "sick", start: addDays(today, -26), end: addDays(today, -26), note: "Clinic" },
    { personId: 1, type: "personal", start: addDays(today, 9), end: addDays(today, 9), note: "Errand" },
    { personId: 2, type: "sick", start: addDays(today, -42), end: addDays(today, -42), note: "Flu" },
    { personId: 3, type: "vacation", start: addDays(today, -15), end: addDays(today, -14), note: "Trip" },
    { personId: 3, type: "sick", start: addDays(today, 24), end: addDays(today, 24), note: "Appointment" },
    { personId: 4, type: "personal", start: addDays(today, -33), end: addDays(today, -32), note: "Family" },
    { personId: 4, type: "sick", start: addDays(today, -20), end: addDays(today, -19), note: "Cold" },
    { personId: 4, type: "unpaid", start: addDays(today, -8), end: addDays(today, -8), note: "Moving" },
    { personId: 4, type: "vacation", start: addDays(today, 21), end: addDays(today, 22), note: "Travel" },
  ];
}

function countOf(database: DatabaseSync, sql: string): number {
  const row = database.prepare(sql).get() as { n: number } | undefined;
  return Number(row?.n ?? 0);
}

// ponytail: one-shot history so the charts have a shape. Stops once a sample row exists, or the log already has 12 real days.
export function seedSamples(database: DatabaseSync): void {
  try {
    writeSamples(database);
  } catch (error) {
    console.error(error);
  }
}

function writeSamples(database: DatabaseSync): void {
  if (countOf(database, "SELECT COUNT(*) AS n FROM attendance WHERE note = 'sample'") > 0) return;
  if (countOf(database, "SELECT COUNT(*) AS n FROM attendance") > 12) return;
  const today = todayISO();
  database.exec("BEGIN IMMEDIATE");
  try {
    if (countOf(database, "SELECT COUNT(*) AS n FROM attendance WHERE note = 'sample'") > 0) {
      database.exec("COMMIT");
      return;
    }
    const people = database.prepare("SELECT id FROM people").all() as { id: number }[];
    const overlap = database.prepare(
      "SELECT id FROM leaves WHERE person_id = ? AND start_date <= ? AND end_date >= ? LIMIT 1",
    );
    const insertLeave = database.prepare(
      "INSERT INTO leaves (person_id, type, start_date, end_date, note) VALUES (?, ?, ?, ?, ?)",
    );
    for (const leave of plannedLeaves(today)) {
      if (!people.some((person) => Number(person.id) === leave.personId)) continue;
      if (overlap.get(leave.personId, leave.end, leave.start)) continue;
      insertLeave.run(leave.personId, leave.type, leave.start, leave.end, leave.note);
    }
    const hasDay = database.prepare("SELECT id FROM attendance WHERE person_id = ? AND day = ? LIMIT 1");
    const onLeave = database.prepare(
      "SELECT id FROM leaves WHERE person_id = ? AND start_date <= ? AND end_date >= ? LIMIT 1",
    );
    const insertDay = database.prepare(
      "INSERT INTO attendance (person_id, day, wfh, clock_in, clock_out, note) VALUES (?, ?, ?, ?, ?, 'sample')",
    );
    for (const person of people) {
      const personId = Number(person.id);
      for (const iso of eachDate(addDays(today, -84), addDays(today, -1))) {
        const plan = samplePlan(personId, iso, today);
        if (!plan) continue;
        if (hasDay.get(personId, iso) || onLeave.get(personId, iso, iso)) continue;
        insertDay.run(personId, iso, plan.wfh ? 1 : 0, plan.clockIn, plan.clockOut);
      }
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
