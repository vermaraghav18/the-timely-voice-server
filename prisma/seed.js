// server/prisma/seed.js
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  /* =========================
   *  Admin user (for /api/auth)
   * ========================= */
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@local';
  const adminPassword = process.env.ADMIN_PASSWORD || 'changeme';

  // Hash the password before storing
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {}, // don't change password on each seed; adjust if you want resets
    create: {
      email: adminEmail,
      passwordHash,
      role: 'admin',
    },
  });

  console.log(`Seeded admin: ${admin.email}`);

  /* =========================
   *  Categories
   * ========================= */
  const cats = [
    { name: 'Breaking',       slug: 'breaking',       sortIndex: 0 },
    { name: 'Business',       slug: 'business',       sortIndex: 1 },
    { name: 'Finance',        slug: 'finance',        sortIndex: 2 },
    { name: 'Tech',           slug: 'tech',           sortIndex: 3 },
    { name: 'Sports',         slug: 'sports',         sortIndex: 4 },
    { name: 'Entertainment',  slug: 'entertainment',  sortIndex: 5 },
  ];

  for (const c of cats) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: c,
    });
  }

  /* =========================
   *  Articles (sample)
   * ========================= */
  const sampleArticles = [
    {
      slug: 'sample-hero-story',
      title: 'Sample Hero Story',
      summary: 'This is a sample hero article used for home page testing.',
      body: 'Longer body text for the hero story.',
      heroImageUrl: 'https://picsum.photos/1200/675',
      thumbnailUrl: 'https://picsum.photos/400/225',
      author: 'TV Staff',
      source: 'The Timely Voice',
      language: 'en',
      status: 'published',
      category: { connect: { slug: 'breaking' } },
      tagsCsv: 'top,hero',
    },
    {
      slug: 'finance-markets-today',
      title: 'Markets Today: Quick Snapshot',
      summary: 'Stocks mixed as investors weigh key earnings.',
      body: 'Market wrap details go here.',
      thumbnailUrl: 'https://picsum.photos/400/225?2',
      author: 'Finance Desk',
      source: 'The Timely Voice',
      language: 'en',
      status: 'published',
      category: { connect: { slug: 'finance' } },
      tagsCsv: 'finance',
    },
    {
      slug: 'tech-latest-gadgets',
      title: 'Five Gadgets Making Waves',
      summary: 'A roundup of notable gadgets this week.',
      body: 'Gadget details here.',
      thumbnailUrl: 'https://picsum.photos/400/225?3',
      author: 'Tech Desk',
      source: 'The Timely Voice',
      language: 'en',
      status: 'published',
      category: { connect: { slug: 'tech' } },
      tagsCsv: 'tech',
    },
  ];

  for (const a of sampleArticles) {
    await prisma.article.upsert({
      where: { slug: a.slug },
      update: {},
      create: a,
    });
  }

  console.log('Seed complete.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
