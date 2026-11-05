import type { CSSProperties } from "react";
import Link from "next/link";
import { formatHours, LEAVE_LABEL, type LeaveType } from "@/lib/stats";
import type { Bar, CalendarCell } from "@/lib/board";

function axisLabel(iso: string): string {
  return `${Number(iso.slice(5, 7))}/${Number(iso.slice(8))}`;
}

const MARKED = new Set(["worked", "wfh", "open", "leave", "missed"]);

export function CalendarGrid({
  cells,
  today,
  picked,
  legend,
}: {
  cells: CalendarCell[];
  today: string;
  picked?: string | null;
  legend: "person" | "team";
}) {
  return (
    <>
      <div className="dow" aria-hidden="true">
        {["M", "T", "W", "T", "F", "S", "S"].map((label, index) => (
          <span key={`${label}-${index}`}>{label}</span>
        ))}
      </div>
      <div className="month">
        {cells.map((cell) => {
          const className = [
            "cell",
            cell.inMonth ? (cell.heat != null ? "heat" : `kind-${cell.kind}`) : "out",
            cell.iso === today ? "is-today" : "",
            cell.iso === picked ? "is-picked" : "",
          ]
            .filter(Boolean)
            .join(" ");
          const style = cell.heat != null ? ({ "--p": String(cell.heat) } as CSSProperties) : undefined;
          const inner = (
            <>
              <span className="num">{Number(cell.iso.slice(-2))}</span>
              {cell.foot != null ? (
                <span className="foot">{cell.foot}</span>
              ) : (
                <span className={MARKED.has(cell.kind) ? `mark ${cell.kind}` : "mark empty"} />
              )}
            </>
          );
          if (!cell.href) {
            return (
              <span key={cell.iso} className={className} style={style} aria-label={cell.aria}>
                {inner}
              </span>
            );
          }
          return (
            <Link
              key={cell.iso}
              className={className}
              style={style}
              href={cell.href}
              aria-label={cell.aria}
              aria-current={cell.iso === picked ? "date" : undefined}
            >
              {inner}
            </Link>
          );
        })}
      </div>
      <p className="legend">
        <span>
          <i className="mark worked" /> Office
        </span>
        <span>
          <i className="mark wfh" /> WFH
        </span>
        <span>
          <i className="mark open" /> In office
        </span>
        <span>
          <i className="mark leave" /> Leave
        </span>
        <span>
          <i className="mark missed" /> Missed
        </span>
        {legend === "team" && <span>Count is people. Deeper green is a fuller office.</span>}
      </p>
    </>
  );
}

export function Bars({
  title,
  range,
  rows,
  unit = "",
  ceiling,
}: {
  title: string;
  range?: string;
  rows: Bar[];
  unit?: "" | "h" | "%";
  ceiling?: number;
}) {
  const max = ceiling ?? Math.max(1, ...rows.map((row) => row.value));
  const summary = rows.map((row) => row.text).join(", ");
  return (
    <section className="card">
      <header className="card-head">
        <h2>{title}</h2>
        {range && <p>{range}</p>}
      </header>
      {rows.length === 0 ? (
        <p className="muted">Nothing in this window.</p>
      ) : (
        <div className="bars" style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` }} role="img" aria-label={summary}>
          {rows.map((row) => (
            <div className="bar" key={row.key}>
              <span className="bar-value">{row.value > 0 ? `${unit === "h" ? Math.round(row.value * 10) / 10 : Math.round(row.value)}${unit}` : ""}</span>
              <span className="bar-track">
                <span className="bar-fill" style={{ height: row.value > 0 ? `${Math.max(4, (row.value / max) * 100)}%` : "0%" }} />
              </span>
              <span className="bar-label">{row.label}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function WeekChart({
  weeks,
  detail,
}: {
  weeks: { start: string; label: string; hours: number }[];
  detail?: string;
}) {
  const dates = weeks.length ? `${weeks[0].label} – ${weeks.at(-1)?.label}` : undefined;
  const ceiling = Math.max(8, ...weeks.map((week) => week.hours));
  return (
    <Bars
      title="Hours by week"
      range={dates && detail ? `${dates} · ${detail}` : dates}
      ceiling={ceiling}
      unit="h"
      rows={weeks.map((week) => ({
        key: week.start,
        label: axisLabel(week.start),
        value: week.hours,
        text: `${week.label} ${formatHours(week.hours)}`,
      }))}
    />
  );
}

export function LeaveChart({ rows, year }: { rows: { type: LeaveType; days: number }[]; year: string }) {
  const visible = rows.filter((row) => row.days > 0);
  const max = Math.max(1, ...visible.map((row) => row.days));
  return (
    <section className="card">
      <header className="card-head">
        <h2>Leave in {year}</h2>
      </header>
      {visible.length === 0 ? (
        <p className="muted">No leave in this range.</p>
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
