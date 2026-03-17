"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log("🌱 Seeding database...");
    const passwordHash = await bcryptjs_1.default.hash("password123", 10);
    // ── Admin ─────────────────────────────────────────────────────────────────────
    const admin = await prisma.user.upsert({
        where: { email: "admin@rgt.com" },
        update: {},
        create: {
            name: "Super Admin",
            email: "admin@rgt.com",
            password: passwordHash,
            role: client_1.Role.ADMIN,
        },
    });
    console.log(`✅ Admin: ${admin.name} (${admin.email})`);
    // ── Staff ─────────────────────────────────────────────────────────────────────
    const staff = await prisma.user.upsert({
        where: { email: "staff@rgt.com" },
        update: {},
        create: {
            name: "Staff Member",
            email: "staff@rgt.com",
            password: passwordHash,
            role: client_1.Role.STAFF,
        },
    });
    console.log(`✅ Staff: ${staff.name} (${staff.email})`);
    // ── Customer ──────────────────────────────────────────────────────────────────
    const customer = await prisma.user.upsert({
        where: { email: "customer@rgt.com" },
        update: {},
        create: {
            name: "Default Customer",
            email: "customer@rgt.com",
            password: passwordHash,
            role: client_1.Role.CUSTOMER,
            staffId: staff.id, // Assigned to our default staff
            mobile: "9876543210",
            aadhar: "1234-5678-9012",
            pan: "ABCDE1234F",
        },
    });
    console.log(`✅ Customer: ${customer.name} (${customer.email})`);
    console.log("\n🎉 Seed complete!");
    console.log("─────────────────────────────────────────────");
    console.log("Login credentials (Password: password123):");
    console.log("  Admin    → admin@rgt.com");
    console.log("  Staff    → staff@rgt.com");
    console.log("  Customer → customer@rgt.com");
    console.log("─────────────────────────────────────────────");
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
