import {
  addDays,
  chartAnchor,
  classifyDay,
  eachDate,
  formatHours,
  hoursBetween,
  leaveTotals,
  monthBounds,
  monthGrid,
  monthTitle,
  parseISODate,
  parseMonth,
  shiftMonth,
  shortDate,
  shortLabel,
  summarize,
  weekSeries,
  weekStart,
  LEAVE_LABEL,
  LEAVE_TYPES,
  type AttendanceInput,
  type LeaveInput,
  type LeaveType,
} from "./stats.ts";

export const STANDARD_HOURS = 8;
export const LATE_AFTER = "10:00";

export const STATUS_FILTERS = [
  { id: "", label: "All" },
  { id: "open", label: "In office" },
  { id: "out", label: "Clocked out" },
  { id: "wfh", label: "WFH" },
  { id: "leave", label: "On leave" },
  { id: "none", label: "Not logged" },
  { id: "late", label: "Late" },
  { id: "missed", label: "Has missed" },
] as const;

export type Tone = "ok" | "wfh" | "leave" | "miss" | "quiet" | "late";

export type StatusView = {
  key: "open" | "out" | "wfh" | "leave" | "missed" | "none" | "off" | "future";
  label: string;
  tone: Tone;
  late: boolean;
  half: boolean;
};

type Summary = ReturnType<typeof summarize>;
type LogRow = AttendanceInput & { note?: string };
type LeaveRow = LeaveInput & { note?: string };

export type Slice = {
  personId: number;
  name: string;
  month: Summary;
  previous: Summary;
  rate: number | null;
  prevRate: number | null;
  trend: "up" | "down" | "flat" | "na";
  avgHours: number | null;
  prevAvgHours: number | null;
  avgClockIn: string | null;
  prevAvgClockIn: string | null;
  netHours: number;
  lateDays: number;
  halfDays: number;
  shortDays: number;
  closedDays: number;
  prevClosed: number;
  currentStreak: number;
  longestStreak: number;
  monthStreak: number;
  today: StatusView;
  todayIn: string | null;
  todayOut: string | null;
};

export type Bar = { key: string; label: string; value: number; text: string };

export type CalendarCell = {
  iso: string;
  inMonth: boolean;
  kind: string;
  aria: string;
  href: string | null;
  foot: string | null;
  heat?: number;
};

export type DayLine = {
  personId: number;
  name: string;
  status: StatusView;
  detail: string;
  attendanceId: number | null;
  leaveId: number | null;
};

export type FeedItem = {
  key: string;
  who: string;
  when: string;
  detail: string;
  label: string;
  tone: Tone;
};

type PersonLog = { name: string; attendance: LogRow[]; leaves: LeaveRow[] };

function round(hours: number): number {
  return Math.round(hours * 100) / 100;
}

export function pageHref(path: string, query: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value);
  }
  const text = params.toString();
  return text ? `${path}?${text}` : path;
}

export type SpanKind = "month" | "year" | "all";

export type Span = {
  kind: SpanKind;
  start: string;
  end: string;
  label: string;
  month: string;
  year: string;
  previous: { start: string; end: string } | null;
};

export function parseYear(value: string | undefined): string | null {
  if (!value || !/^\d{4}$/.test(value)) return null;
  const year = Number(value);
  if (year < 2000 || year > 2100) return null;
  return value;
}

export function yearChoices(today: string, selected: string): string[] {
  const current = Number(today.slice(0, 4));
  const years = new Set<string>();
  for (let delta = 0; delta < 5; delta += 1) years.add(String(current - delta));
  if (parseYear(selected)) years.add(selected);
  return [...years].sort((a, b) => Number(b) - Number(a));
}

function yearWindow(year: string, today: string, dataStart: string, dataEnd: string): { start: string; end: string } | null {
  const startBound = `${year}-01-01`;
  const endBound = `${year}-12-31`;
  if (dataEnd < startBound || dataStart > endBound) return null;
  const start = dataStart > startBound ? dataStart : startBound;
  let end = dataEnd < endBound ? dataEnd : endBound;
  if (today >= startBound && today <= endBound && today > end) end = today;
  if (end < start) return null;
  return { start, end };
}

export function resolveSpan(
  query: { span?: string; month?: string },
  today: string,
  dataStart: string,
  dataEnd: string,
): Span {
  const month = parseMonth(query.month) ?? today.slice(0, 7);
  const pickedYear = parseYear(query.span);
  const kind: SpanKind = query.span === "all" ? "all" : pickedYear ? "year" : "month";
  if (kind === "year" && pickedYear) {
    const window = yearWindow(pickedYear, today, dataStart, dataEnd) ?? { start: `${pickedYear}-12-31`, end: `${pickedYear}-01-01` };
    return {
      kind,
      start: window.start,
      end: window.end,
      label: pickedYear,
      month: `${pickedYear}-${month.slice(5, 7)}`,
      year: pickedYear,
      previous: yearWindow(String(Number(pickedYear) - 1), today, dataStart, dataEnd),
    };
  }
  if (kind === "all") {
    const start = dataStart && dataStart <= today ? dataStart : today;
    let end = dataEnd && dataEnd > today ? dataEnd : today;
    if (end < start) end = start;
    return { kind, start, end, label: "All time", month, year: month.slice(0, 4), previous: null };
  }
  const bounds = monthBounds(month);
  return {
    kind: "month",
    start: bounds.start,
    end: bounds.end,
    label: monthTitle(month),
    month,
    year: month.slice(0, 4),
    previous: monthBounds(shiftMonth(month, -1)),
  };
}

export function spanQuery(span: Span): { span?: string; month: string } {
  return {
    span: span.kind === "all" ? "all" : span.kind === "year" ? span.year : undefined,
    month: span.month,
  };
}

export function dataExtent(
  records: { attendance: { day: string }[]; leaves: { start: string; end: string }[] }[],
  today: string,
): { start: string; end: string } {
  let start = today;
  let end = today;
  for (const record of records) {
    for (const row of record.attendance) {
      if (row.day < start) start = row.day;
      if (row.day > end) end = row.day;
    }
    for (const leave of record.leaves) {
      if (leave.start < start) start = leave.start;
      if (leave.end > end) end = leave.end;
    }
  }
  return { start, end };
}

export function shiftFocus(span: Span, delta: number): string | null {
  const next = shiftMonth(span.month, delta);
  if (span.kind === "year" && next.slice(0, 4) !== span.year) return null;
  return next;
}

export function selectedPerson(value: string | undefined, activeId: number): "all" | number {
  if (value === "all") return "all";
  if (!value) return activeId;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : activeId;
}

export function cleanStatus(value: string | undefined): string {
  return STATUS_FILTERS.some((item) => item.id === value) ? (value ?? "") : "";
}

export function attendanceRate(summary: { worked: number; wfh: number; missed: number }): number | null {
  const denom = summary.worked + summary.wfh + summary.missed;
  if (denom === 0) return null;
  return Math.round(((summary.worked + summary.wfh) / denom) * 100);
}

export function trendOf(current: number | null, previous: number | null): Slice["trend"] {
  if (current == null || previous == null) return "na";
  if (current === previous) return "flat";
  return current > previous ? "up" : "down";
}

export function percentLabel(value: number | null): string {
  return value == null ? "—" : `${value}%`;
}

export function hoursText(hours: number): string {
  const rounded = round(hours);
  return rounded === 0 ? "0h" : formatHours(rounded);
}

export function signedHours(hours: number): string {
  const rounded = round(hours);
  if (rounded === 0) return "0h";
  const body = formatHours(Math.abs(rounded));
  return rounded > 0 ? `+${body}` : `−${body}`;
}

export function trendLabel(slice: Slice): { text: string; tone: string } {
  if (slice.trend === "na" || slice.rate == null || slice.prevRate == null) return { text: "—", tone: "na" };
  const delta = slice.rate - slice.prevRate;
  if (delta === 0) return { text: "0", tone: "flat" };
  return { text: `${delta > 0 ? "+" : ""}${delta}`, tone: delta > 0 ? "up" : "down" };
}

function meanClock(clocks: string[]): string | null {
  if (clocks.length === 0) return null;
  const total = clocks.reduce((sum, clock) => {
    const [hour, minute] = clock.split(":").map(Number);
    return sum + hour * 60 + minute;
  }, 0);
  const avg = Math.round(total / clocks.length);
  return `${String(Math.floor(avg / 60)).padStart(2, "0")}:${String(avg % 60).padStart(2, "0")}`;
}

export function meanClockLabel(clocks: (string | null)[]): string {
  return meanClock(clocks.filter((clock): clock is string => !!clock)) ?? "—";
}

export function statusOf(input: { iso: string; today: string; row: LogRow | null; leave: LeaveRow | null }): StatusView {
  const kind = classifyDay(input.iso, input.today, input.row, input.leave != null);
  const weekend = parseISODate(input.iso).getDay() % 6 === 0;
  const hours =
    input.row && !input.row.wfh && input.row.clockIn && input.row.clockOut
      ? hoursBetween(input.row.clockIn, input.row.clockOut)
      : null;
  const late = !!input.row && !input.row.wfh && !!input.row.clockIn && input.row.clockIn > LATE_AFTER;
  const half = hours != null && hours > 0 && hours < 5;
  if (kind === "today" && weekend) return { key: "off", label: "Weekend", tone: "quiet", late: false, half: false };
  if (kind === "wfh") return { key: "wfh", label: "WFH", tone: "wfh", late: false, half: false };
  if (kind === "open") return { key: "open", label: "In office", tone: "ok", late, half: false };
  if (kind === "worked") return { key: "out", label: "Clocked out", tone: "ok", late, half };
  if (kind === "leave") {
    return {
      key: "leave",
      label: input.leave ? LEAVE_LABEL[input.leave.type] : "On leave",
      tone: "leave",
      late: false,
      half: false,
    };
  }
  if (kind === "missed") return { key: "missed", label: "Missed", tone: "miss", late: false, half: false };
  if (kind === "off") return { key: "off", label: "Weekend", tone: "quiet", late: false, half: false };
  if (kind === "future") return { key: "future", label: "Upcoming", tone: "quiet", late: false, half: false };
  return { key: "none", label: "Not logged", tone: "quiet", late: false, half: false };
}

function covering(leaves: LeaveRow[], iso: string): LeaveRow | null {
  return leaves.find((leave) => leave.start <= iso && iso <= leave.end) ?? null;
}

function lookup(attendance: LogRow[], leaves: LeaveRow[], iso: string) {
  return {
    row: attendance.find((item) => item.day === iso) ?? null,
    leave: covering(leaves, iso),
  };
}

function present(kind: string): boolean {
  return kind === "worked" || kind === "open" || kind === "wfh";
}

export function currentStreak(today: string, attendance: LogRow[], leaves: LeaveRow[]): number {
  let streak = 0;
  for (let iso = today, guard = 0; guard < 200; guard += 1, iso = addDays(iso, -1)) {
    const { row, leave } = lookup(attendance, leaves, iso);
    const kind = classifyDay(iso, today, row, leave != null);
    if (kind === "off" || kind === "today" || kind === "future") continue;
    if (!present(kind)) break;
    streak += 1;
  }
  return streak;
}

export function longestRun(start: string, end: string, today: string, attendance: LogRow[], leaves: LeaveRow[]): number {
  let best = 0;
  let run = 0;
  for (const iso of eachDate(start, end)) {
    const { row, leave } = lookup(attendance, leaves, iso);
    const kind = classifyDay(iso, today, row, leave != null);
    if (kind === "off" || kind === "future" || kind === "today") continue;
    if (!present(kind)) {
      run = 0;
      continue;
    }
    run += 1;
    if (run > best) best = run;
  }
  return best;
}

function periodNumbers(attendance: LogRow[], leaves: LeaveRow[], start: string, end: string, today: string) {
  const summary = summarize({ start, end, today, attendance, leaves });
  const last = end < today ? end : today;
  const closed = summary.days.filter((day) => day.inMonth && day.iso <= today && day.kind === "worked" && day.hours != null);
  const clocks: string[] = [];
  let late = 0;
  let half = 0;
  let short = 0;
  for (const row of attendance) {
    if (row.wfh || !row.clockIn || row.day < start || row.day > last) continue;
    clocks.push(row.clockIn);
    if (row.clockIn > LATE_AFTER) late += 1;
    if (!row.clockOut) continue;
    const hours = hoursBetween(row.clockIn, row.clockOut);
    if (hours == null) continue;
    if (hours < 6) short += 1;
    if (hours > 0 && hours < 5) half += 1;
  }
  return {
    summary,
    closed: closed.length,
    late,
    half,
    short,
    net: round(closed.reduce((sum, day) => sum + ((day.hours ?? 0) - STANDARD_HOURS), 0)),
    avgHours: closed.length ? round(closed.reduce((sum, day) => sum + (day.hours ?? 0), 0) / closed.length) : null,
    avgClockIn: meanClock(clocks),
  };
}

type Period = string | { start: string; end: string; previous?: { start: string; end: string } | null };

function periodOf(value: Period): { start: string; end: string; previous: { start: string; end: string } | null } {
  if (typeof value === "string") return { ...monthBounds(value), previous: monthBounds(shiftMonth(value, -1)) };
  return { start: value.start, end: value.end, previous: value.previous ?? null };
}

const EMPTY_PERIOD = {
  summary: { hours: 0, worked: 0, wfh: 0, missed: 0, leaveDays: 0, days: [] },
  closed: 0,
  late: 0,
  half: 0,
  short: 0,
  net: 0,
  avgHours: null,
  avgClockIn: null,
};

export function buildSlice(
  person: { id: number; name: string },
  month: Period,
  today: string,
  attendance: LogRow[],
  leaves: LeaveRow[],
): Slice {
  const range = periodOf(month);
  const current = periodNumbers(attendance, leaves, range.start, range.end, today);
  const previous = range.previous
    ? periodNumbers(attendance, leaves, range.previous.start, range.previous.end, today)
    : EMPTY_PERIOD;
  const { start, end } = range;
  const todayRow = attendance.find((row) => row.day === today) ?? null;
  const rate = attendanceRate(current.summary);
  const prevRate = attendanceRate(previous.summary);
  return {
    personId: person.id,
    name: person.name,
    month: current.summary,
    previous: previous.summary,
    rate,
    prevRate,
    trend: trendOf(rate, prevRate),
    avgHours: current.avgHours,
    prevAvgHours: previous.avgHours,
    avgClockIn: current.avgClockIn,
    prevAvgClockIn: previous.avgClockIn,
    netHours: current.net,
    lateDays: current.late,
    halfDays: current.half,
    shortDays: current.short,
    closedDays: current.closed,
    prevClosed: previous.closed,
    currentStreak: currentStreak(today, attendance, leaves),
    longestStreak: longestRun(addDays(today, -120), today, today, attendance, leaves),
    monthStreak: longestRun(start, end < today ? end : today, today, attendance, leaves),
    today: statusOf({ iso: today, today, row: todayRow, leave: covering(leaves, today) }),
    todayIn: todayRow && !todayRow.wfh ? todayRow.clockIn : null,
    todayOut: todayRow && !todayRow.wfh ? todayRow.clockOut : null,
  };
}

export function matchesStatus(slice: Slice, status: string): boolean {
  if (!status) return true;
  if (status === "late") return slice.today.late;
  if (status === "missed") return slice.month.missed > 0;
  return slice.today.key === status;
}

export function sumRate(slices: Slice[], which: "month" | "previous" = "month"): number | null {
  const totals = slices.reduce(
    (sum, slice) => {
      const source = which === "month" ? slice.month : slice.previous;
      return {
        worked: sum.worked + source.worked,
        wfh: sum.wfh + source.wfh,
        missed: sum.missed + source.missed,
      };
    },
    { worked: 0, wfh: 0, missed: 0 },
  );
  return attendanceRate(totals);
}

function weekStarts(anchor: string, count: number): string[] {
  const end = weekStart(anchor);
  const first = addDays(end, -7 * (count - 1));
  return Array.from({ length: count }, (_, index) => addDays(first, index * 7));
}

function axisLabel(iso: string): string {
  return `${Number(iso.slice(5, 7))}/${Number(iso.slice(8))}`;
}

export function windowLabel(anchor: string): string {
  const start = weekStarts(anchor, 8)[0];
  return `${shortLabel(start)} – ${shortLabel(anchor)}`;
}

function closedAsOf(anchor: string, today: string): string {
  return anchor < today ? addDays(anchor, 1) : today;
}

function tally(iso: string, asOf: string, attendance: LogRow[], leaves: LeaveRow[]): "present" | "missed" | "skip" {
  const { row, leave } = lookup(attendance, leaves, iso);
  const kind = classifyDay(iso, asOf, row, leave != null);
  if (present(kind)) return "present";
  if (kind === "missed") return "missed";
  return "skip";
}

export function weeklyAttendance(people: PersonLog[], anchor: string, today: string): Bar[] {
  const asOf = closedAsOf(anchor, today);
  return weekStarts(anchor, 8).map((start) => {
    let presentCount = 0;
    let denom = 0;
    for (const person of people) {
      for (const iso of eachDate(start, addDays(start, 6))) {
        const mark = tally(iso, asOf, person.attendance, person.leaves);
        if (mark === "skip") continue;
        denom += 1;
        if (mark === "present") presentCount += 1;
      }
    }
    const value = denom === 0 ? 0 : Math.round((presentCount / denom) * 100);
    return { key: start, label: axisLabel(start), value, text: `${shortLabel(start)} ${value}% attended` };
  });
}

export function weeklyHours(people: PersonLog[], anchor: string): { start: string; label: string; hours: number }[] {
  const series = people.map((person) => weekSeries(person.attendance, anchor));
  if (series.length === 0 || !series[0]) return [];
  return series[0].map((week, index) => ({
    start: week.start,
    label: week.label,
    hours: round(series.reduce((sum, rows) => sum + (rows[index]?.hours ?? 0), 0)),
  }));
}

export function perPersonWeeks<T extends { hours: number }>(weeks: T[], people: number): T[] {
  if (people <= 1) return weeks;
  return weeks.map((week) => ({ ...week, hours: round(week.hours / people) }));
}

export function averageWeekHours(weeks: { hours: number }[], people: number): number | null {
  const last = weeks.at(-1);
  if (!last || people === 0) return null;
  return round(last.hours / people);
}

export function weekdayOccupancy(people: PersonLog[], anchor: string, today: string, from = weekStarts(anchor, 8)[0]): Bar[] {
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const occupied = [0, 0, 0, 0, 0];
  const eligible = [0, 0, 0, 0, 0];
  const asOf = closedAsOf(anchor, today);
  for (const person of people) {
    for (const iso of eachDate(from, anchor)) {
      const dow = parseISODate(iso).getDay();
      if (dow < 1 || dow > 5) continue;
      const { row, leave } = lookup(person.attendance, person.leaves, iso);
      const kind = classifyDay(iso, asOf, row, leave != null);
      if (kind === "future" || kind === "today" || kind === "off") continue;
      eligible[dow - 1] += 1;
      if (kind === "worked" || kind === "open") occupied[dow - 1] += 1;
    }
  }
  return labels.map((label, index) => {
    const value = eligible[index] === 0 ? 0 : Math.round((occupied[index] / eligible[index]) * 100);
    return { key: label, label, value, text: `${label} ${value}% in office` };
  });
}

export function modeMix(
  people: PersonLog[],
  anchor: string,
  today: string,
  from = weekStarts(anchor, 8)[0],
): { office: number; wfh: number; leave: number; missed: number } {
  const mix = { office: 0, wfh: 0, leave: 0, missed: 0 };
  const asOf = closedAsOf(anchor, today);
  for (const person of people) {
    for (const iso of eachDate(from, anchor)) {
      const { row, leave } = lookup(person.attendance, person.leaves, iso);
      const kind = classifyDay(iso, asOf, row, leave != null);
      if (kind === "worked" || kind === "open") mix.office += 1;
      else if (kind === "wfh") mix.wfh += 1;
      else if (kind === "leave") mix.leave += 1;
      else if (kind === "missed") mix.missed += 1;
    }
  }
  return mix;
}

function monthsBetween(start: string, end: string): string[] {
  const months: string[] = [];
  let cursor = start.slice(0, 7);
  const last = end.slice(0, 7);
  while (cursor <= last && months.length < 120) {
    months.push(cursor);
    cursor = shiftMonth(cursor, 1);
  }
  return months;
}

function monthTick(ym: string, start: string, end: string): string {
  const [year, month] = ym.split("-").map(Number);
  const crosses = start.slice(0, 4) !== end.slice(0, 4);
  return new Date(year, month - 1, 1).toLocaleDateString("en", crosses ? { month: "short", year: "2-digit" } : { month: "short" });
}

function clipMonth(ym: string, start: string, end: string): { start: string; end: string } {
  const bounds = monthBounds(ym);
  return { start: bounds.start < start ? start : bounds.start, end: bounds.end > end ? end : bounds.end };
}

export function monthlyAttendance(people: PersonLog[], start: string, end: string, today: string): Bar[] {
  return monthsBetween(start, end).map((month) => {
    const bounds = clipMonth(month, start, end);
    let presentCount = 0;
    let denom = 0;
    for (const person of people) {
      for (const iso of eachDate(bounds.start, bounds.end)) {
        const mark = tally(iso, today, person.attendance, person.leaves);
        if (mark === "skip") continue;
        denom += 1;
        if (mark === "present") presentCount += 1;
      }
    }
    const value = denom === 0 ? 0 : Math.round((presentCount / denom) * 100);
    return { key: month, label: monthTick(month, start, end), value, text: `${monthTitle(month)} ${value}% attended` };
  });
}

export function monthlyHourBars(people: PersonLog[], start: string, end: string): Bar[] {
  const count = people.length;
  return monthsBetween(start, end).map((month) => {
    const bounds = clipMonth(month, start, end);
    let hours = 0;
    for (const person of people) {
      for (const row of person.attendance) {
        if (row.day < bounds.start || row.day > bounds.end) continue;
        if (row.wfh || !row.clockIn || !row.clockOut) continue;
        hours += hoursBetween(row.clockIn, row.clockOut) ?? 0;
      }
    }
    const value = count > 1 ? round(hours / count) : round(hours);
    return { key: month, label: monthTick(month, start, end), value, text: `${monthTitle(month)} ${formatHours(value)}` };
  });
}

export function monthlyLeaveBars(people: PersonLog[], start: string, end: string): Bar[] {
  return monthsBetween(start, end).map((month) => {
    const bounds = clipMonth(month, start, end);
    const days = people.reduce(
      (sum, person) => sum + leaveTotals(person.leaves, bounds.start, bounds.end).reduce((inner, row) => inner + row.days, 0),
      0,
    );
    return { key: month, label: monthTick(month, start, end), value: days, text: `${monthTitle(month)} ${days} leave days` };
  });
}

export function weeklyLeave(people: PersonLog[], anchor: string): Bar[] {
  return weekStarts(anchor, 8).map((start) => {
    const end = addDays(start, 6);
    const days = people.reduce(
      (sum, person) => sum + leaveTotals(person.leaves, start, end).reduce((inner, row) => inner + row.days, 0),
      0,
    );
    return { key: start, label: axisLabel(start), value: days, text: `${shortLabel(start)} ${days} leave days` };
  });
}

export function monthLeave(people: { leaves: LeaveRow[] }[], start: string, end: string): { type: LeaveType; days: number }[] {
  const totals = new Map<LeaveType, number>(LEAVE_TYPES.map((type) => [type, 0]));
  for (const person of people) {
    for (const row of leaveTotals(person.leaves, start, end)) {
      totals.set(row.type, (totals.get(row.type) ?? 0) + row.days);
    }
  }
  return LEAVE_TYPES.map((type) => ({ type, days: totals.get(type) ?? 0 }));
}

export function calendarCells(input: {
  month: string;
  today: string;
  people: PersonLog[];
  hrefFor: (iso: string) => string;
}): CalendarCell[] {
  const { start, end } = monthBounds(input.month);
  const single = input.people.length === 1;
  return monthGrid(input.month).map((iso) => {
    const inMonth = iso >= start && iso <= end;
    if (!inMonth) return { iso, inMonth, kind: "out", aria: iso, href: null, foot: null };
    if (single) {
      const person = input.people[0];
      const { row, leave } = lookup(person.attendance, person.leaves, iso);
      const kind = classifyDay(iso, input.today, row, leave != null);
      const status = statusOf({ iso, today: input.today, row, leave });
      return {
        iso,
        inMonth,
        kind,
        aria: `${person.name}, ${status.label}`,
        href: input.hrefFor(iso),
        foot: null,
      };
    }
    let office = 0;
    let wfh = 0;
    let leaveCount = 0;
    let missed = 0;
    for (const person of input.people) {
      const { row, leave } = lookup(person.attendance, person.leaves, iso);
      const kind = classifyDay(iso, input.today, row, leave != null);
      if (kind === "worked" || kind === "open") office += 1;
      else if (kind === "wfh") wfh += 1;
      else if (kind === "leave") leaveCount += 1;
      else if (kind === "missed") missed += 1;
    }
    const ranked = [
      ["worked", office],
      ["wfh", wfh],
      ["leave", leaveCount],
      ["missed", missed],
    ].sort((a, b) => Number(b[1]) - Number(a[1]));
    const kind = iso > input.today ? (leaveCount > 0 ? "leave" : "future") : Number(ranked[0][1]) === 0 ? "off" : String(ranked[0][0]);
    return {
      iso,
      inMonth,
      kind,
      aria: `${shortDate(iso)}: ${office} in office, ${wfh} working from home, ${leaveCount} on leave, ${missed} missed`,
      href: input.hrefFor(iso),
      foot: kind === "worked" ? String(office) : kind === "wfh" ? String(wfh) : kind === "leave" ? String(leaveCount) : kind === "missed" ? String(missed) : null,
      heat: kind === "worked" ? office / input.people.length : undefined,
    };
  });
}

export function dayLines(iso: string, today: string, people: (PersonLog & { id?: number })[]): DayLine[] {
  return people.map((person) => {
    const { row, leave } = lookup(person.attendance, person.leaves, iso);
    const status = statusOf({ iso, today, row, leave });
    const bits: string[] = [];
    if (row && !row.wfh && row.clockIn) bits.push(row.clockOut ? `${row.clockIn}–${row.clockOut}` : `In at ${row.clockIn}`);
    if (row && !row.wfh && row.clockIn && row.clockOut) {
      const hours = hoursBetween(row.clockIn, row.clockOut);
      if (hours != null) bits.push(hoursText(hours));
    }
    const note = row?.note && row.note !== "sample" ? row.note : "";
    if (note) bits.push(note);
    else if (leave?.note && status.key === "leave") bits.push(leave.note);
    return {
      personId: person.id ?? 0,
      name: person.name,
      status,
      detail: bits.join(" · "),
      attendanceId: row?.id ?? null,
      leaveId: leave?.id ?? null,
    };
  });
}

export function pickedDay(month: string, today: string, requested: string | null): string {
  const { start, end } = monthBounds(month);
  if (requested && requested >= start && requested <= end) return requested;
  if (today >= start && today <= end) return today;
  return today > end ? end : start;
}

export function recentFeed(people: PersonLog[], start: string, end: string, today: string): FeedItem[] {
  const items: (FeedItem & { sort: string })[] = [];
  for (const person of people) {
    for (const row of person.attendance) {
      if (row.day < start || row.day > end || row.day > today) continue;
      items.push({
        key: `a-${row.id}`,
        who: person.name,
        when: row.day,
        sort: `${row.day}-1-${String(row.id).padStart(6, "0")}`,
        detail: row.wfh ? "Work from home" : row.clockOut ? `${row.clockIn}–${row.clockOut}` : `Clocked in ${row.clockIn}`,
        label: row.wfh ? "WFH" : row.clockOut ? "Clocked out" : "Clocked in",
        tone: row.wfh ? "wfh" : "ok",
      });
    }
    for (const leave of person.leaves) {
      if (leave.end < start || leave.start > end || leave.start > today) continue;
      items.push({
        key: `l-${leave.id}`,
        who: person.name,
        when: leave.start,
        sort: `${leave.start}-0-${String(leave.id).padStart(6, "0")}`,
        detail: `${LEAVE_LABEL[leave.type]}${leave.note ? ` · ${leave.note}` : ""}`,
        label: "Leave",
        tone: "leave",
      });
    }
  }
  return items.sort((a, b) => b.sort.localeCompare(a.sort)).slice(0, 8);
}

export function upcomingLeave(
  people: (PersonLog & { id?: number })[],
  start: string,
  end: string,
  today: string,
  leaveType = "",
): { title: string; hint: string; items: FeedItem[] } {
  const upcoming = end >= today;
  const horizon = addDays(today, 60);
  const items: (FeedItem & { sort: string })[] = [];
  for (const person of people) {
    for (const leave of person.leaves) {
      if (leaveType && leave.type !== leaveType) continue;
      const inView = upcoming ? leave.end >= today && leave.start <= horizon : leave.end >= start && leave.start <= end;
      if (!inView) continue;
      const when = leave.end === leave.start ? shortDate(leave.start) : `${shortDate(leave.start)} – ${shortDate(leave.end)}`;
      items.push({
        key: `u-${leave.id}`,
        who: person.name,
        when: leave.start,
        sort: `${leave.start}-${person.name}`,
        detail: `${when}${leave.note ? ` · ${leave.note}` : ""}`,
        label: LEAVE_LABEL[leave.type],
        tone: "leave",
      });
    }
  }
  items.sort((a, b) => a.sort.localeCompare(b.sort));
  return {
    title: upcoming ? "Upcoming leave" : "Leave in this range",
    hint: upcoming ? "Next 60 days" : "Overlapping this range",
    items,
  };
}

export function attentionLines(
  slices: Slice[],
  stale: { personId: number; personName: string; day: string }[],
): string[] {
  const lines: string[] = [];
  for (const row of stale) {
    if (!slices.some((slice) => slice.personId === row.personId)) continue;
    lines.push(`${row.personName} still in since ${shortDate(row.day)}`);
  }
  for (const slice of slices) {
    if (slice.today.key === "none") lines.push(`${slice.name} not logged`);
    else if (slice.today.late && slice.todayIn) lines.push(`${slice.name} late ${slice.todayIn}`);
  }
  return lines;
}

export function insightCards(
  slices: Slice[],
  attention: string[],
  emptyRange = "this month",
): { title: string; value: string; detail: string }[] {
  const by = (score: (slice: Slice) => number) =>
    [...slices].sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name))[0];
  const missed = slices.reduce((sum, slice) => sum + slice.month.missed, 0);
  const missedNames = slices.filter((slice) => slice.month.missed > 0).map((slice) => slice.name);
  const short = slices.reduce((sum, slice) => sum + slice.shortDays, 0);
  const shortNames = slices
    .filter((slice) => slice.shortDays > 0)
    .sort((a, b) => b.shortDays - a.shortDays)
    .slice(0, 3)
    .map((slice) => `${slice.name} ${slice.shortDays}d`);
  const leave = by((slice) => slice.month.leaveDays);
  const streak = by((slice) => slice.longestStreak);
  const office = by((slice) => slice.month.worked);
  return [
    {
      title: "Missed logs",
      value: String(missed),
      detail: missedNames.length ? missedNames.join(", ") : `None ${emptyRange}`,
    },
    {
      title: "Short hours",
      value: String(short),
      detail: shortNames.length ? shortNames.join(" · ") : "No day under 6h",
    },
    {
      title: "Frequent leave",
      value: leave && leave.month.leaveDays > 0 ? `${leave.month.leaveDays}d` : "0d",
      detail: leave && leave.month.leaveDays > 0 ? leave.name : `No leave ${emptyRange}`,
    },
    {
      title: "Longest streak",
      value: streak ? `${streak.longestStreak}d` : "0d",
      detail: streak && streak.longestStreak > 0 ? `${streak.name} · 120 days` : "No run yet",
    },
    {
      title: "Top office presence",
      value: office ? `${office.month.worked}d` : "0d",
      detail: office ? office.name : "—",
    },
    {
      title: "Needs attention",
      value: String(attention.length),
      detail: attention.length === 0 ? "Everyone is accounted for" : attention.slice(0, 4).join("\n"),
    },
  ];
}

export function timeline(people: (PersonLog & { id: number })[], start: string, end: string, today: string): FeedItem[] {
  const last = end < today ? end : today;
  const items: FeedItem[] = [];
  for (const iso of [...eachDate(start, last)].reverse()) {
    for (const line of dayLines(iso, today, people)) {
      if (line.status.key === "off" || line.status.key === "future") continue;
      items.push({
        key: `${iso}-${line.personId}`,
        who: line.name,
        when: iso,
        detail: line.detail || line.status.label,
        label: line.status.label,
        tone: line.status.tone,
      });
    }
  }
  return items.slice(0, 16);
}

export function missedFeed(people: (PersonLog & { id: number })[], start: string, end: string, today: string): FeedItem[] {
  const last = end < today ? end : today;
  const items: FeedItem[] = [];
  for (const iso of [...eachDate(start, last)].reverse()) {
    for (const line of dayLines(iso, today, people)) {
      if (line.status.key !== "missed") continue;
      items.push({
        key: `m-${iso}-${line.personId}`,
        who: line.name,
        when: iso,
        detail: "Nothing logged",
        label: "Missed",
        tone: "miss",
      });
      if (items.length >= 8) return items;
    }
  }
  return items;
}

export function chartAnchorFor(month: string, today: string): string {
  return chartAnchor(month, today);
}

export function dayAction(
  line: DayLine,
  iso: string,
  activeId: number,
): { href: string | null; hrefLabel: string | null } {
  if (line.personId !== activeId) return { href: null, hrefLabel: null };
  if (line.status.key === "leave" && line.leaveId) {
    return { href: `/leave?edit=${line.leaveId}#leave-form`, hrefLabel: "Edit leave" };
  }
  if (line.attendanceId) return { href: `/attendance?edit=${line.attendanceId}#day-form`, hrefLabel: "Edit" };
  if (line.status.key === "missed" || line.status.key === "none") {
    return { href: `/attendance?day=${iso}`, hrefLabel: "Log" };
  }
  return { href: null, hrefLabel: null };
}

export function scopeLine(slices: Slice[]): string {
  if (slices.length === 0) return "No one matches these filters.";
  if (slices.length === 1) return slices[0].name;
  return `${slices.length} people`;
}
