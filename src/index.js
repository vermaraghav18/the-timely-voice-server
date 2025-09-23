// server/src/index.js
require("dotenv").config();

const express = require("express");
const session = require("express-session");
const cors = require("cors");

const authRouter = require("./routes/auth");
const articlesRouter = require("./routes/articles");
const categoriesRouter = require("./routes/categories");
const settingsRouter = require("./routes/settings");

// Connect Prisma (prints "Prisma connected" in your db module)
require("./db");

const app = express();
const isProd = process.env.NODE_ENV === "production";

/* ---------------- CORS ---------------- */
const envOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

// Always allow localhost when not in prod (handy for local testing)
const devOrigins = isProd ? [] : ["http://localhost:5173", "http://localhost:5174"];

// Final allowlist
const ORIGINS = [...new Set([...envOrigins, ...devOrigins])];

console.log("CORS origins (from env + dev):", ORIGINS);

app.set("trust proxy", 1); // required on Render for secure cookies behind proxy

app.use(cors({
  origin(origin, cb) {
    // allow requests with no Origin (e.g., curl, server-to-server)
    if (!origin) return cb(null, true);
    return cb(null, ORIGINS.includes(origin));
  },
  credentials: true, // allow cookies
}));

/* ---------------- Parsers ---------------- */
app.use(express.json());

/* ---------------- Sessions ---------------- */
app.use(session({
  name: "tv.sid",
  secret: process.env.SESSION_SECRET || "dev-change-this-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProd,         // cookies only over HTTPS in production (Render)
    sameSite: isProd ? "none" : "lax", // cross-site cookies required for Vercel -> Render
    maxAge: 30 * 24 * 60 * 60 * 1000,  // 30 days
  },
}));

/* ---------------- Routes ---------------- */
app.use("/api/auth", authRouter);
app.use("/api/articles", articlesRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/settings", settingsRouter);

// Health check & quick debug
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    env: process.env.NODE_ENV,
    origins: ORIGINS,
    time: new Date().toISOString(),
  });
});

/* ---------------- Error Handler ---------------- */
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Internal Server Error" });
});

/* ---------------- Start ---------------- */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
