
import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";

async function listModels() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    // There isn't a direct listModels method on the genAI instance in the node SDK easily exposed?
    // Wait, the error message said "Call ListModels to see...". That might be a REST API hint.
    // The SDK might not expose it directly on the top level?
    // Actually, let's try to infer from the error message first.

    // Actually, I can use the model name "models/gemini-1.5-flash" if I want, maybe the SDK prefixes it?
    // Let's try to just run a simple generation with a known model.

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Hello");
        console.log("gemini-1.5-flash worked");
    } catch (e) {
        console.log("gemini-1.5-flash failed: " + e.message);
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const result = await model.generateContent("Hello");
        console.log("gemini-pro worked");
    } catch (e) {
        console.log("gemini-pro failed: " + e.message);
    }
}

listModels();
