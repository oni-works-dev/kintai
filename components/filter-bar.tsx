"use client";

import { useState } from "react";
import Link from "next/link";
import { ChoiceField, MonthField } from "@/components/fields";

function useSynced(value: string) {
  const [current, setCurrent] = useState(value);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setCurrent(value);
  }
  return [current, setCurrent] as const;
}

export function FilterBar({
  action,
  span,
  month,
  years,
  hidden,
  resetHref,
}: {
  action: string;
  span: string;
  month: string;
  years: string[];
  hidden: Record<string, string>;
  resetHref: string;
}) {
  const [spanValue, setSpan] = useSynced(span);
  const [monthValue, setMonth] = useSynced(month);

  return (
    <form className="filters" action={action} method="get">
      {Object.entries(hidden).map(([key, value]) =>
        value ? <input key={key} type="hidden" name={key} value={value} /> : null,
      )}
      <ChoiceField
        label="Period"
        name="span"
        value={spanValue}
        options={[
          { value: "all", label: "All time" },
          ...years.map((year) => ({ value: year, label: year })),
          { value: "month", label: "Selected month" },
        ]}
        onChange={setSpan}
      />
      <MonthField label="Month" name="month" value={monthValue} onChange={setMonth} />
      <button className="button ghost" type="submit">
        Apply
      </button>
      <Link className="button quiet" href={resetHref}>
        Reset
      </Link>
    </form>
  );
}
