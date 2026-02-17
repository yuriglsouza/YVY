import { pgTable, text, serial, integer, boolean, timestamp, jsonb, real, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Export Chat Models from Integration
export * from "./models/chat";

// === FARMS ===
export const farms = pgTable("farms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  sizeHa: real("size_ha").notNull(),
  cropType: text("crop_type").notNull(),
  imageUrl: text("image_url"), // Placeholder for satellite image
  clientId: integer("client_id"), // Link to Client (CRM)
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
  satelliteImage: text("satellite_image"), // URL to RGB thumbnail
  thermalImage: text("thermal_image"), // URL to Thermal map thumbnail (LST)
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

// === USERS (Settings) ===
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").unique().notNull(), // Made unique
  googleId: text("google_id").unique(), // For OAuth
  name: text("name"), // Display name from Google
  avatarUrl: text("avatar_url"), // Profile picture
  receiveAlerts: boolean("receive_alerts").default(true).notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

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

// === RELATIONS ===
// (Optional but good for query helpers if we were using query builder extensively)
// For now, simple ID references are fine.
