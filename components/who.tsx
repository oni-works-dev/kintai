"use client";

import { useRef, useActionState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { renamePerson, selectPerson, type ActionState } from "@/app/actions";
import { ChoiceField, TextField } from "@/components/fields";
import { errorMessage } from "@/lib/errors";
import type { Person } from "@/lib/db";

export function Who({ people, active }: { people: Person[]; active: Person }) {
  const pathname = usePathname();
  const month = useSearchParams().get("month");
  const next = month && (pathname === "/" || pathname === "/report") ? `${pathname}?month=${month}` : pathname;
  const [state, action, pending] = useActionState(renamePerson, null as ActionState);
  const personForm = useRef<HTMLFormElement>(null);

  return (
    <div className="who">
      <form action={selectPerson} ref={personForm}>
        <input type="hidden" name="next" value={next} />
        <ChoiceField
          key={active.id}
          label="Person"
          name="person"
          value={String(active.id)}
          options={people.map((person) => ({ value: String(person.id), label: person.name }))}
          onChange={() => personForm.current?.requestSubmit()}
        />
      </form>
      <form action={action}>
        <input type="hidden" name="id" value={active.id} />
        <TextField key={active.name} label="Name" name="name" defaultValue={active.name} maxLength={40} required />
        <button className="button ghost" type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save name"}
        </button>
      </form>
      {errorMessage(state?.error) && (
        <p className="banner" role="alert">
          {errorMessage(state?.error)}
        </p>
      )}
    </div>
  );
}
