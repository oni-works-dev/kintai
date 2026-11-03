"use client";

import { useActionState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { renamePerson, selectPerson, type ActionState } from "@/app/actions";
import { errorMessage } from "@/lib/errors";
import type { Person } from "@/lib/db";

export function Gate({ people }: { people: Person[] }) {
  return (
    <main className="gate">
      <div className="gate-card">
        <span className="brand-mark" aria-hidden="true">
          勤
        </span>
        <h1>Who&apos;s here?</h1>
        <p>This browser keeps the person you pick.</p>
        <div className="gate-people">
          {people.map((person) => (
            <form action={selectPerson} key={person.id}>
              <input type="hidden" name="person" value={person.id} />
              <input type="hidden" name="next" value="/" />
              <button type="submit">{person.name}</button>
            </form>
          ))}
        </div>
      </div>
    </main>
  );
}

export function Profile({ people, active }: { people: Person[]; active: Person }) {
  const pathname = usePathname();
  const month = useSearchParams().get("month");
  const next = month && (pathname === "/" || pathname === "/report") ? `${pathname}?month=${month}` : pathname;
  const [state, action, pending] = useActionState(renamePerson, null as ActionState);
  const initial = active.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <details className="profile">
      <summary className="profile-button" aria-label={`${active.name}, account`}>
        {initial}
      </summary>
      <div className="profile-panel">
        <form action={action} className="profile-name">
          <input type="hidden" name="id" value={active.id} />
          <input
            key={active.name}
            className="field-input"
            name="name"
            aria-label="Name"
            defaultValue={active.name}
            maxLength={40}
            required
          />
          <button className="button ghost" type="submit" disabled={pending}>
            {pending ? "Saving..." : "Save"}
          </button>
        </form>
        {errorMessage(state?.error) && (
          <p className="banner" role="alert">
            {errorMessage(state?.error)}
          </p>
        )}
        <p className="profile-label">Switch person</p>
        <div className="profile-switch">
          {people.map((person) => (
            <form action={selectPerson} key={person.id}>
              <input type="hidden" name="person" value={person.id} />
              <input type="hidden" name="next" value={next} />
              <button type="submit" disabled={person.id === active.id} aria-current={person.id === active.id ? "true" : undefined}>
                {person.name}
              </button>
            </form>
          ))}
        </div>
      </div>
    </details>
  );
}
