import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { registerRoutes } from "./routes.js";
import { setupAuth } from "./auth.js";
import { requestLogger } from './request-logger.js';

declare module "http" {
    interface IncomingMessage {
        rawBody: unknown;
    }
}

export function log(message: string, source = "express") {
    // Check API Key status once
    if (source === "startup-check" && !process.env.GEMINI_API_KEY) {
        console.warn("WARNING: GEMINI_API_KEY is missing from environment variables!");
    } else if (source === "startup-check") {
        console.log("GEMINI_API_KEY is present.");
    }

    const formattedTime = new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
    });

    console.log(`${formattedTime} [${source}] ${message}`);
}

export async function createApp() {
    const app = express();
    const httpServer = createServer(app);

    app.use(
        express.json({
            verify: (req, _res, buf) => {
                req.rawBody = buf;
            },
        }),
    );
    app.use(express.urlencoded({ extended: false }));

    app.use(requestLogger(log));

    // Auth Middleware
    setupAuth(app);

    await registerRoutes(httpServer, app);

    // Error handling middleware
    app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";

        console.error("Internal Server Error:", err);

        if (res.headersSent) {
            return next(err);
        }

        return res.status(status).json({ message });
    });

    return { app, httpServer };
}
