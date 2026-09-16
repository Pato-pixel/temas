import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const UPLOADS_DIR = path.join(__dirname, "uploads");
const TOPICS_FILE = path.join(DATA_DIR, "topics.json");
const AUTH_FILE = path.join(DATA_DIR, "auth.json");
const SECRET_FILE = path.join(DATA_DIR, "secret.txt");

const PORT = process.env.PORT || 4000;

// --- Preparar almacenamiento en disco (JSON simple, suficiente para este proyecto) ---
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(TOPICS_FILE)) fs.writeFileSync(TOPICS_FILE, "[]");
if (!fs.existsSync(AUTH_FILE)) fs.writeFileSync(AUTH_FILE, JSON.stringify({ passwordHash: null }));
if (!fs.existsSync(SECRET_FILE)) fs.writeFileSync(SECRET_FILE, crypto.randomBytes(32).toString("hex"));

const JWT_SECRET = fs.readFileSync(SECRET_FILE, "utf-8").trim();

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// --- App ---
const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use("/uploads", express.static(UPLOADS_DIR));

// --- Subida de imágenes ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, crypto.randomUUID() + ext);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Solo se permiten imágenes"));
    cb(null, true);
  },
});

// --- Middleware de autenticación ---
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "No autenticado" });
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Sesión inválida o vencida" });
  }
}

// --- Rutas de autenticación ---
app.get("/api/auth/status", (req, res) => {
  const auth = readJSON(AUTH_FILE);
  res.json({ hasPassword: !!auth.passwordHash });
});

// Solo funciona una vez: mientras no exista contraseña guardada.
app.post("/api/auth/setup", async (req, res) => {
  const auth = readJSON(AUTH_FILE);
  if (auth.passwordHash) return res.status(400).json({ error: "Ya existe una contraseña configurada" });
  const { password } = req.body || {};
  if (!password || password.length < 6) {
    return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  writeJSON(AUTH_FILE, { passwordHash });
  const token = jwt.sign({ role: "professor" }, JWT_SECRET, { expiresIn: "30d" });
  res.json({ token });
});

app.post("/api/auth/login", async (req, res) => {
  const auth = readJSON(AUTH_FILE);
  if (!auth.passwordHash) return res.status(400).json({ error: "Todavía no se ha configurado una contraseña" });
  const { password } = req.body || {};
  const ok = password && (await bcrypt.compare(password, auth.passwordHash));
  if (!ok) return res.status(401).json({ error: "Contraseña incorrecta" });
  const token = jwt.sign({ role: "professor" }, JWT_SECRET, { expiresIn: "30d" });
  res.json({ token });
});

app.post("/api/auth/change-password", requireAuth, async (req, res) => {
  const { newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
  }
  const passwordHash = await bcrypt.hash(newPassword, 10);
  writeJSON(AUTH_FILE, { passwordHash });
  res.json({ ok: true });
});

// --- Rutas de temas (lectura pública, escritura protegida) ---
app.get("/api/topics", (req, res) => {
  res.json(readJSON(TOPICS_FILE));
});

app.post("/api/topics", requireAuth, (req, res) => {
  const { title, category, description, imageUrl } = req.body || {};
  if (!title || !title.trim()) return res.status(400).json({ error: "El título es obligatorio" });
  const topics = readJSON(TOPICS_FILE);
  const entry = {
    id: crypto.randomUUID(),
    title: title.trim(),
    category: category || "Otro",
    description: description || "",
    imageUrl: imageUrl || "",
    updatedBy: "Profesor",
    updatedAt: new Date().toISOString(),
  };
  topics.unshift(entry);
  writeJSON(TOPICS_FILE, topics);
  res.status(201).json(entry);
});

app.put("/api/topics/:id", requireAuth, (req, res) => {
  const topics = readJSON(TOPICS_FILE);
  const idx = topics.findIndex((t) => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Tema no encontrado" });
  const { title, category, description, imageUrl } = req.body || {};
  if (!title || !title.trim()) return res.status(400).json({ error: "El título es obligatorio" });
  topics[idx] = {
    ...topics[idx],
    title: title.trim(),
    category: category || topics[idx].category,
    description: description ?? topics[idx].description,
    imageUrl: imageUrl ?? topics[idx].imageUrl,
    updatedBy: "Profesor",
    updatedAt: new Date().toISOString(),
  };
  writeJSON(TOPICS_FILE, topics);
  res.json(topics[idx]);
});

app.delete("/api/topics/:id", requireAuth, (req, res) => {
  const topics = readJSON(TOPICS_FILE);
  const next = topics.filter((t) => t.id !== req.params.id);
  writeJSON(TOPICS_FILE, next);
  res.json({ ok: true });
});

app.post("/api/upload", requireAuth, upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No se recibió ninguna imagen" });
  res.json({ url: `/uploads/${req.file.filename}` });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Error del servidor" });
});

app.listen(PORT, () => {
  console.log(`API de temas del profesor corriendo en http://localhost:${PORT}`);
});
