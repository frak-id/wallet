"use server";

import { kernelAddresses } from "@/context/common/blockchain/addresses";
import { addPassKeyFnAbi, setExecutionAbi } from "@/context/recover/utils/abi";
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
    const addPasskeySelector = toFunctionSelector(addPassKeyFnAbi);

    // Generate the setup tx data
    const txData = encodeFunctionData({
        abi: [setExecutionAbi],
        functionName: "setExecution",
        args: [
            // The passkey addition method
            addPasskeySelector,
            // The webauthn validator address
            kernelAddresses.multiWebAuthnValidator,
            // The address of the ecdsa validator
            kernelAddresses.ecdsaValidator,
            // Valid until / valid after timestamps, keep that as 0
            0,
            0,
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
