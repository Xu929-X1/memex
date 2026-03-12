'use client'
import { routeHelper } from "@/app/route-helper";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorBody } from "@/utils/api/response";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { toast } from "sonner";
const FORM_NAME = "login-form";

interface LoginFormData {
    identifier: string
    password: string
}
export default function Page() {

    const router = useRouter();
    const [state, formAction, isPending] = useActionState<LoginFormData | null, FormData>(handleLogin, null);

    async function handleLogin(prevState: LoginFormData | null, formData: FormData): Promise<LoginFormData | null> {
        const payload: Record<string, string> = {};
        for (const [key, value] of formData.entries()) {
            if (typeof value === 'string') {
                payload[key] = value;
            }
        }
        try {
            const response = await axios.post(routeHelper.login.post, payload);
            router.push("/dashboard");
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const body = error.response?.data as ErrorBody;
                toast.error("Unable to Login:", {
                    description: body?.error?.message,
                });
            }
        }
        return null;
    }
    return (
        <>
            <div className="flex flex-col min-h-screen align-middle justify-center">

                <div className="flex align-middle justify-center items-center flex-1">

                    <Card className="w-full max-w-sm">
                        <CardHeader>

                            <CardTitle>
                                Login
                            </CardTitle>
                            <CardAction>
                                <Button variant={"link"} onClick={() => {
                                    router.push('/register')
                                }}>
                                    Register
                                </Button>
                            </CardAction>
                        </CardHeader>

                        <CardContent>
                            <form id={FORM_NAME} action={formAction}>
                                <div className="flex flex-col gap-6">
                                    <div className="grid gap-2">
                                        <Label htmlFor="identifier">
                                            Email or Username
                                        </Label>
                                        <Input
                                            name="identifier"
                                            id="identifier"
                                            required
                                            placeholder="Enter Email or Username"
                                        />

                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="password">Password</Label>
                                        <Input
                                            name="password"
                                            id="password"
                                            required
                                            type="password"
                                            placeholder="Enter Password"
                                        />
                                    </div>
                                </div>
                            </form>
                        </CardContent>

                        <CardFooter>
                            <Button form={FORM_NAME} variant={"default"} className={"w-full"} type="submit">Login</Button>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </>
    )
}