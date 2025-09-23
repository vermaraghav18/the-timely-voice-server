const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
let bcrypt = null;
try { bcrypt = require('bcryptjs'); } catch {}

const prisma = new PrismaClient();

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

async function main() {
  const email = 'admin@local';
  const password = 'changeme';

  let passwordHash;
  if (bcrypt) {
    passwordHash = await bcrypt.hash(password, 10);
  } else {
    // store sha256 if bcrypt isn't available
    passwordHash = sha256(password);
  }

  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: 'admin' },
    create: { email, passwordHash, role: 'admin' },
  });

  console.log(`✔ Admin ready: ${email} / ${password}`);
}

main().finally(() => prisma.$disconnect());
