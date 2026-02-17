import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { api } from "@shared/routes";
import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { type Reading, type InsertReading, insertUserSchema } from "@shared/schema";
import { sendEmail } from "./email";

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
      temperature: 20 + Math.random() * 15, // 20 - 35 Celsius
      otci: 0.5 + Math.random() * 2.5, // 0.5 - 3.0 (Typical OTCI range)
      satelliteImage: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80",
      thermalImage: "https://images.unsplash.com/photo-1577705998148-6da4f3963bc1?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80"
    });
  }
  return readings;
}

// AI Analysis Service
// AI Analysis Service
async function generateAgronomistReport(reading: Reading, prediction?: { date: string, value: number } | null): Promise<{ content: string, formalContent: string }> {
  if (!process.env.GEMINI_API_KEY) {
    return {
      content: "Assistente de IA não configurado. Por favor, configure a chave da API do Gemini para receber análises.",
      formalContent: "Relatório técnico indisponível (API Key missing)."
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemma-3-27b-it"
    });

    const prompt = `
      Você é o 'YVY IA', um agrônomo digital.
      Analise os dados deste satélite e gere um relatório em formato JSON com dois campos:
      
      1. "content": Uma versão informal, direta e "parceira" para o produtor ler no celular. Use emojis, linguagem simples e acolhedora.
         Estruture com: ## 🧐 O que vi, ## 🚜 O que fazer.
      
      2. "formalContent": Uma versão técnica, formal e estruturada para exportação em PDF (bancos/auditoria).
         Sem emojis. Use termos técnicos (ex: "Índice de Vegetação", "Estresse Hídrico").
         Estruture com: 1. Diagnóstico Técnico, 2. Análise de Índices, 3. Recomendações Agronômicas.

      Dados Atuais:
      - Data: ${reading.date}
      - NDVI (Vigor): ${reading.ndvi}
      - NDWI (Água): ${reading.ndwi}
      - NDRE (Clorofila): ${reading.ndre}
      - Temperatura: ${reading.temperature}°C
      
      ${prediction ? `Previsão Futura (${prediction.date}): NDVI ${prediction.value.toFixed(2)}` : ''}
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Clean markdown code blocks if present
    const cleanJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();

    return JSON.parse(cleanJson);

  } catch (err) {
    console.error("AI Generation Error:", err);
    // Log error to file
    const fs = await import("fs");
    fs.appendFileSync("debug_errors.log", `\n\n--- ${new Date().toISOString()} ---\n`);
    fs.appendFileSync("debug_errors.log", `ERROR: ${JSON.stringify(err, Object.getOwnPropertyNames(err))}\n`);

    return {
      content: "Erro ao gerar análise. Tente novamente em instantes.",
      formalContent: "Erro na geração do relatório técnico."
    };
  }
}

async function checkAndSendAlerts(reading: Reading, farmId: number) {
  const user = await storage.getUser();
  if (!user || !user.receiveAlerts) return;

  const alerts = [];
  const farm = await storage.getFarm(farmId);
  const farmName = farm?.name || `Fazenda #${farmId}`;

  // 1. NDVI Stress
  if (reading.ndvi < 0.4) {
    alerts.push({
      type: "ESTRESSE VEGETATIVO",
      msg: `NDVI baixo (${reading.ndvi.toFixed(2)}). Possível estresse hídrico ou nutricional.`
    });
  }

  // 2. Drought (NDWI)
  if (reading.ndwi < -0.15) {
    alerts.push({
      type: "RISCO DE SECA",
      msg: `NDWI muito baixo (${reading.ndwi.toFixed(2)}). Solo com pouca umidade.`
    });
  }

  // 3. Heat Stress
  if (reading.temperature && reading.temperature > 32) {
    alerts.push({
      type: "ALTA TEMPERATURA",
      msg: `Temperatura de superfície atingiu ${reading.temperature.toFixed(1)}°C. Risco de abortamento floral.`
    });
  }

  if (alerts.length > 0) {
    console.log(`⚠️ Detected ${alerts.length} critical issues for ${farmName}`);

    // Persist alerts to DB
    for (const alert of alerts) {
      await storage.logAlert(farmId, alert.type, alert.msg, user.email);
    }

    const subject = `🚨 Alerta Crítico: ${farmName}`;
    const html = `
      <h2>⚠️ Alerta de Monitoramento - Yvy Orbital</h2>
      <p>Detectamos condições críticas na <b>${farmName}</b> na leitura de ${reading.date}.</p>
      <ul>
        ${alerts.map(a => `<li><b>${a.type}:</b> ${a.msg}</li>`).join('')}
      </ul>
      <p>Acesse a plataforma para ver os mapas detalhados.</p>
      <hr>
      <small>Você recebeu este email porque ativou os alertas na Yvy Orbital.</small>
    `;

    const sent = await sendEmail({
      to: user.email,
      subject,
      text: alerts.map(a => `${a.type}: ${a.msg}`).join('\n'),
      html
    });

    if (sent) {
      console.log(`Email sent to ${user.email}`);
    }
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Alerts
  app.get("/api/alerts", async (req, res) => {
    const alerts = await storage.getAlerts();
    res.json(alerts);
  });

  app.post("/api/alerts/:id/read", async (req, res) => {
    const id = Number(req.params.id);
    await storage.markAlertRead(id);
    res.json({ success: true });
  });

  // Benchmark
  app.get("/api/farms/:id/benchmark", async (req, res) => {
    const farmId = Number(req.params.id);
    const reading = await storage.getLatestReading(farmId);

    if (!reading) {
      return res.status(404).json({ message: "No data available for benchmark" });
    }

    // Mocked Regional Data (in a real app, this would query DB for same crop/region)
    // Randomize slightly around a "regional average" to make it look realistic
    const baseRegionalNdvi = 0.65;
    const regionalNdvi = baseRegionalNdvi + (Math.random() * 0.1 - 0.05);

    // Calculate Percentile
    const diff = reading.ndvi - regionalNdvi;
    let percentile = 50;
    let rank = "Na Média";

    if (diff > 0.1) { percentile = 90; rank = "Top 10% 🏆"; }
    else if (diff > 0.05) { percentile = 75; rank = "Acima da Média"; }
    else if (diff < -0.1) { percentile = 10; rank = "Abaixo da Média ⚠️"; }
    else if (diff < -0.05) { percentile = 25; rank = "Abaixo da Média"; }

    res.json({
      farmNdvi: reading.ndvi,
      regionalNdvi,
      percentile,
      rank,
      history: [
        { year: "2023", ndvi: reading.ndvi - 0.05 }, // Mock last year
        { year: "2024", ndvi: reading.ndvi + 0.02 }, // Mock this year
        { year: "2025", ndvi: reading.ndvi }         // Current
      ]
    });
  });

  // Management Zones
  app.post("/api/farms/:id/zones/generate", async (req, res) => {
    const farmId = Number(req.params.id);
    const farm = await storage.getFarm(farmId);

    if (!farm) return res.status(404).json({ message: "Farm not found" });

    // In a real app, we would pass the satellite image path
    // For now, we generate mock data based on location
    try {
      const { exec } = await import("child_process");
      const path = await import("path");
      const scriptPath = path.join(process.cwd(), "scripts", "cluster.py");
      // Pass lat/lon/size to generate mock pixels
      const command = `python3 "${scriptPath}" --lat ${farm.latitude} --lon ${farm.longitude} --size ${farm.sizeHa}`;

      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`Clustering Script Error: ${stderr}`);
          return res.status(500).json({ message: "Clustering failed" });
        }
        try {
          const zonesData = JSON.parse(stdout);
          res.json(zonesData);
        } catch (e) {
          console.error("Failed to parse clustering output", e);
          res.status(500).json({ message: "Invalid output from clustering script" });
        }
      });
    } catch (e) {
      console.error("generateZones internal error:", e);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // Farms
  app.get(api.farms.list.path, async (req, res) => {
    const farms = await storage.getFarms();
    // Enrich with latest reading for dashboard comparison
    const farmsWithReadings = await Promise.all(farms.map(async (farm) => {
      const latestReading = await storage.getLatestReading(farm.id);
      return { ...farm, latestReading };
    }));
    res.json(farmsWithReadings);
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

  // Debug Endpoint
  app.get("/api/debug", (req, res) => {
    res.json({
      env: process.env.NODE_ENV,
      db_url_set: !!process.env.DATABASE_URL,
      db_url_prefix: process.env.DATABASE_URL?.substring(0, 15),
      has_db_connection: !!db,
      timestamp: new Date().toISOString()
    });
  });

  app.post(api.reports.generate.path, async (req, res) => {
    const farmId = Number(req.params.id);
    const reading = await storage.getLatestReading(farmId);

    if (!reading) {
      return res.status(404).json({ message: "No readings available to analyze" });
    }

    const predictionDate = new Date();
    predictionDate.setDate(predictionDate.getDate() + 30); // Predict 30 days out
    const dateStr = predictionDate.toISOString().split('T')[0];
    const predValue = await getPrediction(farmId, dateStr);

    const reportData = await generateAgronomistReport(reading, predValue !== null ? { date: dateStr, value: predValue } : null);

    const report = await storage.createReport({
      farmId,
      content: reportData.content,
      formalContent: reportData.formalContent,
      readingsSnapshot: reading
    });

    res.status(201).json(report);
  });

  // Refresh Readings (Real Satellite Data)
  app.post(api.farms.refreshReadings.path, async (req, res) => {
    const farmId = Number(req.params.id);
    const farm = await storage.getFarm(farmId);

    if (!farm) {
      return res.status(404).json({ message: "Fazenda não encontrada" });
    }

    // Execute Python script
    const { exec } = await import("child_process");
    const path = await import("path");

    const scriptPath = path.join(process.cwd(), "scripts", "satellite_analysis.py");
    const command = `python3 "${scriptPath}" --lat ${farm.latitude} --lon ${farm.longitude} --size ${farm.sizeHa}`;

    console.log(`Executing: ${command}`);

    exec(command, async (error, stdout, stderr) => {
      const fallbackToMock = async (reason: string) => {
        console.warn(`[Satellite Fallback] Reason: ${reason}`);
        const [mockReading] = generateMockReadings(farmId, 1);
        mockReading.date = new Date().toISOString().split('T')[0];
        // Mock image (placeholder or static map/satellite)
        mockReading.satelliteImage = "https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80"; // Generic farm field
        mockReading.thermalImage = "https://images.unsplash.com/photo-1577705998148-6da4f3963bc1?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80"; // Heatmap style

        await storage.createReading(mockReading);

        // Trigger Alert Check (Async) even for simulation
        checkAndSendAlerts(mockReading as Reading, farmId).catch(console.error);

        res.json({
          message: "⚠️ Simulação: Satélite indisponível (Auth GEE pendente)",
          reading: mockReading,
          isMock: true,
          details: reason
        });
      };

      if (error) {
        return fallbackToMock(stderr || error.message);
      }

      try {
        console.log(`Python Output: ${stdout}`);
        const result = JSON.parse(stdout);

        if (result.error) {
          return fallbackToMock(result.error);
        }

        const newReading: InsertReading = {
          farmId,
          date: result.date,
          ndvi: result.ndvi,
          ndwi: result.ndwi,
          ndre: result.ndre,
          rvi: result.rvi,
          otci: result.otci,
          temperature: result.temperature,
          satelliteImage: result.satellite_image,
          thermalImage: result.thermal_image
        };

        await storage.createReading(newReading);

        // Trigger Alert Check (Async)
        checkAndSendAlerts(newReading as Reading, farmId).catch(console.error);

        res.json({ message: "Dados atualizados com sucesso", reading: newReading });

      } catch (parseError) {
        console.error("Failed to parse python output:", stdout);
        return fallbackToMock("Valid JSON not returned by script");
      }
    });
  });

  // Seed Data
  if (process.env.NODE_ENV !== 'production') {
    const existingFarms = await storage.getFarms();
    if (existingFarms.length === 0) {
      console.log("Seeding Database...");

      const farm1 = await storage.createFarm({
        name: "Fazenda Vale Verde",
        latitude: -23.5505,
        longitude: -46.6333,
        sizeHa: 150.5,
        cropType: "Soja",
        imageUrl: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80"
      });

      const readings1 = generateMockReadings(farm1.id, 12); // 12 weeks
      for (const r of readings1) await storage.createReading(r);

      const farm2 = await storage.createFarm({
        name: "Fazenda de Café Planalto",
        latitude: -19.9167,
        longitude: -43.9345,
        sizeHa: 45.0,
        cropType: "Café",
        imageUrl: "https://images.unsplash.com/photo-1500964757637-c85e8a162699?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80"
      });
      const readings2 = generateMockReadings(farm2.id, 8);
      for (const r of readings2) await storage.createReading(r);
    }
  }


  // Helper for Prediction
  async function getPrediction(farmId: number, date: string): Promise<number | null> {
    try {
      const { exec } = await import("child_process");
      const path = await import("path");
      const scriptPath = path.join(process.cwd(), "scripts", "predict.py");
      const command = `python3 "${scriptPath}" --farm-id ${farmId} --date ${date}`;

      return new Promise((resolve) => {
        exec(command, (error, stdout, stderr) => {
          if (error) {
            console.error(`Prediction Script Error: ${stderr}`);
            resolve(null);
            return;
          }
          const match = stdout.match(/([\d\.]+)\s*$/);
          const prediction = match ? parseFloat(match[1]) : null;
          resolve(prediction);
        });
      });
    } catch (e) {
      console.error("getPrediction internal error:", e);
      return null;
    }
  }

  // Predictive Model Endpoint
  app.get("/api/farms/:id/prediction", async (req, res) => {
    const farmId = Number(req.params.id);
    const date = req.query.date as string;

    if (!date) {
      return res.status(400).json({ message: "Date query parameter is required (YYYY-MM-DD)" });
    }

    const prediction = await getPrediction(farmId, date);

    if (prediction !== null) {
      res.json({ farmId, date, prediction, unit: "NDVI" });
    } else {
      res.status(500).json({ message: "Failed to generate prediction" });
    }
  });

  // Settings
  app.get("/api/settings", async (req, res) => {
    const user = await storage.getUser();
    res.json(user || null);
  });

  app.put("/api/settings", async (req, res) => {
    try {
      const input = insertUserSchema.parse(req.body);
      const user = await storage.updateUser(input);
      res.json(user);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  return httpServer;
}
