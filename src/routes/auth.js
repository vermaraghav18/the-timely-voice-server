// server/src/routes/auth.js
const express = require("express");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const router = express.Router();

const log = (...args) => console.log("[auth]", ...args);

/** Normalize user object returned to client */
function sanitizeUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email ?? null,
    username: u.username ?? null,
    name: u.name ?? null,
    role: u.role ?? null,
    createdAt: u.createdAt ?? null,
    updatedAt: u.updatedAt ?? null,
  };
}

/** Try to find a user by email (case-insensitive) or username */
async function findUserByIdentity(identityRaw) {
  if (!identityRaw) return null;

  const identity = String(identityRaw).trim();
  const looksLikeEmail = identity.includes("@");

  // Prefer email when it looks like one (case-insensitive)
  if (looksLikeEmail) {
    // If your DB email is case-sensitive, try both exact and lowercased variants.
    let u =
      (await prisma.user.findUnique({ where: { email: identity } }).catch(() => null)) ||
      (await prisma.user.findUnique({ where: { email: identity.toLowerCase() } }).catch(() => null));
    if (u) return u;
  }

  // Try username (exact)
  let u = await prisma.user.findUnique({ where: { username: identity } }).catch(() => null);
  if (u) return u;

  // As a last resort: if they typed an email, try username = local-part
  if (looksLikeEmail) {
    const local = identity.split("@")[0];
    u = await prisma.user.findUnique({ where: { username: local } }).catch(() => null);
    if (u) return u;
  }

  return null;
}

/**
 * POST /api/auth/login
 * body: { email, password }   // "email" may actually be username; both are accepted
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    log("login attempt", { origin: req.headers.origin, email });

    if (!email || !password) {
      return res.status(400).json({ error: "Email/username and password are required" });
    }

    const user = await findUserByIdentity(email);
    if (!user) {
      log("login fail: user not found");
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Support either field name in DB
    const stored =
      (typeof user.passwordHash === "string" && user.passwordHash) ||
      (typeof user.password === "string" && user.password) ||
      null;

    if (!stored) {
      log("login fail: no stored password on account");
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, stored);
    if (!ok) {
      log("login fail: bad password");
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Establish session
    req.session.userId = user.id;
    // normalize role checkers: store as-is, but default to "admin" if missing
    req.session.role = user.role || "admin";

    // For extra clarity in logs:
    log("login success", { userId: user.id, role: req.session.role });

    // Express-session will set Set-Cookie on this response
    res.set("Cache-Control", "no-store");
    return res.json({ user: sanitizeUser(user) });
  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

/** POST /api/auth/logout */
router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("tv.sid");
    res.json({ ok: true });
  });
});

/**
 * GET /api/auth/me
 * Returns the current user if a valid session exists
 */
router.get("/me", async (req, res) => {
  try {
    const id = req.session.userId;
    if (!id) return res.status(401).json({ error: "Not authenticated" });

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(401).json({ error: "Not authenticated" });

    res.set("Cache-Control", "no-store");
    return res.json({ user: sanitizeUser(user) });
  } catch (err) {
    console.error("me error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

/** TEMP: debug your session server-side (remove when done) */
router.get("/debug/whoami", (req, res) => {
  res.json({
    hasSession: !!req.session.userId,
    session: {
      id: req.session.id,
      userId: req.session.userId || null,
      role: req.session.role || null,
    },
    headersOrigin: req.headers.origin || null,
  });
});

module.exports = router;
