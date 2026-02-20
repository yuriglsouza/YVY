import { pgTable, text, serial, integer, boolean, timestamp, jsonb, real, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// No external models to export for now

// === FARMS ===
// === USERS (Settings & Auth) ===
// Moved up because Farms need to reference Users
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").unique().notNull(),
  password: text("password"), // For local auth if needed, or just link to Google
  googleId: text("google_id").unique(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  role: text("role").default("user").notNull(), // 'admin' | 'user'
  subscriptionStatus: text("subscription_status").default("trial"), // 'active', 'trial', 'expired'
  subscriptionEnd: timestamp("subscription_end"),
  receiveAlerts: boolean("receive_alerts").default(true).notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

// === FARMS ===
export const farms = pgTable("farms", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id), // Owner
  name: text("name").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  sizeHa: real("size_ha").notNull(),
  cropType: text("crop_type").notNull(),
  imageUrl: text("image_url"),
  clientId: integer("client_id"),
  isDeforested: boolean("is_deforested").default(false), // ESG Compliance Flag
});

export const insertFarmSchema = createInsertSchema(farms).omit({ id: true });
export type Farm = typeof farms.$inferSelect;
export type InsertFarm = z.infer<typeof insertFarmSchema>;

// === READINGS (Satellite Data) ===
export const readings = pgTable("readings", {
  id: serial("id").primaryKey(),
  farmId: integer("farm_id").notNull(),
  date: date("date").notNull(), // ISO Date string
  ndvi: real("ndvi").notNull(), // Health
  ndwi: real("ndwi").notNull(), // Water
  ndre: real("ndre").notNull(), // Chlorophyll
  rvi: real("rvi").notNull(),   // Radar Vegetation Index
  otci: real("otci"),           // Sentinel-3 Chlorophyll Index
  temperature: real("temperature"), // Land Surface Temperature (Celsius)
  cloudCover: real("cloud_cover").default(0), // Percentage of cloud cover (0-1)
  satelliteImage: text("satellite_image"), // URL to RGB thumbnail
  thermalImage: text("thermal_image"), // URL to Thermal map thumbnail (LST)
  imageBounds: jsonb("image_bounds"), // [[lat1, lon1], [lat2, lon2]]
  regionalNdvi: real("regional_ndvi"), // Average NDVI of surrounding area (5km radius)
  carbonStock: real("carbon_stock"), // Estimated Carbon Stock (tonnes)
  co2Equivalent: real("co2_equivalent"), // Estimated CO2e (tonnes)
});

export const insertReadingSchema = createInsertSchema(readings).omit({ id: true });
export type Reading = typeof readings.$inferSelect;
export type InsertReading = z.infer<typeof insertReadingSchema>;

// === AI REPORTS ===
export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  farmId: integer("farm_id").notNull(),
  date: timestamp("date").defaultNow(),
  content: text("content").notNull(), // The AI analysis text (informal)
  formalContent: text("formal_content"), // The technical report for PDF
  readingsSnapshot: jsonb("readings_snapshot"), // Store the readings used for this report
});

export const insertReportSchema = createInsertSchema(reports).omit({ id: true, date: true });
export type Report = typeof reports.$inferSelect;
export type InsertReport = z.infer<typeof insertReportSchema>;

// === CLIENTS (CRM) ===
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertClientSchema = createInsertSchema(clients).omit({ id: true, createdAt: true });
export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;

// === ALERT LOGS ===
export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  farmId: integer("farm_id").notNull(),
  date: timestamp("date").defaultNow(),
  type: text("type").notNull(), // 'CRITICAL_NDVI', 'DROUGHT', 'HEAT_STRESS'
  message: text("message").notNull(),
  sentTo: text("sent_to"), // The email it was sent to
  read: boolean("read").default(false).notNull(),
});

export const insertAlertSchema = createInsertSchema(alerts).omit({ id: true });
export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = z.infer<typeof insertAlertSchema>;

// === MANAGEMENT ZONES ===
export const zones = pgTable("zones", {
  id: serial("id").primaryKey(),
  farmId: integer("farm_id").notNull(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  coordinates: jsonb("coordinates").notNull(),
  areaHa: real("area_ha").notNull().default(0),
});

export const insertZoneSchema = createInsertSchema(zones).omit({ id: true });
export type Zone = typeof zones.$inferSelect;
export type InsertZone = z.infer<typeof insertZoneSchema>;

// === TASKS (Actionable Insights) ===
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  farmId: integer("farm_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").default("pending").notNull(), // 'pending', 'in_progress', 'completed'
  priority: text("priority").default("medium").notNull(), // 'low', 'medium', 'high', 'critical'
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true, updatedAt: true });
export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;

// === RELATIONS ===
// (Optional but good for query helpers if we were using query builder extensively)
// For now, simple ID references are fine.

// === SESSIONS (connect-pg-simple) ===
export const session = pgTable("session", {
  sid: text("sid").primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull(),
});
