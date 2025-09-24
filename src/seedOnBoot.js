// server/src/seedOnBoot.js
const { PrismaClient, Prisma } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

// --- helpers to read Prisma schema at runtime ---
function getModel(nameCandidates) {
  const models = Prisma?.dmmf?.datamodel?.models || [];
  for (const name of nameCandidates) {
    const m = models.find((x) => x.name.toLowerCase() === String(name).toLowerCase());
    if (m) return m;
  }
  return null;
}
function hasField(model, fieldName) {
  if (!model) return false;
  return model.fields.some((f) => f.name === fieldName);
}
function enumIncludes(enumName, value) {
  const enums = Prisma?.dmmf?.datamodel?.enums || [];
  const e = enums.find((x) => x.name === enumName);
  return !!e && e.values.some((v) => v.name === value);
}

async function seedAdminAdaptive() {
  // Guess the user model name: adjust candidates as needed.
  const userModel =
    getModel(["User"]) || getModel(["Users"]) || getModel(["Account"]) || getModel(["Admin"]);
  if (!userModel) {
    console.log("[seed] No suitable user model found (User/Users/Account/Admin). Skipping.");
    return;
  }
  console.log(`[seed] Using model: ${userModel.name}`);

  const email = process.env.ADMIN_EMAIL || "admin@local";
  const rawPassword = process.env.ADMIN_PASSWORD || "changeme";
  const passwordHash = await bcrypt.hash(rawPassword, 10);

  // Figure out unique identifier: prefer email, else username.
  let where = {};
  if (hasField(userModel, "email")) where.email = email;
  else if (hasField(userModel, "username")) where.username = email.split("@")[0];
  else {
    console.log("[seed] Neither email nor username field exists; cannot upsert. Skipping.");
    return;
  }

  // Build create/update payloads based on available fields
  const create = {};
  const update = {};

  // Identifier fields
  if (where.email) {
    create.email = where.email;
  }
  if (where.username) {
    create.username = where.username;
  }

  // Name (optional)
  if (hasField(userModel, "name")) {
    create.name = "Admin";
    update.name = "Admin";
  }

  // Password field name can be 'password' or 'passwordHash'
  if (hasField(userModel, "passwordHash")) {
    create.passwordHash = passwordHash;
    update.passwordHash = passwordHash;
  } else if (hasField(userModel, "password")) {
    // Most codebases still store the HASH in `password`. We set the hash.
    create.password = passwordHash;
    update.password = passwordHash;
  } else {
    console.log("[seed] No password/passwordHash field found. Skipping password set.");
  }

  // Role (string or enum)
  if (hasField(userModel, "role")) {
    // Check if role is an enum and supports ADMIN
    const roleField = userModel.fields.find((f) => f.name === "role");
    const isEnum = !!roleField?.type && Prisma?.dmmf?.datamodel?.enums?.some((e) => e.name === roleField.type);
    if (isEnum) {
      if (enumIncludes(roleField.type, "ADMIN")) {
        create.role = "ADMIN";
        update.role = "ADMIN";
      } else {
        // fallback: set whatever first enum value is
        const enums = Prisma.dmmf.datamodel.enums;
        const e = enums.find((x) => x.name === roleField.type);
        if (e?.values?.length) {
          create.role = e.values[0].name;
          update.role = e.values[0].name;
        }
      }
    } else {
      // likely a String field
      create.role = "ADMIN";
      update.role = "ADMIN";
    }
  }

  // Active/enabled flags (common field names)
  for (const f of ["active", "enabled", "isActive", "isEnabled"]) {
    if (hasField(userModel, f)) {
      create[f] = true;
      update[f] = true;
    }
  }

  console.log("[seed] upserting with where/create/update:", { where, create, update });

  const result = await prisma[userModel.name.toLowerCase()].upsert({
    where,
    update,
    create,
  });

  console.log(`[seed] Admin ready: ${result.email || result.username || "(no id field printed)"}`);
}

async function maybeSeed() {
  if (process.env.SEED_ON_BOOT === "1") {
    console.log("[seed] SEED_ON_BOOT=1 → seeding admin user…");
    try {
      await seedAdminAdaptive();
      console.log("[seed] done.");
    } catch (err) {
      console.error("[seed] failed:", err);
    } finally {
      await prisma.$disconnect();
    }
  } else {
    console.log("[seed] SEED_ON_BOOT not set → skipping.");
  }
}

module.exports = { maybeSeed };
