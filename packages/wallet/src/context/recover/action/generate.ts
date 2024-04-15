"use server";

import { setExecutionAbi } from "@/context/recover/utils/abi";
import {
    kernelEcdsaValidator,
    recoveryAction,
} from "@/context/recover/utils/recover";
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
    const recoverySelector = toFunctionSelector(recoveryAction.executorFn);

    // Generate the setup tx data
    const txData = encodeFunctionData({
        abi: [setExecutionAbi],
        functionName: "setExecution",
        args: [
            // Do recovery method
            recoverySelector,
            // And do recovery contract
            recoveryAction.address,
            // The address of the ecdsa validator
            kernelEcdsaValidator,
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
