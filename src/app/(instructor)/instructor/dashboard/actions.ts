"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

import { fromZonedTime } from 'date-fns-tz';

// Mock Email Function
import { sendEmail } from "@/lib/email";

export async function getInstructorShifts() {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "INSTRUCTOR") {
        return [];
    }

    const shifts = await prisma.shift.findMany({
        where: {
            instructorId: session.user.id,
        },
        include: {
            bookings: {
                include: {
                    student: { select: { name: true } },
                    report: true
                }
            }
        },
        orderBy: {
            start: 'asc',
        },
    });

    return shifts;
}

export async function getAllShifts() {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "INSTRUCTOR") return [];

    return await prisma.shift.findMany({
        where: {
            isPublished: true,
            // You might want to filter past shifts for master schedule to reduce load, or keep all.
            // Let's keep all for now or current month +/-. For master view usually recent/future.
            start: {
                gte: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1) // From last month
            }
        },
        include: {
            instructor: { select: { id: true, name: true } },
            bookings: {
                include: { student: { select: { name: true } } }
            }
        },
        orderBy: { start: 'asc' }
    });
}

export async function getInstructorHistory() {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "INSTRUCTOR") return [];

    return await prisma.booking.findMany({
        where: {
            shift: { instructorId: session.user.id }
        },
        include: {
            student: { select: { name: true } },
            shift: true,
            report: true
        },
        orderBy: { shift: { start: 'desc' } }
    });
}



export async function getInstructorRequests() {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "INSTRUCTOR") return [];

    return await prisma.scheduleRequest.findMany({
        where: {
            instructorId: session.user.id,
            status: "PENDING"
        },
        include: {
            student: { select: { name: true, email: true } }
        },
        orderBy: { createdAt: 'desc' }
    });
}

// New function for Report Management
export async function getStudentsForInstructor() {
    const session = await auth();
    if (session?.user?.role !== "INSTRUCTOR") return [];

    // Instructors should see all students to view their past reports history
    return await prisma.user.findMany({
        where: { role: "STUDENT" },
        include: {
            studentBookings: {
                include: {
                    shift: {
                        include: {
                            instructor: { select: { name: true } }
                        }
                    },
                    report: true
                },
                orderBy: { shift: { start: 'desc' } }
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            admissionResults: true
        } as any,
        orderBy: { name: 'asc' }
    });
}

export async function createShift(formData: FormData) {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "INSTRUCTOR") {
        return { error: "Unauthorized" };
    }

    const dateStr = formData.get("date") as string;
    const startTime = formData.get("startTime") as string;
    const endTime = formData.get("endTime") as string;
    const type = formData.get("type") as string;
    const className = formData.get("className") as string;

    if (!dateStr || !startTime || !endTime || !type) {
        return { error: "Missing fields" };
    }

    // Parse as JST
    const startDateTime = fromZonedTime(`${dateStr} ${startTime}`, 'Asia/Tokyo');
    const endDateTime = fromZonedTime(`${dateStr} ${endTime}`, 'Asia/Tokyo');

    // Check for overlaps
    const overlap = await prisma.shift.findFirst({
        where: {
            instructorId: session.user.id,
            start: { lt: endDateTime },
            end: { gt: startDateTime }
        }
    });

    if (overlap) {
        return { error: "同時間帯に既にシフトが存在します" };
    }

    try {
        const shift = await prisma.shift.create({
            data: {
                instructorId: session.user.id,
                start: startDateTime,
                end: endDateTime,
                type: type.toUpperCase(),
                className: className || null,
                location: formData.get("location") as string || "ONLINE",
                isPublished: true,
            },
        });

        revalidatePath("/instructor/dashboard");
        return { success: true, shift };
    } catch {
        return { error: "Database error" };
    }
}

export async function submitReport(bookingId: string, formData: FormData) {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "INSTRUCTOR") {
        return { error: "Unauthorized" };
    }

    const content = formData.get("content") as string;
    const logUrl = formData.get("logUrl") as string;
    const homework = formData.get("homework") as string;
    const feedback = formData.get("feedback") as string;

    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { shift: true }
    });

    if (!booking) return { error: "Booking not found" };

    const now = new Date();
    const shiftStart = new Date(booking.shift.start);

    if (now < shiftStart) {
        return { error: "授業開始前です。まだカルテは記入できません。" };
    }

    const deadline = new Date(shiftStart);
    deadline.setHours(23, 59, 59, 999);

    if (now > deadline) {
        return { error: "提出期限切れです（当日23:59まで）。管理者に連絡してください。" };
    }

    try {
        await prisma.report.create({
            data: {
                bookingId: bookingId,
                content,
                logUrl,
                homework,
                feedback
            }
        });
        revalidatePath("/instructor/dashboard");
        return { success: true };
    } catch {
        return { error: "Failed to submit report" };
    }
}

export async function deleteShift(shiftId: string) {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "INSTRUCTOR") {
        return { error: "Unauthorized" };
    }

    const shift = await prisma.shift.findUnique({
        where: { id: shiftId },
        include: { bookings: true }
    });

    if (!shift) return { error: "Shift not found" };
    if (shift.instructorId !== session.user.id) return { error: "Not your shift" };

    // Check if 24h before
    const now = new Date();
    const shiftStart = new Date(shift.start);
    const timeDiff = shiftStart.getTime() - now.getTime();
    const hoursUntilStart = timeDiff / (1000 * 60 * 60);

    if (hoursUntilStart < 24) {
        return { error: "授業開始24時間前を切っているため削除できません。" };
    }

    try {
        await prisma.$transaction(async (tx) => {
            // Delete bookings first (cascade manually)
            await tx.booking.deleteMany({
                where: { shiftId: shiftId }
            });

            await tx.shift.delete({
                where: { id: shiftId }
            });
        });

        revalidatePath("/instructor/dashboard");
        return { success: true };
    } catch (e) {
        console.error("Delete shift error:", e);
        return { error: "Failed to delete shift" };
    }
}

// 予約作成（講師による強制予約）
export async function createBooking(shiftId: string, studentId: string) {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "INSTRUCTOR") {
        return { error: "Unauthorized" };
    }

    const shift = await prisma.shift.findUnique({
        where: { id: shiftId },
        include: { bookings: true, instructor: true }
    });

    if (!shift) return { error: "Shift not found" };
    if (!shift) return { error: "Shift not found" };
    // Removed ownership check to allow cross-booking
    // if (shift.instructorId !== session.user.id) return { error: "Not your shift" };

    if (shift.bookings.some(b => b.status === "CONFIRMED")) {
        return { error: "既に予約が入っています" };
    }

    const student = await prisma.user.findUnique({ where: { id: studentId } });
    if (!student) return { error: "Student not found" };

    // Check overlap for student
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

    if (studentOverlap) {
        return { error: "この生徒は同時間帯に既に授業予約があります" };
    }

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
        await sendEmail({
            to: student.email,
            subject: "【予約確定】授業予約が完了しました",
            body: `${student.name}様\n\n以下の通り授業予約が確定しました。\n\n日時: ${format(shift.start, "yyyy/MM/dd HH:mm", { locale: ja })} - ${format(shift.end, "HH:mm", { locale: ja })}\n担当: ${shift.instructor.name}\n場所: ${shift.location === 'ONLINE' ? 'オンライン' : shift.location}\n\n当日よろしくお願いいたします。`
        });

        // Email to Instructor
        await sendEmail({
            to: shift.instructor.email,
            subject: "【予約確定】新規予約が入りました", // Instructor usually knows, but this confirms the action
            body: `${shift.instructor.name}先生\n\n以下の授業予約を登録しました。\n\n日時: ${format(shift.start, "yyyy/MM/dd HH:mm", { locale: ja })}\n生徒: ${student.name}\n\nよろしくお願いいたします。`
        });

        revalidatePath("/instructor/dashboard");
        return { success: true };
    } catch {
        return { error: "Failed to create booking" };
    }
}

export async function approveRequest(requestId: string) {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "INSTRUCTOR") return { error: "Unauthorized" };

    const request = await prisma.scheduleRequest.findUnique({
        where: { id: requestId },
        include: { student: true, instructor: true }
    });

    if (!request) return { error: "Request not found" };

    try {
        await prisma.$transaction(async (tx) => {
            const shift = await tx.shift.create({
                data: {
                    instructorId: session.user.id as string,
                    start: request.start,
                    end: request.end,
                    type: "INDIVIDUAL",
                    location: "ONLINE", // Defaulting to ONLINE as per plan
                    isPublished: true,
                }
            });

            await tx.booking.create({
                data: {
                    studentId: request.studentId,
                    shiftId: shift.id,
                    status: "CONFIRMED",
                    meetingType: "ONLINE"
                }
            });

            await tx.scheduleRequest.update({
                where: { id: requestId },
                data: { status: "APPROVED" }
            });
        });

        // Email to Student
        await sendEmail({
            to: request.student.email,
            subject: "日程リクエストが承認されました",
            body: `${format(request.start, "MM/dd HH:mm", { locale: ja })} のリクエストが${request.instructor.name}講師により承認されました。`
        });

        // Email to Instructor (Self-copy)
        await sendEmail({
            to: request.instructor.email,
            subject: "【確認】日程リクエストを承認しました",
            body: `${request.student.name}様からのリクエスト（${format(request.start, "MM/dd HH:mm", { locale: ja })}）を承認し、予約を確定させました。`
        });

        revalidatePath("/instructor/dashboard");
        return { success: true };
    } catch (e) {
        console.error(e);
        return { error: "Failed to approve request" };
    }
}

export async function rejectRequest(requestId: string) {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "INSTRUCTOR") return { error: "Unauthorized" };

    const request = await prisma.scheduleRequest.findUnique({
        where: { id: requestId },
        include: { student: true }
    });

    if (!request) return { error: "Request not found" };

    try {
        await prisma.scheduleRequest.update({
            where: { id: requestId },
            data: { status: "REJECTED" }
        });

        await sendEmail({
            to: request.student.email,
            subject: "日程リクエストが却下されました",
            body: `リクエストされた日程は都合により承認されませんでした。別の日程で再度ご検討ください。`
        });

        revalidatePath("/instructor/dashboard");
        return { success: true };
    } catch {
        return { error: "Failed to reject request" };
    }
}

// 合否・志望校管理: 取得
export async function getAdmissionResults(studentId: string) {
    const session = await auth();
    if (!session?.user?.id || (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN")) {
        return [];
    }

    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const results = await (prisma as any).admissionResult.findMany({
            where: { studentId },
            orderBy: { rank: 'asc' }
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return results as any[];
    } catch (e) {
        return [];
    }
}

// 合否・志望校管理: 更新（または作成）
export async function updateAdmissionResult(studentId: string, results: { schoolName: string, department?: string, rank: number, status: string }[]) {
    const session = await auth();
    if (!session?.user?.id || (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN")) {
        return { error: "Unauthorized" };
    }

    try {
        await prisma.$transaction(async (tx) => {
            // Delete existing and recreate (simplest for list management)
            // Or upsert. Since we pass full list, delete all for student and insert is easier but loses history if we tracked it (we track status updatedBy?).
            // Let's use deleteMany + createMany for simplicity as per requirement "constantly editable".
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (tx as any).admissionResult.deleteMany({
                where: { studentId }
            });

            if (results.length > 0) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (tx as any).admissionResult.createMany({
                    data: results.map(r => ({
                        studentId,
                        schoolName: r.schoolName,
                        department: r.department,
                        rank: r.rank,
                        status: r.status
                    }))
                });
            }
        });
        revalidatePath("/instructor/dashboard");
        revalidatePath("/admin/dashboard");
        return { success: true };
    } catch (e) {
        return { error: "Failed to update admission results" };
    }
}

// アーカイブ閲覧: 許可されたアーカイブ生徒の取得
export async function getLicensedArchivedStudents() {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "INSTRUCTOR") return [];

    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const accesses = await (prisma as any).archiveAccess.findMany({
            where: { instructorId: session.user.id },
            include: {
                student: {
                    include: {
                        studentBookings: {
                            include: {
                                shift: { include: { instructor: true } },
                                report: true
                            },
                            orderBy: { shift: { start: "desc" } }
                        },
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        admissionResults: true
                    }
                }
            }
        });

        // Also fetch their admission results
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return accesses.map((a: any) => a.student);
    } catch (e) {
        return [];
    }
}

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
