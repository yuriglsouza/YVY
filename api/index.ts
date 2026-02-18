
import { createApp } from "../server/app.js";

let appPromise: Promise<any> | null = null;

export default async function handler(req: any, res: any) {
    try {
        if (!appPromise) {
            console.log("[Vercel] Initializing app...");
            appPromise = createApp();
        }
        const { app } = await appPromise;
        app(req, res);
    } catch (error: any) {
        console.error("[Vercel] Startup Error:", error);
        res.status(500).json({
            error: "Internal Server Error",
            details: error.message,
            stack: error.stack
        });
    }
}
