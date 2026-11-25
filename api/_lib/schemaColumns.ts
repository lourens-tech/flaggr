import { sql } from './db';

// Some columns are added by migrations that may be applied before or after the
// code that uses them is deployed (migrations are applied by hand in Neon).
// Code that writes or reads such a column asks hasColumn() first and leaves the
// column out when it is missing, so the API keeps working either way.
// Checked once per warm instance; a missing column is checked again after a
// minute, so applying the migration takes effect without a redeploy.
const RECHECK_MS = 60_000;
const known = new Map<string, { present: boolean; at: number }>();

export async function hasColumn(table: string, column: string, migration: string): Promise<boolean> {
  const key = `${table}.${column}`;
  const k = known.get(key);
  if (k && (k.present || Date.now() - k.at < RECHECK_MS)) return k.present;
  const rows = (await sql`
    select 1 from information_schema.columns
    where table_schema = current_schema() and table_name = ${table} and column_name = ${column}
    limit 1
  `) as unknown[];
  const present = rows.length > 0;
  if (!present) console.error(`[schema] ${key} missing: apply db/migrations/${migration}`);
  known.set(key, { present, at: Date.now() });
  return present;
}
