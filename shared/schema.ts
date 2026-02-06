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
  content: text("content").notNull(), // The AI analysis text
  readingsSnapshot: jsonb("readings_snapshot"), // Store the readings used for this report
});

export const insertReportSchema = createInsertSchema(reports).omit({ id: true, date: true });
export type Report = typeof reports.$inferSelect;
export type InsertReport = z.infer<typeof insertReportSchema>;

// === USERS (Settings) ===
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  receiveAlerts: boolean("receive_alerts").default(true).notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

// === ALERT LOGS ===
export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  farmId: integer("farm_id").notNull(),
  date: timestamp("date").defaultNow(),
  type: text("type").notNull(), // 'CRITICAL_NDVI', 'DROUGHT', 'HEAT_STRESS'
  message: text("message").notNull(),
  sentTo: text("sent_to"), // The email it was sent to
});

// === RELATIONS ===
// (Optional but good for query helpers if we were using query builder extensively)
// For now, simple ID references are fine.
