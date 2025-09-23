const express = require('express')
const router = express.Router()
const { prisma } = require('../db')

// GET /api/sections/home?lang=en
// Simple rule-based home feed: top items per key sections
router.get('/home', async (req, res, next) => {
  try {
    const { lang } = req.query
    const langFilter = lang ? { language: lang } : {}

    async function topByCategory(slug, limit=6) {
      return prisma.article.findMany({
        where: { status: 'published', ...langFilter, category: { slug } },
        orderBy: { publishedAt: 'desc' },
        take: limit,
        include: { category: true }
      })
    }

    const [hero, breaking, finance, tech, sports, entertainment, business] = await Promise.all([
      prisma.article.findMany({
        where: { status: 'published', ...langFilter },
        orderBy: { publishedAt: 'desc' },
        take: 1,
        include: { category: true }
      }),
      topByCategory('breaking', 6),
      topByCategory('finance', 6),
      topByCategory('tech', 6),
      topByCategory('sports', 6),
      topByCategory('entertainment', 6),
      topByCategory('business', 6),
    ])

    res.json({
      hero: hero[0] || null,
      breaking,
      finance,
      tech,
      sports,
      entertainment,
      business
    })
  } catch (e) { next(e) }
})

module.exports = router
