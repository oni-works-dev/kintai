import type { Metadata } from "next";
import Link from "next/link";
import { Banner } from "@/components/banner";
import { LeaveChart, MonthCalendar, WeekChart } from "@/components/charts";
import { TodayCard } from "@/components/today-card";
import { activePerson } from "@/lib/active";
import { allAttendance, allLeaves } from "@/lib/db";
import {
  chartAnchor,
  formatHours,
  leaveTotals,
  monthTitle,
  parseMonth,
  shiftMonth,
  summarize,
  todayISO,
  weekSeries,
} from "@/lib/stats";

export const metadata: Metadata = { title: "Report" };
export const dynamic = "force-dynamic";

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; error?: string }>;
}) {
  const query = await searchParams;
  const person = await activePerson();
  const today = todayISO();
  const month = parseMonth(query.month) ?? today.slice(0, 7);
  const attendance = allAttendance(person.id);
  const leaves = allLeaves(person.id);
  const summary = summarize({ month, today, attendance, leaves });
  const weeks = weekSeries(attendance, chartAnchor(month, today));
  const year = month.slice(0, 4);

  return (
    <>
      <header className="page-head">
        <div>
          <h1>{monthTitle(month)}</h1>
          <p>{person.name}&apos;s month.</p>
        </div>
        <div className="month-nav">
          <Link className="button ghost" href={`/report?month=${shiftMonth(month, -1)}`}>
            Previous
          </Link>
          {month !== today.slice(0, 7) && (
            <Link className="button ghost" href="/report">
              This month
            </Link>
          )}
          <Link className="button ghost" href={`/report?month=${shiftMonth(month, 1)}`}>
            Next
          </Link>
        </div>
      </header>
      <Banner code={query.error} />
      <TodayCard
        name={person.name}
        today={today}
        row={attendance.find((row) => row.day === today) ?? null}
        returnTo="/report"
      />
      <section className="stats">
        <Stat label="Hours" value={summary.hours === 0 ? "0h" : formatHours(summary.hours)} hint="Completed clock-ins" />
        <Stat label="Worked" value={String(summary.worked)} hint="Days with a clock-in" />
        <Stat label="Missed" value={String(summary.missed)} hint="Past weekdays with nothing logged" />
        <Stat label="Leave" value={String(summary.leaveDays)} hint="Calendar days, including planned" />
      </section>
      <div className="split">
        <MonthCalendar days={summary.days} today={today} />
        <div className="stack">
          <WeekChart weeks={weeks} />
          <LeaveChart rows={leaveTotals(leaves, `${year}-01-01`, `${year}-12-31`)} year={year} />
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <article className="stat">
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{hint}</span>
    </article>
  );
}
