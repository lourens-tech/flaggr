import { neon } from '@neondatabase/serverless';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

// One-shot HTTP driver — a fresh connection per query, which is the
// recommended approach for stateless serverless functions on Vercel.
export const sql = neon(connectionString);
