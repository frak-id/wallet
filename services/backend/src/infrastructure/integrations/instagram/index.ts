import { log } from "@backend-infrastructure/external/logger";

/** Pinned to what the FRA-364 spike ran against. */
export const INSTAGRAM_GRAPH_VERSION = "v26.0";
const GRAPH_URL = "https://graph.instagram.com";
const TIMEOUT_MS = 5_000;

/** Meta error codes that say nothing about the player: auth, permissions, throttling, outage. */
const SYSTEMIC_ERROR_CODES = new Set([1, 2, 4, 10, 17, 32, 190, 613]);

/** 401/403 mean our token or app setup is wrong, whatever the code: never one player's fault. */
function isSystemic(status: number, code: number | null): boolean {
    if (status >= 500 || status === 429 || code === null) return true;
    if (status === 401 || status === 403) return true;
    return SYSTEMIC_ERROR_CODES.has(code) || (code >= 200 && code < 300);
}

export type InstagramProfileLookup =
    | { kind: "found"; username: string; follows: boolean }
    /** Meta refuses this IGSID (account deleted or blocking us): no follow to prove. */
    | { kind: "gone"; code: number | null }
    | { kind: "unavailable" };

type GraphError = { error?: { code?: number; message?: string } };

/** Instagram API with Instagram Login, as the connected @frak_fr account. */
export class InstagramGraphClient {
    constructor(private readonly baseUrl: string = GRAPH_URL) {}

    async lookupProfile(
        igsid: string,
        token: string
    ): Promise<InstagramProfileLookup> {
        const url = `${this.baseUrl}/${INSTAGRAM_GRAPH_VERSION}/${encodeURIComponent(igsid)}?fields=username,is_user_follow_business`;
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(TIMEOUT_MS),
        }).catch((err: unknown) => {
            log.warn({ err }, "Instagram profile lookup unreachable");
            return null;
        });
        if (!response) return { kind: "unavailable" };

        const body = (await response.json().catch(() => null)) as
            | ({
                  username?: string;
                  is_user_follow_business?: boolean;
              } & GraphError)
            | null;
        if (response.ok && body?.username) {
            return {
                kind: "found",
                username: body.username,
                follows: body.is_user_follow_business === true,
            };
        }

        const code = body?.error?.code ?? null;
        log.warn(
            { status: response.status, code, message: body?.error?.message },
            "Instagram profile lookup failed"
        );
        return isSystemic(response.status, code)
            ? { kind: "unavailable" }
            : { kind: "gone", code };
    }

    /** A new 60-day token; Meta only renews a token at least 24 h old. Never log the URL. */
    async refreshToken(
        token: string
    ): Promise<{ token: string; expiresInSeconds: number } | null> {
        const url = `${this.baseUrl}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`;
        const response = await fetch(url, {
            signal: AbortSignal.timeout(TIMEOUT_MS),
        }).catch(() => null);
        const body = (await response?.json().catch(() => null)) as
            | ({ access_token?: string; expires_in?: number } & GraphError)
            | null;
        if (!(response?.ok && body?.access_token && body.expires_in)) {
            log.error(
                {
                    status: response?.status,
                    code: body?.error?.code,
                    message: body?.error?.message,
                },
                "Instagram token refresh failed"
            );
            return null;
        }
        return {
            token: body.access_token,
            expiresInSeconds: body.expires_in,
        };
    }
}
