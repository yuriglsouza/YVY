
import { db } from "../server/db";
import { readings, farms } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

async function main() {
    if (!db) {
        console.error("Database connection not available (DATABASE_URL missing?)");
        process.exit(1);
    }

    console.log("📊 Checking Data Statistics...");

    // 1. Total Farms
    const allFarms = await db.select().from(farms);
    console.log(`\n🌾 Total Farms: ${allFarms.length}`);

    // 2. Readings per Farm
    for (const farm of allFarms) {
        const farmReadings = await db
            .select({
                count: sql<number>`count(*)`,
                minDate: sql<string>`min(${readings.date})`,
                maxDate: sql<string>`max(${readings.date})`,
            })
            .from(readings)
            .where(eq(readings.farmId, farm.id));

        const stats = farmReadings[0];
        console.log(`\n📍 Farm: ${farm.name} (ID: ${farm.id})`);
        console.log(`   - Total Readings: ${stats.count}`);
        console.log(`   - Range: ${stats.minDate} to ${stats.maxDate}`);

        // Check gaps?
        // This is a simple check for now.
    }

    console.log("\n✅ Done.");
    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
