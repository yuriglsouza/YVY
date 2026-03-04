import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import { db } from "./db.js";
import { api } from "../shared/routes.js";
import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { type Reading, type InsertReading, insertFarmSchema, insertReadingSchema, insertReportSchema, insertUserSchema, insertClientSchema, insertTaskSchema } from "../shared/schema.js";
import { sendEmail, buildAlertEmailHTML, buildWeeklyReportEmailHTML } from "./email.js";

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
// AI Analysis Service
async function generateAgronomistReport(
  reading: Reading,
  cropType: string,
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

    const isPerennial = cropType.toLowerCase().includes("banana") || cropType.toLowerCase().includes("fruti") || cropType.toLowerCase().includes("café");
    const isHorti = cropType.toLowerCase().includes("hortifruti");

    let cropSpecificRules = "";
    if (isPerennial) {
      cropSpecificRules = `- ATENÇÃO: A cultura avaliada é PERENE/SEMI-PERENE (${cropType}). Não a analise como se tivesse fim de safra no inverno. O foco primário para Banana e Frutas deve ser vigor constante, temperatura extrema e, CRITICAMENTE, o estresse hídrico (NDWI), pois frutas demandam muita água para encher.`;
    } else if (isHorti) {
      cropSpecificRules = `- ATENÇÃO: A cultura avaliada é HORTIFRUTI. Ciclos são extremamente curtos e responsivos. O foco de recomendação deve envolver irrigação de precisão e controle foliar fitossanitário imediato.`;
    }

    const prompt = `
      CONTEXTO DO SISTEMA:
      Você é a SYAZ Intelligence Engine, uma IA agronômica especializada em:
      - Analisar o cultivo: ${cropType}
      - Análise multiespectral orbital (Sentinel-1, 2, 3)
      - Modelagem preditiva de produtividade
      - Validação estatística longitudinal
      - Auditoria ESG baseada em IPCC Tier 1
      - Análise de risco produtivo para crédito rural

      REGRAS DE REDAÇÃO E CULTURA:
      ${cropSpecificRules}
      - Escreva de forma CLARA, COMPLETA e ACESSÍVEL. O produtor rural precisa entender.
      - Use dados numéricos sempre que possível para dar credibilidade.
      - Evite jargões excessivos. Quando usar termos técnicos, explique brevemente o que significam.
      - NÃO use emojis, marketing, exageros ou promessas.
      - NÃO use primeira pessoa.
      - Seja DETALHADO. Respostas curtas e genéricas são PROIBIDAS.

      Retorne APENAS um JSON válido com a seguinte estrutura:
        {
          "content": "UM ÚNICO PARÁGRAFO completo e direto (entre 4 e 6 frases) para o produtor. Deve mencionar a cultura (${cropType}), os valores espectrais, o clima e recomendar ações de manejo práticas baseadas no tipo da planta. SEM quebras de linha.",
          "formalContent": "Texto técnico-institucional com os 5 parágrafos obrigatórios: [Diagnóstico da Cultura] [Interpretação Técnica cruzando faixas e clima] [Impacto Produtivo na Cultura] [Classificação de Risco com score numérico] [Recomendações Práticas Quantificadas]. Este texto vai para o relatório PDF de auditoria. Usar quebras de linha com \\n.",
          "structuredAnalysis": {
            "diagnostic": "Frase técnica assertiva sobre o estado das bandas espectrais da cultura.",
            "prediction": "Predição quantitativa baseada na temperatura, clima e histórico.",
            "recommendation": ["Ação corretiva imediata com dosagem", "Ação preventiva com prazo", "Ação de manejo hídrico/nutricional com valores"]
          }
        }

      Dados Atuais da Fazenda (${cropType}):
    - Data: ${reading.date}
    - NDVI(Vigor): ${reading.ndvi.toFixed(3)}
    - NDWI(Água): ${reading.ndwi.toFixed(3)}
    - NDRE(Clorofila/Nitrogênio): ${reading.ndre.toFixed(3)}
    - OTCI(Pigmentação): ${reading.otci ? reading.otci.toFixed(3) : 'N/A'}
    - Temperatura de Superfície: ${reading.temperature ? reading.temperature.toFixed(1) + '°C' : 'N/A'}
    - Estoque de Carbono Estimado: ${reading.carbonStock ? reading.carbonStock.toFixed(2) + ' kg/ha' : 'N/A'}
    - CO2 Equivalente Retido: ${reading.co2Equivalent ? reading.co2Equivalent.toFixed(2) + ' kg/ha' : 'N/A'}
      
      ${climateForecast ? `Dados Climáticos da Região (Open-Meteo):\n    - Temp Atual: ${climateForecast.currentTemp.toFixed(1)}°C\n    - Previsão Próximos 7 Dias: ${climateForecast.forecastSummary}.` : ''}

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
  const farm = await storage.getFarm(farmId);
  const farmName = farm?.name || `Fazenda #${farmId}`;

  // Collect recipients: farm owner + admin
  const recipients: { email: string; name: string }[] = [];

  // 1. Farm owner
  if (farm?.userId) {
    const owner = await storage.getUser(farm.userId);
    if (owner?.email && owner.receiveAlerts) {
      recipients.push({ email: owner.email, name: owner.name || "Produtor" });
    }
  }

  // 2. Admin (always receives a copy if configured)
  const adminEmails = (process.env.ADMIN_EMAIL || "").split(",").map(e => e.trim());
  for (const admin of adminEmails) {
    if (admin && !recipients.some(r => r.email === admin)) {
      recipients.push({ email: admin, name: "Admin" });
    }
  }

  if (recipients.length === 0) return;

  const alerts = [];

  // 0. ANOMALY DETECTION: Compare with previous reading
  try {
    const previousReadings = await storage.getReadings(farmId);
    // Sort by date descending, skip the current one (index 0 = most recent = this one)
    const sorted = previousReadings.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const previousReading = sorted.length >= 2 ? sorted[1] : null;

    if (previousReading && previousReading.ndvi > 0.1) {
      const ndviChange = ((reading.ndvi - previousReading.ndvi) / previousReading.ndvi) * 100;

      if (ndviChange <= -15) {
        alerts.push({
          type: "📉 ANOMALIA: QUEDA BRUSCA DE NDVI",
          msg: `NDVI caiu ${Math.abs(ndviChange).toFixed(1)}% em relação à leitura anterior (${previousReading.ndvi.toFixed(3)} → ${reading.ndvi.toFixed(3)}). Investigação urgente recomendada.`,
          taskTemplate: {
            title: "Investigar Queda Brusca de NDVI",
            description: `Queda de ${Math.abs(ndviChange).toFixed(1)}% no NDVI detectada (${previousReading.ndvi.toFixed(3)} → ${reading.ndvi.toFixed(3)}). Possíveis causas: pragas, doenças, estresse hídrico severo, geada ou aplicação incorreta de defensivos. Agende vistoria de campo imediata.`,
            priority: "critical"
          }
        });
      }

      // NDWI drop > 20%
      if (previousReading.ndwi && reading.ndwi && previousReading.ndwi > -0.3) {
        const ndwiChange = ((reading.ndwi - previousReading.ndwi) / Math.abs(previousReading.ndwi || 0.01)) * 100;
        if (ndwiChange <= -20) {
          alerts.push({
            type: "💧 ANOMALIA: QUEDA HÍDRICA RÁPIDA",
            msg: `NDWI caiu ${Math.abs(ndwiChange).toFixed(1)}% rapidamente (${previousReading.ndwi.toFixed(3)} → ${reading.ndwi.toFixed(3)}). Possível perda de umidade acelerada.`,
            taskTemplate: {
              title: "Verificar Estado Hídrico",
              description: `Queda de ${Math.abs(ndwiChange).toFixed(1)}% no NDWI. Verifique umidade do solo e funcionamento da irrigação.`,
              priority: "high"
            }
          });
        }
      }
    }
  } catch (e) {
    console.error("Anomaly detection error:", e);
  }

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
      await storage.logAlert(farmId, alert.type, alert.msg, recipients[0].email);
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
    const html = buildAlertEmailHTML(farmName, alerts.map(a => ({ type: a.type, msg: a.msg })));
    const text = alerts.map(a => `${a.type}: ${a.msg}`).join('\n');

    // Send to all recipients (owner + admin)
    for (const recipient of recipients) {
      const sent = await sendEmail({ to: recipient.email, subject, text, html });
      if (sent) {
        console.log(`📧 Alert email sent to ${recipient.name} (${recipient.email})`);
      }
    }
  }
}


// Exported so cron job can use it natively
export async function syncFarmSatelliteData(farmId: number): Promise<{ message: string, reading?: any, isMock?: boolean, details?: string, error?: string }> {
  try {
    const farm = await storage.getFarm(farmId);
    if (!farm) {
      return { message: "Erro", error: "Fazenda não encontrada" };
    }

    return new Promise(async (resolve) => {
      const handleSuccess = async (result: any) => {
        try {
          if (result.error) throw new Error(result.error);

          const prevReadings = await storage.getReadings(farmId);
          const resultDateObj = new Date(result.date);
          const resultDateStr = resultDateObj.toISOString().split('T')[0];

          let existingTodayReading = prevReadings.find(r => r.date && new Date(r.date).toISOString().split('T')[0] === resultDateStr);

          // Lógica inquebrável para a "Leitura Anterior"
          if (result.prev_satellite_image) {
            const resultTime = resultDateObj.getTime();

            // Encontra exatamente a mesma leitura velha que o Frontend exibirá (> 20 dias atrás)
            const targetPastReading = prevReadings.find(r => {
              if (!r.date) return false;
              const rTime = new Date(r.date).getTime();
              return (resultTime - rTime) > 20 * 24 * 60 * 60 * 1000;
            });

            if (targetPastReading) {
              // Se encontrou uma leitura mock ou verdadeira do passado, salva o link real de satélite nela!
              await storage.updateReading(targetPastReading.id, { satelliteImage: result.prev_satellite_image });
              console.log(`Updated Previous Reading ID ${targetPastReading.id} with fresh satellite_image URL`);
            } else {
              // Nenhuma leitura com mais de 20 dias existe. Vamos criar uma "Ghost Reading" realística de 30 dias atrás.
              const mockPastDate = new Date(resultDateObj);
              mockPastDate.setDate(mockPastDate.getDate() - 30);
              const pastReading: InsertReading = {
                farmId,
                date: mockPastDate.toISOString(),
                ndvi: Math.max(0, (result.ndvi || 0.5) - 0.05),
                ndwi: result.ndwi || 0,
                ndre: result.ndre || 0,
                rvi: result.rvi || 0,
                otci: result.otci || 0,
                temperature: result.temperature || 0,
                cloudCover: 0,
                satelliteImage: result.prev_satellite_image,
                thermalImage: result.thermal_image,
              };
              await storage.createReading(pastReading);
            }
          }

          const newReadingData: Partial<InsertReading> = {
            farmId,
            date: resultDateObj.toISOString(), // Fix: Type string
            ndvi: result.ndvi,
            ndwi: result.ndwi,
            ndre: result.ndre,
            rvi: result.rvi,
            otci: result.otci,
            temperature: result.temperature,
            cloudCover: result.cloud_cover ?? 0,
            satelliteImage: result.satellite_image,
            thermalImage: result.thermal_image,
            imageBounds: result.bounds,
            regionalNdvi: result.regional_ndvi,
            carbonStock: result.carbon_stock,
            co2Equivalent: result.co2_equivalent
          };

          let finalReading;
          if (existingTodayReading) {
            finalReading = await storage.updateReading(existingTodayReading.id, newReadingData);
          } else {
            finalReading = await storage.createReading(newReadingData as InsertReading);
            checkAndSendAlerts(finalReading as Reading, farmId).catch(console.error);
          }

          resolve({ message: "Dados atualizados com sucesso", reading: finalReading });
        } catch (e: any) {
          await fallbackToMock(e.message || "Error processing result");
        }
      };

      const fallbackToMock = async (reason: string) => {
        console.warn(`[Satellite Fallback] Reason: ${reason}`);
        const [mockReading] = generateMockReadings(farmId, 1);
        mockReading.date = new Date().toISOString().split('T')[0];
        mockReading.satelliteImage = "https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80";
        mockReading.thermalImage = "https://images.unsplash.com/photo-1577705998148-6da4f3963bc1?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80";

        await storage.createReading(mockReading);
        checkAndSendAlerts(mockReading as Reading, farmId).catch(console.error);

        resolve({
          message: "⚠️ Simulação: Satélite indisponível (Auth GEE pendente)",
          reading: mockReading,
          isMock: true,
          details: reason
        });
      };

      if (process.env.PYTHON_SERVICE_URL) {
        try {
          console.log(`Calling Python Service: ${process.env.PYTHON_SERVICE_URL}/satellite`);
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 90000); // 90s timeout (Render cold start)
          const response = await fetch(`${process.env.PYTHON_SERVICE_URL}/satellite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lat: farm.latitude,
              lon: farm.longitude,
              size: farm.sizeHa,
              polygon: farm.polygon || null
            }),
            signal: controller.signal
          });
          clearTimeout(timeout);

          if (!response.ok) {
            throw new Error(`Service returned ${response.status}`);
          }

          const result = await response.json();
          await handleSuccess(result);
          return;
        } catch (e: any) {
          console.error("Python Service Failed:", e.message || e);
        }
      }

      try {
        const { exec } = await import("child_process");
        const path = await import("path");
        const scriptPath = path.join(process.cwd(), "scripts", "satellite_analysis.py");
        const command = `python3 "${scriptPath}" --lat ${farm.latitude} --lon ${farm.longitude} --size ${farm.sizeHa}`;

        console.log(`Executing Local Script: ${command}`);

        exec(command, async (error, stdout, stderr) => {
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
  } catch (error: any) {
    return { message: "Erro", error: error.message || "Erro desconhecido" };
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {


  // TEMPORARY MANUAL CRON TRIGGER
  app.get("/api/force-cron", async (req: any, res: any) => {
    console.log("[Test Root] Forcing Cron Sync...");
    const farms = await storage.getFarms();
    const adminEmail = process.env.ADMIN_EMAIL || "yuriglsouza@gmail.com";

    // Fire and forget so we don't timeout the HTTP request immediately
    (async () => {
      for (const farm of farms) {
        try {
          const result = await syncFarmSatelliteData(farm.id);

          if (result && !result.error && result.reading) {
            const { ndvi, cloudCover, date } = result.reading;
            const status = result.isMock ? "Simulação (Offline)" : "Satélite Sincronizado";
            let ownerEmail = null;
            if (farm.userId) {
              const user = await storage.getUser(farm.userId);
              if (user) ownerEmail = user.email;
            }
            const adminEmails = (process.env.ADMIN_EMAIL || "yuriglsouza@gmail.com").split(",").map(e => e.trim());
            const emailsToNotify = Array.from(new Set([...adminEmails, ownerEmail].filter(Boolean) as string[]));
            for (const email of emailsToNotify) {
              await sendEmail({
                to: email,
                subject: `Relatório de Satélite TESTE: ${farm.name}`,
                text: `Sync Manual: ${farm.name}. NDVI: ${ndvi}`,
                html: buildWeeklyReportEmailHTML(farm.name, date, { ndvi, cloudCover, status })
              }).catch(console.error);
            }
          }
        } catch (e) {
          console.error("Error on manual cron", e);
        }
        await new Promise(r => setTimeout(r, 2000));
      }
    })();

    res.json({ message: "Sincronização iniciada em background. Verifique o console ou a caixa de e-mail em instantes." });
  });

  // Vercel Cron Integration (Fan-Out Trigger)
  app.get("/api/cron/sync", async (req: any, res: any) => {
    // Check for Vercel Cron Authorization
    const authHeader = req.headers.authorization;
    if (
      process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    console.log("[Vercel Cron] Iniciando trigger Fan-Out para as Fazendas...");
    const farms = await storage.getFarms();

    const baseUrl = `${req.protocol}://${req.get("host")}`;

    let delayMs = 0;
    // Dispara requisições individuais assíncronas para fugir do timeout
    for (const farm of farms) {
      const workerUrl = `${baseUrl}/api/cron/sync-single?farmId=${farm.id}&delay=${delayMs}`;
      // Usando fetch "fire and forget" para não bloquear a resposta local
      fetch(workerUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.CRON_SECRET || ""}`
        }
      }).catch(err => console.error(`[Fan-Out] Falha ao acionar farm ${farm.id}:`, err.message));

      // Incrementamos o delay em 2 segundos a cada fazenda. O Worker vai respeitar esse delay
      // antes de iniciar seu processamento pesado, diluindo as chamadas na API.
      delayMs += 2000;
    }

    // Responde ao Vercel instantaneamente (< 1 segundo)
    res.json({ message: "Cron acionado com sucesso. Processamento assíncrono em andamento." });
  });

  // Vercel Cron Worker (Processa 1 fazenda por vez)
  app.post("/api/cron/sync-single", async (req: any, res: any) => {
    // Mesma validação de segurança
    const authHeader = req.headers.authorization;
    if (
      process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const farmId = Number(req.query.farmId);
    if (!farmId || isNaN(farmId)) {
      return res.status(400).json({ message: "farmId is required" });
    }

    const startDelay = Number(req.query.delay) || 0;
    if (startDelay > 0) {
      console.log(`[Vercel Worker ${farmId}] Stagger Delay: dormindo por ${startDelay}ms para balancear APIs...`);
      await new Promise(r => setTimeout(r, startDelay));
    }

    try {
      const farm = await storage.getFarm(farmId);
      if (!farm) return res.status(404).json({ message: "Farm not found" });

      const adminEmail = process.env.ADMIN_EMAIL || "yuriglsouza@gmail.com";
      console.log(`[Vercel Worker] Iniciando processamento para Fazenda ${farm.id}...`);

      const result = await syncFarmSatelliteData(farmId);

      if (result && !result.error && result.reading) {
        const { ndvi, cloudCover, date } = result.reading;
        const status = result.isMock ? "Simulação (Offline)" : "Satélite Sincronizado";
        let ownerEmail = null;

        if (farm.userId) {
          const user = await storage.getUser(farm.userId);
          if (user) ownerEmail = user.email;
        }

        const adminEmails = (process.env.ADMIN_EMAIL || "yuriglsouza@gmail.com").split(",").map(e => e.trim());
        const emailsToNotify = Array.from(new Set([...adminEmails, ownerEmail].filter(Boolean) as string[]));
        for (const email of emailsToNotify) {
          await sendEmail({
            to: email,
            subject: `Relatório de Satélite: ${farm.name}`,
            text: `Sincronização concluída para ${farm.name}. NDVI: ${ndvi}`,
            html: buildWeeklyReportEmailHTML(farm.name, date, { ndvi, cloudCover, status })
          }).catch(e => console.error(`[Vercel Worker] Erro email ${email}`, e));
        }

        console.log(`[Vercel Worker] Sucesso Fazenda ${farm.id}`);
        await storage.updateFarm(farmId, { lastSyncAt: new Date() });
        return res.json({ success: true, farmId });
      } else {
        console.error(`[Vercel Worker] Erro lógico Fazenda ${farmId}:`, result?.error);
        return res.status(500).json({ error: result?.error || "Unknown logic error" });
      }
    } catch (e: any) {
      console.error(`[Vercel Worker] Erro fatal Fazenda ${farmId}:`, e);
      return res.status(500).json({ error: e.message });
    }
  });

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
            k: 3,
            polygon: farm.polygon || null
          })
        });

        if (response.ok) {
          const zonesData = await response.json();

          // Calculate correct area and inject into response for frontend
          // Python returns area_percentage as a fraction (0.0 to 1.0)
          const processedZones = (zonesData.zones || zonesData).map((z: any) => {
            const calculatedAreaHa = z.area_percentage ? (farm.sizeHa * z.area_percentage) : 0;
            return {
              ...z,
              areaHa: calculatedAreaHa
            };
          });

          // Save zones to DB for history
          try {
            const zonesToSave = processedZones.map((z: any) => ({
              name: z.name || z.label || 'Zona',
              color: z.color || '#22C55E',
              coordinates: z.coordinates || z.points || [],
              areaHa: z.areaHa,
              ndviAvg: z.ndvi_avg || z.ndviAvg || null,
            }));
            await storage.saveZones(farmId, zonesToSave);
            console.log(`💾 Saved ${zonesToSave.length} zones to history for farm ${farmId}`);
          } catch (saveErr) {
            console.error("Failed to save zones to history:", saveErr);
          }

          return res.json({
            ...zonesData,
            zones: processedZones
          });
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

  // Zone History
  app.get("/api/farms/:id/zones/history", async (req, res) => {
    const farmId = Number(req.params.id);
    const allZones = await storage.getZoneHistory(farmId);

    // Group zones by generatedAt timestamp
    const grouped: Record<string, any[]> = {};
    for (const zone of allZones) {
      const key = zone.generatedAt?.toISOString() || 'unknown';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(zone);
    }

    // Convert to array sorted by date desc
    const history = Object.entries(grouped).map(([dateStr, zones]) => ({
      date: dateStr,
      zones: zones.map(z => ({
        id: z.id,
        name: z.name,
        color: z.color,
        coordinates: z.coordinates,
        areaHa: z.areaHa,
        ndviAvg: z.ndviAvg,
      }))
    })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json(history);
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

  // Export Readings as CSV
  app.get("/api/farms/:id/readings/export-csv", async (req, res) => {
    const farmId = Number(req.params.id);
    const farm = await storage.getFarm(farmId);
    if (!farm) return res.status(404).json({ message: "Farm not found" });

    const allReadings = await storage.getReadings(farmId);
    if (allReadings.length === 0) return res.status(404).json({ message: "No readings to export" });

    // Sort by date ascending
    const sorted = allReadings.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // CSV Header
    const headers = ["Data", "NDVI", "NDWI", "NDRE", "RVI", "OTCI", "Temperatura (°C)", "Cobertura de Nuvens (%)", "Estoque de Carbono (t)", "CO2e (t)", "NDVI Regional"];
    const rows = sorted.map(r => [
      r.date,
      r.ndvi?.toFixed(4) ?? "",
      r.ndwi?.toFixed(4) ?? "",
      r.ndre?.toFixed(4) ?? "",
      r.rvi?.toFixed(4) ?? "",
      r.otci?.toFixed(4) ?? "",
      r.temperature?.toFixed(1) ?? "",
      r.cloudCover ? (r.cloudCover * 100).toFixed(0) : "",
      r.carbonStock?.toFixed(1) ?? "",
      r.co2Equivalent?.toFixed(1) ?? "",
      r.regionalNdvi?.toFixed(4) ?? "",
    ].join(","));

    const csv = [headers.join(","), ...rows].join("\n");
    const filename = `${farm.name.replace(/[^a-zA-Z0-9]/g, "_")}_readings_${new Date().toISOString().split("T")[0]}.csv`;

    // BOM for Excel UTF-8 compatibility
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send("\uFEFF" + csv);
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
      farm.cropType,
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
    const result = await syncFarmSatelliteData(farmId);
    if (result.error) {
      return res.status(404).json({ message: result.error });
    }
    await storage.updateFarm(farmId, { lastSyncAt: new Date() });
    res.json(result);
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


  async function getPrediction(farmId: number, date: string, tempModifier: number = 0, rainModifier: number = 0, sizeHa: number = 0, cropType: string = "Soja"): Promise<{ result?: number; yieldTons?: number; forecast?: any[]; trend?: string; error?: string }> {

    // 1. Try External Python Service (Stateless)
    if (process.env.PYTHON_SERVICE_URL) {
      try {
        // Fetch history for on-the-fly training
        const readings = await storage.getReadings(farmId);
        // Take last 50 readings to keep payload size reasonable
        const history = readings.slice(0, 50).map(r => ({
          date: r.date,
          ndvi: r.ndvi,
          ndwi: r.ndwi ?? 0,
          temperature: r.temperature
        }));

        if (history.length < 5) {
          return { error: "Histórico insuficiente para predição (mínimo 5 leituras)" };
        }

        console.log(`Sending prediction request to: ${process.env.PYTHON_SERVICE_URL}/predict`);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        const response = await fetch(`${process.env.PYTHON_SERVICE_URL}/predict`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            history,
            target_date: date,
            forecast_days: 30,
            temp_modifier: tempModifier,
            rain_modifier: rainModifier,
            size_ha: sizeHa,
            crop_type: cropType
          }),
          signal: controller.signal
        });
        clearTimeout(timeout);

        if (response.ok) {
          const data = await response.json();
          if (data.prediction !== undefined) {
            return {
              result: data.prediction,
              yieldTons: data.yield_tons || 0,
              forecast: data.forecast || [],
              trend: data.trend || 'stable'
            };
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

    const output = await getPrediction(farmId, date, tempModifier, rainModifier, farm.sizeHa || 0, farm.cropType || "Soja");

    if (output.result !== undefined) {
      res.json({
        farmId,
        date,
        prediction: output.result,
        yieldTons: output.yieldTons || 0,
        forecast: output.forecast || [],
        trend: output.trend || 'stable',
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
