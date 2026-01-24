import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import AdminDashboardClient from "./AdminDashboardClient";
import { redirect } from "next/navigation";
import { getUsers, getAllInstructors, getMasterSchedule, getGlobalSettings } from "./actions";

export default async function AdminDashboardPage() {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
        redirect("/login");
    }

    // Existing: Fetch all students with reports
    const studentsWithReports = await prisma.user.findMany({
        where: { role: "STUDENT" },
        include: {
            studentBookings: {
                where: {
                    status: "CONFIRMED",
                    report: { isNot: null }
                },
                include: {
                    report: true,
                    shift: {
                        include: { instructor: { select: { name: true } } }
                    }
                },
                orderBy: {
                    shift: { start: 'desc' }
                }
            }
        },
        orderBy: { name: 'asc' }
    });

    const allUsers = await getUsers();
    const allInstructors = await getAllInstructors();
    const masterShifts = await getMasterSchedule();
    const deadlineSetting = await getGlobalSettings("CARTE_DEADLINE_EXTENSION_HOURS");
    const extensionHours = parseInt(deadlineSetting.value || "0", 10);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return <AdminDashboardClient students={studentsWithReports} allUsers={allUsers as any} allInstructors={allInstructors as any} masterShifts={masterShifts as any} initialDeadlineExtension={extensionHours} />;
}
