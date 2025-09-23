const express = require('express')
const router = express.Router()
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args))

// Proxy to keep your API key secret.
// Requires WEATHER_API_KEY in .env
router.get('/', async (req, res, next) => {
  try {
    const { lat, lon, lang = 'en' } = req.query
    const apiKey = process.env.WEATHER_API_KEY
    if (!apiKey) return res.status(500).json({ error: 'WEATHER_API_KEY missing' })
    if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' })

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&lang=${lang}&appid=${apiKey}&units=metric`
    const r = await fetch(url)
    const data = await r.json()
    res.json(data)
  } catch (e) { next(e) }
})

module.exports = router
