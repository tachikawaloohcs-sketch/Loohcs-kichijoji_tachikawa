"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";

interface Report {
    id: string;
    content: string;
    homework: string | null;
    feedback: string | null;
    logUrl: string | null;
}

interface Booking {
    id: string;
    status: string; // "CONFIRMED", "CANCELLED"
    shift: {
        start: Date;
        instructor: { name: string | null };
    };
    report: Report | null;
}

interface AdmissionResult {
    id: string;
    schoolName: string;
    department?: string | null;
    rank: number;
    status: string; // "PENDING", "PASSED", "FAILED", "WITHDRAWN"
}

interface Student {
    id: string;
    name: string | null;
    email: string;
    studentBookings: Booking[];
    admissionResults?: AdmissionResult[];
}

interface CarteViewerProps {
    students: Student[];
    editable?: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onUpdateAdmission?: (studentId: string, results: any[]) => Promise<{ success?: boolean; error?: string }>;
}

export function CarteViewer({ students, editable, onUpdateAdmission }: CarteViewerProps) {
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

    const formatDate = (d: Date) => format(new Date(d), "yyyy/MM/dd HH:mm");

    const getStudentStats = (student: Student) => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const thisMonthBookings = student.studentBookings.filter(b => {
            const d = new Date(b.shift.start);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear && b.status !== "CANCELLED";
        });

        const thisMonthCompleted = thisMonthBookings.filter(b => {
            if (b.status === "CANCELLED") return false;
            if (b.report) return true;
            return new Date(b.shift.start) < now;
        });

        return { total: thisMonthBookings.length, completed: thisMonthCompleted.length };
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Student List */}
            <Card className="md:col-span-1 h-fit">
                <CardHeader>
                    <CardTitle>生徒一覧</CardTitle>
                    <CardDescription>生徒を選択して過去のカルテを閲覧</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {students.length === 0 ? (
                        <p className="text-muted-foreground">生徒がいません</p>
                    ) : (
                        students.map((student) => {
                            const stats = getStudentStats(student);
                            return (
                                <div
                                    key={student.id}
                                    className={`flex items-center gap-4 p-3 rounded cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${selectedStudent?.id === student.id ? 'bg-slate-100 dark:bg-slate-800' : ''}`}
                                    onClick={() => setSelectedStudent(student)}
                                >
                                    <Avatar>
                                        <AvatarFallback>{student.name?.[0]}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                        <div className="font-semibold">{student.name}</div>
                                        <div className="text-xs text-muted-foreground">{student.email}</div>
                                        <div className="flex gap-3 mt-1 text-xs">
                                            <span className="text-blue-600">全カルテ: {student.studentBookings.filter(b => b.report).length}</span>
                                            <span className="text-slate-600">今月: {stats.completed}/{stats.total}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </CardContent>
            </Card>

            {/* Report View */}
            <div className="md:col-span-2 space-y-6">
                {selectedStudent ? (
                    <>
                        {/* Student Header with Admission Info */}
                        <div className="flex justify-between items-start">
                            <div>
                                <h2 className="text-2xl font-bold">{selectedStudent.name} さんのカルテ一覧</h2>
                                <p className="text-muted-foreground">{selectedStudent.email}</p>
                            </div>
                            {editable && onUpdateAdmission && (
                                <AdmissionEditDialog student={selectedStudent} onUpdate={onUpdateAdmission} />
                            )}
                        </div>

                        {/* Admission Results Summary */}
                        {selectedStudent.admissionResults && selectedStudent.admissionResults.length > 0 && (
                            <Card className="bg-slate-50 dark:bg-slate-900 border-none">
                                <CardContent className="pt-6">
                                    <h3 className="font-semibold mb-2">志望校・合否状況</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedStudent.admissionResults.map(res => (
                                            <div key={res.id} className="bg-white dark:bg-black border rounded px-3 py-1 text-sm flex items-center gap-2">
                                                <span className={`font-bold ${res.rank === 1 ? 'text-red-500' : ''}`}>
                                                    {res.rank === 1 ? '第一志望' : `第${res.rank}志望`}
                                                </span>
                                                <span>{res.schoolName} {res.department}</span>
                                                <AdmissionStatusBadge status={res.status} />
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {selectedStudent.studentBookings.length === 0 ? (
                            <Card>
                                <CardContent className="p-6 text-center text-muted-foreground">
                                    提出されたカルテはありません。
                                </CardContent>
                            </Card>
                        ) : (
                            selectedStudent.studentBookings.map(booking => (
                                booking.report && (
                                    <Card key={booking.id}>
                                        <CardHeader>
                                            <CardTitle className="text-lg flex justify-between">
                                                <span>{formatDate(booking.shift.start)}</span>
                                                <span className="text-base font-normal text-muted-foreground">講師: {booking.shift.instructor.name}</span>
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div>
                                                <h4 className="font-semibold text-sm mb-1">実施内容・所感</h4>
                                                <p className="text-sm bg-slate-50 dark:bg-slate-900 p-3 rounded whitespace-pre-wrap">{booking.report.content}</p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <h4 className="font-semibold text-sm mb-1">宿題</h4>
                                                    <p className="text-sm">{booking.report.homework || "なし"}</p>
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-sm mb-1">生徒へのFB</h4>
                                                    <p className="text-sm">{booking.report.feedback || "なし"}</p>
                                                </div>
                                            </div>
                                            {booking.report.logUrl && (
                                                <div>
                                                    <h4 className="font-semibold text-sm mb-1">ログURL</h4>
                                                    <a href={booking.report.logUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-sm">
                                                        {booking.report.logUrl}
                                                    </a>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                )
                            ))
                        )}
                    </>
                ) : (
                    <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg text-muted-foreground">
                        左のリストから生徒を選択してください
                    </div>
                )}
            </div>
        </div>
    );
}

function AdmissionStatusBadge({ status }: { status: string }) {
    const styles = {
        PENDING: "bg-gray-100 text-gray-700",
        PASSED: "bg-red-100 text-red-700 font-bold",
        FAILED: "bg-blue-100 text-blue-700",
        WITHDRAWN: "bg-yellow-100 text-yellow-700",
    };
    const labels = {
        PENDING: "受験予定/結果待ち",
        PASSED: "合格",
        FAILED: "不合格",
        WITHDRAWN: "辞退",
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const style = (styles as any)[status] || styles.PENDING;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const label = (labels as any)[status] || status;

    return <span className={`px-2 py-0.5 rounded text-xs ${style}`}>{label}</span>;
}

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AdmissionEditDialog({ student, onUpdate }: { student: Student, onUpdate: (id: string, results: any[]) => Promise<any> }) {
    const [open, setOpen] = useState(false);
    const [results, setResults] = useState<AdmissionResult[]>(student.admissionResults || []);

    const handleSave = async () => {
        await onUpdate(student.id, results);
        setOpen(false);
    };

    const addRow = () => {
        setResults([...results, { id: Math.random().toString(), schoolName: "", rank: results.length + 1, status: "PENDING" }]);
    };

    const updateRow = (index: number, field: keyof AdmissionResult, value: any) => {
        const newResults = [...results];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (newResults[index] as any)[field] = value;
        setResults(newResults);
    };

    const removeRow = (index: number) => {
        setResults(results.filter((_, i) => i !== index));
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">志望校・合否編集</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>志望校・合否情報の編集 - {student.name}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        {results.map((res, index) => (
                            <div key={res.id} className="flex gap-2 items-center">
                                <div className="w-20">
                                    <Label className="text-xs">志望順位</Label>
                                    <Input
                                        type="number"
                                        value={res.rank}
                                        onChange={e => updateRow(index, "rank", parseInt(e.target.value))}
                                    />
                                </div>
                                <div className="flex-1">
                                    <Label className="text-xs">学校名</Label>
                                    <Input
                                        value={res.schoolName}
                                        onChange={e => updateRow(index, "schoolName", e.target.value)}
                                        placeholder="〇〇大学"
                                    />
                                </div>
                                <div className="flex-1">
                                    <Label className="text-xs">学部・学科</Label>
                                    <Input
                                        value={res.department || ""}
                                        onChange={e => updateRow(index, "department", e.target.value)}
                                        placeholder="法学部"
                                    />
                                </div>
                                <div className="w-32">
                                    <Label className="text-xs">ステータス</Label>
                                    <Select value={res.status} onValueChange={val => updateRow(index, "status", val)}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="PENDING">受験予定</SelectItem>
                                            <SelectItem value="PASSED">合格</SelectItem>
                                            <SelectItem value="FAILED">不合格</SelectItem>
                                            <SelectItem value="WITHDRAWN">辞退</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="mt-6">
                                    <Button variant="ghost" size="icon" onClick={() => removeRow(index)}>
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <Button variant="outline" size="sm" onClick={addRow} className="w-full border-dashed">
                        <Plus className="h-4 w-4 mr-2" />
                        志望校を追加
                    </Button>
                </div>
                <DialogFooter>
                    <Button onClick={handleSave}>保存</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
