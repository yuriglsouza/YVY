import cron from "node-cron";
import { storage } from "./storage.js";
import { sendEmail, buildWeeklyReportEmailHTML } from "./email.js";
import { syncFarmSatelliteData } from "./routes.js";

export function setupCronJobs() {
    // Agendamento: Segundas e Quintas às 06:00
    // String cron: Minuto Hora DiaMes Mês DiaSemana
    cron.schedule("0 6 * * 1,4", async () => {
        console.log(`[Cron] Iniciando Sincronização Automática Agendada...`);
        const farms = await storage.getFarms();

        // E-mail Admin/Godmode solicitado pelo dono
        const adminEmail = process.env.ADMIN_EMAIL || "yuriglsouza@gmail.com";

        for (const farm of farms) {
            try {
                console.log(`[Cron] Fazenda ${farm.id} (${farm.name}) - Sincronizando (Nuvem)...`);

                // Chamada direta à abstração sem depender de networking HTTP
                const result = await syncFarmSatelliteData(farm.id);

                if (result && !result.error && result.reading) {
                    const { ndvi, cloudCover, date } = result.reading;
                    const status = result.isMock ? "Simulação (Offline)" : "Satélite Sincronizado";

                    let ownerEmail: string | null = null;
                    if (farm.userId) {
                        const user = await storage.getUser(farm.userId);
                        if (user) ownerEmail = user.email;
                    }

                    // Lista deduplicada de e-mails pra não enviar 2x
                    const emailsToNotify = Array.from(new Set([adminEmail, ownerEmail].filter(Boolean) as string[]));

                    for (const email of emailsToNotify) {
                        try {
                            await sendEmail({
                                to: email,
                                subject: `Relatório de Satélite: ${farm.name}`,
                                text: `Sincronização concluída para ${farm.name}. NDVI: ${ndvi}`,
                                html: buildWeeklyReportEmailHTML(farm.name, date, { ndvi, cloudCover, status })
                            });
                        } catch (emailErr) {
                            console.error(`[Cron] Erro ao enviar email para ${email}:`, emailErr);
                        }
                    }
                } else {
                    console.error(`[Cron] Falha na Sincronização Interna (Fazenda ${farm.id}):`, result?.error || result?.message || "Erro omitido.");
                }
            } catch (error) {
                console.error(`[Cron] Erro Operacional - Fazenda ${farm.id}:`, error);
            }

            // Pausa de 5 segundos entre as fazendas para evitar Rate Limit das APIs de Satélite
            await new Promise(r => setTimeout(r, 5000));
        }

        console.log(`[Cron] Sincronização Completa.`);
    });

    console.log("[Cron] Job de Sincronização Agendado (Segundas e Quintas às 06h00).");
}
