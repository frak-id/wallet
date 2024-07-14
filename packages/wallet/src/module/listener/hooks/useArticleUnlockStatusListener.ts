import { frakChainId } from "@/context/blockchain/provider";
import type { IFrameRequestResolver } from "@/context/sdk/utils/iFrameRequestResolver";
import { sessionAtom } from "@/module/common/atoms/session";
import { useAAClients } from "@/module/common/hook/useAAClients";
import {
    unlockStateAtom,
    unlockStateFromOnChainSetterAtom,
    unlockStatusListenerAtom,
} from "@/module/listener/atoms/unlockStatusListener";
import {
    clearCurrentStateIfMatchAtom,
    paywallListenerAdditionalLoaderParamAtom,
} from "@/module/listener/atoms/unlockStatusListenerLocal";
import { paywallStatusAtom } from "@/module/paywall/atoms/paywallStatus";
import { useOnChainArticleUnlockStatus } from "@/module/paywall/hook/useOnChainArticleUnlockStatus";
import type {
    ExtractedParametersFromRpc,
    IFrameRpcSchema,
} from "@frak-labs/nexus-sdk/core";
import { jotaiStore } from "@module/atoms/store";
import { useQuery } from "@tanstack/react-query";
import { useAtom } from "jotai";
import { useAtomValue } from "jotai/index";
import { waitForUserOperationReceipt } from "permissionless";
import { useCallback, useEffect } from "react";
import { waitForTransactionReceipt } from "viem/actions";

type OnListenToArticleUnlockStatus = IFrameRequestResolver<
    Extract<
        ExtractedParametersFromRpc<IFrameRpcSchema>,
        { method: "frak_listenToArticleUnlockStatus" }
    >
>;

/**
 * Hook use to listen to the wallet status
 */
export function useArticleUnlockStatusListener(): OnListenToArticleUnlockStatus {
    // Fetch the AA transports
    const { viemClient, bundlerClient } = useAAClients({
        chainId: frakChainId,
    });

    /**
     * The current wallet status state
     */
    const [listenerParam, setListenerParam] = useAtom(unlockStatusListenerAtom);

    /**
     * The current unlock status mapped from the current listener param
     */
    const currentUnlockStatus = useAtomValue(unlockStateAtom);

    /**
     * Check if the user is allowed on chain
     */
    const {
        data: onChainUnlockStatus,
        refetch: refreshOnChainUnlockStatus,
        isLoading: isFetchingOnChainStatus,
    } = useOnChainArticleUnlockStatus({
        contentId: listenerParam?.contentId,
        articleId: listenerParam?.articleId,
        queryOptions: {},
    });

    // Just a syncer + mapper between tanstack and jotai
    useEffect(() => {
        jotaiStore.set(unlockStateFromOnChainSetterAtom, onChainUnlockStatus);
    }, [onChainUnlockStatus]);

    /**
     * Every time the 'currentUnlockStatus' atom is updated, emit it (if we don't have any concurrent updates)
     */
    useEffect(() => {
        // If we are loading a few stuff, directly exit
        if (isFetchingOnChainStatus) {
            return;
        }

        // If no emitter, or no status, directly exit
        if (!(listenerParam?.emitter && currentUnlockStatus)) {
            return;
        }

        // If we got no session, directly emit the locked state
        const session = jotaiStore.get(sessionAtom);
        if (!session) {
            listenerParam?.emitter({
                result: {
                    key: "not-unlocked",
                    status: "locked",
                },
            });
            return;
        }

        // Emit the status
        listenerParam?.emitter({ result: currentUnlockStatus });

        // If that's a valid status, clear the paywall context
        if (currentUnlockStatus.key === "valid") {
            jotaiStore.set(clearCurrentStateIfMatchAtom);
        }
    }, [currentUnlockStatus, listenerParam?.emitter, isFetchingOnChainStatus]);

    /**
     * The additional loader params, used to listen to a user op or a tx hash
     */
    const loaderParam = useAtomValue(paywallListenerAdditionalLoaderParamAtom);

    /**
     * Query that will listen to the current context paywall status
     */
    useQuery({
        queryKey: [
            "currentPaywallListener",
            loaderParam.key,
            loaderParam.userOpHash ?? "no-op-hash",
            loaderParam.txHash ?? "no-tx-hash",
        ],
        queryFn: async () => {
            // If we are waiting for the user op hash
            if (loaderParam.userOpHash && bundlerClient) {
                const status = await waitForUserOperationReceipt(
                    bundlerClient,
                    {
                        hash: loaderParam.userOpHash,
                    }
                );
                // Set the global paywall status as a success with it's user op hash
                jotaiStore.set(paywallStatusAtom, {
                    key: "success",
                    userOpHash: loaderParam.userOpHash,
                    txHash: status.receipt.transactionHash,
                });
                return null;
            }

            // If we are waiting for the tx hash
            if (loaderParam.txHash && viemClient) {
                await waitForTransactionReceipt(viemClient, {
                    hash: loaderParam.txHash,
                    confirmations: 2,
                });
                // Once we got our response, we can refresh the on chain unlock status
                await refreshOnChainUnlockStatus();
                return null;
            }

            // If we arrived here, nothing to load
            return null;
        },
        enabled:
            loaderParam.key !== "nothing-to-load" &&
            !!viemClient &&
            !!bundlerClient,
    });

    return useCallback(
        async (request, emitter) => {
            // Extract content id and article id
            const contentId = request.params[0];
            const articleId = request.params[1];

            // Always reset the onchain unlock status state
            jotaiStore.set(unlockStateFromOnChainSetterAtom, undefined);

            // If we got nothing, early exit
            if (!(contentId && articleId)) {
                setListenerParam(null);
                return;
            }

            // Reset the onchain unlock status and refetch it
            refreshOnChainUnlockStatus();

            // Otherwise, save emitter and params
            setListenerParam({
                contentId,
                articleId,
                emitter,
            });
        },
        [setListenerParam, refreshOnChainUnlockStatus]
    );
}
