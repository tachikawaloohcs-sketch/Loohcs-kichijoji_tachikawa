"use server";

import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export async function authenticate(prevState: string | undefined, formData: FormData) {
    const email = formData.get("email") as string;

    try {
        const user = await prisma.user.findUnique({ where: { email } });
        // Let signIn handle the password validation failure, but if user implies role...
        // Actually, better to just redirect to root and let middleware handle it if we can't find user
        // But here we want explicit redirect.

        // Check isActive
        if (user && user.isActive === false) {
            return "このアカウントは現在無効化されています。管理者に連絡してください。";
        }

        const redirectUrl = "/";
        // if (user) {
        //     switch (user.role) {
        //         case "ADMIN": redirectUrl = "/admin/dashboard"; break;
        //         case "INSTRUCTOR": redirectUrl = "/instructor/dashboard"; break;
        //         case "STUDENT": redirectUrl = "/student/dashboard"; break;
        //     }
        // }

        await signIn("credentials", formData, { redirectTo: redirectUrl });
    } catch (error) {
        if (error instanceof AuthError) {
            switch (error.type) {
                case "CredentialsSignin":
                    return "メールアドレスまたはパスワードが間違っています。"; // Japanese error message
                default:
                    return "Something went wrong.";
            }
        }
        throw error;
    }
}

export async function register(prevState: string | undefined, formData: FormData) {
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const role = formData.get("role") as string; // STUDENT, INSTRUCTOR, ADMIN
    const bio = formData.get("bio") as string;
    const imageFile = formData.get("image") as File;

    if (!email || !password || !name) {
        return "Missing fields";
    }

    // Admin Registration Restriction
    if (role === "ADMIN") {
        if (email !== "tachikawa.loohcs@gmail.com") {
            return "このメールアドレスでは管理者登録できません";
        }
        if (password !== "Yamamoto_Hasegawa2525") {
            return "管理者パスワードが違います";
        }
    }

    let imageUrl: string | null = null;
    // Image upload disabled for Cloud Run (Read-only file system)
    /*
    if (imageFile && imageFile.size > 0) {
        try {
            const buffer = Buffer.from(await imageFile.arrayBuffer());
            const ext = path.extname(imageFile.name) || ".jpg";
            const fileName = `${randomUUID()}${ext}`;
            const uploadPath = path.join(process.cwd(), "public/uploads", fileName);

            await writeFile(uploadPath, buffer);
            imageUrl = `/uploads/${fileName}`;
        } catch (e) {
            console.error("Image upload failed", e);
            // Optionally return error or proceed without image
        }
    }
    */

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: role || "STUDENT",
                bio: bio || null, // Type check trigger
                imageUrl: imageUrl || null
            },
        });
    } catch (error) {
        console.error("Registration error:", error);
        return "User already exists or database error";
    }

    return "success";
}

export async function logout() {
    await signOut();
}
