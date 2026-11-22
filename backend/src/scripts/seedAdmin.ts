import { prisma } from "../lib/prisma.js";
import { hashPassword } from "../utils/password.js";
import { USERROLE } from "../generated/prisma/enums.js";

const accountsToSeed = [
  {
    name: "System Administrator",
    email: "admin.ems",
    password: "ems",
    role: USERROLE.ADMIN,
  },
  {
    name: "System Administrator",
    email: "admin@ems.local",
    password: "Admin@123456",
    role: USERROLE.ADMIN,
  },
  {
    name: "System Administrator",
    email: "admin.ems@ems.local",
    password: "ems",
    role: USERROLE.ADMIN,
  },
];

export const seedAdmin = async () => {
  try {
    console.log("[Seed] Ensuring administrator accounts exist in database...");

    for (const acc of accountsToSeed) {
      const passwordHash = await hashPassword(acc.password);
      const existing = await prisma.user.findUnique({
        where: { email: acc.email },
      });

      if (existing) {
        const updated = await prisma.user.update({
          where: { id: existing.id },
          data: {
            name: acc.name,
            passwordHash,
            role: acc.role,
            isActive: true,
          },
        });
        console.log(`[Seed] Updated administrator: ${updated.email} (Password: ${acc.password})`);
      } else {
        const created = await prisma.user.create({
          data: {
            name: acc.name,
            email: acc.email,
            passwordHash,
            role: acc.role,
            isActive: true,
            clientId: null,
          },
        });
        console.log(`[Seed] Created administrator: ${created.email} (Password: ${acc.password})`);
      }
    }

    console.log("==================================================");
    console.log("[Seed] Administrator provisioning complete!");
    console.log("1) Username/Email: admin.ems        | Password: ems");
    console.log("2) Username/Email: admin@ems.local  | Password: Admin@123456");
    console.log("3) Username/Email: admin.ems@ems.local | Password: ems");
    console.log("==================================================");
  } catch (error) {
    console.error("[Seed] Failed to provision administrators:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

seedAdmin();
