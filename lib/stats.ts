export const LEAVE_TYPES = ["vacation", "sick", "personal", "unpaid"] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

export const LEAVE_LABEL: Record<LeaveType, string> = {
  vacation: "Vacation",
  sick: "Sick leave",
  personal: "Casual leave",
  unpaid: "Unpaid",
};

export type AttendanceInput = {
  id: number;
  day: string;
  wfh?: boolean;
  clockIn: string | null;
  clockOut: string | null;
};

export type LeaveInput = {
  id: number;
  type: LeaveType;
  start: string;
  end: string;
};

export type DayKind = "worked" | "wfh" | "open" | "leave" | "missed" | "off" | "future" | "today";

export type DayFact = {
  iso: string;
  inMonth: boolean;
  kind: DayKind;
  hours: number | null;
  leaveType: LeaveType | null;
  leaveId: number | null;
  attendanceId: number | null;
};

export function isLeaveType(value: string): value is LeaveType {
  return (LEAVE_TYPES as readonly string[]).includes(value);
}

export function parseISODate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function toISODate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function todayISO(now = new Date()): string {
  return toISODate(now);
}

export function currentTime(now = new Date()): string {
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export function parseDay(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = parseISODate(value);
  if (Number.isNaN(date.getTime())) return null;
  return toISODate(date) === value ? value : null;
}

export function parseMonth(value: string | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return null;
  const month = Number(value.slice(5));
  if (month < 1 || month > 12) return null;
  return value;
}

export function parseTime(value: string): string | null {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return `${match[1]}:${match[2]}`;
}

export function addDays(iso: string, days: number): string {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

/** shortcut: same calendar day only; overnight shifts need real datetimes. */
export function hoursBetween(start: string, end: string): number | null {
  const clockIn = parseTime(start);
  const clockOut = parseTime(end);
  if (!clockIn || !clockOut) return null;
  const [startHour, startMinute] = clockIn.split(":").map(Number);
  const [endHour, endMinute] = clockOut.split(":").map(Number);
  const minutes = endHour * 60 + endMinute - (startHour * 60 + startMinute);
  if (minutes < 0) return null;
  return Math.round((minutes / 60) * 100) / 100;
}

export function formatHours(hours: number): string {
  const minutes = Math.round(hours * 60);
  const whole = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (whole === 0) return `${rest}m`;
  if (rest === 0) return `${whole}h`;
  return `${whole}h ${rest}m`;
}

export function longDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function shortDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function shortLabel(iso: string): string {
  return parseISODate(iso).toLocaleDateString("en", { month: "short", day: "numeric" });
}

export function monthTitle(ym: string): string {
  const [year, month] = ym.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en", { month: "long", year: "numeric" });
}

export function shiftMonth(ym: string, delta: number): string {
  const [year, month] = ym.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthBounds(ym: string): { start: string; end: string } {
  const [year, month] = ym.split("-").map(Number);
  const last = new Date(year, month, 0).getDate();
  return { start: `${ym}-01`, end: `${ym}-${String(last).padStart(2, "0")}` };
}

export function weekStart(iso: string): string {
  const day = parseISODate(iso).getDay();
  const delta = day === 0 ? -6 : 1 - day;
  return addDays(iso, delta);
}

export function chartAnchor(month: string, today: string): string {
  if (month < today.slice(0, 7)) return monthBounds(month).end;
  return today;
}

/** shortcut: clips a span at 10 years so a bad row cannot loop forever. */
export function eachDate(start: string, end: string): string[] {
  if (end < start) return [];
  const dates: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    dates.push(cursor);
    if (dates.length > 3660) break;
    cursor = addDays(cursor, 1);
  }
  return dates;
}

export function spanDays(start: string, end: string): number {
  return eachDate(start, end).length;
}

export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

export function monthGrid(ym: string): string[] {
  const { start, end } = monthBounds(ym);
  const gridStart = weekStart(start);
  const endDay = parseISODate(end).getDay();
  const gridEnd = endDay === 0 ? end : addDays(end, 7 - endDay);
  return eachDate(gridStart, gridEnd);
}

export function classifyDay(
  iso: string,
  today: string,
  row: AttendanceInput | null,
  onLeave: boolean,
): DayKind {
  const weekend = parseISODate(iso).getDay() % 6 === 0;
  if (iso > today) return onLeave ? "leave" : "future";
  if (row?.wfh) return "wfh";
  if (row?.clockOut) return "worked";
  if (row) return "open";
  if (onLeave) return "leave";
  if (iso === today) return "today";
  if (weekend) return "off";
  return "missed";
}

function orderedLeaves(leaves: LeaveInput[]): LeaveInput[] {
  return [...leaves].sort((a, b) => a.start.localeCompare(b.start) || a.id - b.id);
}

function leaveCovering(leaves: LeaveInput[], iso: string): LeaveInput | null {
  return leaves.find((leave) => leave.start <= iso && iso <= leave.end) ?? null;
}

export function summarize(input: {
  month?: string;
  start?: string;
  end?: string;
  today: string;
  attendance: AttendanceInput[];
  leaves: LeaveInput[];
}): {
  hours: number;
  worked: number;
  wfh: number;
  missed: number;
  leaveDays: number;
  days: DayFact[];
} {
  const bounds = input.start && input.end ? { start: input.start, end: input.end } : monthBounds(input.month ?? input.today.slice(0, 7));
  const { start, end } = bounds;
  const byDay = new Map(input.attendance.map((row) => [row.day, row]));
  const leaves = orderedLeaves(input.leaves);
  const days = eachDate(start, end).map((iso) => {
    const row = byDay.get(iso) ?? null;
    const leave = leaveCovering(leaves, iso);
    const kind = classifyDay(iso, input.today, row, leave != null);
    return {
      iso,
      inMonth: true,
      kind,
      hours: row?.wfh || !row?.clockIn || !row.clockOut ? null : hoursBetween(row.clockIn, row.clockOut),
      leaveType: leave?.type ?? null,
      leaveId: leave?.id ?? null,
      attendanceId: row?.id ?? null,
    };
  });

  const inMonth = days.filter((day) => day.inMonth);
  const leaveDates = new Set<string>();
  for (const leave of leaves) {
    const from = leave.start > start ? leave.start : start;
    const to = leave.end < end ? leave.end : end;
    for (const iso of eachDate(from, to)) leaveDates.add(iso);
  }

  return {
    hours: roundHours(inMonth.reduce((sum, day) => sum + (day.hours ?? 0), 0)),
    worked: inMonth.filter((day) => day.kind === "worked" || day.kind === "open").length,
    wfh: inMonth.filter((day) => day.kind === "wfh").length,
    missed: inMonth.filter((day) => day.kind === "missed").length,
    leaveDays: leaveDates.size,
    days,
  };
}

export function weekSeries(attendance: AttendanceInput[], anchor: string, count = 8) {
  const end = weekStart(anchor);
  const start = addDays(end, -7 * (count - 1));
  const buckets = new Map<string, number>();
  for (let index = 0; index < count; index += 1) buckets.set(addDays(start, index * 7), 0);
  for (const row of attendance) {
    if (row.wfh || !row.clockIn || !row.clockOut) continue;
    const key = weekStart(row.day);
    if (!buckets.has(key)) continue;
    const hours = hoursBetween(row.clockIn, row.clockOut);
    if (hours == null) continue;
    buckets.set(key, (buckets.get(key) ?? 0) + hours);
  }
  return [...buckets].map(([startDate, hours]) => ({
    start: startDate,
    label: shortLabel(startDate),
    hours: roundHours(hours),
  }));
}

export function leaveTotals(leaves: LeaveInput[], rangeStart: string, rangeEnd: string) {
  const totals = new Map<LeaveType, number>(LEAVE_TYPES.map((type) => [type, 0]));
  const seen = new Set<string>();
  for (const leave of orderedLeaves(leaves)) {
    const from = leave.start > rangeStart ? leave.start : rangeStart;
    const to = leave.end < rangeEnd ? leave.end : rangeEnd;
    for (const iso of eachDate(from, to)) {
      if (seen.has(iso)) continue;
      seen.add(iso);
      totals.set(leave.type, (totals.get(leave.type) ?? 0) + 1);
    }
  }
  return LEAVE_TYPES.map((type) => ({ type, days: totals.get(type) ?? 0 }));
}

function roundHours(hours: number): number {
  return Math.round(hours * 100) / 100;
}
