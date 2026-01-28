"use client";

import { useState, useEffect, startTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { format, isSameDay } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { ja } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";

interface Report {
    id: string;
    content: string;
    homework: string | null;
    feedback: string | null;
    logUrl: string | null;
}

interface User {
    id: string;
    name: string | null;
    email: string;
    role: string;
    isActive: boolean;
    _count?: {
        studentBookings: number;
        instructorShifts: number;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    admissionResults?: any[];
    archiveYear?: number | null;
    archivedAt?: Date | null;
    stats?: {
        monthPublished: number;
        monthCompleted: number;
        yearCompleted: number;
        totalCompleted: number;
    };
}

interface Instructor {
    id: string;
    name: string | null;
}

interface Booking {
    id: string;
    shift: {
        start: Date;
        instructor: { name: string | null };
    };
    report: Report | null;
}

interface Student {
    id: string;
    name: string | null;
    email: string;
    studentBookings: {
        id: string;
        status: string;
        shift: {
            start: Date;
            instructor: { name: string | null };
        };
        report: Report | null;
    }[];
}

interface Shift {
    id: string;
    start: Date;
    end: Date;
    type: string;
    instructor: { name: string | null };
    bookings: { student: { name: string | null } }[];
    location: string;
    className?: string | null;
}

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { archiveUser, unarchiveUser, adminCreateShift, adminCreateBooking, adminDeleteShift, updateGlobalSettings, getArchiveAccesses, grantArchiveAccess, revokeArchiveAccess, getArchivedUsers } from "./actions";
import { logout } from "@/lib/actions";
import { CarteViewer } from "@/components/dashboard/CarteViewer";

export default function AdminDashboardClient({ students, allUsers, allInstructors, masterShifts, initialDeadlineExtension = 0 }: { students: Student[], allUsers: User[], allInstructors: Instructor[], masterShifts: Shift[], initialDeadlineExtension?: number }) {
    const [optimisticShifts, setOptimisticShifts] = useState(masterShifts);

    // Sync with server data when it returns
    useEffect(() => {
        setOptimisticShifts(masterShifts);
    }, [masterShifts]);

    const [activeTab, setActiveTab] = useState("reports");
    const [calendarDate, setCalendarDate] = useState<Date | undefined>(undefined);
    // Settings State
    const [deadlineExtension, setDeadlineExtension] = useState(initialDeadlineExtension.toString());

    // Lesson Management State
    const [shiftInstructorId, setShiftInstructorId] = useState("");
    const [shiftDate, setShiftDate] = useState<Date | undefined>(undefined);
    const [shiftTime, setShiftTime] = useState("10:00");
    const [shiftEndTime, setShiftEndTime] = useState("11:00");
    const [shiftType, setShiftType] = useState("INDIVIDUAL");

    useEffect(() => {
        setCalendarDate(new Date());
        setShiftDate(new Date());
    }, []);

    useEffect(() => {
        if (!shiftTime) return;
        const [h, m] = shiftTime.split(':').map(Number);
        if (isNaN(h) || isNaN(m)) return;
        const d = new Date();
        d.setHours(h, m, 0, 0);

        let duration = 1;
        if (shiftType === 'GROUP' || shiftType === 'SPECIAL') duration = 2;

        d.setHours(d.getHours() + duration);
        setShiftEndTime(format(d, "HH:mm"));
    }, [shiftTime, shiftType]);

    const [bookingShiftId, setBookingShiftId] = useState("");
    const [bookingStudentId, setBookingStudentId] = useState("");

    // Schedule Filters
    const [filterInstructor, setFilterInstructor] = useState("ALL");
    const [filterLocation, setFilterLocation] = useState("ALL");
    const [filterType, setFilterType] = useState("ALL");

    const filteredShifts = optimisticShifts.filter(shift => {
        if (filterInstructor !== "ALL" && shift.instructor.name !== filterInstructor) return false;
        if (filterLocation !== "ALL" && shift.location !== filterLocation) return false;
        if (filterType !== "ALL" && shift.type !== filterType) return false;
        return true;
    });



    const handleCreateShift = async () => {
        if (!shiftInstructorId) return alert("講師を選択してください");
        if (!shiftDate) return alert("日付を選択してください");
        // Ensure shiftDate is valid
        if (isNaN(shiftDate.getTime())) return alert("無効な日付です");

        // Pass date as string "YYYY-MM-DD"
        const dateStr = format(shiftDate, "yyyy-MM-dd");
        const res = await adminCreateShift(shiftInstructorId, dateStr, shiftTime, shiftEndTime, shiftType);
        if (res.success) {
            alert("シフトを作成しました");
            // Optional: reset form or just keep it
        } else {
            alert(res.error);
        }
    };

    const handleCreateBooking = async () => {
        if (!bookingShiftId || !bookingStudentId) return alert("シフトIDと生徒IDを入力してください");
        const res = await adminCreateBooking(bookingShiftId, bookingStudentId);
        if (res.success) alert("予約を作成しました（強制）");
        else alert(res.error);
    };

    const handleUpdateSettings = async () => {
        const res = await updateGlobalSettings("CARTE_DEADLINE_EXTENSION_HOURS", deadlineExtension, "カルテ提出期限の延長時間（時間単位）");
        if (res.success) alert("設定を更新しました");
        else alert(res.error);
    };

    // Archive Access Management
    const [isAccessDialogOpen, setIsAccessDialogOpen] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [selectedArchiveStudent, setSelectedArchiveStudent] = useState<any>(null);
    const [accessInstructors, setAccessInstructors] = useState<Instructor[]>([]);

    // Archive Filters
    const [archiveFilterRole, setArchiveFilterRole] = useState("ALL");
    const [archiveFilterYear, setArchiveFilterYear] = useState("ALL");
    const [archiveFilterSchool, setArchiveFilterSchool] = useState("");
    const [archiveFilterStatus, setArchiveFilterStatus] = useState("ALL");

    const [archivedUsers, setArchivedUsers] = useState<User[]>([]);

    useEffect(() => {
        const fetchArchived = async () => {
            const res = await getArchivedUsers({
                role: archiveFilterRole,
                year: archiveFilterYear,
                school: archiveFilterSchool,
                status: archiveFilterStatus
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setArchivedUsers(res as any);
        };
        fetchArchived();
    }, [archiveFilterRole, archiveFilterYear, archiveFilterSchool, archiveFilterStatus]);

    const handleOpenAccessDialog = async (student: User) => {
        setSelectedArchiveStudent(student);
        const accesses = await getArchiveAccesses(student.id);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setAccessInstructors(accesses as any);
        setIsAccessDialogOpen(true);
    };

    const formatDate = (d: Date) => formatInTimeZone(d, "Asia/Tokyo", "yyyy/MM/dd HH:mm", { locale: ja });

    return (
        <div className="container mx-auto p-6 space-y-8">
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold">管理者ダッシュボード</h1>
                    <p className="text-muted-foreground">生徒のカルテ管理</p>
                </div>
                <Button variant="outline" onClick={() => logout()}>ログアウト</Button>
            </header>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList>
                    <TabsTrigger value="reports">カルテ管理</TabsTrigger>
                    <TabsTrigger value="master-schedule">全体スケジュール</TabsTrigger>
                    <TabsTrigger value="users">ユーザー管理</TabsTrigger>
                    <TabsTrigger value="lessons">授業管理（特権）</TabsTrigger>
                    <TabsTrigger value="settings">設定</TabsTrigger>
                </TabsList>

                <TabsContent value="reports" className="space-y-6">
                    <CarteViewer students={students} />
                </TabsContent>

                <TabsContent value="master-schedule" className="space-y-6">
                    {/* ... (keep existing schedule content) ... */}
                    <Card>
                        <CardHeader>
                            <CardTitle>全体スケジュール</CardTitle>
                            <CardDescription>全講師のシフト状況（登録数: {masterShifts.length}）</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-6">
                            {/* Filters */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                                <div className="space-y-2">
                                    <Label>講師で絞り込み</Label>
                                    <Select value={filterInstructor} onValueChange={setFilterInstructor}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="全講師" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ALL">全講師</SelectItem>
                                            {allInstructors.map(inst => (
                                                <SelectItem key={inst.id} value={inst.name || "Unknown"}>{inst.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>場所で絞り込み</Label>
                                    <Select value={filterLocation} onValueChange={setFilterLocation}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="全場所" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ALL">全場所</SelectItem>
                                            <SelectItem value="ONLINE">オンライン</SelectItem>
                                            <SelectItem value="KICHIJOJI">吉祥寺</SelectItem>
                                            <SelectItem value="TACHIKAWA">立川</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>授業種類で絞り込み</Label>
                                    <Select value={filterType} onValueChange={setFilterType}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="全種類" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ALL">全種類</SelectItem>
                                            <SelectItem value="INDIVIDUAL">個別</SelectItem>
                                            <SelectItem value="GROUP">集団</SelectItem>
                                            <SelectItem value="BEGINNER">ビギナー</SelectItem>
                                            <SelectItem value="TRIAL">無料体験</SelectItem>
                                            <SelectItem value="SPECIAL">特別パック</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="flex flex-col md:flex-row gap-8">
                                <div className="flex-1">
                                    <Calendar
                                        mode="single"
                                        selected={calendarDate}
                                        onSelect={setCalendarDate}
                                        className="rounded-md border shadow mx-auto"
                                    />
                                </div>
                                <div className="flex-1 space-y-4">
                                    <h3 className="font-semibold text-lg border-b pb-2">
                                        {calendarDate ? formatInTimeZone(calendarDate, "Asia/Tokyo", "yyyy年M月d日", { locale: ja }) : "日付を選択"} のシフト
                                    </h3>
                                    <div className="space-y-2">
                                        {calendarDate && filteredShifts.filter(s => isSameDay(s.start, calendarDate)).length === 0 ? (
                                            <p className="text-sm text-muted-foreground">シフトはありません。</p>
                                        ) : (
                                            calendarDate && filteredShifts.filter(s => isSameDay(s.start, calendarDate)).map((shift) => (
                                                <div key={shift.id} className="flex flex-col p-3 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <div className="font-bold text-blue-700 dark:text-blue-300">
                                                            {shift.instructor.name}
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <Badge variant="outline">{shift.location === 'ONLINE' ? 'オンライン' : shift.location === 'KICHIJOJI' ? '吉祥寺' : '立川'}</Badge>
                                                            <Button
                                                                variant="destructive"
                                                                size="sm"
                                                                className="h-6 text-[10px] px-2"
                                                                onClick={async () => {
                                                                    if (!confirm("本当にこのシフトを削除しますか？\n（予約がある場合、予約も削除されます）")) return;

                                                                    // Optimistic update: remove immediately
                                                                    setOptimisticShifts(prev => prev.filter(s => s.id !== shift.id));

                                                                    startTransition(async () => {
                                                                        const res = await adminDeleteShift(shift.id);
                                                                        if (res.success) {
                                                                            // Success: wait for revalidatePath from server to update props
                                                                        } else {
                                                                            alert(res.error);
                                                                            // Revert on error
                                                                            setOptimisticShifts(masterShifts);
                                                                        }
                                                                    });
                                                                }}
                                                            >
                                                                削除
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span>{formatInTimeZone(shift.start, "Asia/Tokyo", "HH:mm", { locale: ja })} - {formatInTimeZone(shift.end, "Asia/Tokyo", "HH:mm", { locale: ja })}</span>
                                                        <Badge variant={shift.type === "INDIVIDUAL" ? "default" : shift.type === "GROUP" ? "secondary" : shift.type === "BEGINNER" ? "outline" : shift.type === "TRIAL" ? "default" : "destructive"} className="text-[10px]">
                                                            {shift.type === "INDIVIDUAL" ? "個別" : shift.type === "GROUP" ? "集団" : shift.type === "BEGINNER" ? "ビギナー" : shift.type === "TRIAL" ? "無料体験" : "特別パック"}
                                                        </Badge>
                                                    </div>
                                                    {shift.className && <div className="text-xs text-muted-foreground mb-1">{shift.className}</div>}
                                                    <div className="text-xs">
                                                        {shift.bookings.length > 0 ? (
                                                            shift.type === 'GROUP' ? (
                                                                <span className="text-blue-600 font-semibold">予約: {shift.bookings.length}名</span>
                                                            ) : (
                                                                <span className="text-green-600 font-semibold">予約: {shift.bookings[0].student.name}</span>
                                                            )
                                                        ) : (
                                                            <span className="text-muted-foreground">予約なし</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="users" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>ユーザー管理</CardTitle>
                            <CardDescription>現在有効なユーザーの一覧です。</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border">
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/50">
                                            <th className="p-4 text-left font-medium">名前</th>
                                            <th className="p-4 text-left font-medium">メールアドレス</th>
                                            <th className="p-4 text-left font-medium">権限</th>
                                            <th className="p-4 text-left font-medium">実績 (今月/年/計)</th>
                                            <th className="p-4 text-left font-medium">操作</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                        {allUsers.filter((u: any) => !u.archivedAt).map((user) => (
                                            <tr key={user.id} className="border-b transition-colors hover:bg-muted/50">
                                                <td className="p-4">{user.name}</td>
                                                <td className="p-4">{user.email}</td>
                                                <td className="p-4">{user.role}</td>
                                                <td className="p-4">
                                                    {user.role === 'INSTRUCTOR' && user.stats ? (
                                                        <div className="text-xs space-y-1">
                                                            <div><span className="font-semibold text-blue-600">公開:</span> {user.stats.monthPublished}</div>
                                                            <div><span className="font-semibold text-green-600">完了:</span> {user.stats.monthCompleted} / {user.stats.yearCompleted} / {user.stats.totalCompleted}</div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground">-</span>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={async () => {
                                                            if (!confirm("本当にアーカイブしますか？\nログインできなくなりますが、データは残ります。")) return;
                                                            const res = await archiveUser(user.id);
                                                            if (res.success) alert("アーカイブしました");
                                                            else alert(res.error);
                                                        }}
                                                    >
                                                        アーカイブ
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>アーカイブ済みユーザー</CardTitle>
                            <CardDescription>過去に在籍していたユーザー（アーカイブ）です。</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Archive Filters */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                                <div className="space-y-2">
                                    <Label>役割</Label>
                                    <Select value={archiveFilterRole} onValueChange={setArchiveFilterRole}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="全役割" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ALL">全役割</SelectItem>
                                            <SelectItem value="STUDENT">生徒</SelectItem>
                                            <SelectItem value="INSTRUCTOR">講師</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>削除年度</Label>
                                    <Select value={archiveFilterYear} onValueChange={setArchiveFilterYear}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="全年度" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ALL">全年度</SelectItem>
                                            {[2023, 2024, 2025, 2026, 2027].map((year) => (
                                                <SelectItem key={year} value={year.toString()}>{year}年度</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>志望校検索</Label>
                                    <Input
                                        placeholder="志望校名を入力..."
                                        value={archiveFilterSchool}
                                        onChange={(e) => setArchiveFilterSchool(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>合否ステータス</Label>
                                    <Select value={archiveFilterStatus} onValueChange={setArchiveFilterStatus}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="全ステータス" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ALL">全ステータス</SelectItem>
                                            <SelectItem value="PASSED">合格 (一次・最終)</SelectItem>
                                            <SelectItem value="PASSED_FINAL">最終合格</SelectItem>
                                            <SelectItem value="PASSED_FIRST">一次合格</SelectItem>
                                            <SelectItem value="REJECTED">不合格</SelectItem>
                                            <SelectItem value="PENDING">結果待ち</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="rounded-md border">
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/50">
                                            <th className="p-4 text-left font-medium">名前</th>
                                            <th className="p-4 text-left font-medium">メールアドレス</th>
                                            <th className="p-4 text-left font-medium">年度/役割</th>
                                            <th className="p-4 text-left font-medium">ステータス概要</th>
                                            <th className="p-4 text-left font-medium">操作</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                        {archivedUsers.map((user: any) => (
                                            <tr key={user.id} className="border-b transition-colors hover:bg-muted/50">
                                                <td className="p-4 font-medium">{user.name}</td>
                                                <td className="p-4 text-muted-foreground">{user.email}</td>
                                                <td className="p-4">
                                                    <div>{user.archiveYear}年度</div>
                                                    <Badge variant="outline" className="mt-1">{user.role}</Badge>
                                                </td>
                                                <td className="p-4">
                                                    {user.role === "STUDENT" && user.admissionResults && user.admissionResults.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1">
                                                            {user.admissionResults.map((r: any) => (
                                                                <Badge key={r.id} variant={r.status.startsWith("PASSED") ? "default" : r.status === "REJECTED" ? "destructive" : "secondary"} className="text-[10px]">
                                                                    {r.schoolName}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground">-</span>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex flex-col gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={async () => {
                                                                if (!confirm("ユーザーを復帰させますか？")) return;
                                                                const res = await unarchiveUser(user.id);
                                                                if (res.success) alert("復帰しました");
                                                                else alert(res.error);
                                                            }}
                                                        >
                                                            復帰
                                                        </Button>
                                                        {user.role === "STUDENT" && (
                                                            <Button
                                                                variant="secondary"
                                                                size="sm"
                                                                onClick={() => handleOpenAccessDialog(user)}
                                                            >
                                                                閲覧権限
                                                            </Button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {archivedUsers.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="p-4 text-center text-muted-foreground">アーカイブされたユーザーはいません</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="lessons" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>特権シフト作成</CardTitle>
                            <CardDescription>制限（時間、重複など）を無視してシフトを作成します。</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label>講師</Label>
                                    <Select onValueChange={setShiftInstructorId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="講師を選択" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {allInstructors.map(inst => (
                                                <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>日付</Label>
                                    <Input
                                        type="date"
                                        value={shiftDate ? format(shiftDate, "yyyy-MM-dd") : ""}
                                        onChange={(e) => setShiftDate(e.target.value ? new Date(e.target.value) : undefined)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>開始時間</Label>
                                    <Input type="time" value={shiftTime} onChange={(e) => setShiftTime(e.target.value)} />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>終了時間</Label>
                                    <Input type="time" value={shiftEndTime} onChange={(e) => setShiftEndTime(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>授業種別</Label>
                                    <Select value={shiftType} onValueChange={setShiftType}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="INDIVIDUAL">個別</SelectItem>
                                            <SelectItem value="GROUP">集団</SelectItem>
                                            <SelectItem value="BEGINNER">ビギナー</SelectItem>
                                            <SelectItem value="TRIAL">無料体験</SelectItem>
                                            <SelectItem value="SPECIAL">特別パック</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <Button onClick={handleCreateShift}>シフト作成（強制）</Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>特権予約作成</CardTitle>
                            <CardDescription>任意のシフトに任意の生徒を強制予約します。</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>シフトID</Label>
                                    <Input placeholder="Shift ID" value={bookingShiftId} onChange={(e) => setBookingShiftId(e.target.value)} />
                                    <p className="text-xs text-muted-foreground">※ シフトIDはDB等から確認してください（簡易実装）</p>
                                </div>
                                <div className="space-y-2">
                                    <Label>生徒</Label>
                                    <Select value={bookingStudentId} onValueChange={setBookingStudentId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="生徒を選択" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {allUsers.filter(u => u.role === "STUDENT").map(u => (
                                                <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <Button onClick={handleCreateBooking}>予約作成（強制）</Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="settings" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>システム設定</CardTitle>
                            <CardDescription>サイト全体の動作設定を行います。</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2 max-w-sm">
                                <Label>カルテ提出期限の延長時間（時間）</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="number"
                                        min="0"
                                        value={deadlineExtension}
                                        onChange={(e) => setDeadlineExtension(e.target.value)}
                                    />
                                    <Button onClick={handleUpdateSettings}>更新</Button>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    デフォルトは当日23:59までですが、ここで設定した時間分だけ期限を延長します。<br />
                                    例: 24を設定すると、翌日23:59まで可能になります。
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Archive Access Management Dialog */}
            <Dialog open={isAccessDialogOpen} onOpenChange={setIsAccessDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>アーカイブ閲覧権限の管理</DialogTitle>
                        <DialogDescription>
                            {selectedArchiveStudent?.name} のアーカイブを閲覧できる講師を設定します。
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <Label>権限を持つ講師</Label>
                        <div className="border rounded-md p-2 max-h-60 overflow-y-auto space-y-2">
                            {allInstructors.map(inst => {
                                const hasAccess = accessInstructors.some(a => a.id === inst.id);
                                return (
                                    <div key={inst.id} className="flex justify-between items-center p-2 hover:bg-muted/50 rounded">
                                        <span>{inst.name}</span>
                                        <Button
                                            variant={hasAccess ? "destructive" : "outline"}
                                            size="sm"
                                            onClick={async () => {
                                                if (!selectedArchiveStudent) return;
                                                if (hasAccess) {
                                                    await revokeArchiveAccess(inst.id, selectedArchiveStudent.id);
                                                } else {
                                                    await grantArchiveAccess(inst.id, selectedArchiveStudent.id);
                                                }
                                                // Refresh local list
                                                const updated = await getArchiveAccesses(selectedArchiveStudent.id);
                                                setAccessInstructors(updated);
                                            }}
                                        >
                                            {hasAccess ? "解除" : "許可"}
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
