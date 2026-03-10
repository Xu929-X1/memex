import { AUTH_TOKEN_KEY } from "@/middleware";
import { generateToken } from "@/utils/api/auth/token";
import { AppError } from "@/utils/api/Errors";
import { withApiHandler } from "@/utils/api/withApiHandlers";
import { prisma } from "@/utils/prisma/prisma";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import * as z from "zod";
const loginSchema = z.object({
    password: z.string(),
    email: z.email(),
    username: z.string()
}).partial().refine(data => {
    return (data.email || data.username) && data.password
}, "Either username or email is required for login")

export const POST = withApiHandler(async (request: NextRequest) => {
    const payload = await request.json();
    const validatedPayload = await loginSchema.safeParse(payload);
    if (validatedPayload.error) {
        throw AppError.unauthorized("Invalid Credentials")
    }
    const user = await prisma.user.findUnique({
        where: validatedPayload.data.email ? {
            email: validatedPayload.data.email
        } : {
            username: validatedPayload.data.username
        }
    });

    if (!user) {
        throw AppError.unauthorized("Invalid Credentials");
    }

    if (!validatedPayload.data.password) {
        throw AppError.unauthorized("Invalid Credentials");
    }

    const isValid = await bcrypt.compare(validatedPayload.data.password, user.password);
    if (!isValid) {
        throw AppError.unauthorized('Invalid Credentials');
    }

    const token = await generateToken(user.id);

    (await cookies()).set({
        name: AUTH_TOKEN_KEY,
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 60 * 60 * 24 * 7
    });
    const { password, ...safeUser } = user;
    return safeUser;

})