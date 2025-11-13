// server.js — siap Render + dukung "Atur API Key" dari browser
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();

// CORS + body parser (besar supaya aman)
app.use(
  cors({
    origin: true,
    credentials: false,
    allowedHeaders: ["Content-Type", "x-user-gemini-key"],
  })
);
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// Serve UI
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/health", (_req, res) => res.status(200).send("ok"));

// Konfigurasi API
const ENV_KEY = process.env.GEMINI_API_KEY || "";
const MOCK = process.env.MOCK === "1";

// Ambil API key dari header user (x-user-gemini-key) atau fallback ENV
function getGenAIFromReq(req) {
  const userKey = (req.headers["x-user-gemini-key"] || "").toString().trim();
  const key = userKey || ENV_KEY;
  if (!key) return null;
  return new GoogleGenerativeAI(key);
}

// Retry + fallback (mengatasi 429/503)
const SLEEP = (ms) => new Promise((r) => setTimeout(r, ms));
function isRetryable(err) {
  const s = err?.status || err?.response?.status;
  const m = (err?.message || "").toLowerCase();
  return s === 429 || s === 503 || m.includes("overloaded") || m.includes("rate") || m.includes("quota");
}
async function generateWithFallback(genAI, { models, parts, maxRetries = 3, baseDelay = 800 }) {
  let lastErr;
  for (const name of models) {
    const model = genAI.getGenerativeModel({ model: name });
    for (let i = 0; i < maxRetries; i++) {
      try {
        const r = await model.generateContent(parts);
        return { model: name, text: r.response.text() };
      } catch (e) {
        lastErr = e;
        if (isRetryable(e) && i < maxRetries - 1) {
          const d = Math.round(baseDelay * Math.pow(2, i) + Math.random() * 250);
          await SLEEP(d);
          continue;
        }
        break; // non-retryable, pindah model berikutnya
      }
    }
  }
  throw lastErr || new Error("Semua model gagal.");
}

// Model yang aman dipakai
const TEXT_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-pro"];

// Helper JSON
const J = (res, obj, code = 200) => res.status(code).type("application/json").send(JSON.stringify(obj));

// ====== Endpoint gabungan: UGC / BROLL / ADS (teks) ======
app.post("/api/generate/:type", async (req, res) => {
  const type = (req.params?.type || "ugc").toUpperCase();
  const desc = (req.body?.desc || "-").slice(0, 2000);

  if (MOCK) {
    return J(res, {
      status: "ok",
      mock: true,
      type,
      items: [
        `Ide 1 untuk ${desc}`,
        `Ide 2 untuk ${desc}`,
        `Ide 3 untuk ${desc}`,
        `Ide 4 untuk ${desc}`,
      ],
    });
  }

  const genAI = getGenAIFromReq(req);
  if (!genAI) return J(res, { status: "error", reason: "NO_API_KEY" }, 401);

  try {
    const prompt =
      `Buat 4 ide ${type} yang singkat & actionable untuk produk berikut:\n` +
      `${desc}\nFormat: 1-4 poin, masing-masing <= 20 kata.`;
    const out = await generateWithFallback(genAI, {
      models: TEXT_MODELS,
      parts: [{ text: prompt }],
      maxRetries: 3,
      baseDelay: 800,
    });
    return J(res, { status: "ok", model: out.model, text: out.text });
  } catch (e) {
    console.error("Gemini error:", e?.status, e?.message || e);
    return J(res, { status: "error", message: String(e?.message || e) }, 503);
  }
});

// Alias rute lama (kalau UI lama masih panggil)
app.post("/api/generate/ugc", (req, res) =>
  app._router.handle({ ...req, params: { type: "ugc" } }, res, () => {})
);
app.post("/api/generate/broll", (req, res) =>
  app._router.handle({ ...req, params: { type: "broll" } }, res, () => {})
);
app.post("/api/generate/ads", (req, res) =>
  app._router.handle({ ...req, params: { type: "ads" } }, res, () => {})
);

// Start
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Server jalan di port ${PORT} (MOCK=${MOCK ? "ON" : "OFF"})`);
});
