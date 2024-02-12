"use client";

import { dexieDb } from "@/context/common/dexie/dexieDb";
import type { ArticlePrice } from "@/types/Price";
import {
    type UnlockRequestParams,
    prepareUnlockRequestResponse,
} from "@frak-wallet/sdk";
import { useLocalStorage } from "@uidotdev/usehooks";
import { useRouter } from "next/navigation";
import {
    type ReactNode,
    createContext,
    useContext,
    useTransition,
} from "react";
import type { Hex } from "viem";

/**
 * Represent the context of a paywall unlock
 */
export type PaywallContext = {
    // Content related
    contentId: Hex;
    contentTitle: string;
    // Article related
    articleId: Hex;
    articleTitle: string;
    // Price related
    price: ArticlePrice;
    // Url related
    articleUrl: string;
    redirectUrl: string;
    previewUrl?: string;
};

export type PaywallStatus =
    | {
          key: "idle" | "cancelled" | "pendingSignature";
      }
    | {
          key: "pendingTx";
          userOpHash: Hex;
      }
    | {
          key: "success";
          txHash: Hex;
          userOpHash: Hex;
      }
    | {
          key: "error";
          txHash?: Hex;
          userOpHash?: Hex;
          reason?: string;
      };

/**
 * Hook used to store current data about the paywall context
 */
function usePaywallHook() {
    const router = useRouter();
    const [, startTransition] = useTransition();

    const [currentContext, setContext] = useLocalStorage<PaywallContext | null>(
        "paywallContext",
        null
    );
    const [currentStatus, setStatus] = useLocalStorage<PaywallStatus | null>(
        "paywallStatus",
        null
    );

    /**
     * Handle a new unlock request
     * @param unlockRequest
     */
    async function handleNewUnlockRequest(unlockRequest: UnlockRequestParams) {
        setContext(unlockRequest);
        setStatus({ key: "idle" });

        // Insert/Update the article link mapping
        try {
            await dexieDb.articleInfo.put({
                articleId: unlockRequest.articleId,
                contentId: unlockRequest.contentId,
                contentTitle: unlockRequest.contentTitle,
                articleTitle: unlockRequest.articleTitle,
                articleUrl: unlockRequest.articleUrl,
            });
        } catch (e) {
            console.error("Error inserting article link", e);
        }
    }

    /**
     * Discard an unlock request
     */
    async function discard() {
        // If we have no current context, nothing to do
        if (!currentContext) {
            setContext(null);
            setStatus(null);
            return;
        }

        // Update the status to discarded
        setStatus({ key: "cancelled" });

        // Build the redirection url
        const unlockResponseUrl = await prepareUnlockRequestResponse(
            currentContext.redirectUrl,
            {
                key: "cancelled",
                status: "locked",
                reason: "User discarded the unlock request",
            }
        );

        // Cleanup the context
        setContext(null);

        // And go to the redirect url
        startTransition(() => {
            router.push(unlockResponseUrl);
        });
    }

    return {
        context: currentContext,
        status: currentStatus,
        handleNewUnlockRequest,
        setStatus,
        discard,
    };
}

type UsePaywallHook = ReturnType<typeof usePaywallHook>;
const PaywallContext = createContext<UsePaywallHook | null>(null);

export const usePaywall = (): UsePaywallHook => {
    const context = useContext(PaywallContext);
    if (!context) {
        throw new Error(
            "usePaywall hook must be used within a PaywallProvider"
        );
    }
    return context;
};

export function PaywallProvider({ children }: { children: ReactNode }) {
    const hook = usePaywallHook();

    return (
        <PaywallContext.Provider value={hook}>
            {children}
        </PaywallContext.Provider>
    );
}
