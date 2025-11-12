// server.js — versi stabil
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// serve UI
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/health", (_req, res) => res.status(200).send("ok"));

// Gemini setup
const apiKey = process.env.GEMINI_API_KEY;
const MOCK = process.env.MOCK === "1";
let genAI = null;

if (apiKey && !MOCK) {
  genAI = new GoogleGenerativeAI(apiKey);
  console.log("✅ Gemini API aktif");
} else {
  console.warn("⚠️ GEMINI_API_KEY kosong atau MOCK aktif");
}

// helper error JSON
function safeJson(res, data) {
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data, null, 2));
}

// endpoints
app.post("/api/generate/:type", async (req, res) => {
  const { type } = req.params;
  const desc = req.body?.desc || "-";
  if (!genAI) return safeJson(res, { status: "error", reason: "NO_API_KEY" });

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Buat ide ${type.toUpperCase()} untuk produk: ${desc}`;
    const result = await model.generateContent(prompt);
    safeJson(res, { status: "ok", type, text: result.response.text() });
  } catch (err) {
    console.error("Gemini error:", err.message);
    safeJson(res, { status: "error", message: err.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Server jalan di port ${PORT}`));
