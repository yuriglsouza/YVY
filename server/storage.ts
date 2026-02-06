import { db } from "./db";
import {
  farms, readings, reports, users, alerts,
  type Farm, type InsertFarm,
  type Reading, type InsertReading,
  type Report, type InsertReport,
  type User, type InsertUser
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

  // Delete
  deleteFarm(id: number): Promise<void>;

  // Settings
  getUser(): Promise<User | undefined>;
  updateUser(user: InsertUser): Promise<User>;

  // Alerts
  logAlert(farmId: number, type: string, message: string, sentTo: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getFarms(): Promise<Farm[]> {
    return await db!.select().from(farms);
  }

  async getFarm(id: number): Promise<Farm | undefined> {
    const [farm] = await db!.select().from(farms).where(eq(farms.id, id));
    return farm;
  }

  async createFarm(insertFarm: InsertFarm): Promise<Farm> {
    const [farm] = await db!.insert(farms).values(insertFarm).returning();
    return farm;
  }

  async getReadings(farmId: number): Promise<Reading[]> {
    return await db!
      .select()
      .from(readings)
      .where(eq(readings.farmId, farmId))
      .orderBy(desc(readings.date), desc(readings.id));
  }

  async getLatestReading(farmId: number): Promise<Reading | undefined> {
    const [reading] = await db!
      .select()
      .from(readings)
      .where(eq(readings.farmId, farmId))
      .orderBy(desc(readings.date), desc(readings.id))
      .limit(1);
    return reading;
  }

  async createReading(insertReading: InsertReading): Promise<Reading> {
    const [reading] = await db!.insert(readings).values(insertReading).returning();
    return reading;
  }

  async getReports(farmId: number): Promise<Report[]> {
    return await db!
      .select()
      .from(reports)
      .where(eq(reports.farmId, farmId))
      .orderBy(desc(reports.date));
  }

  async createReport(insertReport: InsertReport): Promise<Report> {
    const [report] = await db!.insert(reports).values(insertReport).returning();
    return report;
  }

  async deleteFarm(id: number): Promise<void> {
    // Delete related data first (manual cascade for safety)
    await db!.delete(readings).where(eq(readings.farmId, id));
    await db!.delete(reports).where(eq(reports.farmId, id));
    await db!.delete(farms).where(eq(farms.id, id));
  }

  async getUser(): Promise<User | undefined> {
    const [user] = await db!.select().from(users).limit(1);
    return user;
  }

  async updateUser(insertUser: InsertUser): Promise<User> {
    const [existing] = await db!.select().from(users).limit(1);
    if (existing) {
      const [updated] = await db!
        .update(users)
        .set(insertUser)
        .where(eq(users.id, existing.id))
        .returning();
      return updated;
    } else {
      const [newUser] = await db!.insert(users).values(insertUser).returning();
      return newUser;
    }
  }

  async logAlert(farmId: number, type: string, message: string, sentTo: string): Promise<void> {
    await db!.insert(alerts).values({
      farmId,
      type,
      message,
      sentTo
    });
  }
}

export class MemStorage implements IStorage {
  private farms: Map<number, Farm>;
  private readings: Map<number, Reading>;
  private reports: Map<number, Report>;
  private farmIdCounter = 1;
  private readingIdCounter = 1;
  private reportIdCounter = 1;

  constructor() {
    this.farms = new Map();
    this.readings = new Map();
    this.reports = new Map();
    // Seed initial data? Handled in routes.ts if empty.
  }

  async getFarms(): Promise<Farm[]> {
    return Array.from(this.farms.values());
  }

  async getFarm(id: number): Promise<Farm | undefined> {
    return this.farms.get(id);
  }

  async createFarm(insertFarm: InsertFarm): Promise<Farm> {
    const id = this.farmIdCounter++;
    const farm: Farm = { ...insertFarm, id, imageUrl: insertFarm.imageUrl || null };
    this.farms.set(id, farm);
    return farm;
  }

  async deleteFarm(id: number): Promise<void> {
    this.farms.delete(id);

    // Cleanup readings
    const readingsToDelete: number[] = [];
    this.readings.forEach((value, key) => {
      if (value.farmId === id) readingsToDelete.push(key);
    });
    readingsToDelete.forEach(key => this.readings.delete(key));

    // Cleanup reports
    const reportsToDelete: number[] = [];
    this.reports.forEach((value, key) => {
      if (value.farmId === id) reportsToDelete.push(key);
    });
    reportsToDelete.forEach(key => this.reports.delete(key));
  }

  // Settings (Mem)
  private user: User | undefined;

  async getUser(): Promise<User | undefined> {
    return this.user;
  }

  async updateUser(insertUser: InsertUser): Promise<User> {
    const user: User = { ...insertUser, id: 1, receiveAlerts: insertUser.receiveAlerts ?? true };
    this.user = user;
    return user;
  }

  // Alerts (Mem)
  async logAlert(farmId: number, type: string, message: string, sentTo: string): Promise<void> {
    console.log(`[MemStorage Alert] To: ${sentTo} | Type: ${type} | Msg: ${message}`);
  }

  async getReadings(farmId: number): Promise<Reading[]> {
    return Array.from(this.readings.values())
      .filter((r) => r.farmId === farmId)
      .sort((a, b) => {
        const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
        return dateDiff !== 0 ? dateDiff : b.id - a.id;
      });
  }

  async getLatestReading(farmId: number): Promise<Reading | undefined> {
    const readings = await this.getReadings(farmId);
    return readings[0];
  }

  async createReading(insertReading: InsertReading): Promise<Reading> {
    const id = this.readingIdCounter++;
    const reading: Reading = { ...insertReading, id, temperature: insertReading.temperature ?? null };
    this.readings.set(id, reading);
    return reading;
  }

  async getReports(farmId: number): Promise<Report[]> {
    return Array.from(this.reports.values())
      .filter((r) => r.farmId === farmId)
      .sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
  }

  async createReport(insertReport: InsertReport): Promise<Report> {
    const id = this.reportIdCounter++;
    const report: Report = {
      ...insertReport,
      id,
      date: new Date(),
      readingsSnapshot: insertReport.readingsSnapshot || null
    };
    this.reports.set(id, report);
    return report;
  }
}

export const storage = process.env.DATABASE_URL ? new DatabaseStorage() : new MemStorage();
