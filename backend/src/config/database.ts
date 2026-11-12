import { prisma } from "../lib/prisma.js";

export const connectDatabase = async (): Promise<void> => {
  await prisma.$connect();
  console.log("PostgreSQL database connected successfully.");
};

export const disconnectDatabase = async (): Promise<void> => {
  await prisma.$disconnect();
  console.log("PostgreSQL database disconnected.");
};

export { prisma };
