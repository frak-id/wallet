import type { SharingPageProduct } from "@frak-labs/core-sdk";
import {
    decodeProductsParam,
    sanitizeSharingProducts,
} from "@frak-labs/core-sdk";
import {
    sanitizeShareImage,
    truncateForShare,
} from "@frak-labs/wallet-shared/sharing";
import { decodeHostEmbed } from "@/module/common/utils/hostEmbed";
import { sanitizeRedirectUrl } from "@/module/common/utils/sanitizeRedirectUrl";
import { sanitizeReturnScheme } from "@/module/common/utils/sanitizeReturnScheme";
import { sanitizeSeededReward } from "@/module/common/utils/sanitizeSeededReward";

/** Where a param may arrive: `query` at load only, `both` also via the activation fragment. */
export type ParamTransport = "query" | "both";

export type ParamCodec<T> = {
    /** Returns `undefined` for anything the param cannot legally be. */
    decode: (raw: unknown) => T | undefined;
    transport: ParamTransport;
    /** Value written when a fragment arrives WITHOUT this key. */
    fragmentDefault?: T;
};

const str = (raw: unknown): string | undefined =>
    typeof raw === "string" ? raw : undefined;

/** Search values are JSON-parsed, so a numeric-looking id arrives as a `number`. */
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

/** `products` as raw JSON or as a `compressJsonToB64` string; always sanitized. */
const productList = (raw: unknown): SharingPageProduct[] | undefined => {
    if (typeof raw === "string") {
        return decodeProductsParam(raw) ?? sanitizeSharingProducts(raw);
    }
    return sanitizeSharingProducts(raw);
};

/**
 * A non-empty string clipped to `maxLength`. Truncates rather than rejecting: dropping
 * an over-long override would silently fall through to the tier below it, so a merchant
 * who wrote 300 characters would get the generic copy instead of their own, clipped.
 */
const cappedStr =
    (maxLength: number) =>
    (raw: unknown): string | undefined => {
        const value = str(raw);
        if (!value) return undefined;
        return truncateForShare(value, maxLength);
    };

export const SHARING_PARAMS = {
    merchantId: { decode: str, transport: "query" },
    clientId: { decode: str, transport: "query" },
    link: { decode: str, transport: "both" },
    appName: { decode: str, transport: "query" },
    logoUrl: { decode: str, transport: "both" },
    products: { decode: productList, transport: "both" },
    checkoutToken: { decode: str, transport: "query" },
    redirectUrl: { decode: sanitizeRedirectUrl, transport: "query" },

    /** `native` means a host embedded this page, which makes `clientId` mandatory. */
    embed: { decode: decodeHostEmbed, transport: "query" },

    /** Custom scheme a native host listens on: `<scheme>://result?action=…`. */
    returnScheme: { decode: sanitizeReturnScheme, transport: "query" },

    /** Opaque host session token, echoed back on every outcome. */
    sid: { decode: looseStr, transport: "both" },

    /** Version of the native SDK that opened this page. Telemetry only. */
    sdkVersion: { decode: looseStr, transport: "query" },

    /** Pre-formatted reward headline from a host's cache, until the real query resolves. */
    seedReward: { decode: sanitizeSeededReward, transport: "both" },

    /** Per-call share title override; see `SharingRequest.shareTitle` on both native SDKs. */
    shareTitle: { decode: cappedStr(120), transport: "both" },

    /** Per-call share body override; see `SharingRequest.shareText` on both native SDKs. */
    shareText: { decode: cappedStr(280), transport: "both" },

    /** Per-call preview image override; see `SharingRequest.shareImage` on both native SDKs. */
    shareImage: { decode: sanitizeShareImage, transport: "both" },

    /**
     * `warm` means a host preloaded the page; it reports
     * `sharing_page_preloaded` instead of `sharing_page_viewed`. The fragment
     * default clears `warm` even when the host forgot to send `state`.
     */
    state: {
        decode: oneOf("live", "warm"),
        transport: "both",
        fragmentDefault: "live",
    },

    /** Which screen to open on; `confirmation` means the host's own share sheet completed. */
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

/** Widens a table entry so optional flags like `fragmentDefault` stay readable. */
export function paramCodec(key: SharingParamKey): ParamCodec<unknown> {
    return SHARING_PARAMS[key];
}

/** Keys the activation fragment is allowed to deliver. */
export const FRAGMENT_KEYS = (
    Object.keys(SHARING_PARAMS) as SharingParamKey[]
).filter((key) => paramCodec(key).transport === "both");
