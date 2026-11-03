"use client";

import { useEffect, useState } from "react";

export function Now() {
  const [time, setTime] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => {
      setTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <p className="now">{time ?? "\u00a0"}</p>;
}
