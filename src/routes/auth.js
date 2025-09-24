// server/src/routes/auth.js
const express = require("express");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const router = express.Router();

/**
 * Normalize what we return to the client
 */
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

/**
 * Resolve the user by email OR username (whichever your admin sends)
 */
async function findUserByIdentity(identity) {
  if (!identity) return null;

  // try email first
  let user = await prisma.user.findUnique({ where: { email: identity } }).catch(() => null);
  if (user) return user;

  // then try username (e.g., when someone types "admin@local" but schema uses username)
  user = await prisma.user.findUnique({ where: { username: identity } }).catch(() => null);
  return user;
}

/**
 * POST /api/auth/login
 * body: { email, password }  // "email" may also be a username; we handle both
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email/username and password are required" });
    }

    const user = await findUserByIdentity(email);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Support either field name in DB
    const stored =
      (typeof user.passwordHash === "string" && user.passwordHash) ||
      (typeof user.password === "string" && user.password) ||
      null;

    if (!stored) {
      return res.status(401).json({ error: "Account has no password set" });
    }

    const ok = await bcrypt.compare(password, stored);
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Session
    req.session.userId = user.id;
    req.session.role = user.role || "admin"; // default to admin if missing

    // Return the safe user
    return res.json({ user: sanitizeUser(user) });
  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * POST /api/auth/logout
 */
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

    return res.json({ user: sanitizeUser(user) });
  } catch (err) {
    console.error("me error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
