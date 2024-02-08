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
import { type PaywallContext, usePaywall } from "@/module/paywall/provider";
import { useWallet } from "@/module/wallet/provider/WalletProvider";
import { prepareUnlockRequestResponse } from "@frak-wallet/sdk";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { createSmartAccountClient } from "permissionless";
import { useEffect } from "react";
import {
    type Address,
    type Hex,
    encodeFunctionData,
    formatEther,
    parseEther,
} from "viem";
import { polygonMumbai } from "viem/chains";

type UnlockSuccessData = Readonly<{
    redirectUrl: string;
    userOpHash: Hex;
    userOpExplorerLink: string;
}>;

export function PaywallUnlock({ context }: { context: PaywallContext }) {
    const { wallet, smartWallet, balance, refreshBalance } = useWallet();
    const { discard } = usePaywall();

    /**
     * Launch the article unlocking
     *  - Different steps of the unlock phase:
     *     - Check the article param and availability (fetch price, refresh user balance)
     *     - Building the transaction (build txs, simulate them)
     *     - Waiting for user signature (send the user operation)
     *     - Success (with redirect data + user op hash + user op explorer link)
     *     - Error (with retry + redirect data + error message)
     */
    const {
        data: unlockResponse,
        mutate: launchArticleUnlock,
        isPending: isUnlockInProgress,
        isError: isUnlockError,
        error,
    } = useMutation({
        mutationKey: ["unlock", context.articleId, context.contentId],
        mutationFn: async (): Promise<UnlockSuccessData | undefined> => {
            console.log("Unlocking article");
            if (!context) {
                console.log("No context");
                // Error that we are missing context
                return undefined;
            }
            if (!smartWallet) {
                console.log("No smart wallet");
                // Error that the user doesn't have a smart wallet
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
                console.log("Not enough balance");
                throw new Error("Not enough balance");
            }

            // Build the list of tx we will st
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
                console.log("Increasing paywall allowance");
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
            console.log("Adding unlock function call");
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
            console.log("Building smart account client", { txs });
            const smartAccountClient = createSmartAccountClient({
                account: smartWallet,
                chain: polygonMumbai,
                transport: pimlicoBundlerTransport,
                sponsorUserOperation:
                    pimlicoPaymasterClient.sponsorUserOperation,
            });

            console.log("Sending user operation via", {
                smartAccountClient: smartAccountClient.account.address,
            });

            // Encode the user op data
            const smartWalletData = await smartWallet.encodeCallData(txs);

            // TODO: Adding a simulation before sending the tx

            // TODO: Update state before that telling that we are waiting for his signature
            const userOpHash = await smartAccountClient.sendUserOperation({
                userOperation: {
                    callData: smartWalletData,
                },
                account: smartWallet,
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

            return {
                redirectUrl,
                userOpHash,
                userOpExplorerLink: `https://jiffyscan.xyz/userOpHash/${userOpHash}?network=mumbai`,
            };
        },
    });

    useEffect(() => {
        if (error) {
            console.error("Unlock error", error);
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

            {isUnlockInProgress && <p>Unlock in progress ...</p>}
            {isUnlockError && (
                <p>An error occurred during the unlock process</p>
            )}
            {unlockResponse && <DisplaySuccessResult result={unlockResponse} />}
        </div>
    );
}

function DisplaySuccessResult({ result }: { result: UnlockSuccessData }) {
    return (
        <div>
            <h2>Unlock success</h2>
            <p>User op hash: {result.userOpHash}</p>
            <br />
            <br />

            <p>
                <a
                    href={result.userOpExplorerLink}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    Check user op
                </a>
            </p>
            <br />
            <br />

            <Link href={result.redirectUrl}>Read the article</Link>
        </div>
    );
}
