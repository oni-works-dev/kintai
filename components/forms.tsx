"use client";

import { useActionState, useState } from "react";
import { saveAttendance, saveLeave, type ActionState } from "@/app/actions";
import { ChoiceField, DateField, TextField, TimeField } from "@/components/fields";
import { errorMessage } from "@/lib/errors";
import { LEAVE_LABEL, LEAVE_TYPES, type LeaveType } from "@/lib/stats";

function FieldError({ state }: { state: ActionState }) {
  const message = errorMessage(state?.error);
  if (!message) return null;
  return (
    <p className="banner" role="alert">
      {message}
    </p>
  );
}

export function AttendanceForm({
  initial,
}: {
  initial: { id?: number; day: string; clockIn: string; clockOut: string; note: string };
}) {
  const [state, action, pending] = useActionState(saveAttendance, null);
  const [day, setDay] = useState(initial.day);
  const [clockIn, setClockIn] = useState(initial.clockIn);
  const [clockOut, setClockOut] = useState(initial.clockOut);
  const [note, setNote] = useState(initial.note);
  return (
    <form id="day-form" action={action} className="card form-card">
      <h2>{initial.id ? "Edit day" : "Add a day"}</h2>
      <FieldError state={state} />
      {initial.id != null && <input type="hidden" name="id" value={initial.id} />}
      <div className="fields">
        <DateField label="Date" name="day" value={day} onChange={setDay} />
        <TimeField label="In" name="clockIn" value={clockIn} onChange={setClockIn} />
        <TimeField label="Out" name="clockOut" value={clockOut} onChange={setClockOut} allowEmpty />
        <TextField
          className="grow"
          label="Note"
          name="note"
          value={note}
          maxLength={200}
          onChange={setNote}
          placeholder="Optional"
        />
        <div className="form-actions">
          <button className="button primary" type="submit" disabled={pending || !day || !clockIn}>
            {pending ? "Saving..." : initial.id ? "Save changes" : "Add day"}
          </button>
          {initial.id != null && (
            <a className="button ghost" href="/attendance">
              Cancel
            </a>
          )}
        </div>
      </div>
    </form>
  );
}

export function LeaveForm({
  initial,
}: {
  initial: { id?: number; type: LeaveType; start: string; end: string; note: string };
}) {
  const [state, action, pending] = useActionState(saveLeave, null);
  const [type, setType] = useState(initial.type);
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [note, setNote] = useState(initial.note);
  return (
    <form id="leave-form" action={action} className="card form-card">
      <h2>{initial.id ? "Edit leave" : "Add leave"}</h2>
      <FieldError state={state} />
      {initial.id != null && <input type="hidden" name="id" value={initial.id} />}
      <div className="fields">
        <ChoiceField
          label="Type"
          name="type"
          value={type}
          options={LEAVE_TYPES.map((option) => ({ value: option, label: LEAVE_LABEL[option] }))}
          onChange={(next) => setType(next as LeaveType)}
        />
        <DateField label="Start" name="start" value={start} onChange={setStart} />
        <DateField label="End" name="end" value={end} onChange={setEnd} />
        <TextField
          className="grow"
          label="Note"
          name="note"
          value={note}
          maxLength={200}
          onChange={setNote}
          placeholder="Optional"
        />
        <div className="form-actions">
          <button className="button primary" type="submit" disabled={pending || !start || !end}>
            {pending ? "Saving..." : initial.id ? "Save changes" : "Add leave"}
          </button>
          {initial.id != null && (
            <a className="button ghost" href="/leave">
              Cancel
            </a>
          )}
        </div>
      </div>
    </form>
  );
}
