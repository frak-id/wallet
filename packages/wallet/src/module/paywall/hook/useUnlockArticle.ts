import { addresses } from "@/context/common/blockchain/addresses";
import {
    paywallAbi,
    paywallTokenAbi,
} from "@/context/common/blockchain/poc-abi";
import { formatSecondDuration } from "@/context/common/duration";
import { getArticlePrice } from "@/context/paywall/action/getPrices";
import { getStartUnlockResponseRedirectUrl } from "@/context/sdk/utils/startUnlock";
import { useOnChainArticleUnlockStatus } from "@/module/paywall/hook/useOnChainArticleUnlockStatus";
import { usePaywall } from "@/module/paywall/provider";
import type { PaywallContext } from "@/module/paywall/provider";
import { useFrkBalance } from "@/module/wallet/hook/useFrkBalance";
import { useWallet } from "@/module/wallet/provider/WalletProvider";
import type { UiState, UnlockSuccessData } from "@/types/Unlock";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { type Hex, encodeFunctionData, parseEther } from "viem";
import type { Address } from "viem";
import { readContract } from "viem/actions";
import { arbitrumSepolia } from "viem/chains";
import { useClient } from "wagmi";

/**
 * Hook used to fetch and handle the prices
 * TODO: If not on mumbai, modal to inform the user that he is on the wrong network and asking him to switch to mumbai
 */
export function useArticlePrices({ context }: { context: PaywallContext }) {
    const { wallet, smartWallet, smartWalletClient } = useWallet();
    const { balance, refreshBalance } = useFrkBalance();
    const { setStatus: setGlobalPaywallStatus } = usePaywall();
    const [disabled, setDisabled] = useState(false);

    const [uiState, setUiState] = useState<UiState>({
        loading: { info: "idle" },
    });

    const viemClient = useClient({ chainId: arbitrumSepolia.id });

    // Fetch the user allowance on chain
    const { refetch: refreshOnChainUnlockStatus } =
        useOnChainArticleUnlockStatus({
            contentId: context.contentId,
            articleId: context.articleId,
            address: wallet?.address,
        });

    // Helper to set the loading state
    function setLoadingUiState(
        info: "idle" | "checkingParams" | "buildingTx" | "pendingSignature"
    ) {
        setUiState({ loading: { info } });
    }

    function setErrorState(reason: string) {
        setDisabled(false);
        setUiState({ error: { reason } });
        // Set the error globally
        setGlobalPaywallStatus({
            key: "error",
            reason,
        });
    }

    /**
     * Launch the article unlocking
     *  - Different steps of the unlock phase:
     *     - Check the article param and availability (fetch price, refresh user balance)
     *     - Building the transaction (build txs, simulate them)
     *     - Waiting for user signature (send the user operation)
     *     - Success (with redirect data + user op hash + user op explorer link)
     *     - Error (with retry + redirect data + error message)
     */
    const { mutateAsync: launchArticleUnlock, error } = useMutation({
        mutationKey: ["unlock", context.articleId, context.contentId],
        mutationFn: async (): Promise<UnlockSuccessData | undefined> => {
            setDisabled(true);
            setLoadingUiState("checkingParams");
            if (!context) {
                // Error that we are missing context
                setErrorState("Missing paywall context");
                return undefined;
            }
            if (!(smartWallet && smartWalletClient)) {
                // Error that the user doesn't have a smart wallet
                setErrorState("No smart wallet");
                return;
            }
            if (!viemClient) {
                // Error telling that we don't have a blockchain communication client
                setErrorState("No blockchain communication client");
                return;
            }

            // Refresh the on chain stuff
            const { data: onchainStatus } = await refreshOnChainUnlockStatus();
            if (onchainStatus?.isAllowed === true) {
                // Compute the expiration time
                const expireIn =
                    Date.now() - onchainStatus.allowedUntilInSec * 1000;
                const formattedDuration = formatSecondDuration(expireIn / 1000);
                // Parse the data and return them
                const redirectUrl = await getStartUnlockResponseRedirectUrl({
                    redirectUrl: context.redirectUrl,
                    response: {
                        key: "already-unlocked",
                        status: "unlocked",
                        user: wallet.address,
                    },
                });
                setUiState({
                    already: {
                        redirectUrl,
                        expireIn: formattedDuration,
                    },
                });
                return;
            }

            // Refetching the balance
            await refreshBalance();

            // Fetch up to date prices (and inform user if something is different from what he requested)
            const blockchainPrice = await getArticlePrice({
                contentId: context.contentId,
                priceIndex: context.price.index,
            });
            if (blockchainPrice !== context.price) {
                console.log("Different price", {
                    blockchainPrice,
                    contextPrice: context.price,
                });
                // TODO: Inform the user that the price has changed
            }

            // Format the balance and price
            const weiBalance = parseEther(balance);
            const weiPrice = BigInt(blockchainPrice?.frkAmount ?? "0x00");

            if (weiPrice > weiBalance) {
                setErrorState("Not enough balance");
                return;
            }

            // Build the list of tx we will st
            setLoadingUiState("buildingTx");
            // TODO: All of this stuff should be done somewhere else, like a build article tx helper function
            const txs: {
                to: Address;
                value: bigint;
                data: Hex;
            }[] = [];

            // Check the user allowance to the paywall contract
            const allowance = await readContract(viemClient, {
                address: addresses.paywallToken,
                abi: paywallTokenAbi,
                functionName: "allowance",
                args: [wallet?.address, addresses.paywall],
            });

            // If the allowance isn't enough, we need to approve the paywall contract
            if (weiPrice > allowance) {
                const allowanceFnCall = encodeFunctionData({
                    abi: paywallTokenAbi,
                    functionName: "approve",
                    args: [addresses.paywall, weiPrice * 10n],
                });
                txs.push({
                    to: addresses.paywallToken,
                    value: 0n,
                    data: allowanceFnCall,
                });
            }

            // Build the unlock tx and add it
            const unlockFnCall = encodeFunctionData({
                abi: paywallAbi,
                functionName: "unlockAccess",
                args: [
                    BigInt(context.contentId),
                    context.articleId,
                    BigInt(context.price.index),
                ],
            });
            txs.push({
                to: addresses.paywall,
                value: 0n,
                data: unlockFnCall,
            });

            // Encode the user op data
            const smartWalletData = await smartWallet.encodeCallData(txs);

            // TODO: Adding a simulation before sending the tx

            // TODO: Update state before that telling that we are waiting for his signature
            setLoadingUiState("pendingSignature");
            setGlobalPaywallStatus({ key: "pendingSignature" });
            const userOpHash = await smartWalletClient.sendUserOperation({
                userOperation: {
                    callData: smartWalletData,
                },
                account: smartWallet,
            });

            // Update the global paywall status
            setGlobalPaywallStatus({
                key: "pendingTx",
                userOpHash,
            });

            // Parse the data and return them
            const redirectUrl = await getStartUnlockResponseRedirectUrl({
                redirectUrl: context.redirectUrl,
                response: {
                    key: "success",
                    status: "in-progress",
                    user: wallet.address,
                    userOpHash: userOpHash,
                },
            });

            setDisabled(false);

            // Set the ui success state
            setUiState({
                success: {
                    redirectUrl,
                    userOpHash,
                    userOpExplorerLink: `https://jiffyscan.xyz/userOpHash/${userOpHash}?network=arbitrum-sepolia`,
                },
            });
        },
    });

    useEffect(() => {
        if (error) {
            setErrorState(error?.message ?? "Unknown error");
        }
    }, [error]);

    return {
        disabled,
        launchArticleUnlock,
        uiState,
    };
}
