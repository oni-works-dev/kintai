import Link from "next/link";
import {
  formatHours,
  LEAVE_LABEL,
  longDate,
  type DayFact,
  type LeaveType,
} from "@/lib/stats";

function axisLabel(iso: string): string {
  return `${Number(iso.slice(5, 7))}/${Number(iso.slice(8))}`;
}

function dayLabel(day: DayFact): string {
  const name = longDate(day.iso);
  if (day.kind === "worked" && day.hours != null) return `${name}, worked ${formatHours(day.hours)}`;
  if (day.kind === "open") return `${name}, clocked in, not clocked out`;
  if (day.kind === "leave" && day.leaveType) return `${name}, ${LEAVE_LABEL[day.leaveType]}`;
  if (day.kind === "missed") return `${name}, nothing logged`;
  if (day.kind === "off") return `${name}, weekend`;
  if (day.kind === "today") return `${name}, today`;
  return name;
}

function hrefFor(day: DayFact): string | null {
  if (!day.inMonth) return null;
  if (day.kind === "leave" && day.leaveId) return `/leave?edit=${day.leaveId}#leave-form`;
  if (day.kind === "future" || day.kind === "off") return null;
  if (day.attendanceId) return `/attendance?edit=${day.attendanceId}#day-form`;
  return `/attendance?day=${day.iso}`;
}

export function MonthCalendar({ days, today }: { days: DayFact[]; today: string }) {
  return (
    <section className="card calendar">
      <header className="card-head">
        <h2>Calendar</h2>
      </header>
      <div className="dow" aria-hidden="true">
        {["M", "T", "W", "T", "F", "S", "S"].map((label, index) => (
          <span key={`${label}-${index}`}>{label}</span>
        ))}
      </div>
      <div className="month">
        {days.map((day) => {
          const marked = day.inMonth && (day.kind === "worked" || day.kind === "open" || day.kind === "leave" || day.kind === "missed");
          const className = `cell${day.inMonth ? ` kind-${day.kind}` : " out"}${day.iso === today ? " is-today" : ""}`;
          const inner = (
            <>
              <span className="num">{Number(day.iso.slice(-2))}</span>
              <span className={marked ? `mark ${day.kind}` : "mark empty"} />
            </>
          );
          const href = hrefFor(day);
          if (!href) {
            return (
              <span key={day.iso} className={className} aria-label={dayLabel(day)}>
                {inner}
              </span>
            );
          }
          return (
            <Link key={day.iso} className={className} href={href} aria-label={dayLabel(day)}>
              {inner}
            </Link>
          );
        })}
      </div>
      <p className="legend">
        <span>
          <i className="mark worked" /> Worked
        </span>
        <span>
          <i className="mark open" /> Open
        </span>
        <span>
          <i className="mark leave" /> Leave
        </span>
        <span>
          <i className="mark missed" /> Missed
        </span>
      </p>
    </section>
  );
}

export function WeekChart({
  weeks,
}: {
  weeks: { start: string; label: string; hours: number }[];
}) {
  const max = Math.max(8, ...weeks.map((week) => week.hours));
  const summary = weeks.map((week) => `${week.label} ${formatHours(week.hours)}`).join(", ");
  return (
    <section className="card">
      <header className="card-head">
        <h2>Hours by week</h2>
        <p>
          {weeks[0]?.label} – {weeks.at(-1)?.label}
        </p>
      </header>
      <div className="bars" role="img" aria-label={summary}>
        {weeks.map((week) => (
          <div className="bar" key={week.start}>
            <span className="bar-value">{week.hours > 0 ? `${Math.round(week.hours * 10) / 10}h` : ""}</span>
            <span className="bar-track">
              <span
                className="bar-fill"
                style={{ height: week.hours > 0 ? `${Math.max(6, (week.hours / max) * 100)}%` : "0%" }}
              />
            </span>
            <span className="bar-label">{axisLabel(week.start)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function LeaveChart({
  rows,
  year,
}: {
  rows: { type: LeaveType; days: number }[];
  year: string;
}) {
  const visible = rows.filter((row) => row.days > 0);
  const max = Math.max(1, ...visible.map((row) => row.days));
  return (
    <section className="card">
      <header className="card-head">
        <h2>Leave in {year}</h2>
      </header>
      {visible.length === 0 ? (
        <p className="muted">No leave this year.</p>
      ) : (
        <ul className="hbars">
          {visible.map((row) => (
            <li key={row.type}>
              <span>{LEAVE_LABEL[row.type]}</span>
              <span className="htrack">
                <span style={{ width: `${(row.days / max) * 100}%` }} />
              </span>
              <span>{row.days}d</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
