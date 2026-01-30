import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { registerChatRoutes } from "./replit_integrations/chat";
import { openai } from "./replit_integrations/image/client"; // Use the client from image or chat, same instance
import { type Reading } from "@shared/schema";

// Mock Satellite Data Generator
function generateMockReadings(farmId: number, count = 10) {
  const readings = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i * 7); // Weekly readings
    readings.push({
      farmId,
      date: date.toISOString().split('T')[0],
      ndvi: 0.2 + Math.random() * 0.6, // 0.2 - 0.8
      ndwi: -0.2 + Math.random() * 0.4, // -0.2 - 0.2
      ndre: 0.2 + Math.random() * 0.5,
      rvi: 0.5 + Math.random() * 1.0,
    });
  }
  return readings;
}

// AI Analysis Service
async function generateAgronomistReport(reading: Reading): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        {
          role: "system",
          content: "You are an expert digital agronomist helping small farmers. Provide a short, motivating, and actionable analysis based on satellite indices. Keep it under 50 words."
        },
        {
          role: "user",
          content: `Analyze these indices: NDVI (Health): ${reading.ndvi.toFixed(2)}, NDWI (Water): ${reading.ndwi.toFixed(2)}, NDRE (Chlorophyll): ${reading.ndre.toFixed(2)}, RVI (Radar Biomass): ${reading.rvi.toFixed(2)}.`
        }
      ],
      max_completion_tokens: 150,
    });
    return response.choices[0]?.message?.content || "Could not generate report.";
  } catch (err) {
    console.error("AI Error:", err);
    return "AI Service unavailable. Based on the data, please monitor crop health manually.";
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Register Chat Integration Routes (from blueprint)
  registerChatRoutes(app);

  // Farms
  app.get(api.farms.list.path, async (req, res) => {
    const farms = await storage.getFarms();
    res.json(farms);
  });

  app.get(api.farms.get.path, async (req, res) => {
    const farm = await storage.getFarm(Number(req.params.id));
    if (!farm) return res.status(404).json({ message: "Farm not found" });
    res.json(farm);
  });

  app.post(api.farms.create.path, async (req, res) => {
    try {
      const input = api.farms.create.input.parse(req.body);
      const farm = await storage.createFarm(input);
      
      // Seed initial readings for this new farm
      const mockReadings = generateMockReadings(farm.id);
      for (const r of mockReadings) {
        await storage.createReading(r);
      }

      res.status(201).json(farm);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // Readings
  app.get(api.readings.list.path, async (req, res) => {
    const readings = await storage.getReadings(Number(req.params.id));
    res.json(readings);
  });

  app.get(api.readings.latest.path, async (req, res) => {
    const reading = await storage.getLatestReading(Number(req.params.id));
    if (!reading) return res.status(404).json({ message: "No readings found" });
    res.json(reading);
  });

  // Reports
  app.get(api.reports.list.path, async (req, res) => {
    const reports = await storage.getReports(Number(req.params.id));
    res.json(reports);
  });

  app.post(api.reports.generate.path, async (req, res) => {
    const farmId = Number(req.params.id);
    const reading = await storage.getLatestReading(farmId);
    
    if (!reading) {
      return res.status(404).json({ message: "No readings available to analyze" });
    }

    const content = await generateAgronomistReport(reading);
    
    const report = await storage.createReport({
      farmId,
      content,
      readingsSnapshot: reading
    });

    res.status(201).json(report);
  });

  // Mock Refresh Endpoint
  app.post(api.farms.refreshReadings.path, async (req, res) => {
      const farmId = Number(req.params.id);
      // Generate one new reading for today
      const [newReading] = generateMockReadings(farmId, 1);
      // Ensure date is today (generateMockReadings uses past dates by default logic if loop, but here with count=1 it might be today or close)
      newReading.date = new Date().toISOString().split('T')[0];
      
      await storage.createReading(newReading);
      res.json({ message: "New satellite data received" });
  });

  // Seed Data
  if (process.env.NODE_ENV !== 'production') {
      const existingFarms = await storage.getFarms();
      if (existingFarms.length === 0) {
          console.log("Seeding Database...");
          const farm1 = await storage.createFarm({
              name: "Green Valley Farm",
              latitude: -23.5505,
              longitude: -46.6333,
              sizeHa: 150.5,
              cropType: "Soybeans",
              imageUrl: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80"
          });
          
          const readings1 = generateMockReadings(farm1.id, 12); // 12 weeks
          for (const r of readings1) await storage.createReading(r);

          const farm2 = await storage.createFarm({
            name: "Highland Coffee Estate",
            latitude: -19.9167,
            longitude: -43.9345,
            sizeHa: 45.0,
            cropType: "Coffee",
             imageUrl: "https://images.unsplash.com/photo-1500964757637-c85e8a162699?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80"
        });
        const readings2 = generateMockReadings(farm2.id, 8);
        for (const r of readings2) await storage.createReading(r);
      }
  }

  return httpServer;
}
