import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.warn("DATABASE_URL not set. Falling back to memory storage.");
}

// Connection resiliency for Serverless
const poolConfig = process.env.DATABASE_URL ? {
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Force SSL for Supabase
  max: 1, // Limit connections in Serverless to prevent exhaustion
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
} : undefined;

export const pool = poolConfig ? new Pool(poolConfig) : null;

// Add error handler to prevent crashing on idle disconnects
if (pool) {
  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    // Don't exit process, just log
  });
}

export const db = pool ? drizzle(pool, { schema }) : null;
