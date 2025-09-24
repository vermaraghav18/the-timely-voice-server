// server/src/seedOnBoot.js
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

async function seedAdmin() {
  const prisma = new PrismaClient();
  try {
    const email = process.env.ADMIN_EMAIL || "admin@local";
    const password = process.env.ADMIN_PASSWORD || "changeme";
    const passwordHash = await bcrypt.hash(password, 10);

    // Adjust this to match your Prisma User model fields exactly.
    // Assumes: model User { email String @unique, passwordHash String, role String?, name String? }
    const user = await prisma.user.upsert({
      where: { email },
      update: { passwordHash, role: "ADMIN", name: "Admin" },
      create: { email, passwordHash, role: "ADMIN", name: "Admin" },
    });

    console.log(`[seed] Admin ready: ${user.email}`);
  } catch (err) {
    console.error("[seed] failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

async function maybeSeed() {
  if (process.env.SEED_ON_BOOT === "1") {
    console.log("[seed] SEED_ON_BOOT=1 → seeding admin user…");
    await seedAdmin();
    console.log("[seed] done.");
  } else {
    console.log("[seed] SEED_ON_BOOT not set → skipping.");
  }
}

module.exports = { maybeSeed };
