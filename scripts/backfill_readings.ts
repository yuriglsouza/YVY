
import { db } from "../server/db";
import { farms, readings, type InsertReading } from "../shared/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";

const execAsync = promisify(exec);

// Config
const MONTHS_TO_BACKFILL = 6; // How many months back
const PYTHON_SCRIPT = "scripts/satellite_analysis.py";

async function runAnalysis(lat: number, lon: number, size: number, start: string, end: string) {
    try {
        const cmd = `python3 ${PYTHON_SCRIPT} --lat ${lat} --lon ${lon} --size ${size} --start ${start} --end ${end}`;
        console.log(`Executing: ${cmd}`);
        const { stdout, stderr } = await execAsync(cmd);

        if (stderr && stderr.trim().length > 0) {
            // Python script might log warnings to stderr, which is fine.
            // Only critical if stdout is empty or invalid JSON.
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

async function backfill() {
    console.log("Starting backfill process...");

    // 1. Get all farms
    const allFarms = await db.select().from(farms);
    console.log(`Found ${allFarms.length} farms.`);

    const now = new Date();

    for (const farm of allFarms) {
        console.log(`Processing Farm: ${farm.name} (ID: ${farm.id})`);

        for (let i = 1; i <= MONTHS_TO_BACKFILL; i++) {
            // Calculate date window for specific month
            // End date: i months ago
            // Start date: (i months ago) - 30 days

            const endDate = new Date(now);
            endDate.setMonth(now.getMonth() - i);

            const startDate = new Date(endDate);
            startDate.setDate(endDate.getDate() - 30); // 30 day window

            const endDateStr = endDate.toISOString().split('T')[0];
            const startDateStr = startDate.toISOString().split('T')[0];

            // Check if reading exists for this approximate month
            // We check if any reading exists within the start/end window
            const existing = await db.query.readings.findFirst({
                where: and(
                    eq(readings.farmId, farm.id),
                    gte(readings.date, startDateStr),
                    lte(readings.date, endDateStr)
                )
            });

            if (existing) {
                console.log(`  - Skipping ${endDateStr}: Reading already exists.`);
                continue;
            }

            console.log(`  + Backfilling for window: ${startDateStr} to ${endDateStr}`);

            const result = await runAnalysis(farm.latitude, farm.longitude, farm.sizeHa, startDateStr, endDateStr);

            if (result && !result.error) {
                // Parse result and insert
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
                console.log(`    -> Success! Saved reading for ${result.date}`);
            } else {
                console.error(`    -> Failed to fetch data: ${result?.error || 'Unknown error'}`);
            }

            // Small delay to be nice to Earth Engine
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    console.log("Backfill complete.");
    process.exit(0);
}

backfill().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
