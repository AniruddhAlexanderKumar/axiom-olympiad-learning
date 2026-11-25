import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import { config, ensureDataDir } from './env.js';

export interface Queryable {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

let store: Queryable | null = null;

async function createPgStore(): Promise<Queryable> {
  const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });
  return {
    async query<T>(text: string, params?: unknown[]) {
      const result = await pool.query(text, params as unknown[]);
      return { rows: result.rows as T[] };
    },
  };
}

async function createEmbeddedStore(): Promise<Queryable> {
  const inMemory = process.env.NODE_ENV === 'test';
  if (!inMemory) ensureDataDir();
  const lite = await PGlite.create(inMemory ? undefined : '.data/pglite');
  return {
    async query<T>(text: string, params?: unknown[]) {
      const result = await lite.query<T>(text, params as unknown[]);
      return { rows: result.rows as T[] };
    },
  };
}

export async function db(): Promise<Queryable> {
  if (!store) {
    store = config.databaseUrl ? await createPgStore() : await createEmbeddedStore();
  }
  return store;
}

export async function query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> {
  const connection = await db();
  const result = await connection.query<T>(text, params);
  return result.rows;
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function migrate(): Promise<void> {
  const connection = await db();
  await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);

  const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), 'migrations');
  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();
  const applied = new Set(
    (await connection.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map(
      (row) => row.name,
    ),
  );

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(join(migrationsDir, file), 'utf8');
    for (const statement of splitStatements(sql)) {
      await connection.query(statement);
    }
    await connection.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
  }
}

/** PGlite runs one statement per call, so split on semicolons outside strings. */
export function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let quote: string | null = null;
  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    if (quote) {
      current += char;
      if (char === quote && sql[i - 1] !== '\\') quote = null;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      current += char;
      continue;
    }
    if (char === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') i += 1;
      current += '\n';
      continue;
    }
    if (char === ';') {
      if (current.trim()) statements.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}
