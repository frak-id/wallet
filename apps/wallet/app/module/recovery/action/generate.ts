import {
    addresses,
    isRunningInProd,
    kernelAddresses,
} from "@frak-labs/app-essentials";
import type { GeneratedRecoveryData } from "@frak-labs/wallet-shared";
import { doAddPassKeyFnAbi, setExecutionAbi } from "@frak-labs/wallet-shared";
import { type Address, encodeFunctionData, toFunctionSelector } from "viem";

/**
 * Generate the recovery data
 */
export async function generateRecoveryData({
    guardianAddress,
}: {
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
            addresses.webAuthNRecoveryAction,
            // The address of the ecdsa validator
            kernelAddresses.ecdsaValidator,
            // Valid until timestamps, in seconds
            0,
            // Valid after timestamp, in seconds
            validAfter,
            // Data used to confirm the ecdsa validator
            guardianAddress,
        ],
    });
    // Return all the stuff wanted
    return {
        guardianAddress,
        setupTxData: txData,
    };
}
