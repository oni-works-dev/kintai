import Link from "next/link";
import { clockIn, clockOut } from "@/app/actions";
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
  const hours = row?.clockOut ? hoursBetween(row.clockIn, row.clockOut) : null;
  return (
    <section className="today-card">
      <div>
        <p className="eyebrow">
          {name} · {longDate(today)}
        </p>
        <p className="today-status">
          {!row && "Not clocked in yet"}
          {row && !row.clockOut && (
            <>
              Clocked in at <time dateTime={row.clockIn}>{row.clockIn}</time>
            </>
          )}
          {row && row.clockOut && (
            <>
              <time dateTime={row.clockIn}>{row.clockIn}</time>
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
          <form action={clockIn}>
            <input type="hidden" name="return" value={returnTo} />
            <button className="button primary" type="submit">
              Clock in
            </button>
          </form>
        )}
        {row && !row.clockOut && (
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
