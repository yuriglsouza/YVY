
import { db } from "../server/db";
import { readings } from "@shared/schema";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

async function main() {
    if (!db) {
        console.error("Database connection not available.");
        process.exit(1);
    }

    console.log("📦 Exporting Dataset...");

    const allReadings = await db.select().from(readings);

    if (allReadings.length === 0) {
        console.warn("⚠️ No readings found to export.");
        process.exit(0);
    }

    // internal/drizzle objects might need flat conversion
    // CSV Header
    const header = "id,farm_id,date,ndvi,ndwi,ndre,rvi,otci,temperature";

    const rows = allReadings.map(r => {
        // Handle nulls and formatting
        return [
            r.id,
            r.farmId,
            r.date, // Date object or string? Drizzle returns string for date usually
            r.ndvi?.toFixed(6) ?? "",
            r.ndwi?.toFixed(6) ?? "",
            r.ndre?.toFixed(6) ?? "",
            r.rvi?.toFixed(6) ?? "",
            r.otci?.toFixed(6) ?? "",
            r.temperature?.toFixed(2) ?? ""
        ].join(",");
    });

    const content = [header, ...rows].join("\n");

    const outputPath = path.resolve(process.cwd(), "dataset.csv");
    fs.writeFileSync(outputPath, content);

    console.log(`✅ Dataset exported to: ${outputPath}`);
    console.log(`📊 Rows exported: ${rows.length}`);

    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
