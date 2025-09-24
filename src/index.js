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

// Seed hook (runs only if SEED_ON_BOOT=1)
const { maybeSeed } = require("./seedOnBoot");

const app = express();
const isProd = process.env.NODE_ENV === "production";

/* ---------------- CORS ---------------- */
const envOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// allow localhost in dev
const devOrigins = isProd ? [] : [
  "http://localhost:5173",
  "http://localhost:5174",
];

const ORIGINS = [...new Set([...envOrigins, ...devOrigins])];
console.log("CORS origins (from env + dev):", ORIGINS);

// Allow exact allowlist AND Vercel preview subdomains for these two projects only
function isAllowedOrigin(origin) {
  if (!origin) return true; // server-to-server, curl
  try {
    const { host, origin: full } = new URL(origin);

    // exact allowlist from env
    if (ORIGINS.includes(full)) return true;

    // accept vercel previews for admin/client projects
    if (
      /^the-timely-voice-admin(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(host) ||
      /^the-timely-voice-client(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(host)
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

app.set("trust proxy", 1); // required on Render for secure cookies behind proxy

const corsConfig = {
  origin(origin, cb) {
    const ok = isAllowedOrigin(origin);
    if (!ok) console.warn("CORS blocked origin:", origin);
    cb(null, ok);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsConfig));
// Good practice: respond to preflight explicitly
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
      secure: isProd,                  // HTTPS only in prod (Render)
      sameSite: isProd ? "none" : "lax",
      partitioned: isProd ? true : false, // CHIPS: allow cross-site cookie (Vercel -> Render)
      maxAge: 30 * 24 * 60 * 60 * 1000,  // 30 days
    },
  })
);

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
