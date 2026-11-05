import type { Metadata } from "next";
import { Banner } from "@/components/banner";
import { Bars, CalendarGrid, LeaveChart, WeekChart } from "@/components/charts";
import {
  Compare,
  DayPanel,
  Feed,
  Insights,
  Kpi,
  ModeMix,
  MonthNav,
  PageHeading,
} from "@/components/analytics";
import { FilterBar } from "@/components/filter-bar";
import { TodayCard } from "@/components/today-card";
import { activePerson } from "@/lib/active";
import {
  buildSlice,
  calendarCells,
  chartAnchorFor,
  dataExtent,
  dayAction,
  dayLines,
  hoursText,
  meanClockLabel,
  missedFeed,
  modeMix,
  monthLeave,
  monthlyAttendance,
  monthlyHourBars,
  pageHref,
  perPersonWeeks,
  percentLabel,
  pickedDay,
  resolveSpan,
  scopeLine,
  selectedPerson,
  shiftFocus,
  signedHours,
  spanQuery,
  timeline,
  upcomingLeave,
  weekdayOccupancy,
  weeklyAttendance,
  weeklyHours,
  windowLabel,
  yearChoices,
  type Slice,
} from "@/lib/board";
import { allAttendance, allLeaves, allPeople, sampleCount } from "@/lib/db";
import { longDate, monthTitle, parseDay, shiftMonth, todayISO } from "@/lib/stats";

export const metadata: Metadata = { title: "Report" };
export const dynamic = "force-dynamic";

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; span?: string; person?: string; day?: string; error?: string }>;
}) {
  const query = await searchParams;
  const active = await activePerson();
  const today = todayISO();
  const people = allPeople();
  const person = selectedPerson(query.person, active.id);
  const records = people.map((member) => ({
    id: member.id,
    name: member.name,
    attendance: allAttendance(member.id),
    leaves: allLeaves(member.id),
  }));
  const extent = dataExtent(records, today);
  const span = resolveSpan(query, today, extent.start, extent.end);
  const slices = records
    .map((record) =>
      buildSlice(record, { start: span.start, end: span.end, previous: span.previous }, today, record.attendance, record.leaves),
    )
    .filter((slice) => person === "all" || slice.personId === person);
  const group = records.filter((record) => slices.some((slice) => slice.personId === record.id));
  const long = span.kind !== "month";
  const anchor = long ? (span.end < today ? span.end : today) : chartAnchorFor(span.month, today);
  const chartFrom = long ? span.start : undefined;
  const spanText = long ? span.label : windowLabel(anchor);
  const picked = pickedDay(span.month, today, parseDay(query.day ?? ""));
  const weeks = weeklyHours(group, anchor);
  const openPeriod = span.kind === "year" ? span.year === today.slice(0, 4) : span.month === today.slice(0, 7);
  const params = {
    ...spanQuery(span),
    person: person === "all" ? "all" : String(person),
    day: picked,
  };
  const focusHref = (delta: number) => {
    const month = shiftFocus(span, delta);
    return month ? href({ month, day: "" }) : null;
  };
  const href = (patch: Partial<typeof params> = {}) =>
    pageHref("/report", { ...params, ...patch, day: patch.day === "" ? undefined : (patch.day ?? params.day) });
  const self = slices.length === 1 && slices[0]?.personId === active.id ? records.find((record) => record.id === active.id) : null;
  const lines = dayLines(picked, today, group);
  const totals = rollup(slices, "month");
  const prior = rollup(slices, "previous");

  return (
    <>
      <PageHeading
        kicker="Report"
        title={span.label}
        lede={scopeLine(slices)}
        actions={
          span.kind === "year" ? (
            <MonthNav
              prev={href({ span: String(Number(span.year) - 1), day: "" })}
              next={href({ span: String(Number(span.year) + 1), day: "" })}
              current={span.year === today.slice(0, 4) ? null : href({ span: today.slice(0, 4), month: today.slice(0, 7), day: "" })}
              currentLabel="This year"
            />
          ) : span.kind === "month" ? (
            <MonthNav
              prev={href({ month: shiftMonth(span.month, -1), day: "" })}
              next={href({ month: shiftMonth(span.month, 1), day: "" })}
              current={openPeriod ? null : href({ month: today.slice(0, 7), day: "" })}
            />
          ) : null
        }
      />
      {sampleCount() > 0 && (
        <p className="sample-note">Earlier weeks include sample days so the trends are readable. Days you log are left as they are.</p>
      )}
      <FilterBar
        action="/report"
        span={span.kind === "year" ? span.year : span.kind}
        month={span.month}
        years={yearChoices(today, span.year)}
        hidden={{ day: picked, person: person === "all" ? "all" : String(person) }}
        resetHref={pageHref("/report", { ...spanQuery(span), person: String(active.id) })}
      />
      <Banner code={query.error} />
      {self && (
        <TodayCard name={self.name} today={today} row={self.attendance.find((row) => row.day === today) ?? null} returnTo="/report" />
      )}
      {slices.length === 0 ? (
        <section className="card">
          <p className="muted">No one matches these filters.</p>
        </section>
      ) : (
        <>
          <section className="kpis">
            <Kpi label="Hours" value={hoursText(totals.hours)} hint={span.kind === "month" ? "Office time this month" : `Office time in ${span.kind === "all" ? "all time" : span.label}`} />
            <Kpi label="Attendance rate" value={percentLabel(totals.rate)} hint="Office and WFH vs missed" />
            <Kpi label="Avg daily hours" value={totals.avgHours == null ? "—" : hoursText(totals.avgHours)} hint="Closed office days" />
            <Kpi label="Office days" value={String(totals.worked)} hint="Clocked days" tone="ok" />
            <Kpi label="WFH days" value={String(totals.wfh)} hint="No hours counted" tone="wfh" />
            <Kpi label="Leave days" value={String(totals.leaveDays)} hint="Including planned" tone="leave" />
            <Kpi label="Missed logs" value={String(totals.missed)} hint="Past empty weekdays" tone="miss" />
            <Kpi label="Over / under" value={signedHours(totals.net)} hint="Against an 8h office day" />
          </section>
          <div className="analytics">
            <div className="stack">
              {long ? (
                <>
                  <Bars title="Attendance trend" range={span.label} unit="%" ceiling={100} rows={monthlyAttendance(group, span.start, span.end, today)} />
                  <Bars
                    title="Hours by month"
                    range={slices.length > 1 ? `${span.label} · Average per person` : span.label}
                    unit="h"
                    rows={monthlyHourBars(group, span.start, span.end)}
                  />
                </>
              ) : (
                <>
                  <Bars title="Attendance trend" range={spanText} unit="%" ceiling={100} rows={weeklyAttendance(group, anchor, today)} />
                  <WeekChart weeks={perPersonWeeks(weeks, slices.length)} detail={slices.length > 1 ? "Average per person" : undefined} />
                </>
              )}
            </div>
            <div className="stack">
              <ModeMix {...modeMix(group, anchor, today, chartFrom)} range={spanText} />
              <Bars title="Weekday occupancy" range={long ? span.label : "In-office share"} unit="%" ceiling={100} rows={weekdayOccupancy(group, anchor, today, chartFrom)} />
            </div>
          </div>
          {span.previous && (
          <Compare
              title={span.kind === "year" ? "Year against year" : "Month against month"}
              current={span.kind === "year" ? span.year : shortMonth(span.month)}
              previous={span.kind === "year" ? String(Number(span.year) - 1) : shortMonth(shiftMonth(span.month, -1))}
              hint={
                span.kind === "year"
                  ? openPeriod
                    ? "This year is still open, so the comparison is partial."
                    : "Both years are closed."
                  : openPeriod
                    ? "This month is still open, so the comparison is partial."
                    : "Both months are closed."
              }
              rows={[
                { label: "Hours", current: hoursText(totals.hours), previous: hoursText(prior.hours) },
                { label: "Attendance", current: percentLabel(totals.rate), previous: percentLabel(prior.rate) },
                { label: "Avg daily", current: totals.avgHours == null ? "—" : hoursText(totals.avgHours), previous: prior.avgHours == null ? "—" : hoursText(prior.avgHours) },
                { label: "Office days", current: String(totals.worked), previous: String(prior.worked) },
                { label: "WFH", current: String(totals.wfh), previous: String(prior.wfh) },
                { label: "Leave", current: String(totals.leaveDays), previous: String(prior.leaveDays) },
                { label: "Missed", current: String(totals.missed), previous: String(prior.missed) },
                { label: "Avg clock-in", current: meanClockLabel(slices.map((slice) => slice.avgClockIn)), previous: meanClockLabel(slices.map((slice) => slice.prevAvgClockIn)) },
              ]}
          />
          )}
          <Insights
              items={[
                streakCard("Current streak", slices, (slice) => slice.currentStreak, "Through today"),
                streakCard(span.kind === "month" ? "Longest this month" : "Longest in range", slices, (slice) => slice.monthStreak, span.kind === "month" ? "Inside the month" : "Inside the range"),
                { title: "Avg clock-in", value: meanClockLabel(slices.map((slice) => slice.avgClockIn)), detail: span.kind === "month" ? "Office days this month" : "Office days in this range" },
                { title: "Late days", value: String(slices.reduce((sum, slice) => sum + slice.lateDays, 0)), detail: "Arrived after 10:00" },
                { title: "Half-days", value: String(slices.reduce((sum, slice) => sum + slice.halfDays, 0)), detail: "Under 5 hours" },
                { title: "Short days", value: String(slices.reduce((sum, slice) => sum + slice.shortDays, 0)), detail: "Under 6 hours" },
            ]}
          />
          <div className="split">
            <section className="card calendar">
              <header className="card-head">
                <h2>Calendar</h2>
                {span.kind === "month" ? (
                  <p>{slices.length === 1 ? (slices[0]?.name ?? "Person") : "Everyone"}</p>
                ) : (
                  <div className="month-nav">
                    <p>{monthTitle(span.month)}</p>
                    <MonthNav
                      prev={focusHref(-1)}
                      next={focusHref(1)}
                      current={
                        span.month === today.slice(0, 7) || (span.kind === "year" && !today.startsWith(span.year))
                          ? null
                          : href({ month: today.slice(0, 7), day: "" })
                      }
                    />
                  </div>
                )}
              </header>
              <CalendarGrid
                cells={calendarCells({ month: span.month, today, people: group, hrefFor: (iso) => `${href({ day: iso })}#day-detail` })}
                today={today}
                picked={picked}
                legend={slices.length === 1 ? "person" : "team"}
              />
            </section>
            <DayPanel
              title={longDate(picked)}
              hint="Status for the selected day."
              lines={lines.map((line) => ({
                key: `${picked}-${line.personId}`,
                name: line.name,
                detail: line.detail,
                status: line.status,
                ...dayAction(line, picked, active.id),
              }))}
            />
          </div>
          <div className="split">
            <LeaveChart rows={monthLeave(group, span.start, span.end)} year={span.label} />
            <Feed {...upcomingLeave(group, span.start, span.end, today)} empty="No leave in this window." />
          </div>
          <div className="split">
            <Feed title="Missed logs" hint={span.label} items={missedFeed(group, span.start, span.end, today)} empty="No missed weekdays." />
            <Feed title="Timeline" hint="Latest days" items={timeline(group, span.start, span.end, today)} empty="Nothing to show yet." />
          </div>
        </>
      )}
    </>
  );
}

function shortMonth(month: string): string {
  const [year, index] = month.split("-").map(Number);
  return new Date(year, index - 1, 1).toLocaleDateString("en", { month: "short", year: "numeric" });
}

function rollup(slices: Slice[], which: "month" | "previous") {
  const source = (slice: Slice) => (which === "month" ? slice.month : slice.previous);
  const hours = slices.reduce((sum, slice) => sum + source(slice).hours, 0);
  const closed = slices.reduce((sum, slice) => sum + (which === "month" ? slice.closedDays : slice.prevClosed), 0);
  const worked = slices.reduce((sum, slice) => sum + source(slice).worked, 0);
  const wfh = slices.reduce((sum, slice) => sum + source(slice).wfh, 0);
  const missed = slices.reduce((sum, slice) => sum + source(slice).missed, 0);
  const leaveDays = slices.reduce((sum, slice) => sum + source(slice).leaveDays, 0);
  const net = slices.reduce((sum, slice) => sum + (which === "month" ? slice.netHours : 0), 0);
  return {
    hours,
    worked,
    wfh,
    missed,
    leaveDays,
    net,
    rate: worked + wfh + missed === 0 ? null : Math.round(((worked + wfh) / (worked + wfh + missed)) * 100),
    avgHours: closed === 0 ? null : Math.round((hours / closed) * 100) / 100,
  };
}

function streakCard(title: string, slices: Slice[], score: (slice: Slice) => number, solo: string) {
  const top = [...slices].sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name))[0];
  return {
    title,
    value: top ? `${score(top)}d` : "0d",
    detail: slices.length === 1 ? solo : (top?.name ?? "—"),
  };
}
