import Link from "next/link";
import { clockIn, clockOut, markWfh } from "@/app/actions";
import { Now } from "@/components/now";
import type { Attendance } from "@/lib/db";
import { formatHours, hoursBetween, longDate } from "@/lib/stats";

export function TodayCard({
  name,
  today,
  row,
  returnTo,
}: {
  name: string;
  today: string;
  row: Attendance | null;
  returnTo: "/" | "/attendance" | "/report";
}) {
  const hours = row?.clockIn && row.clockOut ? hoursBetween(row.clockIn, row.clockOut) : null;
  return (
    <section className="today-card">
      <div>
        <p className="eyebrow">
          {name} · {longDate(today)}
        </p>
        <p className="today-status">
          {!row && "Not clocked in yet"}
          {row?.wfh && "Working from home"}
          {row && !row.wfh && !row.clockOut && (
            <>
              Clocked in at <time dateTime={row.clockIn ?? undefined}>{row.clockIn}</time>
            </>
          )}
          {row && !row.wfh && row.clockOut && (
            <>
              <time dateTime={row.clockIn ?? undefined}>{row.clockIn}</time>
              {" – "}
              <time dateTime={row.clockOut}>{row.clockOut}</time>
              {hours != null && <span className="today-hours"> · {formatHours(hours)}</span>}
            </>
          )}
        </p>
      </div>
      <div className="today-side">
        <Now />
        {!row && (
          <div className="today-actions">
            <form action={markWfh}>
              <input type="hidden" name="return" value={returnTo} />
              <button className="button ghost" type="submit">
                Work from home
              </button>
            </form>
            <form action={clockIn}>
              <input type="hidden" name="return" value={returnTo} />
              <button className="button primary" type="submit">
                Clock in
              </button>
            </form>
          </div>
        )}
        {row?.wfh && (
          <Link className="button ghost" href={`/attendance?edit=${row.id}#day-form`}>
            Edit today
          </Link>
        )}
        {row && !row.wfh && !row.clockOut && (
          <form action={clockOut}>
            <input type="hidden" name="return" value={returnTo} />
            <button className="button primary" type="submit">
              Clock out
            </button>
          </form>
        )}
        {row?.clockOut && (
          <Link className="button ghost" href={`/attendance?edit=${row.id}#day-form`}>
            Edit today
          </Link>
        )}
      </div>
    </section>
  );
}
