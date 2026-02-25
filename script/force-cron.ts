import "../server/env";
import { storage } from "../server/storage";
import { sendEmail, buildWeeklyReportEmailHTML } from "../server/email";
import { syncFarmSatelliteData } from "../server/routes";

async function forceCronSync() {
    console.log(`[Teste Cron] Iniciando Sincronização Automática Forçada Serverless...`);
    const farms = await storage.getFarms();

    // E-mail Admin/Godmode solicitado pelo dono
    const adminEmail = process.env.ADMIN_EMAIL || "yuri.g.l.souza@gmail.com";

    for (const farm of farms) {
        try {
            console.log(`[Teste Cron] Fazenda ${farm.id} (${farm.name}) - Sincronizando...`);

            const result = await syncFarmSatelliteData(farm.id);

            if (result && !result.error && result.reading) {
                const { ndvi, cloudCover, date } = result.reading;
                const status = result.isMock ? "Simulação (Offline)" : "Satélite Sincronizado";

                let ownerEmail: string | null = null;
                if (farm.userId) {
                    const user = await storage.getUser(farm.userId);
                    if (user) ownerEmail = user.email;
                }

                const emailsToNotify = Array.from(new Set([adminEmail, ownerEmail].filter(Boolean) as string[]));
                console.log(`[Teste Cron] Enviando emails para: ${emailsToNotify.join(", ")}`);

                for (const email of emailsToNotify) {
                    try {
                        await sendEmail({
                            to: email,
                            subject: `[TESTE NUvem] Relatório de Satélite: ${farm.name}`,
                            text: `Sincronização concluída para ${farm.name}. NDVI: ${ndvi}`,
                            html: buildWeeklyReportEmailHTML(farm.name, date, { ndvi, cloudCover, status })
                        });
                        console.log(`[Teste Cron] Email enviado para ${email} com sucesso!`);
                    } catch (emailErr) {
                        console.error(`[Teste Cron] Erro ao enviar email para ${email}:`, emailErr);
                    }
                }
            } else {
                console.error(`[Teste Cron] Falha na Sincronização (Fazenda ${farm.id}):`, result?.error || result?.message || "Erro desconhecido");
            }
        } catch (error) {
            console.error(`[Teste Cron] Erro Operacional - Fazenda ${farm.id}:`, error);
        }

        await new Promise(r => setTimeout(r, 2000));
    }

    console.log(`[Teste Cron] Sincronização Completa.`);
    process.exit(0);
}

forceCronSync();
