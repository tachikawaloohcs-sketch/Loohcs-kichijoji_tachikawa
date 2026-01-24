"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { authenticate } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import Link from "next/link";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

function LoginButton() {
    const { pending } = useFormStatus();
    return (
        <Button className="w-full" aria-disabled={pending}>
            {pending ? "ログイン中..." : "ログイン"}
        </Button>
    );
}

export default function LoginPage() {
    const [errorMessage, dispatch] = useActionState(authenticate, undefined);
    const [showPassword, setShowPassword] = useState(false);

    return (
        <div className="flex h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle>ログイン</CardTitle>
                    <CardDescription>Loohcs志塾立川・吉祥寺校予約システムへようこそ</CardDescription>
                </CardHeader>
                <CardContent>
                    <form action={dispatch} className="space-y-4">
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

                        <LoginButton />

                        {errorMessage && (
                            <div className="text-red-500 text-sm">{errorMessage}</div>
                        )}
                    </form>
                </CardContent>
                <CardFooter className="justify-center">
                    <Link href="/register" className="text-sm text-primary hover:underline">
                        アカウントを作成する
                    </Link>
                </CardFooter>
            </Card>
        </div>
    );
}
