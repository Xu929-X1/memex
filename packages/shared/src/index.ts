/**
 * Shared contracts used across @memex apps (web, desktop, extension) and the API.
 * Single source of truth — import from "@memex/shared".
 */

/** HTTP header that identifies which client made a request. */
export const CLIENT_HEADER = "X-Client" as const;
export const BEARER_HEADER = "Authorization" as const;
export const BEARER_PREFIX = "Bearer "

/**
 * Header carrying the authenticated user id. Set SERVER-SIDE by the proxy after
 * it verifies the token, then read by route handlers. Clients must never send
 * it — doing so would let a caller spoof another user's id.
 */
export const CUSTOM_USER_HEADER_KEY = "x-user-id" as const;
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
