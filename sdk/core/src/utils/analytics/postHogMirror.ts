import type { TrackPayload } from "@openpanel/web";
import { deleteQueryParamCaseInsensitive } from "../url/queryParams";

const nonEmptyString = (value: unknown): string | undefined =>
    typeof value === "string" && value !== "" ? value : undefined;

// A wallet address or a tx hash (which leads to one), bare or inside a URL.
const onChainId = /0x[0-9a-f]{40}/i;
// A legacy v1 `fCtx` is the referrer's wallet address in base64url.
const frakContextParam = /[?&#]fctx=/i;

function scrub(value: unknown): unknown {
    if (typeof value !== "string") return value;
    let scrubbed = value;
    if (frakContextParam.test(scrubbed)) {
        try {
            const url = new URL(scrubbed);
            deleteQueryParamCaseInsensitive(url.searchParams, "fCtx");
            scrubbed = url.toString();
        } catch {
            return undefined;
        }
    }
    return frakContextParam.test(scrubbed) || onChainId.test(scrubbed)
        ? undefined
        : scrubbed;
}

/**
 * Build a function that sends a copy of each OpenPanel `track` payload to
 * PostHog without posthog-js: no person profile, no cookie, nothing stored.
 * Returns `undefined` (mirror off) unless both `host` and `token` are set.
 * @ignore
 */
export function createPostHogMirror(
    host: string | undefined,
    token: string | undefined
): ((payload: TrackPayload) => void) | undefined {
    if (!host || !token) return undefined;

    let fallbackId: string | undefined;
    const anonymousId = () => {
        fallbackId ??= crypto.randomUUID();
        return fallbackId;
    };

    return (payload) => {
        // A mirror must never break the OpenPanel `filter` that calls it.
        try {
            // Values that identify a wallet stay in OpenPanel only.
            const properties = Object.fromEntries(
                Object.entries(payload.properties ?? {}).map(([key, value]) => [
                    key,
                    scrub(value),
                ])
            );
            // `undefined` values are dropped by JSON.stringify, so PostHog
            // stamps its receive time unless OpenPanel queued the event.
            const body = JSON.stringify({
                api_key: token,
                event:
                    payload.name === "screen_view" ? "$pageview" : payload.name,
                distinct_id:
                    nonEmptyString(properties.__deviceId) ?? anonymousId(),
                timestamp: nonEmptyString(properties.__timestamp),
                // No `$lib`: PostHog's bot filter skips any `$lib` but empty, web or js.
                properties: {
                    ...properties,
                    $process_person_profile: false,
                    $current_url: nonEmptyString(properties.__path),
                    $referrer: nonEmptyString(properties.__referrer),
                    $raw_user_agent: globalThis.navigator?.userAgent,
                    op_profile_id: scrub(payload.profileId),
                },
            });
            fetch(`${host}/i/v0/e/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                keepalive: true,
                body,
            }).catch(() => {});
        } catch {}
    };
}
