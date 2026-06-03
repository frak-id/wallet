import { addresses, kernelAddresses } from "@frak-labs/app-essentials";
import type { GeneratedRecoveryData } from "@frak-labs/wallet-shared";
import { type Address, encodeFunctionData, toFunctionSelector } from "viem";
import {
    doAddPassKeyFnAbi,
    setExecutionAbi,
} from "@/module/recovery/utils/abi";

/**
 * Generate the recovery data
 */
export async function generateRecoveryData({
    guardianAddress,
    validAfter,
    validUntil,
}: {
    guardianAddress: Address;
    validAfter: number;
    validUntil: number;
}): Promise<GeneratedRecoveryData> {
    const addPasskeySelector = toFunctionSelector(doAddPassKeyFnAbi);

    // setExecution args are (selector, executor, validator, validUntil, validAfter, enableData)
    const txData = encodeFunctionData({
        abi: [setExecutionAbi],
        functionName: "setExecution",
        args: [
            addPasskeySelector,
            addresses.webAuthNRecoveryAction,
            kernelAddresses.ecdsaValidator,
            validUntil,
            validAfter,
            guardianAddress,
        ],
    });
    return {
        guardianAddress,
        setupTxData: txData,
    };
}
