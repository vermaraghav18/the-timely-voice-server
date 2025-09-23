const express = require('express')
const router = express.Router()
const { prisma } = require('../db')

router.get('/', async (req, res, next) => {
  try {
    const cats = await prisma.category.findMany({
      orderBy: { sortIndex: 'asc' }
    })
    res.json({ items: cats })
  } catch (e) { next(e) }
})

module.exports = router
