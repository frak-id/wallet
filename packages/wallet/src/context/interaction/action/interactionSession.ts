"use server";
import { currentViemClient } from "@/context/blockchain/provider";
import { setExecutionAbi } from "@/context/recover/utils/abi";
import type { InteractionSession } from "@/types/Session";
import {
    addresses,
    getExecutionAbi,
    sendInteractionSelector,
    sendInteractionsSelector,
} from "@frak-labs/app-essentials";
import { backendApi } from "@frak-labs/shared/context/server";
import { headers } from "next/headers";
import { tryit } from "radash";
import {
    type Address,
    type Hex,
    encodeFunctionData,
    isAddressEqual,
    zeroAddress,
} from "viem";
import { readContract } from "viem/actions";

/**
 * Get the full sessions
 */
export async function getFullSessionStatus() {
    const { data: session } = await backendApi.auth.wallet.session.get({
        headers: {
            cookie: headers().get("cookie") ?? undefined,
        },
    });
    if (!session) {
        return { session: null, interactionSession: null };
    }
    const interactionSession = await getSessionStatus({
        wallet: session.address,
    });
    return { session, interactionSession };
}

/**
 * Get the current session status
 * @param wallet
 */
export async function getSessionStatus({
    wallet,
}: { wallet: Address }): Promise<InteractionSession | null> {
    // Read all the prices from the blockchain
    const [, status] = await tryit(() =>
        readContract(currentViemClient, {
            address: wallet,
            abi: [getExecutionAbi],
            functionName: "getExecution",
            args: [sendInteractionSelector],
        })
    )();
    if (!status) {
        return null;
    }

    // If it's not on the latest executor or validator, return null
    if (
        !isAddressEqual(status.executor, addresses.interactionDelegatorAction)
    ) {
        return null;
    }
    if (
        !isAddressEqual(
            status.validator,
            addresses.interactionDelegatorValidator
        )
    ) {
        return null;
    }

    // Parse date
    const sessionStart = new Date(status.validAfter * 1000);
    const sessionEnd = new Date(status.validUntil * 1000);
    const now = new Date();

    // If session expired, return null
    if (sessionStart > now || now > sessionEnd) {
        return null;
    }

    // Return the session status
    return {
        sessionStart: sessionStart.getTime(),
        sessionEnd: sessionEnd.getTime(),
    };
}

/**
 * Get an interaction session enable data
 * @param sessionEnd
 */
export async function getSessionEnableData({
    sessionEnd,
}: { sessionEnd: Date }): Promise<Hex[]> {
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

    // Return the txs data
    return [
        enableTxForSelector(sendInteractionSelector),
        enableTxForSelector(sendInteractionsSelector),
    ];
}

/**
 * Get an interaction session enable data
 */
export async function getSessionDisableData(): Promise<Hex[]> {
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

    // Return the txs data
    return [
        disableTxForSelector(sendInteractionSelector),
        disableTxForSelector(sendInteractionsSelector),
    ];
}
