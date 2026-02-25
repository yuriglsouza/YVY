import { Resend } from "resend";
import nodemailer from "nodemailer";

interface MailOptions {
    to: string;
    subject: string;
    text: string;
    html?: string;
}

// ============================================================
// Provider 1: Resend (Recommended — 100 emails/day free)
// Requires: RESEND_API_KEY env var
// ============================================================

let resendClient: Resend | null = null;

function getResend(): Resend | null {
    if (resendClient) return resendClient;
    if (process.env.RESEND_API_KEY) {
        resendClient = new Resend(process.env.RESEND_API_KEY);
        console.log("📧 Email Provider: Resend (Production)");
        return resendClient;
    }
    return null;
}

async function sendViaResend(options: MailOptions): Promise<boolean> {
    const client = getResend();
    if (!client) return false;

    try {
        const { data, error } = await client.emails.send({
            from: process.env.RESEND_FROM || "SYAZ Orbital <onboarding@resend.dev>",
            to: [options.to],
            subject: options.subject,
            text: options.text,
            html: options.html || options.text,
        });

        if (error) {
            console.error("Resend error:", error);
            return false;
        }

        console.log(`📧 Email sent via Resend: ${data?.id} → ${options.to}`);
        return true;
    } catch (error) {
        console.error("Resend exception:", error);
        return false;
    }
}

// ============================================================
// Provider 2: Nodemailer SMTP (Fallback)
// Requires: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS env vars
// ============================================================

let transporter: nodemailer.Transporter | null = null;

async function createTransporter() {
    if (transporter) return transporter;

    if (process.env.SMTP_HOST) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || "587"),
            secure: process.env.SMTP_PORT === "465",
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
        console.log("📧 Email Provider: Nodemailer SMTP (Fallback)");
    } else {
        // Ethereal test account for dev
        try {
            const testAccount = await nodemailer.createTestAccount();
            console.log("⚠️ No SMTP config found. Using Ethereal Email for testing.");
            transporter = nodemailer.createTransport({
                host: "smtp.ethereal.email",
                port: 587,
                secure: false,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass,
                },
            });
        } catch (err) {
            console.error("Failed to create Ethereal account:", err);
        }
    }
    return transporter;
}

async function sendViaNodemailer(options: MailOptions): Promise<boolean> {
    try {
        const transport = await createTransporter();
        if (!transport) return false;

        const info = await transport.sendMail({
            from: '"SYAZ Orbital Monitor" <alerts@syazorbital.com>',
            ...options,
        });

        console.log(`📧 Email sent via Nodemailer: ${info.messageId}`);
        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
            console.log(`🔗 Preview URL: ${previewUrl}`);
        }
        return true;
    } catch (error) {
        console.error("Nodemailer error:", error);
        return false;
    }
}

// ============================================================
// Public API — tries Resend first, falls back to Nodemailer
// ============================================================

export async function sendEmail(options: MailOptions): Promise<boolean> {
    // Priority 1: Resend (if RESEND_API_KEY is set)
    if (process.env.RESEND_API_KEY) {
        const sent = await sendViaResend(options);
        if (sent) return true;
        console.warn("Resend failed, trying Nodemailer fallback...");
    }

    // Priority 2: Nodemailer (SMTP or Ethereal)
    return sendViaNodemailer(options);
}

// ============================================================
// HTML Email Templates
// ============================================================

export function buildAlertEmailHTML(farmName: string, alerts: { type: string; msg: string }[]): string {
    const alertRows = alerts.map(a => `
        <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #2d3748; color: #fbbf24; font-weight: 600; white-space: nowrap;">
                ${a.type === 'CRITICAL_NDVI' ? '🌿' : a.type === 'DROUGHT' ? '🏜️' : a.type === 'HEAT_STRESS' ? '🌡️' : '⚠️'} ${a.type}
            </td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #2d3748; color: #e2e8f0;">
                ${a.msg}
            </td>
        </tr>
    `).join('');

    return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #065f46, #047857); border-radius: 12px 12px 0 0; padding: 24px; text-align: center;">
                <h1 style="color: #ecfdf5; margin: 0; font-size: 20px;">🛰️ SYAZ Orbital Monitor</h1>
                <p style="color: #a7f3d0; margin: 4px 0 0; font-size: 13px;">Sistema de Alertas Inteligentes</p>
            </div>
            
            <!-- Body -->
            <div style="background-color: #1e293b; padding: 24px; border-radius: 0 0 12px 12px;">
                <h2 style="color: #f1f5f9; margin: 0 0 8px; font-size: 16px;">⚠️ Alerta de Risco Operacional</h2>
                <p style="color: #94a3b8; margin: 0 0 20px; font-size: 14px;">
                    Detectamos condições críticas para a fazenda <strong style="color: #10b981;">${farmName}</strong>:
                </p>
                
                <!-- Alert Table -->
                <table style="width: 100%; border-collapse: collapse; background-color: #0f172a; border-radius: 8px; overflow: hidden;">
                    <thead>
                        <tr style="background-color: #1a2332;">
                            <th style="padding: 10px 16px; text-align: left; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Tipo</th>
                            <th style="padding: 10px 16px; text-align: left; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Descrição</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${alertRows}
                    </tbody>
                </table>
                
                <!-- CTA -->
                <div style="text-align: center; margin-top: 24px;">
                    <a href="${process.env.APP_URL || 'https://yvy-g8z9.vercel.app'}" 
                       style="display: inline-block; background: linear-gradient(135deg, #059669, #10b981); color: #fff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">
                        Acessar Plataforma →
                    </a>
                </div>
            </div>
            
            <!-- Footer -->
            <div style="text-align: center; padding: 16px; color: #475569; font-size: 11px;">
                <p style="margin: 0;">Você recebe este alerta porque ativou as notificações inteligentes na SYAZ Orbital.</p>
                <p style="margin: 4px 0 0;">© ${new Date().getFullYear()} SYAZ Orbital • Monitoramento Agrícola por Satélite</p>
            </div>
        </div>
    </body>
    </html>
    `;
}

export function buildWeeklyReportEmailHTML(farmName: string, date: string, stats: { ndvi: number, cloudCover: number, status: string }): string {
    return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #0284c7, #0369a1); border-radius: 12px 12px 0 0; padding: 24px; text-align: center;">
                <h1 style="color: #f0f9ff; margin: 0; font-size: 20px;">🔄 SYAZ Orbital Monitor</h1>
                <p style="color: #bae6fd; margin: 4px 0 0; font-size: 13px;">Sincronização de Satélite Concluída</p>
            </div>
            
            <!-- Body -->
            <div style="background-color: #1e293b; padding: 24px; border-radius: 0 0 12px 12px;">
                <h2 style="color: #f1f5f9; margin: 0 0 8px; font-size: 16px;">Sua fazenda foi atualizada!</h2>
                <p style="color: #94a3b8; margin: 0 0 20px; font-size: 14px;">
                    O satélite sobrevoou a fazenda <strong style="color: #38bdf8;">${farmName}</strong> em ${date} e já processamos os dados. Confira o resumo:
                </p>
                
                <div style="background-color: #0f172a; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                        <span style="color: #64748b; font-size: 14px;">📸 Data da Captura</span>
                        <strong style="color: #f8fafc; font-size: 14px;">${date}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                        <span style="color: #64748b; font-size: 14px;">🌿 Índice NDVI (Saúde)</span>
                        <strong style="color: ${stats.ndvi > 0.6 ? '#10b981' : stats.ndvi > 0.4 ? '#fbbf24' : '#ef4444'}; font-size: 14px;">${stats.ndvi.toFixed(3)}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                        <span style="color: #64748b; font-size: 14px;">☁️ Nuvens</span>
                        <strong style="color: #f8fafc; font-size: 14px;">${(stats.cloudCover * 100).toFixed(0)}%</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #64748b; font-size: 14px;">📊 Status Geral</span>
                        <strong style="color: #f8fafc; font-size: 14px;">${stats.status}</strong>
                    </div>
                </div>
                
                <div style="text-align: center;">
                    <a href="${process.env.APP_URL || 'https://yvy-g8z9.vercel.app'}" 
                       style="display: inline-block; background: linear-gradient(135deg, #0ea5e9, #0284c7); color: #fff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">
                        Ver Imagens no Painel →
                    </a>
                </div>
            </div>
            
            <!-- Footer -->
            <div style="text-align: center; padding: 16px; color: #475569; font-size: 11px;">
                <p style="margin: 0;">Você optou por receber relatórios semanais da plataforma SYAZ.</p>
                <p style="margin: 4px 0 0;">© ${new Date().getFullYear()} SYAZ Orbital • Transformando dados em produtividade</p>
            </div>
        </div>
    </body>
    </html>
    `;
}
