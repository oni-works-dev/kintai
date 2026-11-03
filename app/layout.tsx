import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { Gate, Profile } from "@/components/who";
import { chosenPerson } from "@/lib/active";
import { allPeople, openPunches } from "@/lib/db";
import { longDate, todayISO } from "@/lib/stats";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Kintai", template: "%s · Kintai" },
  description: "A local attendance and leave tracker.",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function RootLayout({ children }: { children: ReactNode }) {
  const person = await chosenPerson();
  const people = allPeople();
  if (!person) {
    return (
      <html lang="en">
        <body>
          <Gate people={people} />
        </body>
      </html>
    );
  }

  const today = todayISO();
  const stale = openPunches().filter((row) => row.day < today);

  return (
    <html lang="en">
      <body>
        <a className="skip" href="#content">
          Skip to content
        </a>
        <div className="shell">
          <header className="top">
            <Link href="/" className="brand">
              <span className="brand-mark" aria-hidden="true">
                勤
              </span>
              <span>
                <strong>Kintai</strong>
                <small>Attendance and leave</small>
              </span>
            </Link>
            <div className="top-end">
              <Nav />
              <Suspense>
                <Profile people={people} active={person} />
              </Suspense>
            </div>
          </header>
          {stale.length > 0 && (
            <div className="banners">
              {stale.map((row) => (
                <p className="banner warn" key={row.id} role="status">
                  {row.personName} is still clocked in on {longDate(row.day)}.{" "}
                  {row.personId === person.id && (
                    <Link href={`/attendance?edit=${row.id}#day-form`}>Close that day</Link>
                  )}
                </p>
              ))}
            </div>
          )}
          <main id="content">{children}</main>
          <footer className="foot">Saved on this machine in data/kintai.sqlite</footer>
        </div>
      </body>
    </html>
  );
}
