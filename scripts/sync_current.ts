
import { db } from "../server/db";
import { farms, readings, type InsertReading } from "../shared/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const PYTHON_SCRIPT = "scripts/satellite_analysis.py";

async function runAnalysis(lat: number, lon: number, size: number, start: string, end: string) {
    try {
        const cmd = `python3 ${PYTHON_SCRIPT} --lat ${lat} --lon ${lon} --size ${size} --start ${start} --end ${end}`;
        console.log(`Executing: ${cmd}`);
        const { stdout, stderr } = await execAsync(cmd);
        if (stderr && stderr.trim().length > 0) {
            // console.warn("Python Stderr:", stderr);
        }
        try {
            return JSON.parse(stdout.trim());
        } catch (e) {
            console.error("Failed to parse Python output:", stdout);
            return null;
        }
    } catch (error) {
        console.error("Execution error:", error);
        return null;
    }
}

async function syncCurrent() {
    console.log("Starting CURRENT SYNC process...");

    const allFarms = await db.select().from(farms);
    console.log(`Found ${allFarms.length} farms.`);

    const now = new Date();
    const endDateStr = now.toISOString().split('T')[0];

    const startDate = new Date(now);
    startDate.setDate(now.getDate() - 30);
    const startDateStr = startDate.toISOString().split('T')[0];

    for (const farm of allFarms) {
        console.log(`Syncing Farm: ${farm.name} (ID: ${farm.id}) for window ${startDateStr} to ${endDateStr}`);

        // Check if we already have a very recent reading (last 7 days?) to avoid redundant heavy compute
        // actually, let's just force it as requested.

        const result = await runAnalysis(farm.latitude, farm.longitude, farm.sizeHa, startDateStr, endDateStr);

        if (result && !result.error) {
            const insertData: InsertReading = {
                farmId: farm.id,
                date: result.date,
                ndvi: result.ndvi,
                ndwi: result.ndwi,
                ndre: result.ndre,
                rvi: result.rvi,
                temperature: result.temperature,
                otci: result.otci,
                satelliteImage: result.satellite_image,
                thermalImage: result.thermal_image,
                regionalNdvi: result.regional_ndvi,
                carbonStock: result.carbon_stock,
                co2Equivalent: result.co2_equivalent,
                imageBounds: result.bounds
            };

            await db.insert(readings).values(insertData);
            console.log(`    -> Success! Saved current reading.`);
        } else {
            console.error(`    -> Failed: ${result?.error || 'Unknown error'}`);
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log("Current Sync complete.");
    process.exit(0);
}

syncCurrent().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
