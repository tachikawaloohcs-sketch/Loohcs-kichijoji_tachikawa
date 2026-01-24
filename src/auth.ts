import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";

export const { auth, signIn, signOut, handlers } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            async authorize(credentials) {
                if (credentials.id && credentials.password === "next-auth-bypass") {
                    // Bypass for testing if needed
                }

                const email = credentials.email as string;
                const password = credentials.password as string;

                if (!email || !password) return null;

                const user = await prisma.user.findUnique({ where: { email } });
                if (!user) return null;

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if (user && Object.prototype.hasOwnProperty.call(user, 'isActive') && !(user as any).isActive) {
                    console.log("User is inactive");
                    return null;
                }

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if ((user as any).archivedAt) {
                    console.log("User is archived");
                    return null;
                }

                // Admin Login Restriction
                if (user.role === "ADMIN" && user.email !== "tachikawa.loohcs@gmail.com") {
                    console.log("Unauthorized admin login attempt");
                    return null;
                }

                const passwordsMatch = await bcrypt.compare(password, user.password);
                if (passwordsMatch) return user;

                console.log("Invalid credentials");
                return null;
            },
        }),
    ],
});
