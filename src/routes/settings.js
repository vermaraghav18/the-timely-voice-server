// server/routes/settings.js
const express = require('express');
const router = express.Router();
const { prisma } = require('../db');

// Defaults for settings keys that should not 404 on first read
function defaultFor(key) {
  if (key === 'news-split') {
    return {
      mode: 'article',           // 'article' | 'custom'
      articleSlug: '',
      item: {
        leftImage: '',
        rightImage: '',
        title: '',
        description: '',
        byline: '',
        href: '',
        publishedAt: ''
      }
    };
  }
  return null; // null => still 404 if missing
}

// GET /api/settings/:key
router.get('/:key', async (req, res, next) => {
  try {
    const key = String(req.params.key);
    const row = await prisma.setting.findUnique({ where: { key } });

    if (!row) {
      const def = defaultFor(key);
      if (def) return res.json(def);          // return default instead of 404
      return res.status(404).json({ error: 'Not found' });
    }

    let value = {};
    try { value = JSON.parse(row.value || '{}'); } catch {}
    res.json(value);
  } catch (e) {
    next(e);
  }
});

// PUT /api/settings/:key
router.put('/:key', async (req, res, next) => {
  try {
    const key = String(req.params.key);
    const valueObj = req.body ?? {};
    const valueStr = JSON.stringify(valueObj);

    await prisma.setting.upsert({
      where: { key },
      update: { value: valueStr },
      create: { key, value: valueStr },
    });

    res.json(valueObj);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
