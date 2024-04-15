"use server";

import { getViemClientFromChainId } from "@/context/common/blockchain/provider";
import {
    ecdsaValidatorStorageAbi,
    getExecutionAbi,
} from "@/context/recover/utils/abi";
import {
    kernelEcdsaValidator,
    recoveryAction,
} from "@/context/recover/utils/recover";
import type { CurrentRecovery } from "@/types/Recovery";
import {
    type Address,
    isAddressEqual,
    toFunctionSelector,
    zeroAddress,
} from "viem";
import { readContract } from "viem/actions";

/**
 * Get the current recovery options for the given wallet
 * @param wallet
 * @param chainId
 */
export async function getCurrentRecoveryOption({
    wallet,
    chainId,
}: { wallet: Address; chainId: number }): Promise<CurrentRecovery> {
    // Get the viem client for the given chain
    const viemClient = getViemClientFromChainId({ chainId });

    // Get the recovery selector
    const recoverySelector = toFunctionSelector(recoveryAction.executorFn);

    // Query the kernel wallet to see the current recovery options
    const recoveryOption = await readContract(viemClient, {
        address: wallet,
        abi: [getExecutionAbi],
        functionName: "getExecution",
        args: [recoverySelector],
    });

    // Ensure the recovery options matches
    if (!isAddressEqual(recoveryOption.executor, recoveryAction.address)) {
        return null;
    }
    if (!isAddressEqual(recoveryOption.validator, kernelEcdsaValidator)) {
        return null;
    }

    // Fetch the burner wallet associated with the recovery
    const burnerAddress = await readContract(viemClient, {
        address: kernelEcdsaValidator,
        abi: [ecdsaValidatorStorageAbi],
        functionName: "ecdsaValidatorStorage",
        args: [wallet],
    });
    if (isAddressEqual(burnerAddress, zeroAddress)) {
        return null;
    }

    return {
        executor: recoveryOption.executor,
        burnerAddress,
    };
}
