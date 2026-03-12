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
interface RegisterFormData {
    username: string,
    email: string,
    password: string,
    error?: string
}

export default function Page() {
    const router = useRouter();
    const FORM_NAME = "register-form"
    const [state, formAction, isPending] = useActionState<RegisterFormData | null, FormData>(handleRegister, null);

    async function handleRegister(state: RegisterFormData | null, formData: FormData): Promise<RegisterFormData | null> {
        const payload: Record<string, string> = {};
        for (const [key, value] of formData.entries()) {
            if (typeof value === 'string') {
                payload[key] = value;
            }
        }
        try {
            const response = await axios.post(routeHelper.register.post, payload);
            router.push("/dashboard");
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const body = error.response?.data as ErrorBody;
                toast.error("Cannot create user:", {
                    description:
                        body?.error?.message
                });
            }
        }
        return null;
    }
    return (<>
        <div className="flex flex-col align-middle justify-center min-h-screen ">
            <div className="flex-1 flex flex-col items-center justify-center">
                <Card className="w-full max-w-sm">
                    <CardHeader>
                        <CardTitle>Register New Account</CardTitle>
                        <CardAction>
                            <Button variant="link" onClick={() => {
                                router.push('/login')
                            }} >Login</Button>
                        </CardAction>
                    </CardHeader>

                    <CardContent>
                        <form id={FORM_NAME} action={formAction}>
                            <div className="flex flex-col gap-6">
                                <div className="grid gap-2">
                                    <Label htmlFor="username">Username</Label>
                                    <Input
                                        name="username"
                                        id="username"
                                        required
                                        placeholder="Enter username"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                        name="email"
                                        id="email"
                                        type="email"
                                        placeholder="m@example.com"
                                        required
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="password">Password</Label>
                                    <Input name="password" id="password" type="password" placeholder="Enter Password" spellCheck required autoComplete="new-password" />
                                </div>


                            </div>
                        </form>
                    </CardContent>
                    <CardFooter className="flex-col gap-2">
                        <Button type="submit" className="w-full" form={FORM_NAME}>
                            Register
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    </>);
}