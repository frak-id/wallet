import { addresses, kernelAddresses } from "@frak-labs/app-essentials";
import type { GeneratedRecoveryData } from "@frak-labs/wallet-shared";
import {
    type Address,
    encodeFunctionData,
    type Hex,
    toFunctionSelector,
    zeroAddress,
} from "viem";
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

/**
 * Disable recovery on-chain: re-run `setExecution` for the same selector with a
 * zero executor so `getCurrentRecoveryOption` reads back `null` and the burner
 * key can no longer add a passkey.
 */
export async function generateDisableRecoveryData(): Promise<{
    setupTxData: Hex;
}> {
    const addPasskeySelector = toFunctionSelector(doAddPassKeyFnAbi);

    const txData = encodeFunctionData({
        abi: [setExecutionAbi],
        functionName: "setExecution",
        args: [
            addPasskeySelector,
            zeroAddress,
            kernelAddresses.ecdsaValidator,
            0,
            0,
            zeroAddress,
        ],
    });
    return { setupTxData: txData };
}
