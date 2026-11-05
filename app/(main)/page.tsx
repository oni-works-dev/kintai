import type { Metadata } from "next";
import Link from "next/link";
import { Banner } from "@/components/banner";
import { Bars, CalendarGrid, LeaveChart, WeekChart } from "@/components/charts";
import {
  DayPanel,
  Insights,
  Kpi,
  ModeMix,
  MonthNav,
  PageHeading,
  Roster,
  StatusFilters,
  Feed,
} from "@/components/analytics";
import { FilterBar } from "@/components/filter-bar";
import { TodayCard } from "@/components/today-card";
import { activePerson } from "@/lib/active";
import {
  attentionLines,
  averageWeekHours,
  buildSlice,
  calendarCells,
  chartAnchorFor,
  cleanStatus,
  dataExtent,
  dayAction,
  dayLines,
  hoursText,
  insightCards,
  matchesStatus,
  modeMix,
  monthLeave,
  monthlyAttendance,
  monthlyHourBars,
  monthlyLeaveBars,
  pageHref,
  percentLabel,
  pickedDay,
  recentFeed,
  resolveSpan,
  scopeLine,
  shiftFocus,
  spanQuery,
  sumRate,
  trendLabel,
  perPersonWeeks,
  upcomingLeave,
  weekdayOccupancy,
  weeklyAttendance,
  weeklyHours,
  weeklyLeave,
  windowLabel,
  yearChoices,
  type Slice,
  type Span,
} from "@/lib/board";
import { allAttendance, allLeaves, allPeople, openPunches, sampleCount } from "@/lib/db";
import { longDate, monthTitle, parseDay, parseISODate, shiftMonth, todayISO } from "@/lib/stats";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; span?: string; status?: string; day?: string; error?: string }>;
}) {
  const query = await searchParams;
  const active = await activePerson();
  const today = todayISO();
  const people = allPeople();
  const status = cleanStatus(query.status);
  const records = people.map((member) => ({
    id: member.id,
    name: member.name,
    attendance: allAttendance(member.id),
    leaves: allLeaves(member.id),
  }));
  const extent = dataExtent(records, today);
  const span = resolveSpan(query, today, extent.start, extent.end);
  const slices = records.map((record) =>
    buildSlice(record, { start: span.start, end: span.end, previous: span.previous }, today, record.attendance, record.leaves),
  );
  const roster = slices.filter((slice) => matchesStatus(slice, status));
  const long = span.kind !== "month";
  const anchor = long ? (span.end < today ? span.end : today) : chartAnchorFor(span.month, today);
  const chartFrom = long ? span.start : undefined;
  const spanText = long ? span.label : windowLabel(anchor);
  const picked = pickedDay(span.month, today, parseDay(query.day ?? ""));
  const weekend = parseISODate(today).getDay() % 6 === 0;
  const present = slices.filter((slice) => slice.today.key === "open" || slice.today.key === "out").length;
  const weeks = weeklyHours(records, long ? today : anchor);
  const params = {
    ...spanQuery(span),
    status: status || undefined,
    day: picked,
  };
  const focusHref = (delta: number) => {
    const month = shiftFocus(span, delta);
    return month ? href({ month, day: "" }) : null;
  };
  const href = (patch: Partial<typeof params> = {}) => pageHref("/", { ...params, ...patch, day: patch.day === "" ? undefined : (patch.day ?? params.day) });
  const lines = dayLines(picked, today, records);
  const self = records.find((record) => record.id === active.id);
  const attention = attentionLines(
    slices,
    openPunches().filter((row) => row.day < today),
  );

  return (
    <>
      <PageHeading
        kicker="Dashboard"
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
              current={span.month === today.slice(0, 7) ? null : href({ month: today.slice(0, 7), day: "" })}
            />
          ) : null
        }
      />
      {sampleCount() > 0 && (
        <p className="sample-note">Earlier weeks include sample days so the trends are readable. Days you log are left as they are.</p>
      )}
      <FilterBar
        action="/"
        span={span.kind === "year" ? span.year : span.kind}
        month={span.month}
        years={yearChoices(today, span.year)}
        hidden={{ status, day: picked }}
        resetHref={pageHref("/", spanQuery(span))}
      />
      <StatusFilters current={status} hrefFor={(next) => href({ status: next })} />
      <Banner code={query.error} />
      {self && (
        <TodayCard
          name={self.name}
          today={today}
          row={self.attendance.find((row) => row.day === today) ?? null}
          returnTo="/"
        />
      )}
      {slices.length === 0 ? (
        <section className="card">
          <p className="muted">No one matches these filters.</p>
        </section>
      ) : (
        <>
          <section className="kpis">
            <Kpi label="Present today" value={String(present)} hint="In the office" tone="ok" />
            <Kpi label="WFH today" value={String(slices.filter((slice) => slice.today.key === "wfh").length)} hint="Working from home" tone="wfh" />
            <Kpi label="On leave today" value={String(slices.filter((slice) => slice.today.key === "leave").length)} hint="Leave covering today" tone="leave" />
            <Kpi label="Not logged" value={String(slices.filter((slice) => slice.today.key === "none").length)} hint={weekend ? "Weekend" : "No row yet today"} tone="miss" />
            <Kpi label="Attendance rate" value={percentLabel(sumRate(slices))} hint={span.kind === "month" ? "This month, office and WFH" : `${span.label}, office and WFH`} />
            <Kpi label="Avg hours this week" value={hoursText(averageWeekHours(weeks, slices.length) ?? 0)} hint="Office hours per person" />
            <Kpi label="Office days" value={String(slices.reduce((sum, slice) => sum + slice.month.worked, 0))} hint={span.kind === "month" ? "Month to date" : span.label} />
            <Kpi label="Missed logs" value={String(slices.reduce((sum, slice) => sum + slice.month.missed, 0))} hint="Past weekdays with no row" tone="miss" />
          </section>
          <div className="analytics">
            <div className="stack">
              {long ? (
                <>
                  <Bars title="Attendance trend" range={span.label} unit="%" ceiling={100} rows={monthlyAttendance(records, span.start, span.end, today)} />
                  <Bars
                    title="Hours by month"
                    range={slices.length > 1 ? `${span.label} · Average per person` : span.label}
                    unit="h"
                    rows={monthlyHourBars(records, span.start, span.end)}
                  />
                  <Bars title="Leave usage" range={span.label} rows={monthlyLeaveBars(records, span.start, span.end)} />
                </>
              ) : (
                <>
                  <Bars title="Attendance trend" range={spanText} unit="%" ceiling={100} rows={weeklyAttendance(records, anchor, today)} />
                  <WeekChart weeks={perPersonWeeks(weeks, slices.length)} detail={slices.length > 1 ? "Average per person" : undefined} />
                  <Bars title="Leave usage" range={spanText} rows={weeklyLeave(records, anchor)} />
                </>
              )}
            </div>
            <div className="stack">
              <ModeMix {...modeMix(records, anchor, today, chartFrom)} range={spanText} />
              <Bars title="Weekday occupancy" range={long ? span.label : "In-office share"} unit="%" ceiling={100} rows={weekdayOccupancy(records, anchor, today, chartFrom)} />
              <LeaveChart rows={monthLeave(records, span.start, span.end)} year={span.label} />
            </div>
          </div>
          <Insights items={insightCards(slices, attention, span.kind === "month" ? "this month" : "in this range")} />
          <div className="split">
            <section className="card calendar">
              <header className="card-head">
                <h2>Calendar</h2>
                {span.kind === "month" ? (
                  <p>{slices.length === 1 ? "One person" : "Everyone"}</p>
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
                cells={calendarCells({ month: span.month, today, people: records, hrefFor: (iso) => `${href({ day: iso })}#day-detail` })}
                today={today}
                picked={picked}
                legend={slices.length === 1 ? "person" : "team"}
              />
            </section>
            <DayPanel
              title={longDate(picked)}
              hint="Click a day to inspect it."
              lines={lines.map((line) => ({
                key: `${picked}-${line.personId}`,
                name: line.name,
                detail: line.detail,
                status: line.status,
                ...dayAction(line, picked, active.id),
              }))}
            />
          </div>
          <Roster
            caption={`${roster.length} ${roster.length === 1 ? "person" : "people"} · times are today, totals are ${span.kind === "month" ? "the month" : span.kind === "all" ? "all time" : span.year}${status ? " · filters apply here" : ""}`}
            rows={roster.map((slice) => rosterRow(slice, span, active.id))}
          />
          <div className="split">
            <Feed title="Recent activity" hint={span.label} items={recentFeed(records, span.start, span.end, today)} empty="Nothing logged in this range." />
            <Feed {...upcomingLeave(records, span.start, span.end, today)} empty="No leave in this window." />
          </div>
        </>
      )}
    </>
  );
}

function rosterRow(slice: Slice, span: Span, activeId: number) {
  const trend = trendLabel(slice);
  return {
    id: slice.personId,
    name: slice.name,
    href: pageHref("/report", { ...spanQuery(span), person: String(slice.personId) }),
    active: slice.personId === activeId,
    status: slice.today,
    clockIn: slice.todayIn ?? "—",
    clockOut: slice.todayOut ?? "—",
    hours: hoursText(slice.month.hours),
    worked: slice.month.worked,
    wfh: slice.month.wfh,
    leave: slice.month.leaveDays,
    missed: slice.month.missed,
    rate: percentLabel(slice.rate),
    trend: trend.text,
    trendTone: trend.tone,
  };
}
