import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { Redis } from "@upstash/redis";

import { getDefaultSettlementDate, toDateInputValue } from "@/lib/date";
import { Database } from "@/lib/types";

const DATA_DIRECTORY = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIRECTORY, "natillera.json");
const REDIS_DATA_KEY = process.env.NATILLERA_REDIS_DATA_KEY || "natillera:database";
const REDIS_LOCK_KEY = `${REDIS_DATA_KEY}:lock`;
const REDIS_LOCK_TIMEOUT_SECONDS = 10;
const REDIS_LOCK_RETRY_COUNT = 40;
const REDIS_LOCK_RETRY_DELAY_MS = 125;

let redisClient: Redis | null = null;
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

function hasRedisConfig(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function isVercelRuntime(): boolean {
  return Boolean(process.env.VERCEL);
}

function getRedis(): Redis {
  if (!hasRedisConfig()) {
    throw new Error(
      "La app está en Vercel sin almacenamiento persistente. Agrega Upstash Redis en Vercel Marketplace para habilitar edición de datos.",
    );
  }

  redisClient ??= Redis.fromEnv();
  return redisClient;
}

function isMissingFileError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

function isReadOnlyFileSystemError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "EROFS"
  );
}

function storageConfigurationError(): Error {
  return new Error(
    "No se pudo guardar porque el sistema de archivos de Vercel es de solo lectura. Configura Upstash Redis en el proyecto de Vercel y vuelve a desplegar.",
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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

function parseStoredDatabase(value: Database | Partial<Database> | string): Database {
  const parsed = typeof value === "string" ? (JSON.parse(value) as Partial<Database>) : value;
  return sanitizeDatabase(parsed);
}

async function readDatabaseFromFile(): Promise<Database> {
  try {
    const content = await readFile(DATA_FILE, "utf-8");
    return parseStoredDatabase(content);
  } catch (error) {
    if (!isMissingFileError(error)) {
      throw error;
    }

    const database = createDefaultDatabase();

    if (!isVercelRuntime()) {
      await writeDatabaseToFile(database);
    }

    return database;
  }
}

async function readDatabaseFromRedis(): Promise<Database> {
  const redis = getRedis();
  const stored = await redis.get<Database | string>(REDIS_DATA_KEY);

  if (stored) {
    return parseStoredDatabase(stored);
  }

  const seedDatabase = await readDatabaseFromFile();
  const seeded = await redis.set(REDIS_DATA_KEY, seedDatabase, { nx: true });

  if (seeded === null) {
    const current = await redis.get<Database | string>(REDIS_DATA_KEY);
    return current ? parseStoredDatabase(current) : seedDatabase;
  }

  return seedDatabase;
}

export async function readDatabase(): Promise<Database> {
  if (hasRedisConfig()) {
    return readDatabaseFromRedis();
  }

  return readDatabaseFromFile();
}

function touchDatabase(database: Database): void {
  database.updatedAt = new Date().toISOString();
  database.settings.updatedAt = database.updatedAt;
}

async function writeDatabaseToFile(database: Database): Promise<void> {
  if (isVercelRuntime()) {
    throw storageConfigurationError();
  }

  try {
    await mkdir(DATA_DIRECTORY, { recursive: true });
    await writeFile(DATA_FILE, JSON.stringify(database, null, 2));
  } catch (error) {
    if (isReadOnlyFileSystemError(error)) {
      throw storageConfigurationError();
    }

    throw error;
  }
}

async function writeDatabaseToRedis(database: Database): Promise<void> {
  const redis = getRedis();
  await redis.set(REDIS_DATA_KEY, database);
}

async function acquireRedisLock(redis: Redis): Promise<string> {
  const token = crypto.randomUUID();

  for (let attempt = 0; attempt < REDIS_LOCK_RETRY_COUNT; attempt += 1) {
    const acquired = await redis.set(REDIS_LOCK_KEY, token, {
      ex: REDIS_LOCK_TIMEOUT_SECONDS,
      nx: true,
    });

    if (acquired === "OK") {
      return token;
    }

    await sleep(REDIS_LOCK_RETRY_DELAY_MS);
  }

  throw new Error("No fue posible guardar porque hay otra actualización en curso. Intenta de nuevo.");
}

async function releaseRedisLock(redis: Redis, token: string): Promise<void> {
  await redis.eval<[string], number>(
    "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
    [REDIS_LOCK_KEY],
    [token],
  );
}

async function withRedisLock<T>(callback: () => Promise<T>): Promise<T> {
  const redis = getRedis();
  const token = await acquireRedisLock(redis);

  try {
    return await callback();
  } finally {
    await releaseRedisLock(redis, token);
  }
}

export async function updateDatabase<T>(
  updater: (database: Database) => Promise<T> | T,
): Promise<T> {
  const task = writeQueue.then(async () => {
    if (hasRedisConfig()) {
      return withRedisLock(async () => {
        const database = await readDatabaseFromRedis();
        const result = await updater(database);
        touchDatabase(database);
        await writeDatabaseToRedis(database);
        return result;
      });
    }

    const database = await readDatabaseFromFile();
    const result = await updater(database);
    touchDatabase(database);
    await writeDatabaseToFile(database);
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
