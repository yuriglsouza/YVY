import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
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
async function generateAgronomistReport(reading: Reading): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    return "Assistente de IA não configurado. Por favor, configure a chave da API do Gemini para receber análises.";
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: `Você é o 'YVY IA', um agrônomo digital experiente e parceiro do produtor rural. 
      Sua comunicação deve ser:
      1. Simples e Direta: Evite termos técnicos complexos sem explicação. Use analogias do campo.
      2. Acolhedora: Trate o produtor como amigo. Use frases como "Vamos cuidar disso juntos".
      3. Orientada à Ação: Não diga apenas o problema, diga exatamente como resolver (ex: irrigação, adubação).
      
      Estruture sua resposta sempre nestes 3 tópicos claros:
      ## 🧐 O que o satélite viu (Diagnóstico)
      ## 🛠️ O que fazer agora (Ação Prática)
      ## 💡 Dica do Parceiro`
    });

    const prompt = `Analise a situação da lavoura com estes dados de hoje:
          - NDVI (Saúde/Vigor): ${reading.ndvi.toFixed(2)} (Meta: > 0.6)
          - NDWI (Água no solo): ${reading.ndwi.toFixed(2)} (Meta: > -0.1)
          - NDRE (Nutrição/Nitrogênio): ${reading.ndre.toFixed(2)}
          - OTCI (Clorofila S3): ${reading.otci ? reading.otci.toFixed(2) : 'N/A'} (Meta: > 1.0)
          - RVI (Biomassa): ${reading.rvi.toFixed(2)}
          - Temperatura (Superfície): ${reading.temperature ? reading.temperature.toFixed(1) + '°C' : 'N/A'}
          
          Se o NDVI estiver baixo (<0.4), alerte sobre possível estresse.
          Se o NDWI estiver muito negativo, alerte sobre seca.
          Se a temperatura estiver muito alta (>35°C), alerte sobre estresse térmico.
          
          Gere um relatório completo, educativo e que ajude o produtor a salvar a lavoura ou aumentar a produtividade.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (err) {
    console.error("AI Error Details:", JSON.stringify(err, null, 2));

    // Fallback Mock for Demo/Dev purposes
    return `## ⚠️ Aviso do Sistema
    
     A IA está indisponível momentaneamente.
    
    ## 🧐 O que o satélite viu (Simulação)
    Identificamos um vigor vegetativo muito bom neta área (NDVI alto). As plantas estão trabalhando bem.
    
    ## 🛠️ O que fazer agora
    Mantenha o cronograma de irrigação atual. Se não chover nos próximos 3 dias, faça uma rega leve nas bordas.
    
    ## 💡 Dica do Parceiro
    Time que está ganhando não se mexe! Aproveite para revisar o maquinário para a próxima etapa.`;
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
      await storage.logAlert(farmId, "EMAIL_SENT", `Sent ${alerts.length} alerts to ${user.email}`, user.email);
    }
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

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
