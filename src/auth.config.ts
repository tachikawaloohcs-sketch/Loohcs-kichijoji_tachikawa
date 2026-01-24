import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
    pages: {
        signIn: "/login",
    },
    secret: process.env.AUTH_SECRET || "vhQzYpGX9dlG4DYdrxZ9dlr86f+mFzdn9fJhquHB0Ng=",
    providers: [], // Configured in auth.ts to avoid edge runtime issues
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.role = user.role;
                token.id = user.id || "";
            }
            return token;
        },
        async session({ session, token }) {
            if (token && session.user) {
                session.user.role = token.role;
                session.user.id = token.id;
            }
            return session;
        },
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const role = auth?.user?.role;
            const isOnDashboard = nextUrl.pathname.includes("/dashboard"); // Keep existing check or broaden it?

            // Broaden protection to any role-specific path
            const isOnStudentArea = nextUrl.pathname.startsWith("/student");
            const isOnInstructorArea = nextUrl.pathname.startsWith("/instructor");
            const isOnAdminArea = nextUrl.pathname.startsWith("/admin");

            // Dashboard paths map
            const dashboardPaths: Record<string, string> = {
                STUDENT: "/student/dashboard",
                INSTRUCTOR: "/instructor/dashboard",
                ADMIN: "/admin/dashboard",
            };

            if (isOnStudentArea || isOnInstructorArea || isOnAdminArea) {
                if (isLoggedIn) {
                    const userDashboard = dashboardPaths[role as string] || "/";

                    if (isOnStudentArea && role !== "STUDENT") {
                        return Response.redirect(new URL(userDashboard, nextUrl));
                    }
                    if (isOnInstructorArea && role !== "INSTRUCTOR") {
                        return Response.redirect(new URL(userDashboard, nextUrl));
                    }
                    if (isOnAdminArea && role !== "ADMIN") {
                        return Response.redirect(new URL(userDashboard, nextUrl));
                    }
                    return true;
                }
                return false; // Redirect unauthenticated users to login page
            } else if (isLoggedIn) {
                // Redirect logged-in users away from auth pages
                const isOnAuthPage = nextUrl.pathname === "/login" || nextUrl.pathname === "/register" || nextUrl.pathname === "/";
                if (isOnAuthPage) {
                    const userDashboard = dashboardPaths[role as string];
                    if (userDashboard && nextUrl.pathname !== userDashboard) {
                        return Response.redirect(new URL(userDashboard, nextUrl));
                    }
                }
            }
            return true;
        },
    },
};
