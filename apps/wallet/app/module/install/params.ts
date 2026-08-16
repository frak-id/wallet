import {
    decodeHostEmbed,
    type HostEmbed,
} from "@/module/common/utils/hostEmbed";
import { sanitizeReturnScheme } from "@/module/common/utils/sanitizeReturnScheme";

export type InstallSearch = {
    m?: string;
    a?: string;
    /** Shopify credential forwarded from `/sharing`, when there is no `a`. */
    checkoutToken?: string;
    /** `frak-install-v1` proof, when a fragment could not carry it. See `resolveInstallProof`. */
    p?: string;
    /** `native` means a host embedded this page, so it draws no chrome of its own. */
    embed?: HostEmbed;
    /** Native host's result scheme. Present only when the SDK's web view loaded this page. */
    returnScheme?: string;
    /** The host's correlation token, echoed back with any result. */
    sid?: string;
};

/**
 * Decode the `/install` query string. Shared by the SPA route's
 * `validateSearch` and the standalone entrypoint, so a param can never be
 * accepted on one surface and rejected on the other.
 */
export function parseInstallSearch(
    search: Record<string, unknown>
): InstallSearch {
    return {
        m: typeof search.m === "string" ? search.m : undefined,
        a: typeof search.a === "string" ? search.a : undefined,
        checkoutToken:
            typeof search.checkoutToken === "string"
                ? search.checkoutToken
                : undefined,
        p: typeof search.p === "string" ? search.p : undefined,
        embed: decodeHostEmbed(search.embed),
        // Sanitised: the page navigates to whatever scheme this carries; an
        // unvalidated value would turn a wallet-origin page into an arbitrary
        // scheme launcher.
        returnScheme: sanitizeReturnScheme(search.returnScheme),
        sid: typeof search.sid === "string" ? search.sid : undefined,
    };
}

/**
 * Parses the `frak-install-v1` proof from the URL fragment (`#p=...`), which is
 * never sent to a server, never logged, never in a `Referer`. Never throws: a
 * malformed or missing fragment means "no proof".
 */
export function parseInstallProofFragment(hash: string): string | undefined {
    const raw = hash.startsWith("#") ? hash.slice(1) : hash;
    if (!raw) return undefined;
    try {
        return new URLSearchParams(raw).get("p") ?? undefined;
    } catch {
        return undefined;
    }
}

/**
 * The install proof for this visit. The fragment wins, but it cannot survive an
 * in-app navigation and the Play referrer carries none, so those handoffs use
 * `?p=` instead.
 */
export function resolveInstallProof(
    hash: string,
    searchProof?: string
): string | undefined {
    return parseInstallProofFragment(hash) ?? searchProof;
}

/**
 * Builds the ensure action for the direct-link / Tauri processing path.
 * Exported for direct testing. A missing proof degrades silently, never blocks.
 */
export function buildInstallProcessingEnsureAction(params: {
    merchantId?: string;
    anonymousId?: string;
    proof?: string;
}):
    | {
          type: "ensure";
          merchantId: string;
          anonymousId: string;
          proof?: string;
      }
    | undefined {
    const { merchantId, anonymousId, proof } = params;
    if (!merchantId || !anonymousId) return undefined;
    return {
        type: "ensure",
        merchantId,
        anonymousId,
        ...(proof && { proof }),
    };
}
