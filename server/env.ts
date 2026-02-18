
import dotenv from "dotenv";
import path from "path";

// Explicitly load .env from project root
dotenv.config({
    path: path.resolve(process.cwd(), ".env"),
    override: true
});

console.log("[ENV] Environment variables loaded. DATABASE_URL starts with:",
    process.env.DATABASE_URL?.substring(0, 15));
