import {
    pimlicoBundlerClient,
    viemClient,
} from "@/context/common/blockchain/provider";
import { getUnlockStatusOnArticle } from "@/context/paywall/action/getStatus";
import { useSession } from "@/module/common/hook/useSession";
import { type PaywallStatus, usePaywall } from "@/module/paywall/provider";
import type { ArticleUnlockStatusReturnType } from "@frak-labs/nexus-sdk/core";
import { useQuery } from "@tanstack/react-query";
import { waitForUserOperationReceipt } from "permissionless";
import { useEffect, useState } from "react";
import type { Hex } from "viem";
import { waitForTransactionReceipt } from "viem/actions";

/**
 * Get the current unlock state of an article
 */
export function useUnlockState({
    articleId,
    contentId,
}: { articleId?: Hex; contentId?: Hex }) {
    // The current user session
    const {
        session,
        isFetchingSession,
        isSuccess: isSessionFetchSuccess,
    } = useSession();

    // The current context (used to display real time data if a current unlock is in progress)
    const { context, status } = usePaywall();

    // The unlock state to return
    const [unlockState, setUnlockState] =
        useState<ArticleUnlockStatusReturnType>();

    // Get the current user session

    // Fetch the user allowance on chain
    const {
        isLoading: isLoadingOnChainUnlockStatus,
        data: onChainUnlockStatus,
        refetch: refreshOnChainUnlockStatus,
    } = useQuery({
        queryKey: [
            "getUnlockStatus",
            contentId,
            articleId,
            session?.wallet?.address,
        ],
        queryFn: async () => {
            if (!(session?.wallet?.address && contentId && articleId)) {
                return;
            }
            return getUnlockStatusOnArticle({
                contentId,
                articleId,
                user: session.wallet.address,
            });
        },
        enabled:
            isSessionFetchSuccess && !!session && !!contentId && !!articleId,
    });

    // Every time the status change, update the unlock state
    useEffect(() => {
        // If we are fetching the unlock status or the session, don't do anything
        if (isLoadingOnChainUnlockStatus || isFetchingSession) {
            return;
        }

        const address = session?.wallet?.address;
        // If no address, tell the user isn't logged in
        if (!address) {
            setUnlockState({ key: "not-unlocked", status: "locked" });
            return;
        }

        // If we got an allowed unlock status from the blockchain, return that
        if (onChainUnlockStatus?.isAllowed) {
            setUnlockState({
                key: "valid",
                status: "unlocked",
                allowedUntil: onChainUnlockStatus.allowedUntilInSec * 1000,
            });
            return;
        }

        // Otherwise, check if we have a current paywall status
        if (
            status &&
            context &&
            context.articleId === articleId &&
            context.contentId === contentId
        ) {
            realTimeUnlockState({ status });
            return;
        }

        // If the user has an expired unlock status, tell the user it's expired
        if ((onChainUnlockStatus?.allowedUntilInSec ?? 0) > 0) {
            setUnlockState({
                key: "expired",
                status: "locked",
                expiredAt: (onChainUnlockStatus?.allowedUntilInSec ?? 0) * 1000,
            });
            return;
        }

        // If we arrived here, the user isn't allowed to read the content
        setUnlockState({
            key: "not-unlocked",
            status: "locked",
        });
    }, [
        session,
        contentId,
        articleId,
        isFetchingSession,
        isLoadingOnChainUnlockStatus,
        context,
        status,
        onChainUnlockStatus,
    ]);

    /**
     * Compute the real time unlock status
     * @param status
     */
    async function realTimeUnlockState({ status }: { status: PaywallStatus }) {
        // If it's an error, tell the user it's an error
        if (status.key === "error") {
            setUnlockState({
                key: "error",
                status: "locked",
                reason: status.reason ?? "Unknown error",
            });
            return;
        }

        // If it was cancelled, tell the user it was cancelled
        if (status.key === "cancelled") {
            setUnlockState({
                key: "error",
                status: "locked",
                reason: "Paywall unlock cancelled",
            });
            return;
        }

        // If the status is success, tell the user it's a success
        if (status.key === "idle") {
            setUnlockState({
                key: "preparing",
            });
            return;
        }

        // If we are waiting for the user to sign the transaction
        if (status.key === "pendingSignature") {
            setUnlockState({
                key: "waiting-user-validation",
            });
        }

        // If it's a success, setup a listener that update the status
        if (status.key === "success") {
            setUnlockState({
                key: "waiting-transaction-bundling",
                userOpHash: status.userOpHash,
            });

            // Wait for the user operation receipt
            // TODO: should be in a mutation or any other thing?
            // TODO: Should be able to be cancelled if the user cancel the unlock
            const userOpReceipt = await waitForUserOperationReceipt(
                pimlicoBundlerClient,
                {
                    hash: status.userOpHash,
                }
            );
            const txHash = userOpReceipt.receipt.transactionHash;
            setUnlockState({
                key: "waiting-transaction-confirmation",
                userOpHash: status.userOpHash,
                txHash: txHash,
            });

            // Wait for the transaction to be confirmed and refetch the unlock status
            await waitForTransactionReceipt(viemClient, {
                hash: txHash,
                confirmations: 1,
            });
            await refreshOnChainUnlockStatus();
        }
    }

    return {
        unlockState,
    };
}
