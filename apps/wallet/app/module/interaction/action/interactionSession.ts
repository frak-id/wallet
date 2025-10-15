import {
    addresses,
    getExecutionAbi,
    sendInteractionSelector,
} from "@frak-labs/app-essentials";
import { tryit } from "radash";
import { type Address, isAddressEqual } from "viem";
import { readContract } from "viem/actions";
import { currentViemClient } from "@/module/blockchain/provider";
import type { InteractionSession } from "@/types/Session";

/**
 * Get the current session status
 * @param wallet
 */
export async function getSessionStatus({
    wallet,
}: {
    wallet: Address;
}): Promise<InteractionSession | null> {
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
