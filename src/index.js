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

// <-- NEW: seed hook
const { maybeSeed } = require("./seedOnBoot");

const app = express();
const isProd = process.env.NODE_ENV === "production";

/* ---------------- CORS ---------------- */
const envOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Always allow localhost when not in prod (handy for local testing)
const devOrigins = isProd ? [] : ["http://localhost:5173", "http://localhost:5174"];

// Final allowlist
const ORIGINS = [...new Set([...envOrigins, ...devOrigins])];

console.log("CORS origins (from env + dev):", ORIGINS);

app.set("trust proxy", 1); // required on Render for secure cookies behind proxy

app.use(
  cors({
    origin(origin, cb) {
      // allow requests with no Origin (e.g., curl, server-to-server)
      if (!origin) return cb(null, true);
      const allowed = ORIGINS.includes(origin);
      if (allowed) return cb(null, true);
      return cb(null, false); // quietly block (avoids noisy errors in logs)
    },
    credentials: true, // allow cookies
  })
);

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
      secure: isProd,                 // required for SameSite=None/Partitioned
      sameSite: isProd ? "none" : "lax",
      partitioned: isProd ? true : false, // <-- add this line
      maxAge: 30 * 24 * 60 * 60 * 1000,
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
  // <-- NEW: run the seed only when flagged
  await maybeSeed();

  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`API listening on :${PORT}`);
  });
}

start().catch((e) => {
  console.error("Failed to start server:", e);
  process.exit(1);
});
