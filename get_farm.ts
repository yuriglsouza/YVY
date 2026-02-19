import 'dotenv/config';
import { db } from "./server/db.js";
import { farms } from "./shared/schema.js";
import { eq } from "drizzle-orm";

async function main() {
  const [farm] = await db.select().from(farms).where(eq(farms.id, 7));
  console.log(JSON.stringify(farm));
  process.exit(0);
}
main();
