import Link from "next/link";
import type { ReactNode } from "react";
import { shortDate } from "@/lib/stats";
import { STATUS_FILTERS, type FeedItem, type StatusView, type Tone } from "@/lib/board";

export function PageHeading({
  kicker,
  title,
  lede,
  actions,
}: {
  kicker: string;
  title: string;
  lede: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div>
        <p className="kicker">{kicker}</p>
        <h1>{title}</h1>
        <p>{lede}</p>
      </div>
      {actions}
    </header>
  );
}

export function MonthNav({
  prev,
  current,
  next,
  currentLabel = "This month",
}: {
  prev: string | null;
  current: string | null;
  next: string | null;
  currentLabel?: string;
}) {
  return (
    <div className="month-nav">
      {prev && (
        <Link className="button ghost" href={prev}>
          Previous
        </Link>
      )}
      {current && (
        <Link className="button ghost" href={current}>
          {currentLabel}
        </Link>
      )}
      {next && (
        <Link className="button ghost" href={next}>
          Next
        </Link>
      )}
    </div>
  );
}

export function StatusFilters({ current, hrefFor }: { current: string; hrefFor: (status: string) => string }) {
  return (
    <div className="status-row">
      {STATUS_FILTERS.map((item) => (
        <Link key={item.id || "all"} href={hrefFor(item.id)} aria-current={item.id === current ? "true" : undefined}>
          {item.label}
        </Link>
      ))}
    </div>
  );
}

export function Kpi({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: Tone }) {
  return (
    <article className={tone ? `stat stat-${tone}` : "stat"}>
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{hint}</span>
    </article>
  );
}

export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`pill tone-${tone}`}>{children}</span>;
}

export function StatusPills({ status }: { status: StatusView }) {
  return (
    <span className="pills-inline">
      <Pill tone={status.tone}>{status.label}</Pill>
      {status.late && <Pill tone="late">Late</Pill>}
      {status.half && <Pill tone="late">Half-day</Pill>}
    </span>
  );
}

export function Insights({ items }: { items: { title: string; value: string; detail: string }[] }) {
  return (
    <section className="insights">
      {items.map((item) => (
        <article className="insight" key={item.title}>
          <p>{item.title}</p>
          <strong>{item.value}</strong>
          <span>{item.detail}</span>
        </article>
      ))}
    </section>
  );
}

export function ModeMix({
  office,
  wfh,
  leave,
  missed,
  range,
}: {
  office: number;
  wfh: number;
  leave: number;
  missed: number;
  range: string;
}) {
  const parts = [
    { label: "Office", value: office, color: "var(--ok)" },
    { label: "WFH", value: wfh, color: "var(--wfh)" },
    { label: "Leave", value: leave, color: "var(--leave)" },
    { label: "Missed", value: missed, color: "var(--miss)" },
  ];
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  let cursor = 0;
  const stops =
    total === 0
      ? ["var(--line) 0 100%"]
      : parts
          .filter((part) => part.value > 0)
          .map((part) => {
            const start = cursor;
            cursor += (part.value / total) * 100;
            return `${part.color} ${start}% ${cursor}%`;
          });
  return (
    <section className="card">
      <header className="card-head">
        <h2>Attendance mix</h2>
        <p>{range}</p>
      </header>
      <div className="mode">
        <div className="donut-wrap" role="img" aria-label={parts.map((part) => `${part.label} ${part.value}`).join(", ")}>
          <div className="donut" style={{ background: `conic-gradient(${stops.join(", ")})` }} />
          <div className="donut-hole">
            <strong>{total}</strong>
            <span>days</span>
          </div>
        </div>
        <ul className="mode-legend">
          {parts.map((part) => (
            <li key={part.label}>
              <i style={{ background: part.color }} />
              <span>{part.label}</span>
              <strong>{part.value}</strong>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Compare({
  title = "Month against month",
  current,
  previous,
  rows,
  hint,
}: {
  title?: string;
  current: string;
  previous: string;
  rows: { label: string; current: string; previous: string }[];
  hint?: string;
}) {
  return (
    <section className="card">
      <header className="card-head">
        <h2>{title}</h2>
        {hint && <p>{hint}</p>}
      </header>
      <div className="compare">
        <div className="compare-head">
          <span />
          <span>{current}</span>
          <span>{previous}</span>
        </div>
        {rows.map((row) => (
          <div className="compare-line" key={row.label}>
            <span>{row.label}</span>
            <strong>{row.current}</strong>
            <span>{row.previous}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Feed({ title, hint, items, empty }: { title: string; hint?: string; items: FeedItem[]; empty: string }) {
  return (
    <section className="card">
      <header className="card-head">
        <h2>{title}</h2>
        {hint && <p>{hint}</p>}
      </header>
      {items.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <ul className="feed">
          {items.map((item) => (
            <li key={item.key}>
              <Pill tone={item.tone}>{item.label}</Pill>
              <div>
                <strong>{item.who}</strong>
                <span>{item.detail}</span>
              </div>
              <time dateTime={item.when}>{shortDate(item.when)}</time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function DayPanel({
  title,
  hint,
  lines,
}: {
  title: string;
  hint?: string;
  lines: { key: string; name: string; detail: string; status: StatusView; href: string | null; hrefLabel: string | null }[];
}) {
  return (
    <section className="card" id="day-detail">
      <header className="card-head">
        <h2>{title}</h2>
        {hint && <p>{hint}</p>}
      </header>
      {lines.length === 0 ? (
        <p className="muted">No one in this view.</p>
      ) : (
        <ul className="feed">
          {lines.map((line) => (
            <li key={line.key}>
              <StatusPills status={line.status} />
              <div>
                <strong>{line.name}</strong>
                {line.detail && <span>{line.detail}</span>}
              </div>
              {line.href && line.hrefLabel && (
                <Link className="button quiet" href={line.href}>
                  {line.hrefLabel}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export type RosterRow = {
  id: number;
  name: string;
  href: string;
  active: boolean;
  status: StatusView;
  clockIn: string;
  clockOut: string;
  hours: string;
  worked: number;
  wfh: number;
  leave: number;
  missed: number;
  rate: string;
  trend: string;
  trendTone: string;
};

export function Roster({ rows, caption }: { rows: RosterRow[]; caption: string }) {
  return (
    <section className="card team-card">
      <header className="card-head">
        <h2>Roster</h2>
        <p>{caption}</p>
      </header>
      {rows.length === 0 ? (
        <p className="muted">No one matches these filters.</p>
      ) : (
        <div className="team-wrap">
          <table className="team">
            <thead>
              <tr>
                <th>Person</th>
                <th>Today</th>
                <th>In</th>
                <th>Out</th>
                <th className="num">Hours</th>
                <th className="num">Office</th>
                <th className="num">WFH</th>
                <th className="num">Leave</th>
                <th className="num">Missed</th>
                <th className="num">Rate</th>
                <th className="num">Trend</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={row.active ? "is-active" : undefined}>
                  <th scope="row">
                    <Link href={row.href}>{row.name}</Link>
                  </th>
                  <td>
                    <StatusPills status={row.status} />
                  </td>
                  <td className="num">{row.clockIn}</td>
                  <td className="num">{row.clockOut}</td>
                  <td className="num">{row.hours}</td>
                  <td className="num">{row.worked}</td>
                  <td className="num">{row.wfh}</td>
                  <td className="num">{row.leave}</td>
                  <td className="num">{row.missed}</td>
                  <td className="num">{row.rate}</td>
                  <td className={`num trend ${row.trendTone}`}>{row.trend}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
