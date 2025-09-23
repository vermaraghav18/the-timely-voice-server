// server/src/seedNavbar.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const key = 'navbar';

  const value = {
    siteName: 'THE TIMELY VOICE',
    languages: ['ENGLISH','हिंदी','বাংলা','मराठी','తెలుగు','தமிழ்'],
    nav: [
      { key: 'top', label: 'TOP NEWS', to: '/articles' },
      { key: 'india', label: 'INDIA', to: '/articles?section=india' },
      { key: 'world', label: 'WORLD', to: '/articles?section=world' },
      { key: 'finance', label: 'FINANCE', to: '/articles?section=finance' },
      { key: 'health', label: 'HEALTH & LIFESTYLE', to: '/articles?section=health' },
      { key: 'tech', label: 'TECH', to: '/articles?section=tech' },
      { key: 'entertainment', label: 'ENTERTAINMENT', to: '/articles?section=entertainment' },
      { key: 'business', label: 'BUSINESS', to: '/articles?section=business' },
      { key: 'sports', label: 'SPORTS', to: '/articles?section=sports' },
      { key: 'women', label: 'WOMEN MAGAZINE', to: '/articles?section=women' },
    ],
    ctas: [{ label: 'GET THE DAILY UPDATES', kind: 'outline', href: '#' }],
    liveText: 'LIVE',
    liveTicker: 'Weather: Heavy rain alert for Mumbai, Pune',
  };

  await prisma.setting.upsert({
    where: { key },
    update: { value: JSON.stringify(value) },  // << STRINGIFY
    create: { key, value: JSON.stringify(value) }, // << STRINGIFY
  });

  console.log('Seeded navbar setting.');
}

main().finally(() => prisma.$disconnect());
