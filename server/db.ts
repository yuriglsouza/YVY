import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../shared/schema.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.warn("DATABASE_URL not set. Falling back to memory storage.");
} else {
  console.log("DATABASE_URL is set:", process.env.DATABASE_URL.substring(0, 15) + "...");
}

// Config for Vercel/Supabase (SSL required for production)
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10, // Limit connections for serverless
  connectionTimeoutMillis: 5000,
});

// Add error handler to prevent server crash on connection issues
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export const db = drizzle(pool, { schema });
