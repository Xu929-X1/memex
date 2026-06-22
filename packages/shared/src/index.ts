/**
 * Shared contracts used across @memex apps (web, desktop, extension) and the API.
 * Single source of truth — import from "@memex/shared".
 */

/** HTTP header that identifies which client made a request. */
export const CLIENT_HEADER = "X-Client" as const;
export const BEARER_HEADER = "Authorization" as const;
export const BEARER_PREFIX = "Bearer "
/** Known client identifiers sent in {@link CLIENT_HEADER}. */
export const CLIENTS = {
    web: "web",
    desktop: "desktop",
    extension: "extension",
} as const;

export type ClientType = (typeof CLIENTS)[keyof typeof CLIENTS];

/** Narrow an arbitrary header value to a known {@link ClientType}. */
export function parseClient(value: string | null | undefined): ClientType | null {
    return value && (Object.values(CLIENTS) as string[]).includes(value)
        ? (value as ClientType)
        : null;
}
