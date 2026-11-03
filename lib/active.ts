import { cookies } from "next/headers";
import { allPeople, type Person } from "@/lib/db";

export async function chosenPerson(): Promise<Person | null> {
  const people = allPeople();
  const jar = await cookies();
  const id = Number(jar.get("kintai-person")?.value);
  return people.find((item) => item.id === id) ?? null;
}

export async function activePerson(): Promise<Person> {
  const person = await chosenPerson();
  if (person) return person;
  const fallback = allPeople()[0];
  if (!fallback) throw new Error("No people in the database");
  return fallback;
}
