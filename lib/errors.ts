export const ERRORS = {
  "bad-date": "Enter a real date.",
  "bad-time": "Clock-out has to be after clock-in, on the same day.",
  future: "Attendance can't be logged in the future.",
duplicate: "That day already has an entry for this person. Edit it instead.",
overlap: "Those dates overlap another leave entry for this person.",
  "bad-type": "Pick a leave type.",
  missing: "That entry no longer exists.",
  "already-in": "You already clocked in today.",
  "already-wfh": "Today is already marked work from home. Edit the day to clock office hours.",
  "already-out": "Today is already complete. Edit the day to change the times.",
  "not-in": "Clock in before clocking out.",
  range: "The end date is before the start date.",
  long: "Leave can't run longer than a year.",
  note: "Notes are limited to 200 characters.",
name: "Enter a name, up to 40 characters.",
} as const;

export type ErrorCode = keyof typeof ERRORS;

export function errorMessage(code: string | undefined | null): string | null {
  if (!code || !(code in ERRORS)) return null;
  return ERRORS[code as ErrorCode];
}
