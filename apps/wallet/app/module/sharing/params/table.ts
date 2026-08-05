import type { SharingPageProduct } from "@frak-labs/core-sdk";
import {
    decodeProductsParam,
    sanitizeSharingProducts,
} from "@frak-labs/core-sdk";
import { sanitizeRedirectUrl } from "@/module/common/utils/sanitizeRedirectUrl";
import { sanitizeReturnScheme } from "@/module/common/utils/sanitizeReturnScheme";
import { sanitizeSeededReward } from "@/module/common/utils/sanitizeSeededReward";

/**
 * Where a param may legally arrive.
 *
 * `query` — read once, at load. `both` — also deliverable by the activation
 * fragment a native host appends to an already-warmed page, which is a
 * same-document navigation and therefore the only way to hand per-tap state to
 * a page that has already booted.
 */
export type ParamTransport = "query" | "both";

export type ParamCodec<T> = {
    /** Returns `undefined` for anything the param cannot legally be. */
    decode: (raw: unknown) => T | undefined;
    transport: ParamTransport;
    /**
     * Only honoured once `embed` is confirmed. A plain web visitor must not be
     * able to reach a host-only capability by typing the param into the URL.
     */
    nativeOnly?: boolean;
    /**
     * Value written when a fragment arrives WITHOUT this key.
     *
     * Normally an absent key is omitted entirely — see `parseSharingFragment`,
     * where that is load-bearing. This is the deliberate exception: a fragment
     * only ever arrives because someone tapped, so a param whose whole meaning
     * is "nobody has looked at this page yet" must be actively cleared rather
     * than left standing from the warm URL.
     */
    fragmentDefault?: T;
};

/** `typeof value === "string"`, and nothing else. */
const str = (raw: unknown): string | undefined =>
    typeof raw === "string" ? raw : undefined;

/**
 * The router parses search values as JSON, so a host that mints an id from a
 * counter or a timestamp sends digits that arrive as a `number`. Dropping
 * those would cost every callback its session id.
 */
const looseStr = (raw: unknown): string | undefined => {
    if (typeof raw === "string") return raw;
    if (typeof raw === "number") return String(raw);
    return undefined;
};

/** A closed set of string values, for params that are enums rather than flags. */
const oneOf =
    <const T extends string>(...allowed: T[]) =>
    (raw: unknown): T | undefined => {
        const value = looseStr(raw);
        return value !== undefined && allowed.includes(value as T)
            ? (value as T)
            : undefined;
    };

/**
 * A whole number inside `[min, max]`, where `min` also reads as "absent".
 *
 * Same JSON-parsed-value handling as the rest: `?cornerRadius=28` arrives as
 * the number 28, but a host sending it as a string is accepted too.
 */
const clampedInt =
    (min: number, max: number) =>
    (raw: unknown): number | undefined => {
        const numeric =
            typeof raw === "number"
                ? raw
                : typeof raw === "string"
                  ? Number(raw)
                  : Number.NaN;
        if (!Number.isFinite(numeric)) return undefined;
        const clamped = Math.min(Math.max(Math.floor(numeric), min), max);
        return clamped === min ? undefined : clamped;
    };

/**
 * A `products` param in either encoding the contract accepts: raw JSON — which
 * the router's search parser already turns into an array, and which the
 * activation fragment hands over as a JSON string — or a `compressJsonToB64`
 * string, the encoding `sdk/components` already decodes on merchant pages.
 *
 * Tries the b64 decode first, since a JSON-parsed string is never valid
 * base64url, then falls back to sanitizing the value directly, which also
 * covers a JSON-stringified array on its own.
 *
 * Always ends in `sanitizeSharingProducts`: `products` reaches `<img src>`,
 * `product.title`, and campaign selection's numeric scope fields, so it is
 * never trusted as-is regardless of which encoding carried it.
 */
const productList = (raw: unknown): SharingPageProduct[] | undefined => {
    if (typeof raw === "string") {
        return decodeProductsParam(raw) ?? sanitizeSharingProducts(raw);
    }
    return sanitizeSharingProducts(raw);
};

/**
 * The `/sharing` param contract, declared once.
 *
 * Both transports read this table, which is the point: the query string and
 * the activation fragment used to be two hand-written parsers over the same
 * key set that had to agree by convention. Anything they disagreed about was a
 * silent bug — the fragment is spread over the query params, so a param the
 * fragment sanitized differently would quietly overwrite a good value with a
 * bad one, or erase it entirely.
 *
 * ## Frozen keys
 *
 * `merchantId`, `clientId`, `link`, `appName`, `logoUrl`, `products`,
 * `checkoutToken` and `redirectUrl` are sent by the Shopify post-purchase
 * extension, which is live and which merchants depend on
 * (`apps/shopify/extensions/checkout-post-purchase/src/PostPurchaseCard.tsx`).
 * They keep their names and their exact decoding. In particular `logoUrl` is a
 * plain string rather than an https-only URL: tightening it would be a
 * behaviour change on a live param, not a refactor.
 *
 * ## Shared with `/install`
 *
 * `returnScheme` and `sid` keep their names because `/install` reads the same
 * two params from its own hosts. Renaming them here alone would split one host
 * contract across two spellings.
 */
export const SHARING_PARAMS = {
    merchantId: { decode: str, transport: "query" },
    clientId: { decode: str, transport: "query" },
    link: { decode: str, transport: "both" },
    appName: { decode: str, transport: "query" },
    logoUrl: { decode: str, transport: "both" },
    products: { decode: productList, transport: "both" },
    checkoutToken: { decode: str, transport: "query" },
    redirectUrl: { decode: sanitizeRedirectUrl, transport: "query" },

    /**
     * How this page is being presented. `native` means a host has embedded it
     * in its own sheet, which makes `clientId` mandatory (the host owns the
     * caller identity) and renders the page without its own chrome.
     *
     * An enum rather than the boolean it replaced: a second embedding vehicle
     * costs a value here instead of another flag to cross-check.
     */
    embed: { decode: oneOf("native"), transport: "query" },

    /**
     * Custom scheme a native host listens on for outcomes, since it has no JS
     * bridge: outcomes navigate to `<scheme>://result?action=…`, which the host
     * intercepts in its own web view.
     */
    returnScheme: { decode: sanitizeReturnScheme, transport: "query" },

    /**
     * Opaque single-use token minted by the host, echoed back on every outcome
     * so it can drop callbacks not belonging to the active session.
     */
    sid: { decode: looseStr, transport: "both" },

    /** Version of the native SDK that opened this page. Telemetry only. */
    sdkVersion: { decode: looseStr, transport: "query" },

    /**
     * Top corner radius (CSS px) for the sheet a native host presents this page
     * in. The Android host stopped clipping the WebView natively — its
     * `AwDrawFn` GPU functor only carries a rectangular clip, so a Compose
     * `RoundedCornerShape` around it forced an offscreen/stencil pass on every
     * frame — and now rounds the corners in-page instead. iOS omits this param
     * on purpose: a SwiftUI `.sheet` already clips to the system radius, and a
     * second arc drawn inside would read as a double corner.
     *
     * `query`, because a host sets it once at load and never per tap.
     * `nativeOnly`, because `?cornerRadius=200` from a web visitor must not
     * reach into this page's geometry.
     */
    cornerRadius: {
        decode: clampedInt(0, 48),
        transport: "query",
        nativeOnly: true,
    },

    /**
     * Already-formatted reward headline from a host's local cache, painted on
     * the first frame and replaced once the real query resolves. Display-only:
     * never reaches the sharing link or any identity decision.
     */
    seedReward: { decode: sanitizeSeededReward, transport: "both" },

    /**
     * Whether anyone is actually looking at this page.
     *
     * `warm` means a host has loaded it against the real merchant so the
     * bundle, React, i18n and the merchant-keyed queries are all done before
     * the user taps. A warm page reports `sharing_page_preloaded` instead of
     * `sharing_page_viewed`, which is what keeps warming every merchant surface
     * from inflating the sharing funnel's denominator with sheets nobody
     * opened.
     *
     * `fragmentDefault: "live"` is the load-bearing bit: an activation fragment
     * means someone tapped, so it clears `warm` even when the host forgot to
     * say so. Without it a host that omitted the key would warm forever and
     * never report a single view.
     */
    state: {
        decode: oneOf("live", "warm"),
        transport: "both",
        fragmentDefault: "live",
    },

    /**
     * Which of the page's two screens to open on. `confirmation` is how a host
     * whose own share sheet already completed says so, since the in-page
     * buttons that would otherwise set it are hidden under `embed=native`.
     */
    view: { decode: oneOf("share", "confirmation"), transport: "both" },
} as const satisfies Record<string, ParamCodec<unknown>>;

export type SharingParamKey = keyof typeof SHARING_PARAMS;

/** The decoded shape of the whole table. */
export type SharingSearch = {
    [K in SharingParamKey]?: ReturnType<(typeof SHARING_PARAMS)[K]["decode"]>;
};

/** The subset a fragment may carry. */
export type SharingActivation = {
    [K in SharingParamKey as (typeof SHARING_PARAMS)[K]["transport"] extends "both"
        ? K
        : never]?: ReturnType<(typeof SHARING_PARAMS)[K]["decode"]>;
};

/**
 * A table entry seen through the general codec type.
 *
 * `as const satisfies` narrows each entry to exactly the properties it
 * declares, which is what gives `SharingSearch` its per-key value types — but
 * it also means `fragmentDefault` and `nativeOnly` are missing from the
 * entries that omit them, and so unreadable across the union. Widening here
 * keeps the precise types where they are useful and the optional flags
 * readable where they are needed.
 */
export function paramCodec(key: SharingParamKey): ParamCodec<unknown> {
    return SHARING_PARAMS[key];
}

/** Keys the activation fragment is allowed to deliver. */
export const FRAGMENT_KEYS = (
    Object.keys(SHARING_PARAMS) as SharingParamKey[]
).filter((key) => paramCodec(key).transport === "both");
