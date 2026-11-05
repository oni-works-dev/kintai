"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject } from "react";
import { monthGrid, monthTitle, shiftMonth, shortDate } from "@/lib/stats";

function Chevron() {
  return (
    <svg className="chevron" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

function Field({
  label,
  className,
  open,
  fieldRef,
  children,
}: {
  label: string;
  className?: string;
  open?: boolean;
  fieldRef?: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  return (
    <div className={`field${open ? " is-open" : ""}${className ? ` ${className}` : ""}`} ref={fieldRef}>
      <span className="field-label">{label}</span>
      {children}
    </div>
  );
}

export function TextField({
  label,
  name,
  value,
  defaultValue,
  onChange,
  placeholder,
  maxLength,
  required,
  className,
}: {
  label: string;
  name: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  required?: boolean;
  className?: string;
}) {
  const id = useId();
  const controlled = value !== undefined;
  return (
    <Field label={label} className={className}>
      <input
        id={id}
        className="field-input"
        name={name}
        value={controlled ? value : undefined}
        defaultValue={controlled ? undefined : defaultValue}
        placeholder={placeholder}
        maxLength={maxLength}
        required={required}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
      />
    </Field>
  );
}

export function ChoiceField({
  label,
  name,
  value,
  options,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const { open, setOpen, ref } = usePopover();
  const current = options.find((option) => option.value === value) ?? options[0];
  const listId = useId();
  const [cursor, setCursor] = useState(() => Math.max(0, options.findIndex((option) => option.value === value)));

  function choose(next: string) {
    onChange(next);
    setOpen(false);
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" && !open) {
      event.preventDefault();
      setCursor(Math.max(0, options.findIndex((option) => option.value === value)));
      setOpen(true);
      return;
    }
    if (!open) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setCursor((index) => (index + delta + options.length) % options.length);
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const next = options[cursor];
      if (next) choose(next.value);
    }
  }

  return (
    <Field label={label} open={open} fieldRef={ref}>
      <button
        type="button"
        className="field-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={onKeyDown}
      >
        <span>{current?.label}</span>
        <Chevron />
      </button>
      {open && (
        <div className="pop" id={listId} role="listbox" aria-label={label}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              className={`option${options[cursor]?.value === option.value ? " is-active" : ""}`}
              aria-selected={option.value === value}
              onClick={() => choose(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
      <input type="hidden" name={name} value={value} />
    </Field>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function MonthField({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { open, setOpen, ref } = usePopover();
  const [year, setYear] = useState(() => Number(value.slice(0, 4)) || new Date().getFullYear());
  const selectedYear = Number(value.slice(0, 4));
  const selectedMonth = Number(value.slice(5, 7));

  function openPanel() {
    if (value) setYear(Number(value.slice(0, 4)));
    setOpen((current) => !current);
  }

  return (
    <Field label={label} open={open} fieldRef={ref}>
      <button type="button" className="field-button" aria-haspopup="dialog" aria-expanded={open} onClick={openPanel}>
        <span className={value ? undefined : "is-placeholder"}>{value ? monthTitle(value) : "Choose a month"}</span>
        <Chevron />
      </button>
      {open && (
        <div className="pop pop-cal" role="dialog" aria-label={label}>
          <div className="pop-cal-head">
            <button type="button" className="button quiet" onClick={() => setYear((current) => current - 1)} aria-label="Previous year">
              Prev
            </button>
            <strong>{year}</strong>
            <button type="button" className="button quiet" onClick={() => setYear((current) => current + 1)} aria-label="Next year">
              Next
            </button>
          </div>
          <div className="pop-months">
            {MONTHS.map((label, index) => {
              const ym = `${year}-${String(index + 1).padStart(2, "0")}`;
              const selected = year === selectedYear && index + 1 === selectedMonth;
              return (
                <button
                  key={ym}
                  type="button"
                  className={selected ? "is-selected" : undefined}
                  aria-pressed={selected}
                  onClick={() => {
                    onChange(ym);
                    setOpen(false);
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <input type="hidden" name={name} value={value} />
    </Field>
  );
}

export function DateField({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { open, setOpen, ref } = usePopover();
  const [view, setView] = useState(value.slice(0, 7));
  const days = monthGrid(view || value.slice(0, 7));

  function openPanel() {
    if (value) setView(value.slice(0, 7));
    setOpen((current) => !current);
  }

  return (
    <Field label={label} open={open} fieldRef={ref}>
      <button type="button" className="field-button" aria-expanded={open} onClick={openPanel}>
        <span className={value ? undefined : "is-placeholder"}>{value ? shortDate(value) : "Choose a date"}</span>
        <Chevron />
      </button>
      {open && (
        <div className="pop pop-cal">
          <div className="pop-cal-head">
            <button type="button" className="button quiet" onClick={() => setView(shiftMonth(view, -1))} aria-label="Previous month">
              Prev
            </button>
            <strong>{monthTitle(view)}</strong>
            <button type="button" className="button quiet" onClick={() => setView(shiftMonth(view, 1))} aria-label="Next month">
              Next
            </button>
          </div>
          <div className="pop-dow" aria-hidden="true">
            {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
              <span key={`${day}-${index}`}>{day}</span>
            ))}
          </div>
          <div className="pop-grid">
            {days.map((iso) => (
              <button
                key={iso}
                type="button"
                className={`pop-day${iso.slice(0, 7) === view ? "" : " is-out"}${iso === value ? " is-selected" : ""}`}
                aria-label={shortDate(iso)}
                onClick={() => {
                  onChange(iso);
                  setOpen(false);
                }}
              >
                {Number(iso.slice(8))}
              </button>
            ))}
          </div>
        </div>
      )}
      <input type="hidden" name={name} value={value} />
    </Field>
  );
}

export function TimeField({
  label,
  name,
  value,
  onChange,
  allowEmpty,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  allowEmpty?: boolean;
}) {
  const { open, setOpen, ref } = usePopover();
  const [hour, minute] = value.split(":");
  const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
  const minutes = ["00", "15", "30", "45"];

  function setPart(part: "hour" | "minute", next: string) {
    const baseHour = hour || "09";
    const baseMinute = minutes.includes(minute) ? minute : "00";
    onChange(part === "hour" ? `${next}:${baseMinute}` : `${baseHour}:${next}`);
  }

  return (
    <Field label={label} open={open} fieldRef={ref}>
      <button type="button" className="field-button" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <span className={value ? "time-readout" : "is-placeholder"}>{value || "Set time"}</span>
        <Chevron />
      </button>
      {open && (
        <div className="pop pop-time">
          <p className="time-label">Hour</p>
          <div className="time-hours" role="group" aria-label="Hour">
            {hours.map((item) => (
              <button key={item} type="button" aria-pressed={item === hour} onClick={() => setPart("hour", item)}>
                {item}
              </button>
            ))}
          </div>
          <p className="time-label">Minute</p>
          <div className="time-minutes" role="group" aria-label="Minute">
            {minutes.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={item === minute}
                onClick={() => {
                  setPart("minute", item);
                  setOpen(false);
                }}
              >
                {item}
              </button>
            ))}
          </div>
          {allowEmpty && value && (
            <button
              type="button"
              className="button quiet"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Clear
            </button>
          )}
        </div>
      )}
      <input type="hidden" name={name} value={value} />
    </Field>
  );
}
