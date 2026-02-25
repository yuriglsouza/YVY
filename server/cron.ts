import cron from "node-cron";
import { storage } from "./storage";
import { sendEmail, buildWeeklyReportEmailHTML } from "./email";

export function setupCronJobs(port: number) {
    // Agendamento: Segundas e Quintas às 06:00
    // String cron: Minuto Hora DiaMes Mês DiaSemana
    cron.schedule("0 6 * * 1,4", async () => {
        console.log(`[Cron] Iniciando Sincronização Automática Agendada...`);
        const farms = await storage.getFarms();

        // E-mail Admin/Godmode solicitado pelo dono
        const adminEmail = process.env.ADMIN_EMAIL || "yuri.g.l.souza@gmail.com";

        for (const farm of farms) {
            try {
                console.log(`[Cron] Fazenda ${farm.id} (${farm.name}) - Sincronizando...`);

                // Chamada de serviço interno para reaproveitar a complexa lógica do /sync 
                // sem necessidade de duplicação de request para o Earth Engine e Python GEE
                const res = await fetch(`http://127.0.0.1:${port}/api/farms/${farm.id}/readings/sync`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.reading) {
                        const { ndvi, cloudCover, date } = data.reading;
                        const status = data.isMock ? "Simulação (Offline)" : "Satélite Sincronizado";

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
                    }
                } else {
                    console.error(`[Cron] Falha HTTP na Sincronização Interna (Fazenda ${farm.id}): ${res.status}`);
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
