// server.js — siap untuk Render (ESM)
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// --- path util ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===> penting: layani folder public sebagai static + root
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.get("/health", (_req, res) => res.status(200).send("ok"));

// ====== (opsional) API — boleh biarkan apa adanya ======
const MOCK = process.env.MOCK === "1";
const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = (!MOCK && apiKey) ? new GoogleGenerativeAI(apiKey) : null;

function mockItems(label){ return Array.from({length:4},(_,_i)=>({
  id:`${label.toLowerCase()}-${_i+1}`,label:`${label} #${_i+1}`,
  preview:"Contoh ide",prompt:`Prompt contoh ${label} ${_i+1}`
}));}

app.post("/api/generate/broll", async (req,res)=>{
  if(MOCK || !genAI) return res.json({status:"ok",items:mockItems("B-Roll")});
  const m = genAI.getGenerativeModel({model:"gemini-pro"});
  const r = await m.generateContent(`Buat 4 ide B-Roll untuk: ${req.body.desc||"-"}`);
  res.json({status:"ok",items:[{label:"B-Roll",prompt:r.response.text()}]});
});
app.post("/api/generate/ugc", async (req,res)=>{
  if(MOCK || !genAI) return res.json({status:"ok",items:mockItems("UGC")});
  const m = genAI.getGenerativeModel({model:"gemini-pro"});
  const r = await m.generateContent(`Buat 4 ide UGC untuk: ${req.body.desc||"-"}`);
  res.json({status:"ok",items:[{label:"UGC",prompt:r.response.text()}]});
});
app.post("/api/generate/ads", async (req,res)=>{
  if(MOCK || !genAI) return res.json({status:"ok",items:mockItems("Ads")});
  const m = genAI.getGenerativeModel({model:"gemini-pro"});
  const r = await m.generateContent(`Buat 4 ide Ads untuk: ${req.body.desc||"-"}`);
  res.json({status:"ok",items:[{label:"Ads",prompt:r.response.text()}]});
});

// ====== listen ======
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Server jalan di port ${PORT} (MOCK=${MOCK ? "ON" : "OFF"})`);
});
