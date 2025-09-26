// server/src/routes/articles.js
const express = require('express');
const router = express.Router();
const { prisma } = require('../db');

/* ------------ small helpers ------------ */
const clean = (v) => {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'string') return v;
  const t = v.trim();
  if (!t || t.toLowerCase() === 'undefined' || t.toLowerCase() === 'null') return undefined;
  return t;
};

// Resolve a valid categoryId from the request body;
// if missing/invalid, upsert and use WORLD.
async function resolveCategoryId(d) {
  let categoryId;
  if (d && d.categoryId !== undefined && d.categoryId !== null && `${d.categoryId}`.trim() !== '') {
    const maybe = Number(d.categoryId);
    if (!Number.isNaN(maybe) && Number.isFinite(maybe)) {
      categoryId = maybe;
    }
  }
  if (!categoryId) {
    const world = await prisma.category.upsert({
      where: { slug: 'world' },
      update: {},
      create: { name: 'WORLD', slug: 'world', sortIndex: 0 },
    });
    categoryId = world.id;
  }
  return categoryId;
}

/* ------------ LIST ------------ */
// GET /api/articles?category=world&lang=en&q=...&status=published&limit=20&offset=0
router.get('/', async (req, res, next) => {
  try {
    const category = clean(req.query.category);
    const lang     = clean(req.query.lang);
    const status   = clean(req.query.status) || 'published';
    const q        = clean(req.query.q);
    const limit    = Math.min(Number(req.query.limit) || 20, 100);
    const offset   = Math.max(Number(req.query.offset) || 0, 0);

    const where = { status };
    if (lang) where.language = lang;
    // If your relation filter requires "is", change to: where.category = { is: { slug: category } }
    if (category) where.category = { slug: category };
    if (q) {
      where.OR = [
        { title:   { contains: q, mode: 'insensitive' } },
        { summary: { contains: q, mode: 'insensitive' } },
        { body:    { contains: q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.article.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        include: { category: true },
        take: limit,
        skip: offset,
      }),
      prisma.article.count({ where })
    ]);

    res.json({ items, total, limit, offset });
  } catch (e) {
    next(e);
  }
});

/* ------------ CREATE ------------ */
// POST /api/articles
router.post('/', async (req, res, next) => {
  try {
    const d = req.body || {};
    if (!d.title || !d.slug || !d.status)
      return res.status(400).json({ error: 'title, slug and status are required' });
    if (!['draft', 'published'].includes(d.status))
      return res.status(400).json({ error: 'status must be "draft" or "published"' });

    const categoryId = await resolveCategoryId(d);

    const created = await prisma.article.create({
      data: {
        title: d.title,
        slug: d.slug,
        status: d.status,
        categoryId,                    // <-- use resolved id
        summary: d.summary ?? '',
        body: d.body ?? '',
        heroImageUrl: d.heroImageUrl ?? null,
        thumbnailUrl: d.thumbnailUrl ?? null,
        author: d.author ?? null,
        source: d.source ?? null,
        language: d.language ?? 'en',
        tagsCsv: d.tagsCsv ?? null,
      },
      include: { category: true },
    });

    res.status(201).json(created);
  } catch (e) {
    if (e && e.code === 'P2002') {
      return res.status(409).json({ error: 'Slug already exists' });
    }
    next(e);
  }
});

/* ======================================================================
   EXPLICIT BY-SLUG ENDPOINTS (clean separation from numeric :id routes)
   ====================================================================== */

// GET /api/articles/by-slug/:slug
router.get('/by-slug/:slug', async (req, res, next) => {
  try {
    const slug = clean(req.params.slug);
    if (!slug) return res.status(400).json({ error: 'Invalid slug' });

    const article = await prisma.article.findUnique({
      where: { slug },
      include: { category: true }
    });
    if (!article) return res.status(404).json({ error: 'Not found' });
    res.json(article);
  } catch (e) {
    next(e);
  }
});

// DELETE /api/articles/by-slug/:slug
router.delete('/by-slug/:slug', async (req, res, next) => {
  try {
    const slug = clean(req.params.slug);
    if (!slug) return res.status(400).json({ error: 'Invalid slug' });

    const deleted = await prisma.article.delete({ where: { slug } });
    // Return deleted row for convenience (or 204 if you prefer)
    res.json(deleted);
  } catch (e) {
    // Prisma not-found -> 404 (P2025)
    if (e && e.code === 'P2025') {
      return res.status(404).json({ error: 'Not found' });
    }
    next(e);
  }
});

/* ==========================================================
   NUMERIC :id ROUTES — regex ensures only numbers hit these
   ========================================================== */

// PUT /api/articles/:id
router.put('/:id(\\d+)', updateArticleHandler);
// PATCH /api/articles/:id
router.patch('/:id(\\d+)', updateArticleHandler);
async function updateArticleHandler(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
    const d = req.body || {};

    if (d.status && !['draft', 'published'].includes(d.status))
      return res.status(400).json({ error: 'status must be "draft" or "published"' });

    // If categoryId is missing/invalid, default to WORLD
    const categoryId = await resolveCategoryId(d);

    const updated = await prisma.article.update({
      where: { id },
      data: {
        title: d.title,
        slug: d.slug,
        summary: d.summary,
        body: d.body,
        heroImageUrl: d.heroImageUrl,
        thumbnailUrl: d.thumbnailUrl,
        author: d.author,
        source: d.source,
        language: d.language,
        status: d.status,
        categoryId,                 // <-- guaranteed valid id now
        tagsCsv: d.tagsCsv,
      },
      include: { category: true },
    });

    res.json(updated);
  } catch (e) {
    if (e && e.code === 'P2002') {
      return res.status(409).json({ error: 'Slug already exists' });
    }
    if (e && e.code === 'P2025') {
      return res.status(404).json({ error: 'Not found' });
    }
    next(e);
  }
}

// DELETE /api/articles/:id
router.delete('/:id(\\d+)', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await prisma.article.delete({ where: { id } });
    res.status(204).end();
  } catch (e) {
    if (e && e.code === 'P2025') {
      return res.status(404).json({ error: 'Not found' });
    }
    next(e);
  }
});

/* ==========================================================
   LEGACY: KEEP GET /:slug for backwards compatibility
   (this must come AFTER the numeric :id routes above)
   ========================================================== */

// GET /api/articles/:slug
router.get('/:slug', async (req, res, next) => {
  try {
    const slug = clean(req.params.slug);
    if (!slug) return res.status(400).json({ error: 'Invalid slug' });

    const article = await prisma.article.findUnique({
      where: { slug },
      include: { category: true }
    });
    if (!article) return res.status(404).json({ error: 'Not found' });
    res.json(article);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
