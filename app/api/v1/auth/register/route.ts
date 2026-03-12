import { AUTH_TOKEN_KEY } from "@/middleware";
import { generateToken } from "@/utils/api/auth/token";
import { AppError } from "@/utils/api/Errors";
import { withApiHandler } from "@/utils/api/withApiHandlers";
import { prisma } from "@/utils/prisma/prisma";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import * as z from "zod";
const registerSchema = z.object({
    username: z.string(),
    email: z.email(),
    password: z.string().min(8)
})

export const POST = withApiHandler(async (request: NextRequest) => {
    const payload = await request.json();
    const validationResult = await registerSchema.safeParse(payload)
    if (validationResult.error) {
        throw AppError.badRequest("Unable to register", validationResult.error)
    }
    const existing = await prisma.user.findFirst({
        where: {
            OR: [{ email: validationResult.data.email }, { username: validationResult.data.username }]
        }
    })
    if (existing) {
        throw AppError.badRequest("Email or username already taken");
    }
    const hashedPassword = await bcrypt.hash(validationResult.data.password, 10)
    const createdUser = await prisma.user.create({
        data: {
            username: validationResult.data.username,
            email: validationResult.data.email,
            password: hashedPassword
        }
    });
    const { password, ...safeUser } = createdUser
    const token = await generateToken(createdUser.id)

    const response = NextResponse.json(safeUser, { status: 201 })
    response.cookies.set(AUTH_TOKEN_KEY, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7
    })
    return response
})