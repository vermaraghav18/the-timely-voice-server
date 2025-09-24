// server/src/index.js
require("dotenv").config();

const express = require("express");
const session = require("express-session");
const cors = require("cors");

// Routers
const authRouter = require("./routes/auth");
const articlesRouter = require("./routes/articles");
const categoriesRouter = require("./routes/categories");
const settingsRouter = require("./routes/settings");

// Prisma connect (your db module logs “Prisma connected”)
require("./db");

// Seed hook (runs only if SEED_ON_BOOT=1)
const { maybeSeed } = require("./seedOnBoot");

const app = express();
const isProd = process.env.NODE_ENV === "production";

/* ---------------- CORS ---------------- */
const envOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const devOrigins = isProd ? [] : [
  "http://localhost:5173",
  "http://localhost:5174",
];

const ORIGINS = [...new Set([...envOrigins, ...devOrigins])];
console.log("CORS origins (from env + dev):", ORIGINS);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  try {
    const { host, origin: full } = new URL(origin);
    if (ORIGINS.includes(full)) return true;
    // allow Vercel preview subdomains for these two apps
    if (
      /^the-timely-voice-admin(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(host) ||
      /^the-timely-voice-client(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(host)
    ) return true;
    return false;
  } catch {
    return false;
  }
}

app.set("trust proxy", 1); // Render behind proxy

const corsConfig = {
  origin(origin, cb) {
    const ok = isAllowedOrigin(origin);
    if (!ok) console.warn("CORS blocked origin:", origin);
    cb(null, ok);
  },
  credentials: true,
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
};
app.use(cors(corsConfig));
app.options("*", cors(corsConfig));

/* ---------------- Parsers ---------------- */
app.use(express.json());

/* ---------------- Sessions ---------------- */
app.use(
  session({
    name: "tv.sid",
    secret: process.env.SESSION_SECRET || "dev-change-this-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      partitioned: isProd ? true : false, // CHIPS: allow cross-site cookie
      maxAge: 30 * 24 * 60 * 60 * 1000,
    },
  })
);

/* ---------------- OPEN ADMIN (NO LOGIN) ----------------
   If ADMIN_OPEN=1, we auto-attach an admin session to every request.
   WARNING: This exposes your admin to anyone who can reach the admin UI.
   Lock down ALLOWED_ORIGINS and disable when finished.
-------------------------------------------------------- */
if (process.env.ADMIN_OPEN === "1") {
  console.warn("⚠️  ADMIN_OPEN=1 → Admin auth is DISABLED (no password).");
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();

  app.use(async (req, res, next) => {
    try {
      // Only do this for browser/API calls (skip health)
      if (req.path.startsWith("/api")) {
        if (!req.session.userId) {
          const desired = process.env.ADMIN_EMAIL || "admin@local";
          // Find by email OR username (local-part)
          const local = desired.includes("@") ? desired.split("@")[0] : desired;
          let user =
            (await prisma.user.findUnique({ where: { email: desired } }).catch(() => null)) ||
            (await prisma.user.findUnique({ where: { username: desired } }).catch(() => null)) ||
            (await prisma.user.findUnique({ where: { username: local } }).catch(() => null));

          if (!user) {
            console.error("ADMIN_OPEN: no admin user found for", desired);
          } else {
            req.session.userId = user.id;
            req.session.role = user.role || "admin";
          }
        }
      }
    } catch (e) {
      console.error("ADMIN_OPEN middleware error:", e);
    } finally {
      return next();
    }
  });
}

/* ---------------- Routes ---------------- */
app.use("/api/auth", authRouter);
app.use("/api/articles", articlesRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/settings", settingsRouter);

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    env: process.env.NODE_ENV,
    origins: ORIGINS,
    time: new Date().toISOString(),
    openAdmin: process.env.ADMIN_OPEN === "1",
  });
});

/* ---------------- Error Handler ---------------- */
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Internal Server Error" });
});

/* ---------------- Start (with seed-on-boot) ---------------- */
async function start() {
  await maybeSeed(); // runs only when SEED_ON_BOOT=1
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`API listening on :${PORT}`);
  });
}

start().catch((e) => {
  console.error("Failed to start server:", e);
  process.exit(1);
});
