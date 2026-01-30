import { db } from "./db";
import {
  farms, readings, reports,
  type Farm, type InsertFarm,
  type Reading, type InsertReading,
  type Report, type InsertReport
} from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";
// Import chat storage to include it in the exported interface if needed, 
// or just export it separately. The integration blueprint creates its own storage object.
// We can mix them or keep them separate. I'll keep them separate but ensure this file doesn't conflict.

export interface IStorage {
  // Farms
  getFarms(): Promise<Farm[]>;
  getFarm(id: number): Promise<Farm | undefined>;
  createFarm(farm: InsertFarm): Promise<Farm>;

  // Readings
  getReadings(farmId: number): Promise<Reading[]>;
  getLatestReading(farmId: number): Promise<Reading | undefined>;
  createReading(reading: InsertReading): Promise<Reading>;

  // Reports
  getReports(farmId: number): Promise<Report[]>;
  createReport(report: InsertReport): Promise<Report>;
}

export class DatabaseStorage implements IStorage {
  async getFarms(): Promise<Farm[]> {
    return await db.select().from(farms);
  }

  async getFarm(id: number): Promise<Farm | undefined> {
    const [farm] = await db.select().from(farms).where(eq(farms.id, id));
    return farm;
  }

  async createFarm(insertFarm: InsertFarm): Promise<Farm> {
    const [farm] = await db.insert(farms).values(insertFarm).returning();
    return farm;
  }

  async getReadings(farmId: number): Promise<Reading[]> {
    return await db
      .select()
      .from(readings)
      .where(eq(readings.farmId, farmId))
      .orderBy(desc(readings.date));
  }

  async getLatestReading(farmId: number): Promise<Reading | undefined> {
    const [reading] = await db
      .select()
      .from(readings)
      .where(eq(readings.farmId, farmId))
      .orderBy(desc(readings.date))
      .limit(1);
    return reading;
  }

  async createReading(insertReading: InsertReading): Promise<Reading> {
    const [reading] = await db.insert(readings).values(insertReading).returning();
    return reading;
  }

  async getReports(farmId: number): Promise<Report[]> {
    return await db
      .select()
      .from(reports)
      .where(eq(reports.farmId, farmId))
      .orderBy(desc(reports.date));
  }

  async createReport(insertReport: InsertReport): Promise<Report> {
    const [report] = await db.insert(reports).values(insertReport).returning();
    return report;
  }
}

export const storage = new DatabaseStorage();
