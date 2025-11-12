// server.js — stabil untuk Render (ESM)
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();
const app = express();

// ========== body limit besar + selalu JSON ==========
app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));
app.use((err, _req, res, next) => {
  if (err && err.type === "entity.too.large") {
    return res.status(413).json({ status: "error", message: "Payload too large" });
  }
  next(err);
});

// ========== serve UI ==========
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/health", (_req, res) => res.status(200).send("ok"));

// ========== Gemini setup ==========
const apiKey = process.env.GEMINI_API_KEY || "";
const MOCK = process.env.MOCK === "1";
let genAI = null;

if (!MOCK && apiKey) {
  genAI = new GoogleGenerativeAI(apiKey);
  console.log("✅ Gemini API aktif");
} else {
  console.warn("⚠️ GEMINI_API_KEY kosong atau MOCK=1");
}

// helper balas JSON
const j = (res, obj, code = 200) =>
  res.status(code).type("application/json").send(JSON.stringify(obj));

// pilih model aman (fallback ke pro)
const pickModel = () => {
  const candidates = ["gemini-2.5-flash", "gemini-pro"];
  return genAI.getGenerativeModel({ model: candidates[0] });
};

// ========== Satu endpoint untuk semua jenis ==========
app.post("/api/generate/:type", async (req, res) => {
  const type = (req.params?.type || "ugc").toUpperCase();
  const desc = req.body?.desc || "-";

  // mode mock / tanpa API key
  if (MOCK || !genAI) {
    return j(res, {
      status: "ok",
      mock: true,
      type,
      items: ["Ide 1", "Ide 2", "Ide 3", "Ide 4"],
    });
  }

  try {
    const model = pickModel();
    const prompt = `Buat 4 ide ${type} singkat untuk produk berikut:\n${desc}\nFormat: poin bernomor 1-4, ringkas dan actionable.`;
    const r = await model.generateContent(prompt);
    return j(res, { status: "ok", type, text: r.response.text() });
  } catch (err) {
    console.error("Gemini error:", err?.message || err);
    return j(res, { status: "error", message: err?.message || "Gemini failed" }, 500);
  }
});

// alias rute lama (kalau UI lama masih memanggil)
app.post("/api/generate/ugc", (req, res) =>
  app._router.handle({ ...req, params: { type: "ugc" } }, res, () => {})
);
app.post("/api/generate/broll", (req, res) =>
  app._router.handle({ ...req, params: { type: "broll" } }, res, () => {})
);
app.post("/api/generate/ads", (req, res) =>
  app._router.handle({ ...req, params: { type: "ads" } }, res, () => {})
);

// ========== start ==========
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Server jalan di port ${PORT} (MOCK=${MOCK ? "ON" : "OFF"})`));
