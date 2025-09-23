// server/src/routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const { PrismaClient } = require('@prisma/client');
const { prisma } = require('../db'); 
const prisma = new PrismaClient();
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const COOKIE_NAME = 'tv_session';

// 7 days
const TOKEN_TTL_SEC = 7 * 24 * 60 * 60;

// Sign a JWT for a user id
function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: TOKEN_TTL_SEC });
}

// Shape what we return to the client
function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    name: u.name || 'Admin',
    role: u.role || 'admin',
  };
}

// GET /api/auth/me  -> current session user (if any)
router.get('/me', async (req, res) => {
  try {
    const raw = req.cookies?.[COOKIE_NAME];
    if (!raw) return res.status(401).json({ ok: false, error: 'No session' });

    let payload;
    try {
      payload = jwt.verify(raw, JWT_SECRET);
    } catch {
      return res.status(401).json({ ok: false, error: 'Invalid session' });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true },
    });
    if (!user) return res.status(401).json({ ok: false, error: 'User not found' });

    return res.json({ ok: true, user: publicUser(user) });
  } catch (err) {
    console.error('GET /auth/me error', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// POST /api/auth/login  { email, password }
router.post('/login', async (req, res) => {
  try {
    const { email, password } = (req.body || {});
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: 'Email and password required' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, role: true, passwordHash: true },
    });

    if (!user) {
      return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash || '');
    if (!ok) {
      return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    }

    const token = signToken(user.id);

    // Cookie options for local dev
    const cookieStr = cookie.serialize(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false, // set true when serving over HTTPS
      path: '/',
      maxAge: TOKEN_TTL_SEC,
    });

    res.setHeader('Set-Cookie', cookieStr);
    return res.json({ ok: true, user: publicUser(user) });
  } catch (err) {
    console.error('POST /auth/login error', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  const cookieStr = cookie.serialize(COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/',
    maxAge: 0,
  });
  res.setHeader('Set-Cookie', cookieStr);
  return res.json({ ok: true });
});

module.exports = router;
