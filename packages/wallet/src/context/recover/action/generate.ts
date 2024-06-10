"use server";

import { kernelAddresses } from "@/context/blockchain/addresses";
import { isRunningInProd } from "@/context/common/env";
import {
    doAddPassKeyFnAbi,
    setExecutionAbi,
} from "@/context/recover/utils/abi";
import type { GeneratedRecoveryData } from "@/types/Recovery";
import type { WebAuthNWallet } from "@/types/WebAuthN";
import { type Address, encodeFunctionData, toFunctionSelector } from "viem";

/**
 * Generate the recovery data
 * TODO: Is wallet rly needed? Should we perform check beforehand?
 */
export async function generateRecoveryData({
    guardianAddress,
}: {
    wallet: WebAuthNWallet;
    guardianAddress: Address;
}): Promise<GeneratedRecoveryData> {
    // Get the recovery selector
    const addPasskeySelector = toFunctionSelector(doAddPassKeyFnAbi);

    // Crafter the valid after timestamp (one week from now)
    const validAfter = isRunningInProd
        ? Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7
        : Math.floor(Date.now() / 1000);

    // Generate the setup tx data
    const txData = encodeFunctionData({
        abi: [setExecutionAbi],
        functionName: "setExecution",
        args: [
            // The passkey addition method
            addPasskeySelector,
            // The webauthn recovery address
            kernelAddresses.multiWebAuthnRecovery,
            // The address of the ecdsa validator
            kernelAddresses.ecdsaValidator,
            // Valid until timestamps, in seconds
            0,
            // Valid after timestamp, in seconds
            validAfter,
            // Data used to validate the ecdsa validator
            guardianAddress,
        ],
    });
    // Return all the stuff wanted
    return {
        guardianAddress,
        setupTxData: txData,
    };
}
