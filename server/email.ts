import nodemailer from "nodemailer";

interface MailOptions {
    to: string;
    subject: string;
    text: string;
    html?: string;
}

let transporter: nodemailer.Transporter | null = null;

async function createTransporter() {
    if (transporter) return transporter;

    // Check for SMTP config in env
    if (process.env.SMTP_HOST) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || "587"),
            secure: false, // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    } else {
        // Determine if we are in a test/dev environment without credentials
        try {
            const testAccount = await nodemailer.createTestAccount();
            console.log("⚠️ No SMTP config found. Using Ethereal Email for testing.");
            console.log(`Test User: ${testAccount.user}`);
            console.log(`Test Pass: ${testAccount.pass}`);

            transporter = nodemailer.createTransport({
                host: "smtp.ethereal.email",
                port: 587,
                secure: false, // true for 465, false for other ports
                auth: {
                    user: testAccount.user, // generated ethereal user
                    pass: testAccount.pass, // generated ethereal password
                },
            });
        } catch (err) {
            console.error("Failed to create Ethereal account:", err);
        }
    }
    return transporter;
}

export async function sendEmail(options: MailOptions): Promise<boolean> {
    try {
        const transport = await createTransporter();
        if (!transport) {
            console.error("Email transporter not available");
            return false;
        }

        const info = await transport.sendMail({
            from: '"SYAZ Orbital Monitor" <alerts@syazorbital.com>', // sender address
            ...options,
        });

        console.log(`📧 Email sent: ${info.messageId}`);
        // Preview only available when sending through an Ethereal account
        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
            console.log(`🔗 Preview URL: ${previewUrl}`);
        }
        return true;

    } catch (error) {
        console.error("Error sending email:", error);
        return false;
    }
}
