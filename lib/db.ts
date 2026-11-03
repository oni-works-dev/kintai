import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { isLeaveType, type LeaveType } from "@/lib/stats";

export type Person = {
  id: number;
  name: string;
};

export type Attendance = {
  id: number;
  personId: number;
  day: string;
  clockIn: string;
  clockOut: string | null;
  note: string;
};

export type Leave = {
  id: number;
  personId: number;
  type: LeaveType;
  start: string;
  end: string;
  note: string;
};

export type OpenPunch = {
  id: number;
  personId: number;
  personName: string;
  day: string;
};

const STARTER_NAMES = ["Anooj", "Hebbar", "Monish", "Jayant"];

const globalForDb = globalThis as unknown as { kintaiDb?: DatabaseSync };

function columnNames(database: DatabaseSync, table: string): string[] {
  const rows = database.prepare(`PRAGMA table_info(${table})`).all() as Record<string, unknown>[];
  return rows.map((row) => String(row.name));
}

function ensureSchema(database: DatabaseSync) {
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 3000;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS people (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL
    );
  `);
  const count = database.prepare("SELECT COUNT(*) AS n FROM people").get() as Record<string, unknown>;
  if (Number(count.n) === 0) {
    const insert = database.prepare("INSERT INTO people (name) VALUES (?)");
    for (const name of STARTER_NAMES) insert.run(name);
  }
  const first = database.prepare("SELECT id FROM people ORDER BY id LIMIT 1").get() as Record<string, unknown>;
  const personId = Number(first.id);

  const attendanceCols = columnNames(database, "attendance");
  if (attendanceCols.length === 0) {
    database.exec(`
      CREATE TABLE attendance (
        id INTEGER PRIMARY KEY,
        person_id INTEGER NOT NULL REFERENCES people(id),
        day TEXT NOT NULL,
        clock_in TEXT NOT NULL,
        clock_out TEXT,
        note TEXT NOT NULL DEFAULT '',
        UNIQUE (person_id, day)
      );
    `);
  } else if (!attendanceCols.includes("person_id")) {
    database.exec("BEGIN");
    database.exec("DROP TABLE IF EXISTS attendance_next");
    database.exec(`
      CREATE TABLE attendance_next (
        id INTEGER PRIMARY KEY,
        person_id INTEGER NOT NULL REFERENCES people(id),
        day TEXT NOT NULL,
        clock_in TEXT NOT NULL,
        clock_out TEXT,
        note TEXT NOT NULL DEFAULT '',
        UNIQUE (person_id, day)
      );
    `);
    database
      .prepare(
        `INSERT INTO attendance_next (id, person_id, day, clock_in, clock_out, note)
         SELECT id, ?, day, clock_in, clock_out, note FROM attendance`,
      )
      .run(personId);
    database.exec("DROP TABLE attendance");
    database.exec("ALTER TABLE attendance_next RENAME TO attendance");
    database.exec("COMMIT");
  }

  const leaveCols = columnNames(database, "leaves");
  if (leaveCols.length === 0) {
    database.exec(`
      CREATE TABLE leaves (
        id INTEGER PRIMARY KEY,
        person_id INTEGER NOT NULL REFERENCES people(id),
        type TEXT NOT NULL CHECK (type IN ('vacation', 'sick', 'personal', 'unpaid')),
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL CHECK (end_date >= start_date),
        note TEXT NOT NULL DEFAULT ''
      );
    `);
  } else if (!leaveCols.includes("person_id")) {
    database.exec("BEGIN");
    database.exec("DROP TABLE IF EXISTS leaves_next");
    database.exec(`
      CREATE TABLE leaves_next (
        id INTEGER PRIMARY KEY,
        person_id INTEGER NOT NULL REFERENCES people(id),
        type TEXT NOT NULL CHECK (type IN ('vacation', 'sick', 'personal', 'unpaid')),
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL CHECK (end_date >= start_date),
        note TEXT NOT NULL DEFAULT ''
      );
    `);
    database
      .prepare(
        `INSERT INTO leaves_next (id, person_id, type, start_date, end_date, note)
         SELECT id, ?, type, start_date, end_date, note FROM leaves`,
      )
      .run(personId);
    database.exec("DROP TABLE leaves");
    database.exec("ALTER TABLE leaves_next RENAME TO leaves");
    database.exec("COMMIT");
  }
}

function openDatabase(): DatabaseSync {
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  const database = new DatabaseSync(path.join(dir, "kintai.sqlite"));
  ensureSchema(database);
  return database;
}

export function getDb(): DatabaseSync {
  globalForDb.kintaiDb ??= openDatabase();
  return globalForDb.kintaiDb;
}

function rowValue(row: Record<string, unknown>, key: string): unknown {
  return row[key];
}

function mapAttendance(row: Record<string, unknown>): Attendance {
  const clockOut = rowValue(row, "clock_out");
  return {
    id: Number(rowValue(row, "id")),
    personId: Number(rowValue(row, "person_id")),
    day: String(rowValue(row, "day")),
    clockIn: String(rowValue(row, "clock_in")),
    clockOut: clockOut == null ? null : String(clockOut),
    note: String(rowValue(row, "note") ?? ""),
  };
}

function mapLeave(row: Record<string, unknown>): Leave {
  const type = String(rowValue(row, "type"));
  if (!isLeaveType(type)) throw new Error(`Unknown leave type ${type}`);
  return {
    id: Number(rowValue(row, "id")),
    personId: Number(rowValue(row, "person_id")),
    type,
    start: String(rowValue(row, "start_date")),
    end: String(rowValue(row, "end_date")),
    note: String(rowValue(row, "note") ?? ""),
  };
}

function rows(sql: string, ...params: (string | number | null)[]): Record<string, unknown>[] {
  return getDb().prepare(sql).all(...params) as Record<string, unknown>[];
}

function one(sql: string, ...params: (string | number | null)[]): Record<string, unknown> | null {
  const row = getDb().prepare(sql).get(...params);
  return row ? (row as Record<string, unknown>) : null;
}

const ATTENDANCE_COLUMNS = "id, person_id, day, clock_in, clock_out, note";
const LEAVE_COLUMNS = "id, person_id, type, start_date, end_date, note";

export function allPeople(): Person[] {
  return rows("SELECT id, name FROM people ORDER BY id").map((row) => ({
    id: Number(row.id),
    name: String(row.name),
  }));
}

export function updatePersonName(id: number, name: string): void {
  getDb().prepare("UPDATE people SET name = ? WHERE id = ?").run(name, id);
}

// shortcut: reads one person's rows. A team of four stays small; query a range if a log gets slow.
export function allAttendance(personId: number): Attendance[] {
  return rows(
    `SELECT ${ATTENDANCE_COLUMNS} FROM attendance WHERE person_id = ? ORDER BY day DESC`,
    personId,
  ).map(mapAttendance);
}

export function allLeaves(personId: number): Leave[] {
  return rows(
    `SELECT ${LEAVE_COLUMNS} FROM leaves WHERE person_id = ? ORDER BY start_date DESC, id DESC`,
    personId,
  ).map(mapLeave);
}

export function openPunches(): OpenPunch[] {
  return rows(
    `SELECT attendance.id, attendance.person_id, attendance.day, people.name AS person_name
     FROM attendance
     JOIN people ON people.id = attendance.person_id
     WHERE attendance.clock_out IS NULL
     ORDER BY attendance.day`,
  ).map((row) => ({
    id: Number(row.id),
    personId: Number(row.person_id),
    personName: String(row.person_name),
    day: String(row.day),
  }));
}

export function getAttendance(id: number): Attendance | null {
  const row = one(`SELECT ${ATTENDANCE_COLUMNS} FROM attendance WHERE id = ?`, id);
  return row ? mapAttendance(row) : null;
}

export function attendanceOn(personId: number, day: string): Attendance | null {
  const row = one(
    `SELECT ${ATTENDANCE_COLUMNS} FROM attendance WHERE person_id = ? AND day = ?`,
    personId,
    day,
  );
  return row ? mapAttendance(row) : null;
}

export function getLeave(id: number): Leave | null {
  const row = one(`SELECT ${LEAVE_COLUMNS} FROM leaves WHERE id = ?`, id);
  return row ? mapLeave(row) : null;
}

export function insertAttendance(row: Omit<Attendance, "id">): void {
  getDb()
    .prepare("INSERT INTO attendance (person_id, day, clock_in, clock_out, note) VALUES (?, ?, ?, ?, ?)")
    .run(row.personId, row.day, row.clockIn, row.clockOut, row.note);
}

export function updateAttendance(row: Attendance): void {
  getDb()
    .prepare(
      "UPDATE attendance SET day = ?, clock_in = ?, clock_out = ?, note = ? WHERE id = ? AND person_id = ?",
    )
    .run(row.day, row.clockIn, row.clockOut, row.note, row.id, row.personId);
}

export function deleteAttendance(id: number, personId: number): void {
  getDb().prepare("DELETE FROM attendance WHERE id = ? AND person_id = ?").run(id, personId);
}

export function insertLeave(row: Omit<Leave, "id">): void {
  getDb()
    .prepare("INSERT INTO leaves (person_id, type, start_date, end_date, note) VALUES (?, ?, ?, ?, ?)")
    .run(row.personId, row.type, row.start, row.end, row.note);
}

export function updateLeave(row: Leave): void {
  getDb()
    .prepare(
      "UPDATE leaves SET type = ?, start_date = ?, end_date = ?, note = ? WHERE id = ? AND person_id = ?",
    )
    .run(row.type, row.start, row.end, row.note, row.id, row.personId);
}

export function deleteLeave(id: number, personId: number): void {
  getDb().prepare("DELETE FROM leaves WHERE id = ? AND person_id = ?").run(id, personId);
}
