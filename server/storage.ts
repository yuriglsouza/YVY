import { db } from "./db.js";
import {
  farms, readings, reports, users, alerts, clients,
  type Farm, type InsertFarm,
  type Reading, type InsertReading,
  type Report, type InsertReport,
  type User, type InsertUser,
  type Client, type InsertClient
} from "../shared/schema.js";
import { eq, desc, sql } from "drizzle-orm";
// Import chat storage to include it in the exported interface if needed, 
// or just export it separately. The integration blueprint creates its own storage object.
// We can mix them or keep them separate. I'll keep them separate but ensure this file doesn't conflict.

export interface IStorage {
  // Farms
  getFarms(): Promise<Farm[]>;
  getFarmsWithOwners(): Promise<(Farm & { ownerName: string | null; ownerEmail: string | null })[]>; // Added
  getFarmsByUserId(userId: number): Promise<Farm[]>; // Added
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

  // Users (Auth)
  getUser(id: number): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User>;

  // Alerts
  logAlert(farmId: number, type: string, message: string, sentTo: string): Promise<void>;
  getAlerts(limit?: number): Promise<{ id: number; farmId: number; date: Date | null; type: string; message: string; sentTo: string | null; read: boolean }[]>;
  markAlertRead(id: number): Promise<void>;

  // Clients
  getClients(): Promise<Client[]>;
  getClient(id: number): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: number, client: Partial<InsertClient>): Promise<Client>;
  deleteClient(id: number): Promise<void>;

  // Updates
  updateFarm(id: number, farm: Partial<InsertFarm>): Promise<Farm>;
}

export class DatabaseStorage implements IStorage {
  async getFarms(): Promise<Farm[]> {
    const farmsList = await db!.select().from(farms);
    return await Promise.all(farmsList.map(async (farm) => {
      const latestReading = await this.getLatestReading(farm.id);
      return { ...farm, latestReading };
    }));
  }

  async getFarmsWithOwners(): Promise<(Farm & { ownerName: string | null; ownerEmail: string | null })[]> {
    const results = await db!
      .select({
        farm: farms,
        ownerName: users.name,
        ownerEmail: users.email
      })
      .from(farms)
      .leftJoin(users, eq(farms.userId, users.id));

    return await Promise.all(results.map(async ({ farm, ownerName, ownerEmail }) => {
      const latestReading = await this.getLatestReading(farm.id);
      return { ...farm, latestReading, ownerName, ownerEmail };
    }));
  }

  async getFarmsByUserId(userId: number): Promise<Farm[]> {
    const farmsList = await db!.select().from(farms).where(eq(farms.userId, userId));
    return await Promise.all(farmsList.map(async (farm) => {
      const latestReading = await this.getLatestReading(farm.id);
      return { ...farm, latestReading };
    }));
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

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db!.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const [user] = await db!.select().from(users).where(eq(users.googleId, googleId));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const role = insertUser.email === process.env.ADMIN_EMAIL ? "admin" : (insertUser.role ?? "user");

    const [user] = await db!.insert(users).values({ ...insertUser, role }).returning();

    // Auto-create Client entry for CRM if not admin
    if (role !== 'admin') {
      const clientData = {
        name: user.name || "Novo Usuário",
        email: user.email,
        notes: "Cadastrado via Google Login",
        createdAt: new Date()
      };
      // Use insertClientSchema or raw insert depending on needs, simplifying here
      await db!.insert(clients).values(clientData);
    }

    return user;
  }

  async updateUser(id: number, insertUser: Partial<InsertUser>): Promise<User> {
    const [updated] = await db!
      .update(users)
      .set(insertUser)
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  async logAlert(farmId: number, type: string, message: string, sentTo: string): Promise<void> {
    await db!.insert(alerts).values({
      farmId,
      type,
      message,
      sentTo,
      read: false
    });
  }

  async getAlerts(limit = 50): Promise<{ id: number; farmId: number; date: Date | null; type: string; message: string; sentTo: string | null; read: boolean }[]> {
    return await db!
      .select()
      .from(alerts)
      .orderBy(desc(alerts.date))
      .limit(limit);
  }

  async markAlertRead(id: number): Promise<void> {
    await db!
      .update(alerts)
      .set({ read: true })
      .where(eq(alerts.id, id));
  }

  async getClients(): Promise<Client[]> {
    return await db!.select().from(clients).orderBy(desc(clients.createdAt));
  }

  async getClient(id: number): Promise<Client | undefined> {
    const [client] = await db!.select().from(clients).where(eq(clients.id, id));
    return client;
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const [client] = await db!.insert(clients).values(insertClient).returning();
    return client;
  }

  async updateClient(id: number, insertClient: Partial<InsertClient>): Promise<Client> {
    const [updated] = await db!
      .update(clients)
      .set(insertClient)
      .where(eq(clients.id, id))
      .returning();
    return updated;
  }

  async deleteClient(id: number): Promise<void> {
    // Unlink farms first
    await db!.update(farms).set({ clientId: null }).where(eq(farms.clientId, id));
    await db!.delete(clients).where(eq(clients.id, id));
  }

  async updateFarm(id: number, insertFarm: Partial<InsertFarm>): Promise<Farm> {
    const [updated] = await db!
      .update(farms)
      .set(insertFarm)
      .where(eq(farms.id, id))
      .returning();
    return updated;
  }
}

export class MemStorage implements IStorage {
  private farms: Map<number, Farm>;
  private readings: Map<number, Reading>;
  private reports: Map<number, Report>;
  private users: Map<number, User>;
  private clients: Map<number, Client>;
  private farmIdCounter = 1;
  private readingIdCounter = 1;
  private reportIdCounter = 1;
  private userIdCounter = 1;
  private clientIdCounter = 1;

  constructor() {
    this.farms = new Map();
    this.readings = new Map();
    this.reports = new Map();
    this.users = new Map();
    this.clients = new Map();
    // Seed initial data? Handled in routes.ts if empty.
  }

  async getFarms(): Promise<Farm[]> {
    return Array.from(this.farms.values());
  }

  async getFarmsWithOwners(): Promise<(Farm & { ownerName: string | null; ownerEmail: string | null })[]> {
    return Array.from(this.farms.values()).map(farm => {
      const user = this.users.get(farm.userId || 0);
      return {
        ...farm,
        ownerName: user?.name || null,
        ownerEmail: user?.email || null
      };
    });
  }

  async getFarmsByUserId(userId: number): Promise<Farm[]> {
    return Array.from(this.farms.values()).filter(f => f.userId === userId);
  }

  async getFarm(id: number): Promise<Farm | undefined> {
    return this.farms.get(id);
  }

  async createFarm(insertFarm: InsertFarm): Promise<Farm> {
    const id = this.farmIdCounter++;
    const farm: Farm = {
      ...insertFarm,
      id,
      userId: insertFarm.userId ?? null, // Handle undefined
      imageUrl: insertFarm.imageUrl || null,
      clientId: insertFarm.clientId || null
    };
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

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.googleId === googleId);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const role = insertUser.email === process.env.ADMIN_EMAIL ? "admin" : (insertUser.role ?? "user");

    const user: User = {
      ...insertUser,
      id,
      googleId: insertUser.googleId || null,
      name: insertUser.name || null,
      avatarUrl: insertUser.avatarUrl || null,
      password: insertUser.password || null,
      role,
      subscriptionStatus: insertUser.subscriptionStatus ?? "trial",
      subscriptionEnd: insertUser.subscriptionEnd ?? null,
      receiveAlerts: insertUser.receiveAlerts ?? true
    };
    this.users.set(id, user);

    // Auto-create Client entry for CRM if not admin
    if (role !== 'admin') {
      const clientId = this.clientIdCounter++;
      const client: Client = {
        id: clientId,
        name: user.name || "Novo Usuário",
        email: user.email,
        phone: null,
        company: null,
        notes: "Cadastrado via Google Login",
        createdAt: new Date()
      };
      this.clients.set(clientId, client);
    }

    return user;
  }

  async updateUser(id: number, updateUser: Partial<InsertUser>): Promise<User> {
    const user = this.users.get(id);
    if (!user) throw new Error("User not found");
    const updatedUser = { ...user, ...updateUser };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // Alerts (Mem)
  private alertsLog: { id: number; farmId: number; date: Date | null; type: string; message: string; sentTo: string | null; read: boolean }[] = [];
  private alertIdCounter = 1;

  async logAlert(farmId: number, type: string, message: string, sentTo: string): Promise<void> {
    const id = this.alertIdCounter++;
    this.alertsLog.push({
      id,
      farmId,
      date: new Date(),
      type,
      message,
      sentTo,
      read: false
    });
    console.log(`[MemStorage Alert] To: ${sentTo} | Type: ${type} | Msg: ${message}`);
  }

  async getAlerts(limit = 50): Promise<{ id: number; farmId: number; date: Date | null; type: string; message: string; sentTo: string | null; read: boolean }[]> {
    return this.alertsLog
      .sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0))
      .slice(0, limit);
  }

  async markAlertRead(id: number): Promise<void> {
    const alert = this.alertsLog.find(a => a.id === id);
    if (alert) {
      alert.read = true;
    }
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
    const reading: Reading = {
      ...insertReading,
      id,
      temperature: insertReading.temperature ?? null,
      otci: insertReading.otci ?? null,
      satelliteImage: insertReading.satelliteImage ?? null,
      thermalImage: insertReading.thermalImage ?? null,
      regionalNdvi: insertReading.regionalNdvi ?? null,
      imageBounds: (insertReading.imageBounds ?? null) as any
    };
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
      readingsSnapshot: insertReport.readingsSnapshot || null,
      formalContent: insertReport.formalContent || null
    };
    this.reports.set(id, report);
    return report;
  }

  async getClients(): Promise<Client[]> {
    return Array.from(this.clients.values()).sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async getClient(id: number): Promise<Client | undefined> {
    return this.clients.get(id);
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const id = this.clientIdCounter++;
    const client: Client = {
      ...insertClient,
      id,
      createdAt: new Date(),
      email: insertClient.email || null,
      phone: insertClient.phone || null,
      company: insertClient.company || null,
      notes: insertClient.notes || null,
    };
    this.clients.set(id, client);
    return client;
  }

  async updateClient(id: number, updateClient: Partial<InsertClient>): Promise<Client> {
    const client = this.clients.get(id);
    if (!client) throw new Error("Client not found");
    const updatedClient = { ...client, ...updateClient };
    this.clients.set(id, updatedClient);
    return updatedClient;
  }

  async deleteClient(id: number): Promise<void> {
    this.clients.delete(id);
    // Unlink farms
    this.farms.forEach((farm) => {
      if (farm.clientId === id) {
        farm.clientId = null;
      }
    });
  }

  async updateFarm(id: number, updateFarm: Partial<InsertFarm>): Promise<Farm> {
    const farm = this.farms.get(id);
    if (!farm) throw new Error("Farm not found");
    const updatedFarm = { ...farm, ...updateFarm };
    this.farms.set(id, updatedFarm);
    return updatedFarm;
  }
}

export const storage = process.env.DATABASE_URL ? new DatabaseStorage() : new MemStorage();
