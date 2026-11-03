import type { Metadata } from "next";
import { Banner } from "@/components/banner";
import { ConfirmDelete } from "@/components/confirm-delete";
import { LeaveForm } from "@/components/forms";
import { deleteLeaveAction } from "@/app/actions";
import { activePerson } from "@/lib/active";
import { allLeaves } from "@/lib/db";
import { LEAVE_LABEL, shortDate, spanDays, todayISO } from "@/lib/stats";

export const metadata: Metadata = { title: "Leave" };
export const dynamic = "force-dynamic";

export default async function LeavePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; edit?: string }>;
}) {
  const query = await searchParams;
  const person = await activePerson();
  const today = todayISO();
  const rows = allLeaves(person.id);
  const editId = Number(query.edit);
  const editing = Number.isInteger(editId) && editId > 0 ? (rows.find((row) => row.id === editId) ?? null) : null;

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Leave</h1>
          <p>{person.name}&apos;s leave. Calendar days, weekends included.</p>
        </div>
      </header>
      <Banner code={query.edit && !editing ? "missing" : query.error} />
      <LeaveForm
        key={editing ? `edit-${editing.id}` : "new"}
        initial={
          editing
            ? {
                id: editing.id,
                type: editing.type,
                start: editing.start,
                end: editing.end,
                note: editing.note,
              }
            : { type: "vacation", start: today, end: today, note: "" }
        }
      />
      <section className="card log-card">
        <header className="card-head">
          <h2>Recorded leave</h2>
          {rows.length > 0 && (
            <p>
              {rows.length} {rows.length === 1 ? "entry" : "entries"}
            </p>
          )}
        </header>
        {rows.length === 0 ? (
          <p className="muted">No leave recorded.</p>
        ) : (
          <ul className="log">
            {rows.map((row) => (
              <li key={row.id} className={editing?.id === row.id ? "is-editing" : undefined}>
                <div>
                  <strong>{LEAVE_LABEL[row.type]}</strong>
                  <span>
                    {shortDate(row.start)}
                    {row.end !== row.start && ` – ${shortDate(row.end)}`}
                    {` · ${spanDays(row.start, row.end)}d`}
                  </span>
                  {row.note && <em>{row.note}</em>}
                </div>
                <div className="log-actions">
                  <a className="button quiet" href={`/leave?edit=${row.id}#leave-form`}>
                    Edit
                  </a>
                  <ConfirmDelete action={deleteLeaveAction} id={row.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
