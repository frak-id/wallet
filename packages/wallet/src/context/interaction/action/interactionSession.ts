"use server";
import { currentViemClient } from "@/context/blockchain/provider";
import type { InteractionSession } from "@/types/Session";
import {
    addresses,
    getExecutionAbi,
    sendInteractionSelector,
} from "@frak-labs/app-essentials";
import { backendApi } from "@frak-labs/shared/context/server";
import { headers } from "next/headers";
import { tryit } from "radash";
import { type Address, isAddressEqual } from "viem";
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
