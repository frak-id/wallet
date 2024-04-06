import { unlockStatusListenerAtom } from "@/module/listener/atoms/unlockStatusListener";
import { clearPaywallAtom } from "@/module/paywall/atoms/paywall";
import { paywallContextAtom } from "@/module/paywall/atoms/paywallContext";
import { paywallStatusAtom } from "@/module/paywall/atoms/paywallStatus";
import type { ArticleUnlockStatusReturnType } from "@frak-labs/nexus-sdk/core";
import { atom } from "jotai";

/**
 * Atom checking if the current unlock status listener match the current context
 */
const isUnlockStatusListenerMatchingAtom = atom((get) => {
    // Get current listener param, early exit if not found
    const listenerParam = get(unlockStatusListenerAtom);
    if (!listenerParam) {
        return false;
    }

    // Then, get the current context
    const context = get(paywallContextAtom);
    if (!context) {
        return false;
    }

    // Check if the listener param match the current context
    return (
        listenerParam.contentId === context.contentId &&
        listenerParam.articleId === context.articleId
    );
});

/**
 * Derivative atom from the unlock state one, checking if the current unlock state is pending
 */
export const unlockStateFromCurrentAtom =
    atom<ArticleUnlockStatusReturnType | null>((get) => {
        const currentMatchRequest = get(isUnlockStatusListenerMatchingAtom);
        if (!currentMatchRequest) {
            return null;
        }

        // Otherwise, read current state and map it to a return type
        const status = get(paywallStatusAtom);
        if (!status) {
            return null;
        }

        if (status.key === "error") {
            return {
                key: "error",
                status: "locked",
                reason: status.reason ?? "Unknown error",
            };
        }

        if (status.key === "cancelled") {
            return {
                key: "error",
                status: "locked",
                reason: "Paywall unlock cancelled",
            };
        }

        if (status.key === "idle") {
            return {
                status: "in-progress",
                key: "preparing",
            };
        }

        if (status.key === "pendingSignature") {
            return {
                status: "in-progress",
                key: "waiting-user-validation",
            };
        }
        if (status.key === "pendingTx") {
            return {
                status: "in-progress",
                key: "waiting-transaction-bundling",
                userOpHash: status.userOpHash,
            };
        }

        if (status.key === "success") {
            return {
                status: "in-progress",
                key: "waiting-transaction-confirmation",
                userOpHash: status.userOpHash,
                txHash: status.txHash,
            };
        }

        return null;
    });

/**
 * Unlock status from on chain
 */
export const clearCurrentStateIfMatchAtom = atom(null, (get, set) => {
    const currentMatchRequest = get(isUnlockStatusListenerMatchingAtom);
    if (currentMatchRequest) {
        console.log("Apparently current listener matched here");
        set(clearPaywallAtom);
    }
});

/**
 * Check additional stuff we need to load for the paywall listener
 */
export const paywallListenerAdditionalLoaderParamAtom = atom((get) => {
    const context = get(unlockStateFromCurrentAtom);
    if (context?.key === "waiting-transaction-bundling") {
        return {
            key: "wait-user-op",
            userOpHash: context.userOpHash,
        };
    }

    if (context?.key === "waiting-transaction-confirmation") {
        return {
            key: "wait-tx",
            txHash: context.txHash,
        };
    }

    return { key: "nothing-to-load" };
});
