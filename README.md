# The Timely Voice — Backend Starter (Option B)

This is a simple, production-ready **Node.js + Express + Prisma** backend for your site.  
It gives you: Articles, Categories, a Home Sections API, and a Weather proxy.  
Uses **SQLite in development** (no setup). You can switch to Postgres later easily.

## What you get
- **/api/health** — quick check endpoint
- **/api/categories** — list of categories
- **/api/articles** — list/search articles (filters: category, lang, q, limit/offset)
- **/api/articles/:slug** — get one article
- **/api/sections/home** — one call for home (hero + sections)
- **/api/weather** — server-side weather proxy (keeps your API key secret)

## 1) Install
```bash
npm install
```

## 2) Configure env
Copy `.env.example` to `.env` and keep defaults to start (SQLite):
```bash
cp .env.example .env
```
If you have an OpenWeather key, add it to `WEATHER_API_KEY` (optional).

## 3) Initialize DB
```bash
npx prisma generate
npx prisma migrate dev --name init
npm run db:seed
```

## 4) Run
```bash
npm run dev
```
The API will be at: **http://localhost:4000**

## 5) Connect your frontend
In your **frontend** `.env.local` set:
```
VITE_API_BASE_URL=http://localhost:4000
```
Update your fetch helper to prefix with `VITE_API_BASE_URL`.

- Home page: call `GET /api/sections/home?lang=en`
- Section page: call `GET /api/articles?category=tech|sports|finance`
- Weather: call `GET /api/weather?lat=...&lon=...&lang=hi`

## Switch to Postgres later
- Change `datasource db` in `prisma/schema.prisma`
- Set `DATABASE_URL` accordingly in `.env`
- Run `npx prisma migrate deploy` on your server

## Deploy (quick idea)
- Render / Railway: create a Web Service, add env vars, run `npm start`
- Use a persistent volume or Postgres add-on for production

---
**Next steps** (optional):
- Add Auth (JWT) + Admin routes (POST/PATCH/DELETE for articles) 
- Add file uploads (Cloudinary or S3) and store URLs in `heroImageUrl/thumbnailUrl`
- Add a curated "Home Plan" table if you prefer manual selection over rule-based
