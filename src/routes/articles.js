const express = require('express');
const router = express.Router();
const { prisma } = require('../db');

// Helper to normalize query params coming as "undefined"/"null"/"" etc.
const clean = (v) => {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'string') return v;
  const t = v.trim();
  if (!t || t.toLowerCase() === 'undefined' || t.toLowerCase() === 'null') return undefined;
  return t;
};

// -----------------------------
// LIST: GET /api/articles?category=tech&lang=en&q=...&status=published&limit=20&offset=0
// -----------------------------
router.get('/', async (req, res, next) => {
  try {
    // sanitize all incoming query params
    const category = clean(req.query.category);
    const lang     = clean(req.query.lang);
    const status   = clean(req.query.status) || 'published';
    const q        = clean(req.query.q);
    const limit    = Math.min(Number(req.query.limit) || 20, 100);
    const offset   = Math.max(Number(req.query.offset) || 0, 0);

    // Build "where" incrementally; IMPORTANT: no 'mode' for SQLite
    const where = { status };
    if (lang) where.language = lang;
    if (category) where.category = { slug: category };
    if (q) {
      where.OR = [
        { title:   { contains: q } },
        { summary: { contains: q } },
        { body:    { contains: q } },
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
  } catch (e) { next(e); }
});

// -----------------------------
// READ ONE (by slug): GET /api/articles/:slug
// -----------------------------
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
  } catch (e) { next(e); }
});

// -----------------------------
// CREATE: POST /api/articles
// -----------------------------
router.post('/', async (req, res, next) => {
  try {
    const d = req.body || {};

    if (!d.title || !d.slug || !d.status)
      return res.status(400).json({ error: 'title, slug and status are required' });
    if (!['draft', 'published'].includes(d.status))
      return res.status(400).json({ error: 'status must be "draft" or "published"' });
    if (!d.categoryId)
      return res.status(400).json({ error: 'categoryId is required' });

    const created = await prisma.article.create({
      data: {
        title: d.title,
        slug: d.slug,
        status: d.status,
        categoryId: Number(d.categoryId),
        summary: d.summary || '',
        body: d.body || '',
        heroImageUrl: d.heroImageUrl || null,
        thumbnailUrl: d.thumbnailUrl || null,
        author: d.author || null,
        source: d.source || null,
        language: d.language || 'en',
        tagsCsv: d.tagsCsv || null,
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

// -----------------------------
// UPDATE (by numeric id): PUT /api/articles/:id
// -----------------------------
router.put('/:id(\\d+)', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const d = req.body || {};

    if (d.status && !['draft', 'published'].includes(d.status))
      return res.status(400).json({ error: 'status must be "draft" or "published"' });

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
        categoryId: d.categoryId != null ? Number(d.categoryId) : undefined,
        tagsCsv: d.tagsCsv,
      },
      include: { category: true },
    });

    res.json(updated);
  } catch (e) {
    if (e && e.code === 'P2002') {
      return res.status(409).json({ error: 'Slug already exists' });
    }
    next(e);
  }
});

// -----------------------------
// DELETE (by numeric id): DELETE /api/articles/:id
// -----------------------------
router.delete('/:id(\\d+)', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await prisma.article.delete({ where: { id } });
    res.status(204).end();
  } catch (e) { next(e); }
});

module.exports = router;
