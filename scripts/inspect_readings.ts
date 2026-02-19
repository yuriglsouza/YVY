
import { db } from "../server/db";
import { readings } from "../shared/schema";
import { eq, desc } from "drizzle-orm";

async function inspect() {
    const farmId = 3; // "Ramon" from logs
    const data = await db.select().from(readings).where(eq(readings.farmId, farmId)).orderBy(desc(readings.date));

    console.log(`Readings for Farm ${farmId}:`);
    data.forEach(r => {
        console.log(`ID: ${r.id} | Date: ${r.date} | CO2: ${r.co2Equivalent}`);
    });

    process.exit(0);
}

inspect().catch(console.error);
