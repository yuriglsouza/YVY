import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import * as schema from "../shared/schema.js";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  console.warn("DATABASE_URL not set. Falling back to memory storage.");
}

// @neondatabase/serverless is designed for Vercel/Serverless environments
// It handles connection pooling via HTTP/WebSocket and avoids timeout issues
export const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL
}) : null;

export const db = pool ? drizzle(pool, { schema }) : null;
