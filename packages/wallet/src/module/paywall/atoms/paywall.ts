import { dexieDb } from "@/context/common/dexie/dexieDb";
import { paywallContextAtom } from "@/module/paywall/atoms/paywallContext";
import { paywallStatusAtom } from "@/module/paywall/atoms/paywallStatus";
import { paywallUnlockUiStateAtom } from "@/module/paywall/atoms/unlockUiState";
import type { StartArticleUnlockParams } from "@frak-labs/nexus-sdk/core";
import { atom } from "jotai";

/**
 * Providers mapping to get more details
 */
const providersMap = {
    "le-monde": {
        slug: "le-monde",
        name: "Le Monde",
        imageUrl: "/images/le-monde.png",
    },
    wired: {
        slug: "wired",
        name: "Wired",
        imageUrl: "/images/wired.png",
    },
    "l-equipe": {
        slug: "l-equipe",
        name: "L'équipe'",
        imageUrl: "/images/l-equipe.png",
    },
} as const;

/**
 * Small boolean to check if we are currently performing a redirection
 */
export const isPaywallRedirectingAtom = atom(false);

/**
 * Atom used to check if a user has a current paywall context
 */
export const hasPaywallContextAtom = atom((get) => !!get(paywallContextAtom));

/**
 * Atom used to set the current paywall data
 */
export const setPaywallDataAtom = atom(
    null,
    async (_get, set, request: StartArticleUnlockParams) => {
        // Save our context info
        set(paywallContextAtom, request);
        set(paywallStatusAtom, { key: "idle" });

        // Reset the paywall unlock ui state
        // TODO: Is it needed?
        set(paywallUnlockUiStateAtom, { idle: true });

        // Register article specific stuff in the dexie database
        try {
            await dexieDb.articleInfo.put({
                articleId: request.articleId,
                contentId: request.contentId,
                contentTitle: request.contentTitle,
                articleTitle: request.articleTitle,
                articleUrl: request.articleUrl,
                provider: providersMap[request.provider],
            });
        } catch (e) {
            console.error("Error inserting article link", e);
        }
    }
);

/**
 * Atom used to clear the current context
 */
export const clearPaywallAtom = atom(null, (_get, set) => {
    set(paywallContextAtom, null);
    set(paywallStatusAtom, null);
});

/**
 * Atom used to set a paywall error
 */
export const setPaywallErrorAtom = atom(null, (_get, set, reason: string) => {
    // Set global paywall error
    set(paywallStatusAtom, { key: "error", reason });
    // Set the ui state error
    set(paywallUnlockUiStateAtom, { error: { reason } });
});

/**
 * Atom used to set a paywall error
 */
export const setPaywallLoadingAtom = atom(
    null,
    (_get, set, info: "checkingParams" | "buildingTx" | "pendingSignature") => {
        // Set the ui state info
        set(paywallUnlockUiStateAtom, { loading: { info } });
        // If needed, also update the global status
        if (info === "pendingSignature") {
            set(paywallStatusAtom, { key: info });
        }
    }
);
