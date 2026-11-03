"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { activePerson } from "@/lib/active";
import type { ErrorCode } from "@/lib/errors";
import {
  allLeaves,
  allPeople,
  attendanceOn,
  deleteAttendance,
  deleteLeave,
  getAttendance,
  getLeave,
  insertAttendance,
  insertLeave,
  updateAttendance,
  updateLeave,
  updatePersonName,
} from "@/lib/db";
import {
  currentTime,
  eachDate,
  hoursBetween,
  isLeaveType,
  parseDay,
  parseTime,
  rangesOverlap,
  todayISO,
} from "@/lib/stats";

export type ActionState = { error: ErrorCode } | null;

function refresh() {
  revalidatePath("/", "layout");
}

function destination(formData: FormData): "/" | "/attendance" | "/report" {
  const value = formData.get("return");
  if (value === "/attendance" || value === "/report") return value;
  return "/";
}

function fail(path: string, code: ErrorCode): never {
  const join = path.includes("?") ? "&" : "?";
  redirect(`${path}${join}error=${code}`);
}

function safeNext(value: string): string {
  if (value === "/" || value === "/attendance" || value === "/leave" || value === "/report") return value;
  if (/^\/\?month=\d{4}-\d{2}$/.test(value)) return value;
  if (/^\/report\?month=\d{4}-\d{2}$/.test(value)) return value;
  if (/^\/attendance\?edit=\d+$/.test(value)) return value;
  if (/^\/leave\?edit=\d+$/.test(value)) return value;
  return "/";
}

function isUnique(error: unknown): boolean {
  return error instanceof Error && error.message.includes("UNIQUE constraint failed");
}

function catchUnique(write: () => void): ActionState | null {
  try {
    write();
    return null;
  } catch (error) {
    if (isUnique(error)) return { error: "duplicate" };
    throw error;
  }
}

export async function selectPerson(formData: FormData) {
  const id = Number(formData.get("person"));
  if (!allPeople().some((person) => person.id === id)) redirect("/");
  const jar = await cookies();
  jar.set("kintai-person", String(id), { path: "/", sameSite: "lax", httpOnly: true });
  refresh();
  redirect(safeNext(String(formData.get("next") ?? "")));
}

export async function renamePerson(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
  if (!allPeople().some((person) => person.id === id)) return { error: "missing" };
  if (!name || name.length > 40) return { error: "name" };
  updatePersonName(id, name);
  refresh();
  return null;
}

export async function clockIn(formData: FormData) {
  const dest = destination(formData);
  const person = await activePerson();
  const today = todayISO();
  const existing = attendanceOn(person.id, today);
  if (existing?.clockOut) fail(dest, "already-out");
  if (existing) fail(dest, "already-in");
  const failed = catchUnique(() => {
    insertAttendance({ personId: person.id, day: today, clockIn: currentTime(), clockOut: null, note: "" });
  });
  if (failed) fail(dest, failed.error);
  refresh();
  redirect(dest);
}

export async function clockOut(formData: FormData) {
  const dest = destination(formData);
  const person = await activePerson();
  const today = todayISO();
  const existing = attendanceOn(person.id, today);
  if (!existing) fail(dest, "not-in");
  if (existing.clockOut) fail(dest, "already-out");
  const clockOut = currentTime();
  if (hoursBetween(existing.clockIn, clockOut) == null) fail(dest, "bad-time");
  updateAttendance({ ...existing, clockOut });
  refresh();
  redirect(dest);
}

export async function saveAttendance(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const idRaw = String(formData.get("id") ?? "");
  const id = idRaw ? Number(idRaw) : null;
  const day = parseDay(String(formData.get("day") ?? ""));
  const clockInTime = parseTime(String(formData.get("clockIn") ?? ""));
  const outRaw = String(formData.get("clockOut") ?? "").trim();
  const clockOut = outRaw ? parseTime(outRaw) : null;
  const note = String(formData.get("note") ?? "").trim();

  if (!day) return { error: "bad-date" };
  if (!clockInTime || (outRaw && !clockOut)) return { error: "bad-time" };
  if (clockOut && hoursBetween(clockInTime, clockOut) == null) return { error: "bad-time" };
  if (note.length > 200) return { error: "note" };
  if (day > todayISO()) return { error: "future" };
  if (id != null && (!Number.isInteger(id) || id <= 0)) return { error: "missing" };

  const person = await activePerson();
  if (id != null) {
    const existing = getAttendance(id);
    if (!existing || existing.personId !== person.id) return { error: "missing" };
    const clash = attendanceOn(person.id, day);
    if (clash && clash.id !== id) return { error: "duplicate" };
  }

  const failed = catchUnique(() => {
    if (id != null) updateAttendance({ id, personId: person.id, day, clockIn: clockInTime, clockOut, note });
    else insertAttendance({ personId: person.id, day, clockIn: clockInTime, clockOut, note });
  });
  if (failed) return failed;
  refresh();
  redirect("/attendance");
}

export async function saveLeave(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const idRaw = String(formData.get("id") ?? "");
  const id = idRaw ? Number(idRaw) : null;
  const typeRaw = String(formData.get("type") ?? "");
  const start = parseDay(String(formData.get("start") ?? ""));
  const end = parseDay(String(formData.get("end") ?? ""));
  const note = String(formData.get("note") ?? "").trim();

  if (!isLeaveType(typeRaw)) return { error: "bad-type" };
  if (!start || !end) return { error: "bad-date" };
  if (end < start) return { error: "range" };
  if (eachDate(start, end).length > 366) return { error: "long" };
  if (note.length > 200) return { error: "note" };
  if (id != null && (!Number.isInteger(id) || id <= 0)) return { error: "missing" };

  const person = await activePerson();
  const overlap = allLeaves(person.id).some(
    (leave) => leave.id !== id && rangesOverlap(start, end, leave.start, leave.end),
  );
  if (overlap) return { error: "overlap" };

  if (id != null) {
    const existing = getLeave(id);
    if (!existing || existing.personId !== person.id) return { error: "missing" };
    updateLeave({ id, personId: person.id, type: typeRaw, start, end, note });
  } else {
    insertLeave({ personId: person.id, type: typeRaw, start, end, note });
  }

  refresh();
  redirect("/leave");
}

export async function deleteAttendanceAction(formData: FormData) {
  const id = Number(formData.get("id"));
  const person = await activePerson();
  const row = Number.isInteger(id) ? getAttendance(id) : null;
  if (!row || row.personId !== person.id) fail("/attendance", "missing");
  deleteAttendance(id, person.id);
  refresh();
  redirect("/attendance");
}

export async function deleteLeaveAction(formData: FormData) {
  const id = Number(formData.get("id"));
  const person = await activePerson();
  const row = Number.isInteger(id) ? getLeave(id) : null;
  if (!row || row.personId !== person.id) fail("/leave", "missing");
  deleteLeave(id, person.id);
  refresh();
  redirect("/leave");
}
