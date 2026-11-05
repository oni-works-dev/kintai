import type { ErrorCode } from "./errors.ts";
import {
  eachDate,
  hoursBetween,
  isLeaveType,
  parseDay,
  parseTime,
  rangesOverlap,
  type LeaveType,
} from "./stats.ts";

export const STORAGE_KEY = "kintai-me";

export type DayLog = {
  id: number;
  day: string;
  wfh: boolean;
  clockIn: string | null;
  clockOut: string | null;
  note: string;
};

export type LeaveLog = {
  id: number;
  type: LeaveType;
  start: string;
  end: string;
  note: string;
};

export type Book = {
  days: DayLog[];
  leaves: LeaveLog[];
  nextId: number;
};

export type PocketResult = { book: Book } | { error: ErrorCode };

export type DayDraft = {
  id?: number;
  day: string;
  wfh: boolean;
  clockIn: string;
  clockOut: string;
  note: string;
};

export type LeaveDraft = {
  id?: number;
  type: string;
  start: string;
  end: string;
  note: string;
};

function ok(book: Book): PocketResult {
  return { book };
}

function fail(error: ErrorCode): PocketResult {
  return { error };
}

function withId(book: Book): { book: Book; id: number } {
  return { book: { ...book, nextId: book.nextId + 1 }, id: book.nextId };
}

export function clockIn(book: Book, today: string, time: string): PocketResult {
  const existing = book.days.find((row) => row.day === today);
  if (existing?.wfh) return fail("already-wfh");
  if (existing?.clockOut) return fail("already-out");
  if (existing) return fail("already-in");
  const clock = parseTime(time);
  if (!clock) return fail("bad-time");
  const next = withId(book);
  return ok({
    ...next.book,
    days: [{ id: next.id, day: today, wfh: false, clockIn: clock, clockOut: null, note: "" }, ...next.book.days],
  });
}

export function clockOut(book: Book, today: string, time: string): PocketResult {
  const existing = book.days.find((row) => row.day === today);
  if (!existing || existing.wfh || !existing.clockIn) return fail("not-in");
  if (existing.clockOut) return fail("already-out");
  const clock = parseTime(time);
  if (!clock || hoursBetween(existing.clockIn, clock) == null) return fail("bad-time");
  return ok({
    ...book,
    days: book.days.map((row) => (row.id === existing.id ? { ...row, clockOut: clock } : row)),
  });
}

export function markWfh(book: Book, today: string): PocketResult {
  const existing = book.days.find((row) => row.day === today);
  if (existing?.wfh) return fail("already-wfh");
  if (existing) return fail("already-in");
  const next = withId(book);
  return ok({
    ...next.book,
    days: [{ id: next.id, day: today, wfh: true, clockIn: null, clockOut: null, note: "" }, ...next.book.days],
  });
}

export function saveDay(book: Book, draft: DayDraft, today: string): PocketResult {
  const day = parseDay(draft.day);
  const clockIn = draft.wfh ? null : parseTime(draft.clockIn);
  const outRaw = draft.wfh ? "" : draft.clockOut.trim();
  const clockOut = outRaw ? parseTime(outRaw) : null;
  const note = draft.note.trim();
  if (!day) return fail("bad-date");
  if (!draft.wfh && (!clockIn || (outRaw && !clockOut))) return fail("bad-time");
  if (clockIn && clockOut && hoursBetween(clockIn, clockOut) == null) return fail("bad-time");
  if (note.length > 200) return fail("note");
  if (day > today) return fail("future");
  const id = draft.id;
  if (id != null && (!Number.isInteger(id) || id <= 0 || !book.days.some((row) => row.id === id))) return fail("missing");
  if (book.days.some((row) => row.day === day && row.id !== id)) return fail("duplicate");
  const row: DayLog = { id: id ?? 0, day, wfh: draft.wfh, clockIn, clockOut, note };
  if (id != null) return ok({ ...book, days: book.days.map((item) => (item.id === id ? { ...row, id } : item)) });
  const next = withId(book);
  return ok({ ...next.book, days: [{ ...row, id: next.id }, ...next.book.days] });
}

export function deleteDay(book: Book, id: number): PocketResult {
  if (!book.days.some((row) => row.id === id)) return fail("missing");
  return ok({ ...book, days: book.days.filter((row) => row.id !== id) });
}

export function saveLeave(book: Book, draft: LeaveDraft): PocketResult {
  const start = parseDay(draft.start);
  const end = parseDay(draft.end);
  const note = draft.note.trim();
  if (!isLeaveType(draft.type)) return fail("bad-type");
  if (!start || !end) return fail("bad-date");
  if (end < start) return fail("range");
  if (eachDate(start, end).length > 366) return fail("long");
  if (note.length > 200) return fail("note");
  const id = draft.id;
  if (id != null && (!Number.isInteger(id) || id <= 0 || !book.leaves.some((row) => row.id === id))) return fail("missing");
  if (book.leaves.some((leave) => leave.id !== id && rangesOverlap(start, end, leave.start, leave.end))) return fail("overlap");
  const row: LeaveLog = { id: id ?? 0, type: draft.type, start, end, note };
  if (id != null) return ok({ ...book, leaves: book.leaves.map((item) => (item.id === id ? { ...row, id } : item)) });
  const next = withId(book);
  return ok({ ...next.book, leaves: [{ ...row, id: next.id }, ...next.book.leaves] });
}

export function deleteLeave(book: Book, id: number): PocketResult {
  if (!book.leaves.some((row) => row.id === id)) return fail("missing");
  return ok({ ...book, leaves: book.leaves.filter((row) => row.id !== id) });
}

function readDay(value: unknown): DayLog | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const day = typeof row.day === "string" ? parseDay(row.day) : null;
  if (!Number.isInteger(row.id) || Number(row.id) <= 0 || !day || typeof row.wfh !== "boolean") return null;
  const clockIn = row.clockIn == null || row.clockIn === "" ? null : row.clockIn;
  const clockOut = row.clockOut == null || row.clockOut === "" ? null : row.clockOut;
  if ((clockIn != null && typeof clockIn !== "string") || (clockOut != null && typeof clockOut !== "string")) return null;
  return {
    id: Number(row.id),
    day,
    wfh: row.wfh,
    clockIn,
    clockOut,
    note: typeof row.note === "string" ? row.note : "",
  };
}

function readLeave(value: unknown): LeaveLog | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const start = typeof row.start === "string" ? parseDay(row.start) : null;
  const end = typeof row.end === "string" ? parseDay(row.end) : null;
  if (!Number.isInteger(row.id) || Number(row.id) <= 0 || !start || !end || typeof row.type !== "string" || !isLeaveType(row.type)) {
    return null;
  }
  if (end < start) return null;
  return {
    id: Number(row.id),
    type: row.type,
    start,
    end,
    note: typeof row.note === "string" ? row.note : "",
  };
}

export function parseBook(raw: string | null): Book {
  if (!raw) return { days: [], leaves: [], nextId: 1 };
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { days: [], leaves: [], nextId: 1 };
  }
  if (!value || typeof value !== "object") return { days: [], leaves: [], nextId: 1 };
  const record = value as { days?: unknown; leaves?: unknown };
  const days = Array.isArray(record.days) ? record.days.flatMap((item) => {
    const row = readDay(item);
    return row ? [row] : [];
  }) : [];
  const leaves = Array.isArray(record.leaves) ? record.leaves.flatMap((item) => {
    const row = readLeave(item);
    return row ? [row] : [];
  }) : [];
  const max = Math.max(0, ...days.map((row) => row.id), ...leaves.map((row) => row.id));
  return { days, leaves, nextId: max + 1 };
}
