"use client";

import {
    addresses,
    paywallAddress,
} from "@/context/common/blockchain/addresses";
import { frakTokenAbi, paywallAbi } from "@/context/common/blockchain/frak-abi";
import {
    pimlicoBundlerTransport,
    pimlicoPaymasterClient,
    viemClient,
} from "@/context/common/blockchain/provider";
import { getArticlePrice } from "@/context/paywall/action/getPrices";
import { getUnlockStatusOnArticle } from "@/context/paywall/action/getStatus";
import { type PaywallContext, usePaywall } from "@/module/paywall/provider";
import { useWallet } from "@/module/wallet/provider/WalletProvider";
import { prepareUnlockRequestResponse } from "@frak-wallet/sdk";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { createSmartAccountClient } from "permissionless";
import { useEffect, useState } from "react";
import {
    type Address,
    type Hex,
    encodeFunctionData,
    formatEther,
    parseEther,
} from "viem";
import { polygonMumbai } from "viem/chains";
import {formatSecondDuration} from "@frak-wallet/example/src/module/article/utils/duration";

type UnlockSuccessData = Readonly<{
    redirectUrl: string;
    userOpHash: Hex;
    userOpExplorerLink: string;
}>;

type UiState =
    | {
          already: {
              redirectUrl: string;
              expireIn: string;
          };
          success?: never;
          error?: never;
          loading?: never;
      }
    | {
          success: {
              redirectUrl: string;
              userOpHash: Hex;
              userOpExplorerLink: string;
          };
          already?: never;
          error?: never;
          loading?: never;
      }
    | {
          error: {
              reason: string;
          };
          already?: never;
          success?: never;
          loading?: never;
      }
    | {
          loading: {
              info: "checkingParams" | "buildingTx" | "pendingSignature";
          };
          already?: never;
          error?: never;
          success?: never;
      };

export function PaywallUnlock({ context }: { context: PaywallContext }) {
    const { wallet, smartWallet, balance, refreshBalance } = useWallet();
    const { discard, setStatus: setGlobalPaywallStatus } = usePaywall();

    const [uiState, setUiState] = useState<UiState>({
        loading: { info: "checkingParams" },
    });

    // Fetch the user allowance on chain
    const { refetch: refreshOnChainUnlockStatus } = useQuery({
        queryKey: [
            "getUnlockStatus",
            context.contentId,
            context.articleId,
            wallet?.address,
        ],
        queryFn: async () => {
            if (!wallet?.address) {
                return;
            }
            return getUnlockStatusOnArticle({
                contentId: context.contentId,
                articleId: context.articleId,
                user: wallet.address,
            });
        },
        enabled: !!wallet?.address && !!context,
    });

    // Helper to set the loading state
    function setLoadingUiState(
        info: "checkingParams" | "buildingTx" | "pendingSignature"
    ) {
        setUiState({ loading: { info } });
    }

    // Set the error state
    function setErrorState(reason: string) {
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
    const { mutate: launchArticleUnlock, error } = useMutation({
        mutationKey: ["unlock", context.articleId, context.contentId],
        mutationFn: async (): Promise<UnlockSuccessData | undefined> => {
            setLoadingUiState("checkingParams");
            if (!context) {
                // Error that we are missing context
                setErrorState("Missing paywall context");
                return undefined;
            }
            if (!smartWallet) {
                // Error that the user doesn't have a smart wallet
                setErrorState("No smart wallet");
                return;
            }

            // Refresh the on chain stuff
            const { data: onchainStatus } = await refreshOnChainUnlockStatus();
            if (onchainStatus?.isAllowed === true) {
                // Compute the expiration time
                const expireIn = Date.now() - (onchainStatus.allowedUntilInSec * 1000);
                const formattedDuration = formatSecondDuration(expireIn / 1000);
                // Parse the data and return them
                const redirectUrl = await prepareUnlockRequestResponse(
                    context.redirectUrl,
                    {
                        key: "already-unlocked",
                        status: "unlocked",
                        user: wallet.address,
                    }
                );
                setUiState({
                    already: {
                        redirectUrl,
                        expireIn: formattedDuration
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
            const allowance = await viemClient.readContract({
                address: addresses.frakToken,
                abi: frakTokenAbi,
                functionName: "allowance",
                args: [wallet?.address, paywallAddress],
            });

            // If the allowance isn't enough, we need to approve the paywall contract
            if (weiPrice > allowance) {
                const allowanceFnCall = encodeFunctionData({
                    abi: frakTokenAbi,
                    functionName: "approve",
                    args: [paywallAddress, weiPrice * 10n],
                });
                txs.push({
                    to: addresses.frakToken,
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
                to: paywallAddress,
                value: 0n,
                data: unlockFnCall,
            });

            // Build the smart account client we will use to send the txs
            const smartAccountClient = createSmartAccountClient({
                account: smartWallet,
                chain: polygonMumbai,
                transport: pimlicoBundlerTransport,
                sponsorUserOperation:
                    pimlicoPaymasterClient.sponsorUserOperation,
            });

            // Encode the user op data
            const smartWalletData = await smartWallet.encodeCallData(txs);

            // TODO: Adding a simulation before sending the tx

            // TODO: Update state before that telling that we are waiting for his signature
            setLoadingUiState("pendingSignature");
            setGlobalPaywallStatus({ key: "pendingSignature" });
            const userOpHash = await smartAccountClient.sendUserOperation({
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
            const redirectUrl = await prepareUnlockRequestResponse(
                context.redirectUrl,
                {
                    key: "success",
                    status: "in-progress",
                    user: wallet.address,
                    userOpHash: userOpHash,
                }
            );

            // Set the ui success state
            setUiState({
                success: {
                    redirectUrl,
                    userOpHash,
                    userOpExplorerLink: `https://jiffyscan.xyz/userOpHash/${userOpHash}?network=mumbai`,
                },
            });
        },
    });

    useEffect(() => {
        if (error) {
            setErrorState(error?.message ?? "Unknown error");
        }
    }, [error]);

    return (
        <div>
            <h1>Paywall Unlock</h1>
            <p>Content: {context.contentTitle}</p>
            <p>Article: {context.articleTitle}</p>
            <p>Price: {formatEther(BigInt(context.price.frkAmount))} FRK </p>
            <p>Balance: {balance}</p>
            <p>Wallet: {wallet?.address}</p>

            <br />
            <br />
            <button type="button" onClick={discard}>
                Discard unlock request
            </button>

            <br />
            <br />
            <button type="button" onClick={() => launchArticleUnlock()}>
                Launch unlock
            </button>

            <br />
            <br />

            <UiStateComponent uiState={uiState} />
        </div>
    );
}

function UiStateComponent({ uiState }: { uiState: UiState }) {
    return (
        <div>
            <LoadingUiState loading={uiState.loading} />
            <ErrorUiState error={uiState.error} />
            <SuccessUiState success={uiState.success} />
        </div>
    );
}

function LoadingUiState({ loading }: { loading: UiState["loading"] }) {
    if (!loading) {
        return null;
    }

    return (
        <div>
            <h2>Loading...</h2>
            <p>{loading.info}</p>
        </div>
    );
}

function ErrorUiState({ error }: { error: UiState["error"] }) {
    if (!error) {
        return null;
    }

    return (
        <div>
            <h2>Error</h2>
            <p>{error.reason}</p>
        </div>
    );
}

function SuccessUiState({ success }: { success: UiState["success"] }) {
    if (!success) {
        return null;
    }

    return (
        <div>
            <h2>Unlock success</h2>
            <p>User op hash: {success.userOpHash}</p>
            <br />
            <br />

            <p>
                <a
                    href={success.userOpExplorerLink}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    Check user op
                </a>
            </p>
            <br />
            <br />

            <Link href={success.redirectUrl}>Read the article</Link>
        </div>
    );
}
