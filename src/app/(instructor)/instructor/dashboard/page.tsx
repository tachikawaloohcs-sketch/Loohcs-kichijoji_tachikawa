import { getInstructorShifts, getInstructorRequests, getStudentsForInstructor, getGlobalSettings, getLicensedArchivedStudents, getAllShifts, getInstructorHistory } from "./actions";
import InstructorDashboardClient from "./InstructorDashboardClient";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/actions";

export default async function InstructorDashboardPage() {
    const [
        shifts,
        requests,
        students,
        archivedStudents,
        deadlineSetting,
        masterShifts,
        history
    ] = await Promise.all([
        getInstructorShifts(),
        getInstructorRequests(),
        getStudentsForInstructor(),
        getLicensedArchivedStudents(),
        getGlobalSettings("CARTE_DEADLINE_EXTENSION_HOURS"),
        getAllShifts(),
        getInstructorHistory()
    ]);

    const extensionHours = parseInt(deadlineSetting.value || "0", 10);

    return (
        <div className="p-8 space-y-8 max-w-7xl mx-auto">
            <header className="flex justify-between items-center border-b pb-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">講師ダッシュボード</h1>
                    <p className="text-muted-foreground">シフト管理と生徒カルテ</p>
                </div>
                <div className="flex gap-2">
                    <form action={logout}>
                        <Button variant="outline">ログアウト</Button>
                    </form>
                </div>
            </header>

            <InstructorDashboardClient
                initialShifts={shifts}
                initialRequests={requests}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                students={students as any}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                archivedStudents={archivedStudents as any}
                deadlineExtensionHours={extensionHours}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                masterShifts={masterShifts as any[]}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                history={history as any[]}
            />
        </div>
    );
}
