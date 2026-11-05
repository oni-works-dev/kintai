import type { Metadata } from "next";
import { Gate } from "@/components/who";
import { allPeople } from "@/lib/db";

export const metadata: Metadata = { title: "Who's here?" };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function ChoosePage() {
  return <Gate people={allPeople()} />;
}
