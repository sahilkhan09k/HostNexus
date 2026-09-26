import { PrismaClient } from "@prisma/client";

// Centralized Prisma client instance
// Prevents creating multiple instances across services
const prismaClientSingleton = () => {
  return new PrismaClient({
    // Query logging prints parameters (emails, amounts...) — opt-in only, never implied by NODE_ENV
    log: process.env.PRISMA_LOG_QUERIES === "true" ? ["query", "error", "warn"] : ["error", "warn"],
  });
};

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

// Use global singleton to prevent multiple instances in development
export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}

// Graceful shutdown
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
