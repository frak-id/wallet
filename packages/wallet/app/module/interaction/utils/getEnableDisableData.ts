import { setExecutionAbi } from "@/module/recovery/utils/abi";
import { encodeWalletMulticall } from "@/module/wallet/utils/multicall";
import {
    addresses,
    sendInteractionSelector,
    sendInteractionsSelector,
} from "@frak-labs/app-essentials";
import { type Address, type Hex, encodeFunctionData, zeroAddress } from "viem";

/**
 * Get an interaction session enable data
 * @param sessionEnd
 */
export function getEnableSessionData({
    sessionEnd,
    wallet,
}: { sessionEnd: Date; wallet: Address }): Hex {
    // Get allowed after (date.now / 1000) and  until
    const start = Math.floor(Date.now() / 1000);
    const end = Math.floor(sessionEnd.getTime() / 1000);

    const enableTxForSelector = (selector: Hex) =>
        encodeFunctionData({
            abi: [setExecutionAbi],
            functionName: "setExecution",
            args: [
                // The current selector we want to allow
                selector,
                // The interaction action address
                addresses.interactionDelegatorAction,
                // The address of the interaction session validator
                addresses.interactionDelegatorValidator,
                // Valid until timestamps, in seconds
                end,
                // Valid after timestamp, in seconds
                start,
                // Data used to enable our session validator
                "0x00",
            ],
        });

    // Build the transactions data
    const txs = [
        enableTxForSelector(sendInteractionSelector),
        enableTxForSelector(sendInteractionsSelector),
    ];

    // Return a wallet encoded multicall
    return encodeWalletMulticall(
        txs.map((tx) => ({
            to: wallet,
            data: tx,
        }))
    );
}

/**
 * Get the calldata to disable a session
 */
export function getDisableSessionData({ wallet }: { wallet: Address }): Hex {
    const disableTxForSelector = (selector: Hex) =>
        encodeFunctionData({
            abi: [setExecutionAbi],
            functionName: "setExecution",
            args: [
                selector,
                zeroAddress,
                addresses.interactionDelegatorValidator,
                0,
                0,
                "0x00",
            ],
        });

    // Build the transactions data
    const txs = [
        disableTxForSelector(sendInteractionSelector),
        disableTxForSelector(sendInteractionsSelector),
    ];

    return encodeWalletMulticall(
        txs.map((tx) => ({
            to: wallet,
            data: tx,
        }))
    );
}
