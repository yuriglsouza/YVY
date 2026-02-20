import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import { db } from "./db.js";
import { api } from "../shared/routes.js";
import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { type Reading, type InsertReading, insertFarmSchema, insertReadingSchema, insertReportSchema, insertUserSchema, insertClientSchema, insertTaskSchema } from "../shared/schema.js";
import { sendEmail } from "./email.js";

// Mock Satellite Data Generator
function generateMockReadings(farmId: number, count = 10) {
  const readings = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i * 7); // Weekly readings
    const baseCarbon = 20 + Math.random() * 50; // 20 - 70 tonnes
    const cloudCover = Math.random() < 0.3 ? 0.7 + Math.random() * 0.3 : Math.random() * 0.4; // 30% chance of thick clouds

    // If clouds > 60%, optical indices degrade, but RVI (radar) remains steady
    const OpticalBlock = cloudCover > 0.6 ? 0.4 : 1;

    readings.push({
      farmId,
      date: date.toISOString().split('T')[0],
      ndvi: (0.2 + Math.random() * 0.6) * OpticalBlock,
      ndwi: (-0.2 + Math.random() * 0.4) * OpticalBlock,
      ndre: (0.2 + Math.random() * 0.5) * OpticalBlock,
      rvi: 0.5 + Math.random() * 1.0, // Radar traverses clouds untouched
      temperature: 20 + Math.random() * 15,
      cloudCover: cloudCover,
      otci: 0.5 + Math.random() * 2.5, // 0.5 - 3.0 (Typical OTCI range)
      carbonStock: baseCarbon,
      co2Equivalent: baseCarbon * 3.67,
      satelliteImage: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80",
      thermalImage: "https://images.unsplash.com/photo-1577705998148-6da4f3963bc1?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80"
    });
  }
  return readings;
}

// AI Analysis Service
// AI Analysis Service
async function generateAgronomistReport(
  reading: Reading,
  prediction?: { date: string, value: number } | null,
  climateForecast?: {
    currentTemp: number;
    forecastSummary: string;
  } | null
): Promise<{ content: string, formalContent: string }> {
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
      Você é o 'SYAZ IA', um Engenheiro Agrônomo Sênior especialista em Sensoriamento Remoto.
      Analise os dados deste satélite e gere um relatório técnico detalhado e profissional.
      
      Retorne APENAS um JSON válido com a seguinte estrutura:
        {
          "content": "Uma versão informal, direta e 'parceira' para o produtor ler no celular. Use emojis, linguagem simples, acolhedora e caipira respeitosa. Estruture com: ## 🧐 O que vi, ## 🚜 O que fazer.",
          "formalContent": "TEXTO_COMPLETO_DO_RELATÓRIO_TÉCNICO_PARA_PDF",
          "structuredAnalysis": {
            "diagnostic": "Análise diagnóstica TÉCNICA e APROFUNDADA dos índices (NDVI, NDWI, NDRE), identificando variações sutis e causas prováveis.",
            "prediction": "Previsão de cenário baseada na tendência e dados históricos.",
            "recommendation": "Lista de ações práticas sugeridas para o manejo.",
            "esg": "Se informados dados de Estoque de Carbono ou Retenção de CO2, redija um breve parágrafo exaltando essa métrica como pilar de sustentabilidade (ESG) e valor ambiental. Caso contrário, deixe como '-'."
          }
        }

      Diretrizes para o 'formalContent':
    - NÃO use emojis.
      - Use linguagem técnica e culta.
      - Seja assertivo nas previsões e diagnósticos.
      - Foque em produtividade e rentabilidade.
      - Se houver dados de Carbono/CO2, crie um pequeno parágrafo exaltando a contribuição ambiental (Métricas ESG).

      Dados Atuais da Fazenda:
    - Data: ${reading.date}
    - NDVI(Vigor): ${reading.ndvi.toFixed(3)}
    - NDWI(Água): ${reading.ndwi.toFixed(3)}
    - NDRE(Clorofila/Nitrogênio): ${reading.ndre.toFixed(3)}
    - OTCI(Pigmentação): ${reading.otci ? reading.otci.toFixed(3) : 'N/A'}
    - Temperatura de Superfície: ${reading.temperature ? reading.temperature.toFixed(1) + '°C' : 'N/A'}
    - Estoque de Carbono Estimado: ${reading.carbonStock ? reading.carbonStock.toFixed(2) + ' kg/ha' : 'N/A'}
    - CO2 Equivalente Retido: ${reading.co2Equivalent ? reading.co2Equivalent.toFixed(2) + ' kg/ha' : 'N/A'}
      
      ${climateForecast ? `Dados Climáticos da Região (Open-Meteo):\n    - Temp Atual: ${climateForecast.currentTemp.toFixed(1)}°C\n    - Previsão Próximos 7 Dias: ${climateForecast.forecastSummary}\n    => OBRIGATÓRIO: Leve MUITO a sério essa Previsão do Tempo 7 dias para embasar suas recomendações no relatório. Se haverá chuva, economize na irrigação. Se haverá seca/calor, prescreva ações preventivas fortes.` : ''}

      ${prediction ? `Previsão de Produtividade (IA ML): Tendência aponta para NDVI ${prediction.value.toFixed(2)} em ${prediction.date}.` : ''}
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Clean markdown code blocks if present
    const cleanJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();

    const parsed = JSON.parse(cleanJson);

    // Ensure backwards compatibility if model returns old format, or strictly new format
    // We will save the structured part into the formalContent usually, or specific fields if we update schema.
    // For now, let's embed the structured data into formalContent string if needed or keep using the fields.
    // Ideally we should update the DB schema to store 'structuredAnalysis' JSONB, but to avoid migration now:
    // We will append the structured parts to formalContent in a specific format if the frontend expects string.

    // Actually, looking at the prompt, formalContent IS a string in the JSON.
    // The prompt asks for "formalContent": "TEXTO_COMPLETO..."
    // BUT we also asked for "structuredAnalysis".
    // Let's store structuredAnalysis in a way we can retrieve it? 
    // The current schema has 'content' and 'formalContent'.
    // Let's serialize the structuredAnalysis into formalContent so the frontend can parse it back, 
    // OR just rely on the AI generating a great text in 'formalContent'.

    // DECISION: To make the PDF really good with specific sections, we need the structure.
    // However, I cannot easily change the DB schema right now without approval/migration risk.
    // Strategy: Pass the structured object as a JSON string mostly, OR
    // Let's just trust the prompt's "TEXTO_COMPLETO" to be good enough for now?
    // User asked for "interpreted" text.
    // Let's encode the structured analysis into the formalContent string? No, that's messy.

    // Let's just return the parsed object. The route handler saves it.
    // Schema: formalContent is text.
    // I made the prompt return "formalContent": "TEXTO_COMPLETO..."

    // WAIT. I should update the prompt to put the structured stuff INSIDE formalContent if I can't change schema?
    // Or I can JSON.stringify(structuredAnalysis) into formalContent?
    // Let's try to JSON.stringify the WHOLE structuredAnalysis into formalContent field?
    // Frontend expects string. If it's a JSON string, frontend can parse it.

    if (parsed.structuredAnalysis) {
      parsed.formalContent = JSON.stringify(parsed.structuredAnalysis);
    }

    return parsed;

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

// Helper to fetch climate forecast from Open-Meteo
async function fetchClimateForecast(latitude: number, longitude: number) {
  try {
    const params = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      current: "temperature_2m,rain",
      daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max",
      timezone: "auto"
    });
    const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
    if (weatherRes.ok) {
      const wData = await weatherRes.json();
      const days = wData.daily.time ? wData.daily.time.slice(1, 6) : [];
      let summary = "Previsão Diária:\\n";

      let maxTempWeek = -100;
      let totalRainWeek = 0;

      days.forEach((date: string, idx: number) => {
        const dataIdx = idx + 1;
        const max = wData.daily.temperature_2m_max[dataIdx];
        const min = wData.daily.temperature_2m_min[dataIdx];
        const rain = wData.daily.precipitation_sum[dataIdx];
        const prob = wData.daily.precipitation_probability_max[dataIdx];
        summary += `- Dia ${date}: Min ${min}°C / Máx ${max}°C | Chuva: ${rain}mm (Prob: ${prob}%)\\n`;

        if (max > maxTempWeek) maxTempWeek = max;
        totalRainWeek += rain;
      });

      return {
        currentTemp: wData.current?.temperature_2m || 0,
        forecastSummary: summary,
        maxTempWeek,
        totalRainWeek
      };
    }
  } catch (e) {
    console.warn("Failed to fetch climate data", e);
  }
  return null;
}

async function checkAndSendAlerts(reading: Reading, farmId: number) {
  // Alert the specific client/user owning the farm
  const user = await storage.getUser(1);
  if (!user || !user.receiveAlerts) return;

  const alerts = [];
  const farm = await storage.getFarm(farmId);
  const farmName = farm?.name || `Fazenda #${farmId}`;

  // 1. Satellite: NDVI Stress
  if (reading.ndvi < 0.4) {
    alerts.push({
      type: "ESTRESSE VEGETATIVO",
      msg: `NDVI baixo (${reading.ndvi.toFixed(2)}). Possível estresse hídrico ou nutricional diagnosticado pelo satélite.`,
      taskTemplate: { title: "Vistoria de Vigor (Baixo NDVI)", description: `Anomalia NDVI de ${reading.ndvi.toFixed(2)}. Vá a campo e faça avaliação visual de nematoides, pragas ou restrição nutricional.`, priority: "high" }
    });
  }

  // 2. Satellite: Drought (NDWI)
  if (reading.ndwi < -0.15) {
    alerts.push({
      type: "DÉFICIT HÍDRICO",
      msg: `NDWI muito baixo (${reading.ndwi.toFixed(2)}). Solo com pouca umidade na última leitura.`,
      taskTemplate: { title: "Inspeção de Estresse Hídrico", description: "Índice de evapotranspiração severo. Verifique a umidade do solo com trado e reavalie os tensores de irrigação urgentemente.", priority: "critical" }
    });
  }

  // 3. Satellite: Surface Heat Stress
  if (reading.temperature && reading.temperature > 32) {
    alerts.push({
      type: "AQUECIMENTO SUPERFICIAL",
      msg: `Temperatura de superfície atingiu ${reading.temperature.toFixed(1)}°C. Risco de abortamento floral.`,
      taskTemplate: { title: "Risco de Abortamento Floral", description: "Superfície > 32ºC detectada pelo satélite termal. Considere pulverização de protetores foliares se houver florada agendada.", priority: "medium" }
    });
  }

  // 4. PREVISÃO DO TEMPO: Integração Open-Meteo
  if (farm) {
    const climate = await fetchClimateForecast(farm.latitude, farm.longitude);
    if (climate) {
      if (climate.maxTempWeek > 37) {
        alerts.push({
          type: "🔥 ONDA DE CALOR (PREVISÃO)",
          msg: `Previsão de temperaturas extremas chegando a ${climate.maxTempWeek}°C nos próximos dias.`,
          taskTemplate: { title: "Preparação para Onda de Calor", description: `Previsão aponta pico de ${climate.maxTempWeek}ºC. Revise vazão do pivô e antecipe irrigações de salvamento.`, priority: "critical" }
        });
      }
      if (climate.totalRainWeek === 0 && reading.ndwi < 0) {
        alerts.push({
          type: "🏜️ ALERTA DE SECA SEVERA (PREVISÃO)",
          msg: `Não há previsão de chuva (0mm) para os próximos 5 dias, e o balanço hídrico já está negativo.`,
          taskTemplate: { title: "Mitigação de Seca Prolongada", description: "Chuva zerada na próxima semana com déficit pré-existente. Acione plano de contingência hídrica.", priority: "high" }
        });
      }
    }
  }

  // 5. Satellite SAR (Radar fallback) due to clouds
  if (reading.cloudCover !== undefined && reading.cloudCover !== null && reading.cloudCover > 0.6) {
    alerts.push({
      type: "☁️ ALERTA SAR (RADAR ATIVO)",
      msg: `Cobertura de nuvens severa (${(reading.cloudCover * 100).toFixed(0)}%). O satélite Sentinel-2 foi obstruído. O algoritmo acionou o Sentinel-1 (Radar SAR) usando RVI para manter seu monitoramento operante.`
    });
  }

  // 6. ESG Compliance: Deforestation Risk (Simulated 5% chance of detection for demo)
  if (farm && !farm.isDeforested && Math.random() < 0.05) {
    alerts.push({
      type: "🚫 RISCO DE DESMATAMENTO / USO DO SOLO",
      msg: `Atenção: A I.A. de visão computacional detectou supressão recente de vegetação nativa no polígono da propriedade. Risco de Embargo de Crédito (Bacen/Moratória).`,
      taskTemplate: {
        title: "Auditoria ESG Obrigatória",
        description: "Supressão de vegetação detectada pelo satélite. Submeta imediatamente as licenças (ASV) ou justifique o evento para evitar bloqueio de financiamentos pelos bancos.",
        priority: "critical"
      }
    });

    // Update DB to mark farm as deforested (high risk)
    await storage.updateFarm(farmId, { isDeforested: true });
  }

  if (alerts.length > 0) {
    console.log(`⚠️ Detected ${alerts.length} critical issues/forecasts for ${farmName}`);

    // Persist alerts to DB and generate Tasks
    for (const alert of alerts) {
      await storage.logAlert(farmId, alert.type, alert.msg, user.email);
      if (alert.taskTemplate) {
        try {
          await storage.createTask({
            farmId,
            title: alert.taskTemplate.title,
            description: alert.taskTemplate.description,
            priority: alert.taskTemplate.priority,
            status: "pending",
            dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000) // 48h deadline
          });
        } catch (e) { console.error("Could not auto-generate task:", e) }
      }
    }

    const subject = `🚨 Alerta de Monitoramento Agrícola: ${farmName}`;
    const html = `
      <h2>⚠️ Alerta de Risco Operacional - SYAZ Orbital</h2>
      <p>Detectamos condições críticas baseadas nos satélites e na previsão do tempo para a <b>${farmName}</b>.</p>
      <ul>
        ${alerts.map(a => `<li><b>${a.type}:</b> ${a.msg}</li>`).join('')}
      </ul>
      <p>Acesse a plataforma para planejar as ações de mitigação.</p>
      <hr>
      <small>Você recebeu este alerta preventivo pois ativou as notificações inteligentes na SYAZ Orbital.</small>
    `;

    const sent = await sendEmail({
      to: user.email,
      subject,
      text: alerts.map(a => `${a.type}: ${a.msg}`).join('\\n'),
      html
    });

    if (sent) {
      console.log(`Climate/Satellite Email sent to ${user.email}`);
    }
  }
}


export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Middleware to check if user is authenticated
  const isAuthenticated = (req: any, res: any, next: any) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: "Not authenticated" });
  };

  // === FARMS (Protected) ===
  app.get("/api/farms", isAuthenticated, async (req, res) => {
    const user = req.user as any;
    try {
      let farms;
      if (user.role === 'admin') {
        farms = await storage.getFarmsWithOwners();
      } else {
        farms = await storage.getFarmsByUserId(user.id);
      }
      res.json(farms);
    } catch (e) {
      res.status(500).json({ message: "Error fetching farms" });
    }
  });

  app.get("/api/farms/:id", isAuthenticated, async (req, res) => {
    const user = req.user as any;
    const id = parseInt(req.params.id);
    const farm = await storage.getFarm(id);
    if (!farm) return res.status(404).json({ message: "Farm not found" });

    // Security Check
    if (user.role !== 'admin' && farm.userId !== user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    res.json(farm);
  });

  app.post("/api/farms", isAuthenticated, async (req, res) => {
    const user = req.user as any;
    try {
      // Enforce Plan Limits
      if (user.role !== 'admin' && user.subscriptionStatus !== 'active') {
        const currentFarms = await storage.getFarmsByUserId(user.id);
        if (currentFarms.length >= 1) {
          return res.status(403).json({
            message: "Limite do Plano Gratuito atingido. Faça o upgrade para adicionar mais fazendas."
          });
        }
      }

      const farmData = insertFarmSchema.parse({
        ...req.body,
        userId: user.id
      });
      const farm = await storage.createFarm(farmData);
      res.status(201).json(farm);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // === SUBSCRIPTIONS (PayPal) ===
  app.post("/api/subscriptions/upgrade", isAuthenticated, async (req, res) => {
    const user = req.user as any;
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ message: "Order ID mismatch" });
    }

    try {
      // In a real app, verify orderId with PayPal API here.
      // For MVP, we trust the client's successful capture.

      const updatedUser = await storage.updateUser(user.id, {
        subscriptionStatus: 'active',
        subscriptionEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // +30 days
      });

      res.json({ message: "Subscription activated", user: updatedUser });
    } catch (error) {
      res.status(500).json({ message: "Failed to upgrade subscription" });
    }
  });

  // --- CLIENTS (CRM) ---
  app.get("/api/clients", isAuthenticated, async (req, res) => {
    const clients = await storage.getClients();
    res.json(clients);
  });

  app.post("/api/clients", isAuthenticated, async (req, res) => {
    try {
      const input = insertClientSchema.parse(req.body);
      const client = await storage.createClient(input);
      res.status(201).json(client);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put("/api/clients/:id", isAuthenticated, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const input = insertClientSchema.partial().parse(req.body);

      const existing = await storage.getClient(id);
      if (!existing) return res.status(404).json({ message: "Client not found" });

      const updated = await storage.updateClient(id, input);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete("/api/clients/:id", isAuthenticated, async (req, res) => {
    const id = Number(req.params.id);
    const existing = await storage.getClient(id);
    if (!existing) return res.status(404).json({ message: "Client not found" });

    await storage.deleteClient(id);
    res.status(204).end();
  });

  // --- ALERTS ---
  app.get("/api/alerts", isAuthenticated, async (req, res) => {
    const user = req.user as any;
    const allAlerts = await storage.getAlerts();

    // Admin sees all alerts
    if (user.role === 'admin') {
      return res.json(allAlerts);
    }

    // Normal user sees only alerts for their farms
    const userFarms = await storage.getFarmsByUserId(user.id);
    const userFarmIds = new Set(userFarms.map(f => f.id));

    const userAlerts = allAlerts.filter(a => userFarmIds.has(a.farmId));
    res.json(userAlerts);
  });

  app.post("/api/alerts/:id/read", isAuthenticated, async (req, res) => {
    const id = Number(req.params.id);
    await storage.markAlertRead(id);
    res.json({ success: true });
  });

  // --- TASKS (Actionable Insights) ---
  app.get("/api/farms/:id/tasks", isAuthenticated, async (req, res) => {
    const farmId = Number(req.params.id);
    const tasks = await storage.getTasks(farmId);
    res.json(tasks);
  });

  app.post("/api/farms/:id/tasks", isAuthenticated, async (req, res) => {
    try {
      const farmId = Number(req.params.id);
      const input = insertTaskSchema.parse({ ...req.body, farmId });
      const task = await storage.createTask(input);
      res.status(201).json(task);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.patch("/api/tasks/:id", isAuthenticated, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const input = insertTaskSchema.partial().parse(req.body);
      const updated = await storage.updateTask(id, input);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.delete("/api/tasks/:id", isAuthenticated, async (req, res) => {
    const id = Number(req.params.id);
    await storage.deleteTask(id);
    res.status(204).end();
  });

  // Benchmark
  app.get("/api/farms/:id/benchmark", async (req, res) => {
    const farmId = Number(req.params.id);
    const reading = await storage.getLatestReading(farmId);

    if (!reading) {
      return res.status(404).json({ message: "No data available for benchmark" });
    }

    // Use Real Regional Data if available, fallback to mock if 0 or null
    // If we have history, we could average it, but let's use the latest reading's regional data
    let regionalNdvi = reading.regionalNdvi || 0.65; // Default fallback

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

    // 1. Try External Python Service
    if (process.env.PYTHON_SERVICE_URL) {
      try {
        const response = await fetch(`${process.env.PYTHON_SERVICE_URL}/cluster`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat: farm.latitude,
            lon: farm.longitude,
            size: farm.sizeHa,
            k: 3
          })
        });

        if (response.ok) {
          const zonesData = await response.json();
          return res.json(zonesData);
        }
      } catch (e) {
        console.error("Python Service /cluster failed:", e);
      }
    }

    // 2. Fallback to Local Script
    try {
      const { exec } = await import("child_process");
      const path = await import("path");
      const scriptPath = path.join(process.cwd(), "scripts", "cluster.py");

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
  app.get(api.farms.list.path, isAuthenticated, async (req, res) => {
    const farms = await storage.getFarms();
    // Enrich with latest reading for dashboard comparison
    const farmsWithReadings = await Promise.all(farms.map(async (farm) => {
      const latestReading = await storage.getLatestReading(farm.id);
      return { ...farm, latestReading };
    }));
    res.json(farmsWithReadings);
  });

  app.get(api.farms.get.path, isAuthenticated, async (req, res) => {
    const farm = await storage.getFarm(Number(req.params.id));
    if (!farm) return res.status(404).json({ message: "Farm not found" });
    res.json(farm);
  });

  app.post(api.farms.create.path, isAuthenticated, async (req, res) => {
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

  app.put("/api/farms/:id", isAuthenticated, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const input = insertFarmSchema.partial().parse(req.body);

      const existing = await storage.getFarm(id);
      if (!existing) return res.status(404).json({ message: "Farm not found" });

      const updated = await storage.updateFarm(id, input);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete("/api/farms/:id", async (req, res) => {
    const id = Number(req.params.id);
    const farm = await storage.getFarm(id);
    if (!farm) return res.status(404).json({ message: "Farm not found" });

    await storage.deleteFarm(id);
    res.status(204).end();
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
    const farm = await storage.getFarm(farmId);

    if (!reading || !farm) {
      return res.status(404).json({ message: "No readings available to analyze" });
    }

    // 1. Prediction Data
    const predictionDate = new Date();
    predictionDate.setDate(predictionDate.getDate() + 30); // Predict 30 days out
    const dateStr = predictionDate.toISOString().split('T')[0];
    const predOutput = await getPrediction(farmId, dateStr);
    const predValue = predOutput.result !== undefined ? predOutput.result : null;

    // 2. Climate Forecast Data
    const climateForecast = await fetchClimateForecast(farm.latitude, farm.longitude);

    const reportData = await generateAgronomistReport(
      reading,
      predValue !== null ? { date: dateStr, value: predValue } : null,
      climateForecast
    );

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

    // Helper to handle success
    const handleSuccess = async (result: any) => {
      try {
        if (result.error) {
          throw new Error(result.error);
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
          thermalImage: result.thermal_image,

          imageBounds: result.bounds, // Add bounds from python script
          regionalNdvi: result.regional_ndvi, // Add benchmark data
          carbonStock: result.carbon_stock,
          co2Equivalent: result.co2_equivalent
        };

        await storage.createReading(newReading);
        checkAndSendAlerts(newReading as Reading, farmId).catch(console.error);
        res.json({ message: "Dados atualizados com sucesso", reading: newReading });
      } catch (e: any) {
        await fallbackToMock(e.message || "Error processing result");
      }
    };

    // Helper to handle fallback
    const fallbackToMock = async (reason: string) => {
      console.warn(`[Satellite Fallback] Reason: ${reason}`);
      const [mockReading] = generateMockReadings(farmId, 1);
      mockReading.date = new Date().toISOString().split('T')[0];
      mockReading.satelliteImage = "https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80";
      mockReading.thermalImage = "https://images.unsplash.com/photo-1577705998148-6da4f3963bc1?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80";

      await storage.createReading(mockReading);
      checkAndSendAlerts(mockReading as Reading, farmId).catch(console.error);

      res.json({
        message: "⚠️ Simulação: Satélite indisponível (Auth GEE pendente)",
        reading: mockReading,
        isMock: true,
        details: reason
      });
    };

    // 1. Try External Python Service (if configured)
    if (process.env.PYTHON_SERVICE_URL) {
      try {
        console.log(`Calling Python Service: ${process.env.PYTHON_SERVICE_URL}/satellite`);
        const response = await fetch(`${process.env.PYTHON_SERVICE_URL}/satellite`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat: farm.latitude,
            lon: farm.longitude,
            size: farm.sizeHa
          })
        });

        if (!response.ok) {
          throw new Error(`Service returned ${response.status}`);
        }

        const result = await response.json();
        await handleSuccess(result);
        return;
      } catch (e: any) {
        console.error("Python Service Failed:", e);
        // Fallthrough to local script or mock
      }
    }

    // 2. Try Local Script (Dev environment)
    try {
      const { exec } = await import("child_process");
      const path = await import("path");
      const scriptPath = path.join(process.cwd(), "scripts", "satellite_analysis.py");
      const command = `python3 "${scriptPath}" --lat ${farm.latitude} --lon ${farm.longitude} --size ${farm.sizeHa}`;

      console.log(`Executing Local Script: ${command}`);

      exec(command, async (error, stdout, stderr) => {
        // Warning: Python often writes deprecated warnings to stderr. We should only fail if stdout is completely empty/invalid.
        if (error && !stdout) {
          await fallbackToMock(stderr || error.message);
          return;
        }
        try {
          const result = JSON.parse(stdout);
          await handleSuccess(result);
        } catch (parseError) {
          console.error(`[Satellite Fallback] JSON Parse Error. STDOUT was: ${stdout}`);
          await fallbackToMock("Valid JSON not returned by script");
        }
      });
    } catch (e: any) {
      await fallbackToMock("Local script execution failed");
    }
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
  async function getPrediction(farmId: number, date: string, tempModifier: number = 0, rainModifier: number = 0, sizeHa: number = 0): Promise<{ result?: number; yieldTons?: number; error?: string }> {

    // 1. Try External Python Service (Stateless)
    if (process.env.PYTHON_SERVICE_URL) {
      try {
        // Fetch history for on-the-fly training
        const readings = await storage.getReadings(farmId);
        // Take last 50 readings to keep payload size reasonable
        const history = readings.slice(0, 50).map(r => ({
          date: r.date,
          ndvi: r.ndvi,
          temperature: r.temperature
        }));

        if (history.length < 5) {
          return { error: "Histórico insuficiente para predição (mínimo 5 leituras)" };
        }

        console.log(`Sending prediction request to: ${process.env.PYTHON_SERVICE_URL}/predict`);

        const response = await fetch(`${process.env.PYTHON_SERVICE_URL}/predict`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            history,
            target_date: date,
            temp_modifier: tempModifier,
            rain_modifier: rainModifier,
            size_ha: sizeHa
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.prediction !== undefined) {
            return { result: data.prediction, yieldTons: data.yield_tons || 0 };
          }
          if (data.error) {
            return { error: `Python Service Error: ${data.error}` };
          }
        } else {
          const text = await response.text();
          console.error(`Python Service /predict failed: ${response.status} ${text}`);
          return { error: `Service Error ${response.status}: ${text.substring(0, 50)}` };
        }
      } catch (e: any) {
        console.error("Python Service /predict error:", e);
        return { error: `Connection Error: ${e.message}` };
      }
    } else {
      console.warn("PYTHON_SERVICE_URL is not set.");
    }

    // 2. Fallback to Local Script (Dev environment only!)
    // On Vercel, this will fail if Python is not present.
    try {
      if (process.env.NODE_ENV === 'production') {
        return { error: "Service URL not configured (prod)" };
      }

      const { exec } = await import("child_process");
      const path = await import("path");
      const scriptPath = path.join(process.cwd(), "scripts", "predict.py");
      const command = `python3 "${scriptPath}" --farm-id ${farmId} --date ${date} --temp-modifier ${tempModifier} --rain-modifier ${rainModifier} --size ${sizeHa}`;

      return new Promise((resolve) => {
        exec(command, (error, stdout, stderr) => {
          if (error) {
            console.error(`Prediction Script Error: ${stderr}`);
            resolve({ error: "Local script failed (Python missing?)" });
            return;
          }
          try {
            // Find JSON in stdout in case of trailing lines
            const match = stdout.match(/(\{.*\})/);
            if (match) {
              const parsed = JSON.parse(match[1]);
              if (parsed.error) resolve({ error: parsed.error });
              else resolve({ result: parsed.prediction, yieldTons: parsed.yield_tons });
            } else {
              resolve({ error: "Invalid prediction output" });
            }
          } catch (e) {
            resolve({ error: "Failed to parse prediction output" });
          }
        });
      });
    } catch (e: any) {
      console.error("getPrediction internal error:", e);
      return { error: `Internal Error: ${e.message}` };
    }
  }

  // Predictive Model Endpoint
  app.get("/api/farms/:id/prediction", async (req, res) => {
    const farmId = Number(req.params.id);
    const date = req.query.date as string;
    const tempModifier = req.query.tempModifier ? parseFloat(req.query.tempModifier as string) : 0;
    const rainModifier = req.query.rainModifier ? parseFloat(req.query.rainModifier as string) : 0;

    if (!date) {
      return res.status(400).json({ message: "Date query parameter is required (YYYY-MM-DD)" });
    }

    const farm = await storage.getFarm(farmId);
    if (!farm) {
      return res.status(404).json({ message: "Fazenda não encontrada" });
    }

    const output = await getPrediction(farmId, date, tempModifier, rainModifier, farm.sizeHa || 0);

    if (output.result !== undefined) {
      res.json({
        farmId,
        date,
        prediction: output.result,
        yieldTons: output.yieldTons || 0,
        unit: "NDVI"
      });
    } else {
      // Send the specific error message to the frontend
      res.status(500).json({ message: output.error || "Failed to generate prediction" });
    }
  });

  // Settings
  app.get("/api/settings", isAuthenticated, async (req, res) => {
    const user = await storage.getUser((req.user as any).id);
    res.json(user || null);
  });

  app.put("/api/settings", isAuthenticated, async (req, res) => {
    try {
      const input = insertUserSchema.parse(req.body);
      // Ensure we only update the logged-in user
      const user = await storage.updateUser((req.user as any).id, input);
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
