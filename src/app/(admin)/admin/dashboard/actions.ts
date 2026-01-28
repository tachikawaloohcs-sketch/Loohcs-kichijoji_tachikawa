"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { fromZonedTime } from "date-fns-tz";

// ユーザー管理: 全ユーザー取得
export async function getUsers() {
    const session = await auth();
    if (session?.user?.role !== "ADMIN") return [];

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayOfYear = new Date(now.getFullYear(), 0, 1);

    const users = await prisma.user.findMany({
        where: { archivedAt: null },
        orderBy: { name: 'asc' },
        include: {
            studentBookings: {
                include: { shift: true, report: true }
            },
            instructorShifts: {
                include: { bookings: { include: { report: true } } }
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            admissionResults: true
        } as any
    });

    return users.map((u: any) => {
        // Instructor Stats
        const monthPublished = u.instructorShifts ? u.instructorShifts.filter((s: any) => s.start >= firstDayOfMonth).length : 0;

        const instructorBookings = u.instructorShifts ? u.instructorShifts.flatMap((s: any) => s.bookings.map((b: any) => ({ ...b, shift: s }))) : [];

        const monthCompleted = instructorBookings.filter((b: any) =>
            b.status === "CONFIRMED" &&
            new Date(b.shift.start) >= firstDayOfMonth &&
            (b.report || new Date(b.shift.start) < now)
        ).length;

        const yearCompleted = instructorBookings.filter((b: any) =>
            b.status === "CONFIRMED" &&
            new Date(b.shift.start) >= firstDayOfYear &&
            (b.report || new Date(b.shift.start) < now)
        ).length;

        const totalCompleted = instructorBookings.filter((b: any) =>
            b.status === "CONFIRMED" &&
            (b.report || new Date(b.shift.start) < now)
        ).length;

        return {
            ...u,
            stats: {
                monthPublished,
                monthCompleted,
                yearCompleted,
                totalCompleted
            }
        };
    });
}

// ユーザー管理: アーカイブ済みユーザー検索
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getArchivedUsers(filters: { role: string; year: string; school: string; status: string }) {
    const session = await auth();
    if (session?.user?.role !== "ADMIN") return [];

    // Base query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
        archivedAt: { not: null }
    };

    // Role Filter
    if (filters.role !== "ALL") {
        where.role = filters.role;
    }

    // Year Filter
    if (filters.year !== "ALL") {
        where.archiveYear = parseInt(filters.year);
    }

    // School and Status Filters (require joining AdmissionResult)
    if (filters.school || filters.status !== "ALL") {
        const admissionWhere: any = {};

        if (filters.school) {
            admissionWhere.schoolName = { contains: filters.school };
        }

        if (filters.status !== "ALL") {
            if (filters.status === "PASSED") {
                admissionWhere.status = { in: ["PASSED_FIRST", "PASSED_FINAL"] };
            } else {
                admissionWhere.status = filters.status;
            }
        }

        where.admissionResults = {
            some: admissionWhere
        };
    }

    return await prisma.user.findMany({
        where,
        orderBy: { archivedAt: 'desc' },
        include: {
            admissionResults: true
        } as any
    });
}

// ユーザー管理: アーカイブ（論理削除）
export async function archiveUser(userId: string) {
    const session = await auth();
    if (session?.user?.role !== "ADMIN") return { error: "Unauthorized" };

    if (userId === session.user.id) {
        return { error: "自分自身をアーカイブすることはできません" };
    }

    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return { error: "User not found" };

        const now = new Date();
        const currentYear = now.getFullYear();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await prisma.user.update({
            where: { id: userId },
            data: {
                archivedAt: now,
                archiveYear: currentYear,
                isActive: false // Also deactivate
            } as any
        });

        revalidatePath("/admin/dashboard");
        return { success: true };
    } catch (e) {
        return { error: "Failed to archive user" };
    }
}

// ユーザー管理: 復活（アーカイブ解除）
export async function unarchiveUser(userId: string) {
    const session = await auth();
    if (session?.user?.role !== "ADMIN") return { error: "Unauthorized" };

    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await prisma.user.update({
            where: { id: userId },
            data: {
                archivedAt: null,
                archiveYear: null,
                isActive: true
            } as any
        });

        revalidatePath("/admin/dashboard");
        return { success: true };
    } catch (e) {
        return { error: "Failed to unarchive user" };
    }
}

// 授業管理: 全講師取得（シフト表示用）
export async function getAllInstructors() {
    const session = await auth();
    if (session?.user?.role !== "ADMIN") return [];

    return await prisma.user.findMany({
        where: { role: "INSTRUCTOR" },
        select: { id: true, name: true }
    });
}

// 授業管理: 全体シフト取得（カレンダー用）
export async function getMasterSchedule() {
    const session = await auth();
    if (session?.user?.role !== "ADMIN") return [];

    return await prisma.shift.findMany({
        where: {
            // For now, fetch all or maybe limit to recent/future?
            // Let's fetch +/- 3 months or just all for simplicity first
            start: {
                gte: new Date(new Date().setMonth(new Date().getMonth() - 1)) // From 1 month ago
            }
        },
        include: {
            instructor: { select: { name: true } },
            bookings: {
                include: {
                    student: { select: { name: true } }
                }
            }
        },
        orderBy: { start: 'asc' }
    });
}


// 授業管理: 特権シフト作成（制限なし）
export async function adminCreateShift(instructorId: string, dateStr: string, startTime: string, endTime: string, type: string) {
    const session = await auth();
    if (session?.user?.role !== "ADMIN") return { error: "Unauthorized" };

    // Parse as JST (dateStr is "YYYY-MM-DD")
    const startDateTime = fromZonedTime(`${dateStr} ${startTime}`, 'Asia/Tokyo');
    const endDateTime = fromZonedTime(`${dateStr} ${endTime}`, 'Asia/Tokyo');

    // Overlap Check for Admin
    const overlap = await prisma.shift.findFirst({
        where: {
            instructorId,
            start: { lt: endDateTime },
            end: { gt: startDateTime }
        }
    });
    if (overlap) return { error: "同時間帯に既にシフトが存在します" };

    // If end < start, maybe it's next day? Or just user error?
    // Let's assume user error or same day for now, as shifts are usually within a day.
    if (endDateTime <= startDateTime) {
        // Maybe crossing midnight?
        // endDateTime.setDate(endDateTime.getDate() + 1);
        // For now let's just create it as is (might show error if end < start in DB constraints if any/logic)
    }

    try {
        await prisma.shift.create({
            data: {
                instructorId,
                start: startDateTime,
                end: endDateTime,
                type: type as any, // Cast to enum if needed or string
                isPublished: true,
                location: "ONLINE" // Default for now
            }
        });
        revalidatePath("/admin/dashboard");
        return { success: true };
    } catch (e) {
        return { error: "シフト作成に失敗しました" };
    }
}

// 授業管理: 特権シフト削除（予約があっても削除）
export async function adminDeleteShift(shiftId: string) {
    const session = await auth();
    if (session?.user?.role !== "ADMIN") return { error: "Unauthorized" };

    try {
        // Bookings are cascaded? Usually not by default in prisma unless configured but let's check or do manual delete
        // Schema doesn't specify cascade. Need to delete bookings first.

        await prisma.booking.deleteMany({
            where: { shiftId }
        });

        await prisma.shift.delete({
            where: { id: shiftId }
        });

        revalidatePath("/admin/dashboard");
        return { success: true };
    } catch (e) {
        console.error(e);
        return { error: "シフト削除に失敗しました" };
    }
}

// アーカイブアクセス権限管理: 取得
export async function getArchiveAccesses(studentId: string) {
    const session = await auth();
    if (session?.user?.role !== "ADMIN") return [];

    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const accesses = await (prisma as any).archiveAccess.findMany({
            where: { studentId },
            include: { instructor: { select: { id: true, name: true } } }
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return accesses.map((a: any) => a.instructor);
    } catch (e) {
        return [];
    }
}

// アーカイブアクセス権限管理: 付与
export async function grantArchiveAccess(instructorId: string, studentId: string) {
    const session = await auth();
    if (session?.user?.role !== "ADMIN") return { error: "Unauthorized" };

    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prisma as any).archiveAccess.create({
            data: { instructorId, studentId }
        });
        revalidatePath("/admin/dashboard");
        return { success: true };
    } catch (e) {
        return { error: "権限の付与に失敗しました" };
    }
}

// アーカイブアクセス権限管理: 剥奪
export async function revokeArchiveAccess(instructorId: string, studentId: string) {
    const session = await auth();
    if (session?.user?.role !== "ADMIN") return { error: "Unauthorized" };

    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prisma as any).archiveAccess.deleteMany({
            where: { instructorId, studentId }
        });
        revalidatePath("/admin/dashboard");
        return { success: true };
    } catch (e) {
        return { error: "権限の剥奪に失敗しました" };
    }
}

// 授業管理: 特権予約作成（強制予約）
export async function adminCreateBooking(shiftId: string, studentId: string) {
    const session = await auth();
    if (session?.user?.role !== "ADMIN") return { error: "Unauthorized" };

    const shift = await prisma.shift.findUnique({
        where: { id: shiftId },
        include: {
            bookings: { where: { status: "CONFIRMED" } },
            instructor: true
        }
    });

    if (!shift) return { error: "Shift not found" };

    if (shift.type === "INDIVIDUAL" && shift.bookings.length > 0) {
        return { error: "既に予約が入っています" };
    }

    const student = await prisma.user.findUnique({ where: { id: studentId } });
    if (!student) return { error: "Student not found" };

    // Overlap Check for Student (Admin)
    const studentOverlap = await prisma.booking.findFirst({
        where: {
            studentId,
            status: "CONFIRMED",
            shift: {
                start: { lt: shift.end },
                end: { gt: shift.start }
            }
        }
    });
    if (studentOverlap) return { error: "この生徒は同時間帯に既に授業予約があります" };

    try {
        await prisma.booking.create({
            data: {
                shiftId,
                studentId,
                status: "CONFIRMED",
                meetingType: "ONLINE"
            }
        });

        // Email to Student
        // Mock import sendEmail logic - ideally this should be a shared utility
        console.log(`[EMAIL SIMULATION]`);
        console.log(`To Student: ${student.email}`);
        console.log(`Subject: 【予約確定】管理者により授業予約が追加されました`);
        console.log(`Body: 日時: ${shift.start.toLocaleString("ja-JP")}\n担当: ${shift.instructor.name}`);
        console.log("-------------------");

        // Email to Instructor
        console.log(`[EMAIL SIMULATION]`);
        console.log(`To Instructor: ${shift.instructor.email}`);
        console.log(`Subject: 【予約確定】管理者により新規予約が追加されました`);
        console.log(`Body: 日時: ${shift.start.toLocaleString("ja-JP")}\n生徒: ${student.name}`);
        console.log("-------------------");

        revalidatePath("/admin/dashboard");
        return { success: true };
    } catch (e) {
        return { error: "予約作成に失敗しました" };
    }
}

// システム設定: 取得
export async function getGlobalSettings(key: string) {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const setting = await (prisma as any).globalSettings.findUnique({
            where: { key }
        });
        return { value: setting?.value ?? null };
    } catch (e) {
        return { value: null };
    }
}

// システム設定: 更新
export async function updateGlobalSettings(key: string, value: string, description?: string) {
    const session = await auth();
    if (session?.user?.role !== "ADMIN") return { error: "Unauthorized" };

    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prisma as any).globalSettings.upsert({
            where: { key },
            update: { value, description },
            create: { key, value, description }
        });
        revalidatePath("/admin/dashboard");
        revalidatePath("/instructor/dashboard");
        return { success: true };
    } catch (e) {
        return { error: "設定の更新に失敗しました" };
    }
}




