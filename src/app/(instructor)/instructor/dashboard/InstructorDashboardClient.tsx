"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { format, isSameDay } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { ja } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CarteViewer } from "@/components/dashboard/CarteViewer";
import { createShift, submitReport, approveRequest, rejectRequest, deleteShift, updateAdmissionResult, createBooking } from "./actions";

type ShiftType = "individual" | "group" | "special" | "beginner" | "trial";

interface Booking {
    id: string;
    status: string;
    student: { name: string | null };
    report: { id: string } | null;
}

interface Shift {
    id: string;
    start: Date;
    end: Date;
    type: string;
    className?: string | null;
    location?: string;
    bookings: Booking[];
}

interface Request {
    id: string;
    student: { name: string | null; email: string };
    start: Date;
    end: Date;
    status: string;
}

interface Report {
    id: string;
    content: string;
    homework: string | null;
    feedback: string | null;
    logUrl: string | null;
}

interface StudentBooking {
    id: string;
    status: string; // "CONFIRMED", "CANCELLED"
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
    studentBookings: StudentBooking[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    admissionResults?: any[];
}

// Update Props Interface
export default function InstructorDashboardClient({
    initialShifts,
    initialRequests,
    students,
    archivedStudents,
    deadlineExtensionHours = 0,
    masterShifts = [],
    history = []
}: {
    initialShifts: Shift[],
    initialRequests: Request[],
    students: Student[],
    archivedStudents?: Student[],
    deadlineExtensionHours?: number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    masterShifts?: any[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    history?: any[]
}) {
    const [now, setNow] = useState<Date | null>(null);
    useEffect(() => {
        setNow(new Date());
        // Optional: Update 'now' every minute if needed, but for initial render fix just once is enough
    }, []);

    const [date, setDate] = useState<Date | undefined>(undefined);

    // Fix Hydration Error: Initialize date only on client
    useEffect(() => {
        setDate(new Date());
    }, []);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const currentShifts = initialShifts;
    const [requests, setRequests] = useState<Request[]>(initialRequests);
    const [activeTab, setActiveTab] = useState("shifts");

    // Report Dialog State
    const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
    const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

    // Shift Form State
    const [startTime, setStartTime] = useState("10:00");
    const [endTime, setEndTime] = useState("11:00");
    const [shiftType, setShiftType] = useState<ShiftType>("individual");
    const [location, setLocation] = useState("ONLINE");
    const [classNameInput, setClassNameInput] = useState("");

    // Auto-set End Time
    useEffect(() => {
        if (!startTime) return;
        const [h, m] = startTime.split(':').map(Number);
        if (isNaN(h) || isNaN(m)) return;

        const date = new Date();
        date.setHours(h, m, 0, 0);

        let duration = 1;
        if (shiftType === "group" || shiftType === "special") {
            duration = 2;
        }

        date.setHours(date.getHours() + duration);
        setEndTime(format(date, "HH:mm"));
    }, [startTime, shiftType]);

    // Booking Dialog State
    const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false);
    const [bookingShiftId, setBookingShiftId] = useState<string | null>(null);
    const [bookingStudentId, setBookingStudentId] = useState<string>("");

    const handleDateSelect = (selectedDate: Date | undefined) => {
        setDate(selectedDate);
        if (selectedDate) {
            setIsDialogOpen(true);
        }
    };

    const handleCreateShift = async () => {
        if (!date) return;
        const formData = new FormData();
        formData.append("date", format(date, "yyyy-MM-dd"));
        formData.append("startTime", startTime);
        formData.append("endTime", endTime);
        formData.append("type", shiftType);
        formData.append("location", location);
        if (classNameInput) formData.append("className", classNameInput);

        startTransition(async () => {
            const result = await createShift(formData);
            if (result.success) {
                setIsDialogOpen(false);
                setShiftType("individual");
                setLocation("ONLINE");
                setClassNameInput("");
            } else {
                alert(result.error);
            }
        });
    };

    const getDayShifts = (day: Date) => {
        return currentShifts.filter((s) => isSameDay(s.start, day));
    };

    const formatDate = (d: Date) => formatInTimeZone(d, "Asia/Tokyo", "yyyy/MM/dd HH:mm", { locale: ja });
    const formatTime = (d: Date) => formatInTimeZone(d, "Asia/Tokyo", "HH:mm", { locale: ja });

    const getLocationLabel = (loc?: string) => {
        switch (loc) {
            case 'KICHIJOJI': return '吉祥寺';
            case 'TACHIKAWA': return '立川';
            case 'ONLINE': return 'オンライン';
            default: return 'オンライン';
        }
    };

    // Filter for Today's Classes needing reports
    const todayClasses = useMemo(() => {
        if (!now) return [];
        return currentShifts.filter(s =>
            isSameDay(s.start, now) &&
            s.bookings.length > 0
        );
    }, [currentShifts, now]);

    const openReportDialog = (bookingId: string) => {
        setSelectedBookingId(bookingId);
        setIsReportDialogOpen(true);
    };

    const handleSubmitReport = async (formData: FormData) => {
        if (!selectedBookingId) return;
        startTransition(async () => {
            const res = await submitReport(selectedBookingId, formData);
            if (res.success) {
                alert("カルテを提出しました");
                setIsReportDialogOpen(false);
            } else {
                alert(res.error);
            }
        });
    };

    const handleApproveRequest = async (requestId: string) => {
        if (!confirm("このリクエストを承認しますか？（シフトと予約が作成されます）")) return;
        startTransition(async () => {
            const res = await approveRequest(requestId);
            if (res.success) {
                alert("リクエストを承認しました");
                setRequests(prev => prev.filter(r => r.id !== requestId));
            } else {
                alert(res.error);
            }
        });
    };

    const handleRejectRequest = async (requestId: string) => {
        if (!confirm("このリクエストを却下しますか？")) return;
        startTransition(async () => {
            const res = await rejectRequest(requestId);
            if (res.success) {
                alert("リクエストを却下しました");
                setRequests(prev => prev.filter(r => r.id !== requestId));
            } else {
                alert(res.error);
            }
        });
    };

    const handleOpenBookingDialog = (shiftId: string) => {
        setBookingShiftId(shiftId);
        setBookingStudentId("");
        setIsBookingDialogOpen(true);
    };

    const handleCreateBooking = () => {
        if (!bookingShiftId || !bookingStudentId) return;

        // Find student name for confirmation
        const student = students.find(s => s.id === bookingStudentId);
        if (!confirm(`${student?.name}さんをこのシフトに予約しますか？\n（生徒と講師に通知メールが送信されます）`)) return;

        startTransition(async () => {
            const res = await createBooking(bookingShiftId, bookingStudentId);
            if (res.success) {
                alert("予約を作成しました");
                setIsBookingDialogOpen(false);
                setBookingShiftId(null);
                setBookingStudentId("");
            } else {
                alert(res.error);
            }
        });
    };

    const getDeadlineText = () => {
        if (!now) return "";
        const deadline = new Date(now);
        deadline.setHours(23, 59, 0, 0);

        if (deadlineExtensionHours > 0) {
            deadline.setHours(deadline.getHours() + deadlineExtensionHours);
            return format(deadline, "M月d日 H:mm", { locale: ja }) + " までに提出してください。";
        }
        return "当日23:59までにカルテを提出してください。";
    };

    return (
        <div className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="mb-4">
                    <TabsTrigger value="shifts">シフト・授業管理</TabsTrigger>
                    <TabsTrigger value="master">全体スケジュール</TabsTrigger>
                    <TabsTrigger value="history">授業履歴</TabsTrigger>
                    <TabsTrigger value="reports">生徒カルテ閲覧</TabsTrigger>
                    <TabsTrigger value="archives">アーカイブ閲覧</TabsTrigger>
                </TabsList>

                <TabsContent value="shifts" className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Left: Calendar & Shift Input - Expanded */}
                    <div className="md:col-span-3 space-y-6">
                        {/* Report Alert Section for Today */}
                        {todayClasses.length > 0 && (
                            <Card className="border-orange-500 bg-orange-50 dark:bg-orange-950/20">
                                <CardHeader>
                                    <CardTitle className="text-orange-700 dark:text-orange-400">本日の授業・カルテ提出</CardTitle>
                                    <CardDescription>授業開始後、カルテ記入ボタンが表示されます。</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {todayClasses.map(shift => (
                                        shift.bookings.filter(b => b.status === 'CONFIRMED').map(booking => {
                                            const isStarted = now ? now >= new Date(shift.start) : false;
                                            return (
                                                <div key={booking.id} className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded shadow-sm border-l-4 border-l-orange-500">
                                                    <div>
                                                        <div className="font-bold flex items-center gap-2">
                                                            <span>{formatTime(shift.start)} - {formatTime(shift.end)}</span>
                                                            <Badge variant="outline">{getLocationLabel(shift.location)}</Badge>
                                                        </div>
                                                        <div className="font-medium text-lg mt-1">{booking.student.name}</div>
                                                        {shift.className && <div className="text-sm text-muted-foreground">{shift.className}</div>}
                                                    </div>
                                                    <div>
                                                        {booking.report ? (
                                                            <span className="px-4 py-2 bg-green-100 text-green-700 rounded font-bold border border-green-200 block text-center">
                                                                カルテ提出済み
                                                            </span>
                                                        ) : isStarted ? (
                                                            <Button onClick={() => openReportDialog(booking.id)} className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-6">
                                                                カルテを書く
                                                            </Button>
                                                        ) : (
                                                            <span className="text-muted-foreground text-sm border px-3 py-1 rounded bg-gray-50">
                                                                授業開始待ち
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ))}
                                </CardContent>
                            </Card>
                        )}

                        <Card className="h-full">
                            <CardHeader>
                                <CardTitle className="text-2xl">シフト管理</CardTitle>
                                <CardDescription>
                                    日付を選択してシフト時間を登録してください。
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-col xl:flex-row gap-8">
                                <div className="flex-1 flex justify-center p-4 bg-slate-50 rounded-xl">
                                    <Calendar
                                        mode="single"
                                        selected={date}
                                        onSelect={handleDateSelect}
                                        className="rounded-md border shadow bg-white p-4"
                                    />
                                </div>
                                <div className="flex-1 space-y-6">
                                    <h3 className="font-bold text-2xl border-b pb-4 flex items-center gap-2">
                                        <span className="text-blue-600">{date ? formatInTimeZone(date, "Asia/Tokyo", "M月d日", { locale: ja }) : "日付未選択"}</span>
                                        <span className="text-slate-700 text-lg">のシフト</span>
                                    </h3>

                                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                                        {date && getDayShifts(date).length === 0 ? (
                                            <div className="text-center py-10 text-muted-foreground bg-slate-50 rounded-lg border-dashed border-2">
                                                シフトは登録されていません
                                                <div className="mt-2 text-sm">カレンダーの日付をクリックして追加</div>
                                            </div>
                                        ) : (
                                            date && getDayShifts(date).map((shift) => (
                                                <div key={shift.id} className="flex flex-col p-4 bg-white border shadow-sm rounded-xl">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-2">
                                                                <Badge variant={shift.type === "INDIVIDUAL" ? "default" : shift.type === "GROUP" ? "secondary" : shift.type === "BEGINNER" ? "outline" : shift.type === "TRIAL" ? "default" : "destructive"}>
                                                                    {shift.type === "INDIVIDUAL" ? "個別" : shift.type === "GROUP" ? "集団" : shift.type === "BEGINNER" ? "ビギナー" : shift.type === "TRIAL" ? "無料体験" : "特別パック"}
                                                                </Badge>
                                                                <span className="text-sm text-muted-foreground">{getLocationLabel(shift.location)}</span>
                                                            </div>
                                                            <div className="text-2xl font-mono font-bold">
                                                                {formatTime(shift.start)} - {formatTime(shift.end)}
                                                            </div>
                                                        </div>

                                                        {/* Delete Button */}
                                                        {new Date(shift.start).getTime() - new Date().getTime() > 24 * 60 * 60 * 1000 && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="text-red-400 hover:text-red-700 hover:bg-red-50"
                                                                onClick={() => {
                                                                    const hasBooking = shift.bookings.some(b => b.status === 'CONFIRMED');
                                                                    const message = hasBooking
                                                                        ? "このシフトには予約が入っています。\n削除すると予約もキャンセルされます。\n本当に削除しますか？"
                                                                        : "このシフトを削除しますか？";

                                                                    if (confirm(message)) {
                                                                        startTransition(async () => {
                                                                            const res = await deleteShift(shift.id);
                                                                            if (!res.success) alert(res.error);
                                                                        });
                                                                    }
                                                                }}
                                                                disabled={isPending}
                                                            >
                                                                <span className="sr-only">削除</span>
                                                                ✕
                                                            </Button>
                                                        )}
                                                    </div>

                                                    <div className="mt-3 pt-3 border-t flex justify-between items-center">
                                                        {shift.bookings.length > 0 ? (
                                                            shift.type === 'GROUP' ? (
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded">予約: {shift.bookings.length}名</span>
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => handleOpenBookingDialog(shift.id)}
                                                                        className="text-xs h-7"
                                                                    >
                                                                        追加予約
                                                                    </Button>
                                                                </div>
                                                            ) : (
                                                                <span className="text-green-600 font-bold bg-green-50 px-2 py-1 rounded">予約: {shift.bookings[0].student.name}</span>
                                                            )
                                                        ) : (
                                                            <div className="flex gap-3 items-center w-full justify-between">
                                                                <span className="text-muted-foreground text-sm">予約なし</span>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-8 text-xs bg-slate-50"
                                                                    onClick={() => handleOpenBookingDialog(shift.id)}
                                                                >
                                                                    生徒を指名して予約（強制）
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right: Summary & Requests */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>今月の稼働状況</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{currentShifts.length} コマ</div>
                                <p className="text-sm text-muted-foreground">登録済みシフト</p>
                            </CardContent>
                        </Card>

                        {/* Requests List */}
                        <Card>
                            <CardHeader>
                                <CardTitle>日程リクエスト</CardTitle>
                                <CardDescription>生徒からの個別日程相談</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {requests.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">リクエストはありません</p>
                                ) : (
                                    requests.map(req => (
                                        <div key={req.id} className="p-3 border rounded bg-slate-50 dark:bg-slate-900 space-y-2">
                                            <div className="font-bold text-sm">{req.student.name}</div>
                                            <div className="text-sm">
                                                {formatInTimeZone(req.start, "Asia/Tokyo", "M/d HH:mm", { locale: ja })} - {formatInTimeZone(req.end, "Asia/Tokyo", "HH:mm", { locale: ja })}
                                            </div>
                                            <div className="flex gap-2 justify-end">
                                                <Button size="sm" variant="outline" className="text-red-500 hover:text-red-700" onClick={() => handleRejectRequest(req.id)} disabled={isPending}>却下</Button>
                                                <Button size="sm" onClick={() => handleApproveRequest(req.id)} disabled={isPending}>承認</Button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Shift Dialog */}
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>シフトを追加</DialogTitle>
                                <DialogDescription>
                                    {date && formatInTimeZone(date, "Asia/Tokyo", "yyyy年M月d日", { locale: ja })} のシフト詳細を入力してください。
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label className="text-right">時間</Label>
                                    <div className="col-span-3 flex gap-2 items-center">
                                        <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-24" />
                                        <span>~</span>
                                        <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-24" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label className="text-right">場所</Label>
                                    <Select value={location} onValueChange={setLocation}>
                                        <SelectTrigger className="col-span-3">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ONLINE">オンライン</SelectItem>
                                            <SelectItem value="KICHIJOJI">吉祥寺校舎</SelectItem>
                                            <SelectItem value="TACHIKAWA">立川校舎</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label className="text-right">種別</Label>
                                    <Select value={shiftType} onValueChange={(val: ShiftType) => setShiftType(val)}>
                                        <SelectTrigger className="col-span-3">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="individual">個別指導</SelectItem>
                                            <SelectItem value="group">集団授業</SelectItem>
                                            <SelectItem value="beginner">ビギナー</SelectItem>
                                            <SelectItem value="trial">無料体験</SelectItem>
                                            <SelectItem value="special">特別パック</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {shiftType !== "individual" && (
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label className="text-right">授業名</Label>
                                        <Input
                                            value={classNameInput}
                                            onChange={(e) => setClassNameInput(e.target.value)}
                                            placeholder="例: 中3英語特訓"
                                            className="col-span-3"
                                        />
                                    </div>
                                )}
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>キャンセル</Button>
                                <Button onClick={handleCreateShift} disabled={isPending}>公開する</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* Report Dialog */}
                    <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>授業カルテの入力</DialogTitle>
                                <DialogDescription>
                                    本日の授業の報告を行ってください。
                                </DialogDescription>
                            </DialogHeader>
                            <form action={handleSubmitReport}>
                                <div className="grid gap-4 py-4">
                                    <div className="space-y-2">
                                        <Label>本日の実施内容（所感含む正直な記録）</Label>
                                        <Textarea name="content" required placeholder="授業内容と生徒の様子..." className="h-24" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>該当ログURL</Label>
                                        <Input name="logUrl" placeholder="https://..." />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>宿題</Label>
                                        <Input name="homework" placeholder="P.24-25, 単語テスト" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>生徒への申し送り事項</Label>
                                        <Textarea name="feedback" placeholder="次回までに復習しておくこと..." />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" type="button" onClick={() => setIsReportDialogOpen(false)}>キャンセル</Button>
                                    <Button type="submit" disabled={isPending}>提出する</Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>

                    {/* Booking Dialog */}
                    <Dialog open={isBookingDialogOpen} onOpenChange={setIsBookingDialogOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>特権予約作成（強制）</DialogTitle>
                                <DialogDescription>
                                    生徒を選択して予約を確定させてください。
                                </DialogDescription>
                            </DialogHeader>
                            <div className="py-4 space-y-4">
                                <div className="space-y-2">
                                    <Label>生徒を選択</Label>
                                    <Select value={bookingStudentId} onValueChange={setBookingStudentId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="生徒を選択..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {students.map(s => (
                                                <SelectItem key={s.id} value={s.id}>{s.name || s.email}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsBookingDialogOpen(false)}>キャンセル</Button>
                                <Button onClick={handleCreateBooking} disabled={isPending || !bookingStudentId}>予約実行</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                </TabsContent>

                <TabsContent value="master">
                    <Card>
                        <CardHeader>
                            <CardTitle>全体スケジュール</CardTitle>
                            <CardDescription>他の講師のシフト確認・代理予約が可能です。</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="flex gap-4 mb-4">
                                    {/* Simple Filter - can be expanded */}
                                    <Input placeholder="講師名など（簡易検索）" className="max-w-xs" />
                                </div>
                                <div className="space-y-2">
                                    {masterShifts.map((shift: any) => (
                                        <div key={shift.id} className="flex justify-between items-center p-3 border rounded-lg bg-slate-50 dark:bg-slate-900">
                                            <div className="flex items-center gap-4">
                                                <div className="text-sm font-bold w-32">{shift.instructor.name}</div>
                                                <div className="font-mono text-sm">
                                                    {formatInTimeZone(new Date(shift.start), "Asia/Tokyo", "M/d HH:mm", { locale: ja })} - {formatInTimeZone(new Date(shift.end), "Asia/Tokyo", "HH:mm", { locale: ja })}
                                                </div>
                                                <Badge variant={shift.type === "INDIVIDUAL" ? "default" : shift.type === "GROUP" ? "secondary" : "outline"}>
                                                    {shift.type === "INDIVIDUAL" ? "個別" : shift.type === "GROUP" ? "集団" : "その他"}
                                                </Badge>
                                                {shift.bookings.length > 0 ? (
                                                    <span className="text-xs text-blue-600">予約: {shift.bookings.map((b: any) => b.student.name).join(", ")}</span>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">予約なし</span>
                                                )}
                                            </div>
                                            {!shift.bookings.some((b: any) => b.status === "CONFIRMED") && (
                                                <Button size="sm" variant="outline" onClick={() => handleOpenBookingDialog(shift.id)}>予約作成</Button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="history">
                    <Card>
                        <CardHeader>
                            <CardTitle>授業履歴</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {history.map((booking: any) => (
                                    <div key={booking.id} className="flex justify-between items-center p-3 border rounded flex-wrap">
                                        <div className="flex gap-4 items-center">
                                            <div className="font-mono text-sm">{formatInTimeZone(new Date(booking.shift.start), "Asia/Tokyo", "yyyy/MM/dd HH:mm", { locale: ja })}</div>
                                            <div className="font-bold">{booking.student.name}</div>
                                            <Badge variant={booking.report ? "default" : "destructive"}>
                                                {booking.report ? "カルテ提出済" : "未提出"}
                                            </Badge>
                                        </div>
                                        {/* Instructor History Actions if needed, e.g. View Report */}
                                    </div>
                                ))}
                                {history.length === 0 && <p className="text-muted-foreground">履歴はありません</p>}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="reports" className="space-y-6">
                    <CarteViewer
                        students={students}
                        editable={true}
                        onUpdateAdmission={updateAdmissionResult}
                    />
                </TabsContent>

                <TabsContent value="archives" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>アーカイブ閲覧</CardTitle>
                            <CardDescription>
                                過去の生徒のカルテを閲覧できます（管理者により許可された生徒のみ）
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <CarteViewer
                                students={archivedStudents || []}
                                editable={false}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div >
    );
}
