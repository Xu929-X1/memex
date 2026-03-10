import * as jose from "jose";
import { AppError } from "../Errors";

export async function generateToken(userID: string) {
    if (!process.env.JWT_SECRET) {
        throw AppError.internal("No JWT Secret found");
    }
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);

    const token = await new jose.SignJWT({
        sub: userID
    }).setProtectedHeader({
        alg: "HS256"
    }).setExpirationTime("7d").sign(secret);
    return token;
}


export async function decodeToken(token: string) {
    if (!process.env.JWT_SECRET) {
        throw AppError.internal("No JWT Secret found")
    }
    const secret = new TextEncoder().encode(process.env.JWT_SECRET)
    const { payload } = await jose.jwtVerify(token, secret)

    return payload;
}