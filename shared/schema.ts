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

// === RELATIONS ===
// (Optional but good for query helpers if we were using query builder extensively)
// For now, simple ID references are fine.
