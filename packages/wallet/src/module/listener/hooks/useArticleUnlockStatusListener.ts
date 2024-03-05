import {
    pimlicoBundlerClient,
    viemClient,
} from "@/context/common/blockchain/provider";
import type { IFrameRequestResolver } from "@/context/sdk/utils/iFrameRequestResolver";
import { useSession } from "@/module/common/hook/useSession";
import { useOnChainArticleUnlockStatus } from "@/module/paywall/hook/useOnChainArticleUnlockStatus";
import { type PaywallStatus, usePaywall } from "@/module/paywall/provider";
import type {
    ArticleUnlockStatusReturnType,
    ExtractedParametersFromRpc,
    IFrameRpcSchema,
} from "@frak-labs/nexus-sdk/core";
import { useQuery } from "@tanstack/react-query";
import { waitForUserOperationReceipt } from "permissionless";
import { useCallback, useState } from "react";
import type { Hex } from "viem";
import { waitForTransactionReceipt } from "viem/actions";

type OnListenToArticleUnlockStatus = IFrameRequestResolver<
    Extract<
        ExtractedParametersFromRpc<IFrameRpcSchema>,
        { method: "frak_listenToArticleUnlockStatus" }
    >
>;

type UnlockStateListenerParam = {
    contentId: Hex;
    articleId: Hex;
    emitter: (response: ArticleUnlockStatusReturnType) => Promise<void>;
};

/**
 * Hook use to listen to the wallet status
 */
export function useArticleUnlockStatusListener() {
    /**
     * The current wallet status state
     */
    const [listenerParam, setListenerParam] = useState<
        UnlockStateListenerParam | undefined
    >(undefined);

    /**
     * Get the current user session (only fetch it if needed)
     */
    const { session, isFetchingSession } = useSession({
        enabled: listenerParam !== undefined,
    });

    /**
     * Check if the user is allowed on chain
     */
    const {
        isLoading: isLoadingOnChainUnlockStatus,
        data: onChainUnlockStatus,
        refetch: refreshOnChainUnlockStatus,
        dataUpdatedAt: onChainUnlockStatusUpdatedAt,
    } = useOnChainArticleUnlockStatus({
        contentId: listenerParam?.contentId,
        articleId: listenerParam?.articleId,
        address: session?.wallet?.address,
    });

    /**
     * The current context (used to display real time data if a current unlock is in progress)
     */
    const { context: currentPaywallContext, status: currentPaywallStatus } =
        usePaywall();

    /**
     * The function that will be called when we want to listen to an article unlock status
     * @param request
     * @param emitter
     */
    const onArticleUnlockStatusListenerRequest: OnListenToArticleUnlockStatus =
        useCallback(async (request, emitter) => {
            // Extract content id and article id
            const contentId = request.params[0];
            const articleId = request.params[1];

            // If we got nothing, early exit
            if (!(contentId && articleId)) {
                setListenerParam(undefined);
                return;
            }

            // Otherwise, save emitter and params
            setListenerParam({
                contentId,
                articleId,
                emitter,
            });
        }, []);

    /**
     * Emit an updated version of the wallet status every time on our props has changed
     */
    useQuery({
        // Basically, all the trigger arguments to re-send a new states
        queryKey: [
            "articleUnlockStatusAutoEmitter",
            // User related
            session?.wallet?.address ?? "no-wallet",
            // Request related
            listenerParam?.contentId ?? "no-content",
            listenerParam?.articleId ?? "no-article",
            // On chain data related
            onChainUnlockStatus?.isAllowed ?? "no-on-chain-status",
            onChainUnlockStatusUpdatedAt,
            // Real time data
            currentPaywallStatus?.key ?? "no-status",
            currentPaywallContext?.contentId ?? "no-content",
            currentPaywallContext?.articleId ?? "no-content",
        ],
        queryFn: async () => {
            // Early exit if no params
            if (!listenerParam) {
                return;
            }

            // Current user address
            const address = session?.wallet?.address;

            // If no address, early exit
            if (!address) {
                await listenerParam.emitter({
                    key: "not-unlocked",
                    status: "locked",
                });
                return;
            }

            // If we got an allowed unlock status from the blockchain, return that
            if (onChainUnlockStatus?.isAllowed) {
                await listenerParam.emitter({
                    key: "valid",
                    status: "unlocked",
                    allowedUntil: onChainUnlockStatus.allowedUntilInSec * 1000,
                });
                return;
            }

            // If the data wasn't updated recently (less than 30sec) refresh it
            if (
                !onChainUnlockStatusUpdatedAt ||
                Date.now() - onChainUnlockStatusUpdatedAt > 30 * 1000
            ) {
                await refreshOnChainUnlockStatus();
                return;
            }

            // Then, check if it can be handled with real time data
            if (
                currentPaywallStatus &&
                currentPaywallContext &&
                currentPaywallContext.contentId === listenerParam.contentId &&
                currentPaywallContext.articleId === listenerParam.articleId
            ) {
                await emitRealTimeUnlockStatus({
                    status: currentPaywallStatus,
                    emitter: listenerParam.emitter,
                });
                return;
            }

            // If the user has an expired unlock status, tell the user it's expired
            if ((onChainUnlockStatus?.allowedUntilInSec ?? 0) > 0) {
                await listenerParam.emitter({
                    key: "expired",
                    status: "locked",
                    expiredAt:
                        (onChainUnlockStatus?.allowedUntilInSec ?? 0) * 1000,
                });
                return;
            }

            // If we arrived here, the user isn't allowed to read the content
            await listenerParam.emitter({
                key: "not-unlocked",
                status: "locked",
            });
        },
        enabled:
            !!listenerParam &&
            !isFetchingSession &&
            !isLoadingOnChainUnlockStatus,
    });

    /**
     * Compute and emit the real time unlock status
     * @param status
     */
    const emitRealTimeUnlockStatus = useCallback(
        async ({
            status,
            emitter,
        }: {
            status: PaywallStatus;
            emitter: UnlockStateListenerParam["emitter"];
        }) => {
            // If it's an error, tell the user it's an error
            if (status.key === "error") {
                await emitter({
                    key: "error",
                    status: "locked",
                    reason: status.reason ?? "Unknown error",
                });
                return;
            }

            // If it was cancelled, tell the user it was cancelled
            if (status.key === "cancelled") {
                await emitter({
                    key: "error",
                    status: "locked",
                    reason: "Paywall unlock cancelled",
                });
                return;
            }

            // If the status is success, tell the user it's a success
            if (status.key === "idle") {
                await emitter({
                    key: "preparing",
                });
                return;
            }

            // If we are waiting for the user to sign the transaction
            if (status.key === "pendingSignature") {
                await emitter({
                    key: "waiting-user-validation",
                });
            }

            // If it's a success, setup a listener that update the status
            if (status.key === "success") {
                await emitter({
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
                await emitter({
                    key: "waiting-transaction-confirmation",
                    userOpHash: status.userOpHash,
                    txHash: txHash,
                });

                // Wait for the transaction to be confirmed and re-fetch the unlock status
                await waitForTransactionReceipt(viemClient, {
                    hash: txHash,
                    confirmations: 1,
                });
                await refreshOnChainUnlockStatus();
            }
        },
        [refreshOnChainUnlockStatus]
    );

    return {
        onArticleUnlockStatusListenerRequest,
    };
}
