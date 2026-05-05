import { CUSTOM_USER_HEADER_KEY } from "@/proxy";
import { AppError } from "@/utils/api/Errors";
import { withApiHandler } from "@/utils/api/withApiHandlers";
import { prisma } from "@/utils/prisma/prisma";
import { NextRequest } from "next/server";

type PreferencePayload = {
    trackAllActivities?: boolean;
    trackURLs?: string[];
};

function normalizeDomain(raw: string): string | null {
    const v = raw.trim().toLowerCase();
    if (!v) return null;
    try {
        const u = new URL(v.includes("://") ? v : `https://${v}`);
        return u.hostname || null;
    } catch {
        return null;
    }
}

function sanitizeUrls(input: unknown): string[] {
    if (!Array.isArray(input)) return [];
    const set = new Set<string>();
    for (const item of input) {
        if (typeof item !== "string") continue;
        const host = normalizeDomain(item);
        if (host) set.add(host);
    }
    return [...set];
}

export const GET = withApiHandler(async (req: NextRequest) => {
    const userId = req.headers.get(CUSTOM_USER_HEADER_KEY);
    if (!userId) throw AppError.unauthorized();

    const pref = await prisma.browserExtensionPreference.upsert({
        where: { userId },
        update: {},
        create: { userId, trackAllActivities: false, trackURLs: [] },
    });

    return {
        trackAllActivities: pref.trackAllActivities,
        trackURLs: pref.trackURLs,
    };
});

export const PUT = withApiHandler(async (req: NextRequest) => {
    const userId = req.headers.get(CUSTOM_USER_HEADER_KEY);
    if (!userId) throw AppError.unauthorized();

    let payload: PreferencePayload;
    try {
        payload = (await req.json()) as PreferencePayload;
    } catch {
        throw AppError.badRequest("Invalid JSON body");
    }

    const update: { trackAllActivities?: boolean; trackURLs?: string[] } = {};
    if (typeof payload.trackAllActivities === "boolean") {
        update.trackAllActivities = payload.trackAllActivities;
    }
    if (payload.trackURLs !== undefined) {
        update.trackURLs = sanitizeUrls(payload.trackURLs);
    }

    if (Object.keys(update).length === 0) {
        throw AppError.badRequest("No valid fields supplied");
    }

    const pref = await prisma.browserExtensionPreference.upsert({
        where: { userId },
        update,
        create: {
            userId,
            trackAllActivities: update.trackAllActivities ?? false,
            trackURLs: update.trackURLs ?? [],
        },
    });

    return {
        trackAllActivities: pref.trackAllActivities,
        trackURLs: pref.trackURLs,
    };
});
