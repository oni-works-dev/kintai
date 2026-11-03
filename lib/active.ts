import { cookies } from "next/headers";
import { allPeople, type Person } from "@/lib/db";

export async function activePerson(): Promise<Person> {
  const people = allPeople();
  const jar = await cookies();
  const id = Number(jar.get("kintai-person")?.value);
  const person = people.find((item) => item.id === id) ?? people[0];
  if (!person) throw new Error("No people in the database");
  return person;
}
