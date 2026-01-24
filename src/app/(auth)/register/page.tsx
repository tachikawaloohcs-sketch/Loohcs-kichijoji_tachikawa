"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { register } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

function RegisterButton() {
    const { pending } = useFormStatus();
    return (
        <Button className="w-full" aria-disabled={pending}>
            {pending ? "登録中..." : "登録する"}
        </Button>
    );
}

export default function RegisterPage() {
    const [errorMessage, dispatch] = useActionState(register, undefined);
    const router = useRouter();
    const [showPassword, setShowPassword] = useState(false);
    const [role, setRole] = useState("STUDENT");

    useEffect(() => {
        if (errorMessage === "success") {
            router.push("/login?registered=true");
        }
    }, [errorMessage, router]);

    return (
        <div className="flex h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle>アカウント登録</CardTitle>
                    <CardDescription>必要な情報を入力してください</CardDescription>
                </CardHeader>
                <CardContent>
                    <form action={dispatch} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">お名前</Label>
                            <Input id="name" name="name" required placeholder="山田 太郎" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">メールアドレス</Label>
                            <Input id="email" type="email" name="email" required placeholder="user@example.com" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">パスワード</Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="role">役割</Label>
                            <div className="relative">
                                <select
                                    name="role"
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={role}
                                    onChange={(e) => setRole(e.target.value)}
                                >
                                    <option value="STUDENT">生徒</option>
                                    <option value="INSTRUCTOR">講師</option>
                                </select>
                            </div>
                            <p className="text-xs text-muted-foreground">※本来は管理者が招待する運用推奨</p>
                        </div>

                        {role === "INSTRUCTOR" && (
                            <div className="space-y-4 border-l-2 border-primary pl-4 py-2 bg-slate-50 dark:bg-slate-900/50 rounded-r">
                                <div className="space-y-2">
                                    <Label htmlFor="bio">自己紹介・担当科目</Label>
                                    <Input id="bio" name="bio" placeholder="例: 英語・数学を担当します。" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="image">顔写真</Label>
                                    <Input id="image" name="image" type="file" accept="image/*" />
                                </div>
                            </div>
                        )}

                        <RegisterButton />

                        {errorMessage && errorMessage !== "success" && (
                            <div className="text-red-500 text-sm">{errorMessage}</div>
                        )}
                    </form>
                </CardContent>
                <CardFooter className="justify-center">
                    <Link href="/login" className="text-sm text-primary hover:underline">
                        すでにアカウントをお持ちの方 / ログイン
                    </Link>
                </CardFooter>
            </Card>
        </div>
    );
}
