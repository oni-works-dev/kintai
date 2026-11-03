import type { Metadata } from "next";
import Link from "next/link";
import { Banner } from "@/components/banner";
import { activePerson } from "@/lib/active";
import { allAttendance, allLeaves, allPeople, type Attendance, type Leave } from "@/lib/db";
import {
  formatHours,
  LEAVE_LABEL,
  monthBounds,
  monthTitle,
  parseISODate,
  parseMonth,
  shiftMonth,
  shortDate,
  summarize,
  todayISO,
} from "@/lib/stats";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; error?: string }>;
}) {
  const query = await searchParams;
  const person = await activePerson();
  const today = todayISO();
  const month = parseMonth(query.month) ?? today.slice(0, 7);
  const { start, end } = monthBounds(month);
  const team = allPeople().map((member) => {
    const attendance = allAttendance(member.id);
    const leaves = allLeaves(member.id);
    return {
      member,
      attendance,
      leaves,
      summary: summarize({ month, today, attendance, leaves }),
      today: todayStatus(attendance, leaves, today),
    };
  });
  const monthLeaves = team
    .flatMap((row) =>
      row.leaves
        .filter((leave) => leave.start <= end && leave.end >= start)
        .map((leave) => ({ person: row.member.name, leave })),
    )
    .sort((a, b) => a.leave.start.localeCompare(b.leave.start) || a.person.localeCompare(b.person));

  return (
    <>
      <header className="page-head">
        <div>
          <h1>{monthTitle(month)}</h1>
          <p>Everyone this month.</p>
        </div>
        <div className="month-nav">
          <Link className="button ghost" href={`/?month=${shiftMonth(month, -1)}`}>
            Previous
          </Link>
          {month !== today.slice(0, 7) && (
            <Link className="button ghost" href="/">
              This month
            </Link>
          )}
          <Link className="button ghost" href={`/?month=${shiftMonth(month, 1)}`}>
            Next
          </Link>
        </div>
      </header>
      <Banner code={query.error} />
      <section className="card team-card">
        <header className="card-head">
          <h2>Team</h2>
          <p>{team.length} people</p>
        </header>
        <div className="team-wrap">
          <table className="team">
            <thead>
              <tr>
                <th>Person</th>
                <th>Today</th>
                <th className="num">Hours</th>
                <th className="num">Worked</th>
                <th className="num">WFH</th>
                <th className="num">Missed</th>
                <th className="num">Leave</th>
              </tr>
            </thead>
            <tbody>
              {team.map((row) => (
                <tr key={row.member.id} className={row.member.id === person.id ? "is-active" : undefined}>
                  <th scope="row">{row.member.name}</th>
                  <td className={row.today.tone}>{row.today.text}</td>
                  <td className="num">{hoursLabel(row.summary.hours)}</td>
                  <td className="num">{row.summary.worked}</td>
                  <td className="num">{row.summary.wfh}</td>
                  <td className="num">{row.summary.missed}</td>
                  <td className="num">{row.summary.leaveDays}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">All</th>
                <td />
                <td className="num">{hoursLabel(team.reduce((sum, row) => sum + row.summary.hours, 0))}</td>
                <td className="num">{team.reduce((sum, row) => sum + row.summary.worked, 0)}</td>
                <td className="num">{team.reduce((sum, row) => sum + row.summary.wfh, 0)}</td>
                <td className="num">{team.reduce((sum, row) => sum + row.summary.missed, 0)}</td>
                <td className="num">{team.reduce((sum, row) => sum + row.summary.leaveDays, 0)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <h3>Leave</h3>
        {monthLeaves.length === 0 ? (
          <p className="muted">No leave this month.</p>
        ) : (
          <ul className="team-leave">
            {monthLeaves.map(({ person: name, leave }) => (
              <li key={leave.id}>
                <strong>{name}</strong>
                <span>
                  {LEAVE_LABEL[leave.type]} · {shortDate(leave.start)}
                  {leave.end !== leave.start && ` – ${shortDate(leave.end)}`}
                </span>
                {leave.note && <em>{leave.note}</em>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function hoursLabel(hours: number): string {
  const rounded = Math.round(hours * 100) / 100;
  return rounded === 0 ? "0h" : formatHours(rounded);
}

function todayStatus(
  attendance: Attendance[],
  leaves: Leave[],
  today: string,
): { text: string; tone: string } {
  const row = attendance.find((item) => item.day === today);
  if (row?.wfh) return { text: "WFH", tone: "tone-wfh" };
  if (row?.clockOut) return { text: `${row.clockIn}–${row.clockOut}`, tone: "" };
  if (row) return { text: `In ${row.clockIn}`, tone: "tone-open" };
  const leave = leaves.find((item) => item.start <= today && today <= item.end);
  if (leave) return { text: LEAVE_LABEL[leave.type], tone: "tone-leave" };
  if (parseISODate(today).getDay() % 6 === 0) return { text: "Off", tone: "tone-quiet" };
  return { text: "—", tone: "tone-quiet" };
}
