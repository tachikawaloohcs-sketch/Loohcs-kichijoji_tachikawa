"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

// Mock Email Function
import { sendEmail } from "@/lib/email";

export async function getInstructors() {
    const instructors = await prisma.user.findMany({
        where: { role: "INSTRUCTOR", isActive: true },
        select: { id: true, name: true, email: true, bio: true, imageUrl: true }, // Force TS re-check
    });
    return instructors;
}

export async function getDetailedShifts(instructorId: string) {
    const shifts = await prisma.shift.findMany({
        where: {
            instructorId,
            start: {
                gte: new Date(),
            },
            isPublished: true,

        },
        include: {
            bookings: true,
        },
        orderBy: {
            start: 'asc'
        }
    });

    return shifts.filter(s => {
        if (s.type === "INDIVIDUAL" && s.bookings.some(b => b.status === "CONFIRMED")) return false;
        return true;
    });
}

export async function createBooking(shiftId: string, meetingType: string = "ONLINE") {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "STUDENT") {
        return { error: "Unauthorized" };
    }

    const shift = await prisma.shift.findUnique({
        where: { id: shiftId },
        include: { instructor: true }
    });

    if (!shift) return { error: "Shift not found" };

    const now = new Date();
    const shiftStart = new Date(shift.start);
    const timeDiff = shiftStart.getTime() - now.getTime();
    const hoursUntilStart = timeDiff / (1000 * 60 * 60);

    if (hoursUntilStart < 24) {
        return { error: "予約期限切れです（授業開始24時間前まで予約可能）" };
    }

    const existingBooking = await prisma.booking.findFirst({
        where: {
            shiftId: shiftId,
            status: "CONFIRMED"
        }
    });

    if (existingBooking && shift.type === "INDIVIDUAL") {
        return { error: "この枠は既に予約されています" };
    }

    try {
        const booking = await prisma.booking.create({
            data: {
                studentId: session.user.id,
                shiftId: shiftId,
                status: "CONFIRMED",
                meetingType: meetingType,
            },
        });

        if (session.user.email) {
            await sendEmail({
                to: session.user.email,
                subject: "予約確定のお知らせ",
                body: `
${format(shiftStart, "yyyy年MM月dd日 HH:mm", { locale: ja })} からの予約が確定しました。
担当講師: ${shift.instructor.name || "講師"}
場所/形式: ${meetingType}
`
            });
        }

        if (shift.instructor.email) {
            await sendEmail({
                to: shift.instructor.email,
                subject: "新規予約が入りました",
                body: `
${format(shiftStart, "yyyy年MM月dd日 HH:mm", { locale: ja })} の枠に新しい予約が入りました。
生徒: ${session.user.name || "生徒"}
`
            });
        }

        revalidatePath("/student/dashboard");
        return { success: true, booking };
    } catch {
        return { error: "Database error" };
    }
}

export async function getStudentBookings() {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "STUDENT") {
        return [];
    }

    const bookings = await prisma.booking.findMany({
        where: {
            studentId: session.user.id,
            status: "CONFIRMED" // Include Cancelled? Maybe separate list.
        },
        include: {
            shift: {
                include: { instructor: { select: { name: true } } }
            },
            report: true
        },
        orderBy: {
            shift: { start: 'desc' }
        }
    });

    return bookings;
    return bookings;
}

export async function createRequest(instructorId: string, date: Date, time: string) {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "STUDENT") {
        return { error: "Unauthorized" };
    }

    const [hours, minutes] = time.split(":").map(Number);
    const startDateTime = new Date(date);
    startDateTime.setHours(hours, minutes, 0, 0);
    const endDateTime = new Date(startDateTime);
    endDateTime.setHours(startDateTime.getHours() + 1); // 1 hour duration default

    try {
        const request = await prisma.scheduleRequest.create({
            data: {
                studentId: session.user.id,
                instructorId: instructorId,
                start: startDateTime,
                end: endDateTime,
                status: "PENDING"
            },
            include: { instructor: { select: { email: true, name: true } }, student: { select: { name: true } } }
        });

        // Notify Instructor
        // Notify Instructor
        await sendEmail({
            to: request.instructor.email,
            subject: "新しい日程リクエストが届きました",
            body: `生徒 ${request.student.name} から ${format(startDateTime, "MM/dd HH:mm", { locale: ja })} の日程リクエストが届きました。ダッシュボードから承認・却下を行ってください。`
        });

        revalidatePath("/student/dashboard");
        return { success: true };
    } catch (e) {
        console.error(e);
        return { error: "リクエスト送信に失敗しました" };
    }
}

export async function cancelBooking(bookingId: string) {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "STUDENT") {
        return { error: "Unauthorized" };
    }

    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { shift: { include: { instructor: true } }, student: true }
    });

    if (!booking) return { error: "Booking not found" };
    if (booking.studentId !== session.user.id) return { error: "Unauthorized" };

    try {
        await prisma.booking.delete({
            where: { id: bookingId }
        });

        // Email Notifications
        if (booking.student.email) {
            await sendEmail({
                to: booking.student.email,
                subject: "予約キャンセルのお知らせ",
                body: `
以下の予約をキャンセルしました。

日時: ${format(new Date(booking.shift.start), "yyyy年MM月dd日 HH:mm", { locale: ja })}
講師: ${booking.shift.instructor.name}
`
            });
        }

        if (booking.shift.instructor.email) {
            await sendEmail({
                to: booking.shift.instructor.email,
                subject: "予約がキャンセルされました",
                body: `
以下の予約がキャンセルされました。

日時: ${format(new Date(booking.shift.start), "yyyy年MM月dd日 HH:mm", { locale: ja })}
生徒: ${booking.student.name}
`
            });
        }

        revalidatePath("/student/dashboard");
        return { success: true };
    } catch {
        return { error: "Failed to cancel booking" };
    }
}
