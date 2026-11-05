"use client";

import { useEffect, useState } from "react";
import { Now } from "@/components/now";
import { errorMessage, type ErrorCode } from "@/lib/errors";
import {
  clockIn,
  clockOut,
  deleteDay,
  deleteLeave,
  markWfh,
  parseBook,
  saveDay,
  saveLeave,
  STORAGE_KEY,
  type Book,
  type DayDraft,
  type DayLog,
  type LeaveDraft,
  type LeaveLog,
  type PocketResult,
} from "@/lib/pocket";
import {
  LEAVE_LABEL,
  LEAVE_TYPES,
  classifyDay,
  currentTime,
  formatHours,
  hoursBetween,
  longDate,
  monthBounds,
  monthGrid,
  monthTitle,
  parseISODate,
  shiftMonth,
  shortDate,
  spanDays,
  summarize,
  todayISO,
} from "@/lib/stats";

type Tab = "today" | "days" | "leave";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

function hoursLabel(hours: number): string {
  return hours === 0 ? "0h" : formatHours(hours);
}

function dayDetail(row: DayLog): string {
  if (row.wfh) return row.note ? `Work from home · ${row.note}` : "Work from home";
  if (row.clockIn && row.clockOut) {
    const hours = hoursBetween(row.clockIn, row.clockOut);
    const span = `${row.clockIn}–${row.clockOut}`;
    const text = hours == null ? span : `${span} · ${hoursLabel(hours)}`;
    return row.note ? `${text} · ${row.note}` : text;
  }
  if (row.clockIn) return row.note ? `In at ${row.clockIn} · ${row.note}` : `In at ${row.clockIn}`;
  return "Office";
}

function heroStatus(row: DayLog | null, today: string): string {
  if (!row) return parseISODate(today).getDay() % 6 === 0 ? "Weekend" : "Not clocked in";
  if (row.wfh) return "Working from home";
  if (row.clockIn && row.clockOut) {
    const hours = hoursBetween(row.clockIn, row.clockOut);
    const span = `${row.clockIn} – ${row.clockOut}`;
    return hours == null ? span : `${span} · ${hoursLabel(hours)}`;
  }
  if (row.clockIn) return `Clocked in at ${row.clockIn}`;
  return "Office";
}

function toDayDraft(row: DayLog): DayDraft {
  return { id: row.id, day: row.day, wfh: row.wfh, clockIn: row.clockIn ?? "", clockOut: row.clockOut ?? "", note: row.note };
}

function toLeaveDraft(row: LeaveLog): LeaveDraft {
  return { id: row.id, type: row.type, start: row.start, end: row.end, note: row.note };
}

export function PhoneApp() {
  const [book, setBook] = useState<Book | null>(null);
  const [today, setToday] = useState<string | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("today");
  const [error, setError] = useState<ErrorCode | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [installed, setInstalled] = useState(false);
  const [dayForm, setDayForm] = useState<DayDraft | null>(null);
  const [leaveForm, setLeaveForm] = useState<LeaveDraft | null>(null);

  useEffect(() => {
    const day = todayISO();
    setToday(day);
    setMonth(day.slice(0, 7));
    setBook(parseBook(localStorage.getItem(STORAGE_KEY)));
    const media = window.matchMedia("(display-mode: standalone)");
    const syncInstalled = () => {
      const ios = (navigator as Navigator & { standalone?: boolean }).standalone === true;
      setInstalled(media.matches || ios);
    };
    syncInstalled();
    media.addEventListener("change", syncInstalled);
    const onShow = () => setToday(todayISO());
    document.addEventListener("visibilitychange", onShow);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/me-sw.js").then(async (registration) => {
        await navigator.serviceWorker.ready;
        const urls = performance
          .getEntriesByType("resource")
          .map((entry) => entry.name)
          .filter((name) => name.startsWith(location.origin) && name.includes("/_next/static/"));
        registration.active?.postMessage({ type: "cache", urls: ["/me", "/icon.svg", "/me.webmanifest", ...urls] });
      }).catch(() => undefined);
    }
    return () => {
      media.removeEventListener("change", syncInstalled);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, []);

  useEffect(() => {
    if (tab === "days" && dayForm) document.getElementById("day-form")?.scrollIntoView({ block: "nearest" });
    if (tab === "leave" && leaveForm) document.getElementById("leave-form")?.scrollIntoView({ block: "nearest" });
  }, [tab, dayForm, leaveForm]);

  function commit(result: PocketResult, close?: () => void) {
    if ("error" in result) {
      setError(result.error);
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(result.book));
    } catch {
      setBook(result.book);
      setStorageError("This browser blocked saving. The change is only on this screen until storage is allowed.");
      return;
    }
    setStorageError(null);
    setError(null);
    setBook(result.book);
    close?.();
  }

  if (!book || !today || !month) {
    return (
      <div className="phone">
        <PhoneTop />
        <h1>Today</h1>
      </div>
    );
  }

  const todayRow = book.days.find((row) => row.day === today) ?? null;
  const stale = book.days
    .filter((row) => !row.wfh && row.clockIn && !row.clockOut && row.day < today)
    .sort((a, b) => a.day.localeCompare(b.day));
  const summary = summarize({ month, today, attendance: book.days, leaves: book.leaves });
  const denom = summary.worked + summary.wfh + summary.missed;
  const rate = denom === 0 ? "—" : `${Math.round(((summary.worked + summary.wfh) / denom) * 100)}%`;
  const message = storageError ?? errorMessage(error);
  const days = [...book.days].sort((a, b) => b.day.localeCompare(a.day) || b.id - a.id);
  const leaves = [...book.leaves].sort((a, b) => b.start.localeCompare(a.start) || b.id - a.id);

  function freshToday(): string {
    const day = todayISO();
    if (day !== today) setToday(day);
    return day;
  }

  function openDay(draft: DayDraft) {
    setTab("days");
    setDayForm(draft);
    setError(null);
  }

  function openLeave(draft: LeaveDraft) {
    setTab("leave");
    setLeaveForm(draft);
    setError(null);
  }

  function openIso(iso: string) {
    const row = book.days.find((item) => item.day === iso);
    const leave = book.leaves.find((item) => item.start <= iso && iso <= item.end);
    if (row) {
      openDay(toDayDraft(row));
      return;
    }
    if (leave) {
      openLeave(toLeaveDraft(leave));
      return;
    }
    if (iso > today) return;
    openDay({ day: iso, wfh: false, clockIn: "09:00", clockOut: "", note: "" });
  }

  return (
    <div className="phone">
      <PhoneTop />
      {tab === "today" && (
        <>
          <section className="phone-hero">
            <p className="eyebrow">{longDate(today)}</p>
            <p className="today-status">{heroStatus(todayRow, today)}</p>
            <Now />
            <div className="phone-actions">
              {!todayRow && (
                <>
                  <button className="button ghost" type="button" onClick={() => commit(markWfh(book, freshToday()))}>
                    Work from home
                  </button>
                  <button className="button primary" type="button" onClick={() => commit(clockIn(book, freshToday(), currentTime()))}>
                    Clock in
                  </button>
                </>
              )}
              {todayRow?.wfh && (
                <button className="button ghost" type="button" onClick={() => openDay(toDayDraft(todayRow))}>
                  Edit today
                </button>
              )}
              {todayRow && !todayRow.wfh && !todayRow.clockOut && (
                <button className="button primary" type="button" onClick={() => commit(clockOut(book, freshToday(), currentTime()))}>
                  Clock out
                </button>
              )}
              {todayRow?.clockOut && (
                <button className="button ghost" type="button" onClick={() => openDay(toDayDraft(todayRow))}>
                  Edit today
                </button>
              )}
            </div>
          </section>
          {stale.map((row) => (
            <p className="banner warn" key={row.id} role="status">
              Still clocked in since {shortDate(row.day)}.{" "}
              <button type="button" onClick={() => openDay(toDayDraft(row))}>
                Add a clock-out
              </button>
            </p>
          ))}
          {message && <p className="banner" role="alert">{message}</p>}
          <section className="phone-month">
            <div className="phone-month-head">
              <h2>{monthTitle(month)}</h2>
              <div className="month-nav">
                <button className="button ghost" type="button" onClick={() => setMonth(shiftMonth(month, -1))}>
                  Prev
                </button>
                <button
                  className="button ghost"
                  type="button"
                  disabled={month >= today.slice(0, 7)}
                  onClick={() => setMonth(shiftMonth(month, 1))}
                >
                  Next
                </button>
              </div>
            </div>
            <div className="phone-stats">
              <Stat label="Hours" value={hoursLabel(summary.hours)} />
              <Stat label="Attendance" value={rate} />
              <Stat label="Office" value={String(summary.worked)} />
              <Stat label="From home" value={String(summary.wfh)} />
              <Stat label="Leave" value={String(summary.leaveDays)} />
              <Stat label="Missed" value={String(summary.missed)} />
            </div>
            <MonthGrid month={month} today={today} book={book} onPick={openIso} />
          </section>
          <p className="phone-note">
            {installed
              ? "Saved on this phone. Nothing is sent anywhere."
              : "Saved on this phone only. In Safari or Chrome: Share, then Add to Home Screen."}
          </p>
        </>
      )}
      {tab === "days" && (
        <>
          <div className="phone-month-head">
            <h1>Days</h1>
            <button
              className="button primary"
              type="button"
              onClick={() => openDay({ day: today, wfh: false, clockIn: "09:00", clockOut: "", note: "" })}
            >
              Log a day
            </button>
          </div>
          {message && <p className="banner" role="alert">{message}</p>}
          {dayForm && (
            <DayForm
              key={dayForm.id ?? `new-${dayForm.day}`}
              initial={dayForm}
              today={today}
              onCancel={() => setDayForm(null)}
              onSave={(draft) => commit(saveDay(book, draft, freshToday()), () => setDayForm(null))}
              onDelete={draft => {
                if (draft.id == null) return;
                commit(deleteDay(book, draft.id), () => setDayForm(null));
              }}
            />
          )}
          {days.length === 0 ? (
            <p className="muted">No days logged yet.</p>
          ) : (
            <ul className="phone-list">
              {days.map((row) => (
                <li key={row.id}>
                  <button className="phone-row" type="button" onClick={() => openDay(toDayDraft(row))}>
                    <strong>{shortDate(row.day)}</strong>
                    <span>{dayDetail(row)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {tab === "leave" && (
        <>
          <div className="phone-month-head">
            <h1>Leave</h1>
            <button
              className="button primary"
              type="button"
              onClick={() => openLeave({ type: "vacation", start: today, end: today, note: "" })}
            >
              Add leave
            </button>
          </div>
          {message && <p className="banner" role="alert">{message}</p>}
          {leaveForm && (
            <LeaveForm
              key={leaveForm.id ?? "new-leave"}
              initial={leaveForm}
              onCancel={() => setLeaveForm(null)}
              onSave={(draft) => commit(saveLeave(book, draft), () => setLeaveForm(null))}
              onDelete={(draft) => {
                if (draft.id == null) return;
                commit(deleteLeave(book, draft.id), () => setLeaveForm(null));
              }}
            />
          )}
          {leaves.length === 0 ? (
            <p className="muted">No leave recorded.</p>
          ) : (
            <ul className="phone-list">
              {leaves.map((row) => (
                <li key={row.id}>
                  <button className="phone-row" type="button" onClick={() => openLeave(toLeaveDraft(row))}>
                    <strong>{LEAVE_LABEL[row.type]}</strong>
                    <span>
                      {row.end === row.start ? shortDate(row.start) : `${shortDate(row.start)} – ${shortDate(row.end)}`}
                      {` · ${spanDays(row.start, row.end)}d`}
                      {row.note ? ` · ${row.note}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <nav className="phone-tabs" aria-label="Sections">
        {(
          [
            ["today", "Today"],
            ["days", "Days"],
            ["leave", "Leave"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" aria-current={tab === id ? "page" : undefined} onClick={() => { setTab(id); setError(null); }}>
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function PhoneTop() {
  return (
    <header className="phone-top">
      <span className="brand-mark" aria-hidden="true">勤</span>
      <span>
        <strong>Kintai</strong>
        <small>On this phone</small>
      </span>
    </header>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <p className="phone-stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </p>
  );
}

function MonthGrid({
  month,
  today,
  book,
  onPick,
}: {
  month: string;
  today: string;
  book: Book;
  onPick: (iso: string) => void;
}) {
  const { start, end } = monthBounds(month);
  return (
    <div className="phone-cal">
      {WEEKDAYS.map((label, index) => (
        <span className="phone-dow" key={`${label}-${index}`} aria-hidden="true">{label}</span>
      ))}
      {monthGrid(month).map((iso) => {
        const inMonth = iso >= start && iso <= end;
        const row = book.days.find((item) => item.day === iso) ?? null;
        const leave = book.leaves.find((item) => item.start <= iso && iso <= item.end) ?? null;
        const kind = inMonth ? classifyDay(iso, today, row, leave != null) : "out";
        const disabled = !inMonth || (iso > today && kind !== "leave");
        return (
          <button
            key={iso}
            type="button"
            className={`phone-day is-${kind}${iso === today ? " is-today" : ""}`}
            disabled={disabled}
            aria-label={shortDate(iso)}
            onClick={() => onPick(iso)}
          >
            {Number(iso.slice(8))}
          </button>
        );
      })}
    </div>
  );
}

function DayForm({
  initial,
  today,
  onSave,
  onDelete,
  onCancel,
}: {
  initial: DayDraft;
  today: string;
  onSave: (draft: DayDraft) => void;
  onDelete: (draft: DayDraft) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [armed, setArmed] = useState(false);
  return (
    <form
      className="card phone-form"
      id="day-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(draft);
      }}
    >
      <h2>{draft.id ? "Edit day" : "Log a day"}</h2>
      <label className="field">
        <span className="field-label">Date</span>
        <input className="field-input" type="date" max={today} value={draft.day} onChange={(event) => setDraft({ ...draft, day: event.target.value })} required />
      </label>
      <div className="phone-segment" role="group" aria-label="Where">
        <button type="button" aria-pressed={!draft.wfh} onClick={() => setDraft({ ...draft, wfh: false, clockIn: draft.clockIn || "09:00" })}>
          Office
        </button>
        <button type="button" aria-pressed={draft.wfh} onClick={() => setDraft({ ...draft, wfh: true })}>
          Home
        </button>
      </div>
      {!draft.wfh && (
        <div className="phone-times">
          <label className="field">
            <span className="field-label">In</span>
            <input className="field-input" type="time" value={draft.clockIn} onChange={(event) => setDraft({ ...draft, clockIn: event.target.value })} required />
          </label>
          <label className="field">
            <span className="field-label">Out</span>
            <input className="field-input" type="time" value={draft.clockOut} onChange={(event) => setDraft({ ...draft, clockOut: event.target.value })} />
          </label>
        </div>
      )}
      <label className="field">
        <span className="field-label">Note</span>
        <textarea className="field-input" maxLength={200} value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} />
      </label>
      <div className="phone-form-actions">
        <button className="button primary" type="submit">Save</button>
        <button className="button ghost" type="button" onClick={onCancel}>Cancel</button>
        {draft.id != null && (
          <button
            className={armed ? "button danger is-armed" : "button danger"}
            type="button"
            onClick={() => {
              if (!armed) {
                setArmed(true);
                return;
              }
              onDelete(draft);
            }}
          >
            {armed ? "Delete this day" : "Delete"}
          </button>
        )}
      </div>
    </form>
  );
}

function LeaveForm({
  initial,
  onSave,
  onDelete,
  onCancel,
}: {
  initial: LeaveDraft;
  onSave: (draft: LeaveDraft) => void;
  onDelete: (draft: LeaveDraft) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [armed, setArmed] = useState(false);
  return (
    <form
      className="card phone-form"
      id="leave-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(draft);
      }}
    >
      <h2>{draft.id ? "Edit leave" : "Add leave"}</h2>
      <label className="field">
        <span className="field-label">Type</span>
        <select className="field-input" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })}>
          {LEAVE_TYPES.map((type) => (
            <option key={type} value={type}>{LEAVE_LABEL[type]}</option>
          ))}
        </select>
      </label>
      <div className="phone-times">
        <label className="field">
          <span className="field-label">Start</span>
          <input className="field-input" type="date" value={draft.start} onChange={(event) => setDraft({ ...draft, start: event.target.value })} required />
        </label>
        <label className="field">
          <span className="field-label">End</span>
          <input className="field-input" type="date" value={draft.end} onChange={(event) => setDraft({ ...draft, end: event.target.value })} required />
        </label>
      </div>
      <label className="field">
        <span className="field-label">Note</span>
        <textarea className="field-input" maxLength={200} value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} />
      </label>
      <div className="phone-form-actions">
        <button className="button primary" type="submit">Save</button>
        <button className="button ghost" type="button" onClick={onCancel}>Cancel</button>
        {draft.id != null && (
          <button
            className={armed ? "button danger is-armed" : "button danger"}
            type="button"
            onClick={() => {
              if (!armed) {
                setArmed(true);
                return;
              }
              onDelete(draft);
            }}
          >
            {armed ? "Delete this leave" : "Delete"}
          </button>
        )}
      </div>
    </form>
  );
}
