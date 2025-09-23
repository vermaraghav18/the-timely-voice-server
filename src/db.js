// server/src/db.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function connectOnce() {
  try {
    await prisma.$connect();
    console.log('✅ Prisma connected');
  } catch (e) {
    console.error('❌ Prisma connection error', e);
  }
}
connectOnce();

module.exports = { prisma };
