"use client";

import { useEffect, useRef, useState } from "react";

export function ConfirmDelete({
  action,
  id,
}: {
  action: (formData: FormData) => Promise<void>;
  id: number;
}) {
  const [armed, setArmed] = useState(false);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!armed) return;
    function onPointer(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) setArmed(false);
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [armed]);

  return (
    <form action={action} ref={ref}>
      <input type="hidden" name="id" value={id} />
      <button
        className={`button quiet danger${armed ? " is-armed" : ""}`}
        type={armed ? "submit" : "button"}
        onClick={() => {
          if (!armed) setArmed(true);
        }}
      >
        {armed ? "Confirm" : "Delete"}
      </button>
    </form>
  );
}
