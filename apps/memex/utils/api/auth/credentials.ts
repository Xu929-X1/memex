import { AUTH_TOKEN_KEY } from "@/proxy";
import { generateToken } from "@/utils/api/auth/token";
import { AppError } from "@/utils/api/Errors";
import { prisma } from "@/utils/prisma/prisma";
import bcrypt from "bcryptjs";
import * as z from "zod";

export const loginSchema = z.object({
    identifier: z.string(),
    password: z.string(),
});

export const registerSchema = z.object({
    username: z.string(),
    email: z.email(),
    password: z.string().min(8),
});

// Options for the httpOnly auth cookie. Web/extension read this automatically;
// desktop can't (native HTTP + httpOnly) so it uses the token-in-body routes.
export const authCookieOptions = {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 7,
};

type SafeUser = Omit<Awaited<ReturnType<typeof prisma.user.create>>, "password">;

/** Verify credentials, returning the password-stripped user + a fresh token. */
export async function authenticate(
    payload: unknown,
): Promise<{ user: SafeUser; token: string }> {
    const parsed = loginSchema.safeParse(payload);
    // Same opaque error whether the body is malformed or the creds are wrong —
    // don't leak which part failed.
    if (parsed.error) throw AppError.unauthorized("Invalid Credentials");

    const found = await prisma.user.findFirst({
        where: {
            OR: [
                { email: parsed.data.identifier },
                { username: parsed.data.identifier },
            ],
        },
    });
    if (!found) throw AppError.unauthorized("Invalid Credentials");

    const isValid = await bcrypt.compare(parsed.data.password, found.password);
    if (!isValid) throw AppError.unauthorized("Invalid Credentials");

    const token = await generateToken(found.id);
    const { password, ...user } = found;
    return { user, token };
}

/** Create a new user, returning the password-stripped user + a fresh token. */
export async function createAccount(
    payload: unknown,
): Promise<{ user: SafeUser; token: string }> {
    const parsed = registerSchema.safeParse(payload);
    if (parsed.error) throw AppError.badRequest("Unable to register", parsed.error);

    const existing = await prisma.user.findFirst({
        where: {
            OR: [
                { email: parsed.data.email },
                { username: parsed.data.username },
            ],
        },
    });
    if (existing) throw AppError.badRequest("Email or username already taken");

    const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
    const created = await prisma.user.create({
        data: {
            username: parsed.data.username,
            email: parsed.data.email,
            password: hashedPassword,
        },
    });
    const token = await generateToken(created.id);
    const { password, ...user } = created;
    return { user, token };
}

export { AUTH_TOKEN_KEY };
