// server/src/routes/auth.js
const express = require('express');
const router = express.Router();
const { prisma } = require('../db');
const crypto = require('crypto');

// optional bcrypt — works if installed; otherwise we fall back
let bcrypt = null;
try { bcrypt = require('bcryptjs'); } catch { /* not installed, ok */ }

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

async function checkPassword(inputPassword, storedHash) {
  if (!storedHash) return false;

  // bcrypt hash starts with $2a/$2b/$2y
  if (storedHash.startsWith('$2')) {
    if (!bcrypt) return false;                // bcrypt hash present but lib missing
    try { return await bcrypt.compare(inputPassword, storedHash); }
    catch { return false; }
  }

  // support sha256 hashes
  if (storedHash.length === 64 && /^[a-f0-9]+$/i.test(storedHash)) {
    return sha256(inputPassword) === storedHash;
  }

  // last resort (dev only): accept plain text match
  return inputPassword === storedHash;
}

// GET /api/auth/me
router.get('/me', async (req, res, next) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, createdAt: true }
    });

    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    res.json(user);
  } catch (e) { next(e); }
});

// POST /api/auth/login  { email, password }
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await checkPassword(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    req.session.userId = user.id;
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// POST /api/auth/logout
router.post('/logout', async (req, res, next) => {
  try {
    req.session?.destroy?.(() => {});
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
