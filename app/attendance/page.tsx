import type { Metadata } from "next";
import { Banner } from "@/components/banner";
import { ConfirmDelete } from "@/components/confirm-delete";
import { AttendanceForm } from "@/components/forms";
import { TodayCard } from "@/components/today-card";
import { deleteAttendanceAction } from "@/app/actions";
import { activePerson } from "@/lib/active";
import { allAttendance } from "@/lib/db";
import { formatHours, hoursBetween, parseDay, shortDate, todayISO } from "@/lib/stats";

export const metadata: Metadata = { title: "Attendance" };
export const dynamic = "force-dynamic";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; edit?: string; day?: string }>;
}) {
  const query = await searchParams;
  const person = await activePerson();
  const today = todayISO();
  const rows = allAttendance(person.id);
  const editId = Number(query.edit);
  const editing = Number.isInteger(editId) && editId > 0 ? (rows.find((row) => row.id === editId) ?? null) : null;
  const prefill = parseDay(query.day ?? "") ?? today;

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Attendance</h1>
          <p>One in and out each day for {person.name}.</p>
        </div>
      </header>
      <Banner code={query.edit && !editing ? "missing" : query.error} />
      <TodayCard
        name={person.name}
        today={today}
        row={rows.find((row) => row.day === today) ?? null}
        returnTo="/attendance"
      />
      <AttendanceForm
        key={editing ? `edit-${editing.id}` : `new-${prefill}`}
        initial={
          editing
            ? {
                id: editing.id,
                day: editing.day,
                clockIn: editing.clockIn,
                clockOut: editing.clockOut ?? "",
                note: editing.note,
              }
            : { day: prefill, clockIn: "09:00", clockOut: "", note: "" }
        }
      />
      <section className="card log-card">
        <header className="card-head">
          <h2>History</h2>
          {rows.length > 0 && (
            <p>
              {rows.length} {rows.length === 1 ? "day" : "days"}
            </p>
          )}
        </header>
        {rows.length === 0 ? (
          <p className="muted">No days logged yet.</p>
        ) : (
          <ul className="log">
            {rows.map((row) => {
              const hours = row.clockOut ? hoursBetween(row.clockIn, row.clockOut) : null;
              return (
                <li key={row.id} className={editing?.id === row.id ? "is-editing" : undefined}>
                  <div>
                    <strong>{shortDate(row.day)}</strong>
                    <span>
                      <time dateTime={row.clockIn}>{row.clockIn}</time>
                      {" – "}
                      {row.clockOut ? (
                        <time dateTime={row.clockOut}>{row.clockOut}</time>
                      ) : (
                        <span className="open-word">still open</span>
                      )}
                      {hours != null && ` · ${formatHours(hours)}`}
                    </span>
                    {row.note && <em>{row.note}</em>}
                  </div>
                  <div className="log-actions">
                    <a className="button quiet" href={`/attendance?edit=${row.id}#day-form`}>
                      Edit
                    </a>
                    <ConfirmDelete action={deleteAttendanceAction} id={row.id} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
