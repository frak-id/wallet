import { sessionAtom } from "@/module/common/atoms/session";
import { unlockStateFromCurrentAtom } from "@/module/listener/atoms/unlockStatusListenerLocal";
import type {
    ArticleUnlockStatusReturnType,
    IFrameRpcSchema,
    RpcResponse,
} from "@frak-labs/nexus-sdk/core";
import { atom } from "jotai";
import type { Hex } from "viem";

type UnlockStateListenerParam = {
    contentId: Hex;
    articleId: Hex;
    emitter: (
        response: RpcResponse<
            IFrameRpcSchema,
            "frak_listenToArticleUnlockStatus"
        >
    ) => Promise<void>;
};

/**
 * Atom representing the current unlock status listener
 */
export const unlockStatusListenerAtom = atom<UnlockStateListenerParam | null>(
    null
);

/**
 * Atom representing the current unlock state
 */
export const unlockStateAtom = atom<ArticleUnlockStatusReturnType>((get) => {
    // Get the current session
    const session = get(sessionAtom);

    // If no session, return a default locked state
    if (!session) {
        return {
            key: "not-unlocked",
            status: "locked",
        };
    }

    // Get the current on chain status
    const currentOnChainStatus = get(unlockStateFromOnChainAtom);

    // If that's unlocked, return it
    if (currentOnChainStatus?.status === "unlocked") {
        return currentOnChainStatus;
    }

    // Otherwise, return the current state, if we got one, return it directly
    const currentUnlockingState = get(unlockStateFromCurrentAtom);
    if (currentUnlockingState) {
        return currentUnlockingState;
    }

    // Otherwise, return the on chain status if present
    if (currentOnChainStatus) {
        return currentOnChainStatus;
    }

    // Otherwise, return a default locked state
    return {
        key: "not-unlocked",
        status: "locked",
    };
});

/**
 * Unlock status from on chain
 */
const unlockStateFromOnChainAtom = atom<ArticleUnlockStatusReturnType | null>(
    null
);

/**
 * Mapper and setter for the on-chain status
 */
export const unlockStateFromOnChainSetterAtom = atom(
    null,
    (
        _get,
        set,
        data?: {
            isAllowed: boolean;
            allowedUntilInSec?: number;
        } | null
    ) => {
        // Otherwise, set the on chain unlock status
        if (data?.isAllowed === true) {
            set(unlockStateFromOnChainAtom, {
                key: "valid",
                status: "unlocked",
                allowedUntil: (data?.allowedUntilInSec ?? 0) * 1000,
            });
            return;
        }

        // Otherwise, set the on chain unlock status to expired
        if ((data?.allowedUntilInSec ?? 0) > 0) {
            set(unlockStateFromOnChainAtom, {
                key: "expired",
                status: "locked",
                expiredAt: (data?.allowedUntilInSec ?? 0) * 1000,
            });
            return;
        }
        // If no case match, set it to null
        set(unlockStateFromOnChainAtom, null);
    }
);
