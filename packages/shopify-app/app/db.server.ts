import { PrismaClient } from "@prisma/client";

declare global {
    var prisma: PrismaClient;
}

if (process.env.NODE_ENV !== "production") {
    if (!global.prisma) {
        global.prisma = new PrismaClient();
    }
}

// biome-ignore lint/suspicious/noRedeclare: Global declaration, can be redeclared
const prisma: PrismaClient = global.prisma || new PrismaClient();

export default prisma;
