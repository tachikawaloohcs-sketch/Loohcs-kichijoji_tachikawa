import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    const defaultPassword = await bcrypt.hash('password123', 10)
    const adminPassword = await bcrypt.hash('Yamamoto_Hasegawa2525', 10)

    // Admin (ensure exists)
    await prisma.user.upsert({
        where: { email: 'tachikawa.loohcs@gmail.com' },
        update: {
            password: adminPassword,
            isActive: true,
        },
        create: {
            email: 'tachikawa.loohcs@gmail.com',
            name: 'Admin User',
            password: adminPassword,
            role: 'ADMIN',
            isActive: true,
            isProfileComplete: true,
        },
    })

    // Instructor
    const instructor = await prisma.user.upsert({
        where: { email: 'instructor@example.com' },
        update: {
            password: defaultPassword,
            isActive: true,
        },
        create: {
            email: 'instructor@example.com',
            name: 'Test Instructor',
            password: defaultPassword,
            role: 'INSTRUCTOR',
            isActive: true,
            isProfileComplete: true,
        },
    })

    // Student 1 (Active)
    await prisma.user.upsert({
        where: { email: 'student1@example.com' },
        update: {
            password: defaultPassword,
            isActive: true,
        },
        create: {
            email: 'student1@example.com',
            name: 'Active Student',
            password: defaultPassword,
            role: 'STUDENT',
            isActive: true,
            isProfileComplete: true,
        },
    })

    // Student 2 (To be Archived)
    await prisma.user.upsert({
        where: { email: 'student2@example.com' },
        update: {
            password: defaultPassword,
        },
        create: {
            email: 'student2@example.com',
            name: 'Archived Student',
            password: defaultPassword,
            role: 'STUDENT',
            isActive: true, // Will be archived manually in test
            isProfileComplete: true,
        },
    })

    console.log("Seeding complete")
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
