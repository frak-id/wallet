"use server";

import { kernelAddresses } from "@/context/common/blockchain/addresses";
import { getViemClientFromChainId } from "@/context/common/blockchain/provider";
import {
    addPassKeyFnAbi,
    ecdsaValidatorStorageAbi,
    getExecutionAbi,
} from "@/context/recover/utils/abi";
import type { CurrentRecovery } from "@/types/Recovery";
import { tryit } from "radash";
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
}: { wallet: Address; chainId: number }): Promise<CurrentRecovery | null> {
    // Get the viem client for the given chain
    const viemClient = getViemClientFromChainId({ chainId });

    // Get the recovery selector
    const addPasskeySelector = toFunctionSelector(addPassKeyFnAbi);

    // Query the kernel wallet to see the current recovery options
    const [, recoveryOption] = await tryit(() =>
        readContract(viemClient, {
            address: wallet,
            abi: [getExecutionAbi],
            functionName: "getExecution",
            args: [addPasskeySelector],
        })
    )();
    if (!recoveryOption) {
        return null;
    }

    // Ensure the recovery options matches
    if (
        !isAddressEqual(
            recoveryOption.executor,
            kernelAddresses.multiWebAuthnValidator
        )
    ) {
        return null;
    }
    if (
        !isAddressEqual(
            recoveryOption.validator,
            kernelAddresses.ecdsaValidator
        )
    ) {
        return null;
    }

    // Fetch the burner wallet associated with the recovery
    const burnerAddress = await readContract(viemClient, {
        address: kernelAddresses.ecdsaValidator,
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
