import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getDefaultSettlementDate, toDateInputValue } from "@/lib/date";
import { Database } from "@/lib/types";

const DATA_DIRECTORY = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIRECTORY, "natillera.json");

let writeQueue: Promise<unknown> = Promise.resolve();

function createDefaultDatabase(): Database {
  const today = new Date();
  const startDate = toDateInputValue(today);
  const endDate = toDateInputValue(
    new Date(today.getFullYear(), today.getMonth() + 11, today.getDate()),
  );
  const now = today.toISOString();

  return {
    version: 1,
    settings: {
      id: "settings",
      name: "Natillera",
      startDate,
      endDate,
      durationMonths: 12,
      estimatedSettlementDate: getDefaultSettlementDate(today),
      status: "active",
      updatedAt: now,
    },
    participants: [],
    monthlyContributions: [],
    raffleEntries: [],
    raffleRounds: [],
    lunches: [],
    tripContributions: [],
    loans: [],
    loanInstallments: [],
    cashAdjustments: [],
    settlements: [],
    updatedAt: now,
  };
}

async function ensureDatabaseFile(): Promise<void> {
  await mkdir(DATA_DIRECTORY, { recursive: true });

  try {
    await readFile(DATA_FILE, "utf-8");
  } catch {
    await writeFile(DATA_FILE, JSON.stringify(createDefaultDatabase(), null, 2));
  }
}

function sanitizeDatabase(raw: Partial<Database>): Database {
  const fallback = createDefaultDatabase();

  return {
    version: raw.version ?? fallback.version,
    settings: raw.settings ?? fallback.settings,
    participants: raw.participants ?? [],
    monthlyContributions: raw.monthlyContributions ?? [],
    raffleEntries: raw.raffleEntries ?? [],
    raffleRounds: raw.raffleRounds ?? [],
    lunches: raw.lunches ?? [],
    tripContributions: raw.tripContributions ?? [],
    loans: raw.loans ?? [],
    loanInstallments: raw.loanInstallments ?? [],
    cashAdjustments: raw.cashAdjustments ?? [],
    settlements: raw.settlements ?? [],
    updatedAt: raw.updatedAt ?? fallback.updatedAt,
  };
}

export async function readDatabase(): Promise<Database> {
  await ensureDatabaseFile();
  const content = await readFile(DATA_FILE, "utf-8");
  const parsed = JSON.parse(content) as Partial<Database>;
  return sanitizeDatabase(parsed);
}

async function writeDatabase(database: Database): Promise<void> {
  database.updatedAt = new Date().toISOString();
  database.settings.updatedAt = database.updatedAt;
  await writeFile(DATA_FILE, JSON.stringify(database, null, 2));
}

export async function updateDatabase<T>(
  updater: (database: Database) => Promise<T> | T,
): Promise<T> {
  const task = writeQueue.then(async () => {
    const database = await readDatabase();
    const result = await updater(database);
    await writeDatabase(database);
    return result;
  });

  writeQueue = task.then(
    () => undefined,
    () => undefined,
  );

  return task;
}

export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}
