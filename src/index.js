require('dotenv').config();

const express = require('express');
const session = require('express-session');
const cors = require('cors');

const authRouter = require('./routes/auth');
const articlesRouter = require('./routes/articles');
const categoriesRouter = require('./routes/categories');
const settingsRouter = require('./routes/settings');

// You already connect Prisma in ./db (prints "✅ Prisma connected")
require('./db');

const app = express();

// ----- CORS (for admin dev hosts) -----
const ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
];
app.use(cors({
  origin: ORIGINS,
  credentials: true,
}));

// ----- Body parsing -----
app.use(express.json());

// ----- Sessions (MUST be before routes) -----
app.set('trust proxy', 1); // good habit if you ever sit behind a proxy
app.use(session({
  name: 'tv.sid',
  secret: process.env.SESSION_SECRET || 'dev-change-this-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',    // allows cookie with fetch credentials on same-site
    secure: false,      // set true only when serving HTTPS
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
}));

// ----- Routes -----
app.use('/api/auth', authRouter);
app.use('/api/articles', articlesRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/settings', settingsRouter);

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true }));

// ----- Error handler (keeps 500s readable) -----
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// ----- Start -----
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
  console.log(`CORS origins: ${ORIGINS.join(', ')}`);
});
