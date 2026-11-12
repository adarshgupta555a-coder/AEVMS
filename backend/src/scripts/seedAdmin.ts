import { prisma } from "../lib/prisma.js";
import { hashPassword } from "../utils/password.js";
import { USERROLE } from "../generated/prisma/enums.js";

const seedAdmin = async () => {
  try {
    const email = process.env.INITIAL_ADMIN_EMAIL || "admin@ems.local";
    const password = process.env.INITIAL_ADMIN_PASSWORD || "Admin@123456";
    const name = process.env.INITIAL_ADMIN_NAME || "System Administrator";

    console.log(`[Seed] Checking administrator account for: ${email}...`);

    const passwordHash = await hashPassword(password);

    const existingAdmin = await prisma.user.findUnique({
      where: { email },
    });

    if (existingAdmin) {
      const updated = await prisma.user.update({
        where: { id: existingAdmin.id },
        data: {
          passwordHash,
          role: USERROLE.ADMIN,
          isActive: true,
        },
      });

      console.log("==================================================");
      console.log("[Seed] Administrator password updated successfully!");
      console.log(`Email:    ${updated.email}`);
      console.log(`Password: ${password}`);
      console.log(`Role:     ${updated.role}`);
      console.log(`Active:   ${updated.isActive}`);
      console.log("==================================================");
      process.exit(0);
    }

    const admin = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: USERROLE.ADMIN,
        isActive: true,
        clientId: null,
      },
    });

    console.log("==================================================");
    console.log("[Seed] Initial Administrator created successfully!");
    console.log(`Email:    ${admin.email}`);
    console.log(`Password: ${password}`);
    console.log(`Role:     ${admin.role}`);
    console.log("==================================================");
    process.exit(0);
  } catch (error) {
    console.error("[Seed] Failed to create initial administrator:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

seedAdmin();
