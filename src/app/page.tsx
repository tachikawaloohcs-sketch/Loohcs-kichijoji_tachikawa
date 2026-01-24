import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/auth";

export default async function Home() {
  const session = await auth();
  const user = session?.user;
  const role = user?.role; // "STUDENT", "INSTRUCTOR", "ADMIN"

  const isDisabled = (target: "STUDENT" | "INSTRUCTOR" | "ADMIN") => {
    if (!user) return false;
    if (role === "ADMIN") return false;
    if (role === "INSTRUCTOR") return target === "ADMIN";
    if (role === "STUDENT") return target !== "STUDENT";
    return false;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 flex flex-col items-center justify-center p-4">
      <div className="max-w-3xl w-full space-y-8 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl text-primary dark:text-blue-400">
          Loohcs志塾立川・吉祥寺校予約システム
        </h1>

        {user ? (
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">
            ようこそ。{user.name}さん。
          </p>
        ) : (
          <p className="text-xl text-slate-600 dark:text-slate-400">
            ログインする役割を選択してください
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <div className={isDisabled("STUDENT") ? "opacity-50 pointer-events-none" : ""}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-t-4 border-primary h-full">
              <CardHeader>
                <CardTitle>生徒</CardTitle>
                <CardDescription>授業の予約・履歴確認</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href={user ? "/student/dashboard" : "/login"}>
                  <Button className="w-full">生徒としてログイン</Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          <div className={isDisabled("INSTRUCTOR") ? "opacity-50 pointer-events-none" : ""}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-t-4 border-primary h-full">
              <CardHeader>
                <CardTitle>講師</CardTitle>
                <CardDescription>シフト提出・授業報告</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href={user ? "/instructor/dashboard" : "/login"}>
                  <Button className="w-full" variant="outline">講師としてログイン</Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          <div className={isDisabled("ADMIN") ? "opacity-50 pointer-events-none" : ""}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-t-4 border-primary h-full">
              <CardHeader>
                <CardTitle>管理者</CardTitle>
                <CardDescription>ユーザー管理・請求</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href={user ? "/admin/dashboard" : "/login"}>
                  <Button className="w-full" variant="secondary">管理者としてログイン</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
