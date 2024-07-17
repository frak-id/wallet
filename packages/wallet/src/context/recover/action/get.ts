"use server";

import { kernelAddresses } from "@/context/blockchain/addresses";
import {
    type AvailableChainIds,
    availableChains,
    getViemClientFromChainId,
} from "@/context/blockchain/provider";
import {
    doAddPassKeyFnAbi,
    ecdsaValidatorStorageAbi,
    getExecutionAbi,
} from "@/context/recover/utils/abi";
import type { CurrentRecovery } from "@/types/Recovery";
import { multiWebAuthNValidatorV2Abi } from "@frak-labs/shared/context/blockchain/abis/kernel-v2-abis";
import { map, tryit } from "radash";
import {
    type Address,
    isAddressEqual,
    keccak256,
    toFunctionSelector,
    toHex,
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
    const addPasskeySelector = toFunctionSelector(doAddPassKeyFnAbi);

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
            kernelAddresses.multiWebAuthnRecovery
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
    const guardianAddress = await readContract(viemClient, {
        address: kernelAddresses.ecdsaValidator,
        abi: [ecdsaValidatorStorageAbi],
        functionName: "ecdsaValidatorStorage",
        args: [wallet],
    });
    if (isAddressEqual(guardianAddress, zeroAddress)) {
        return null;
    }

    return {
        executor: recoveryOption.executor,
        guardianAddress,
    };
}

/**
 * Get all the chains available chains for recovery for the given wallet
 * @param wallet
 * @param expectedGuardian
 * @param newAuthenticatorId
 */
export async function getChainsAvailableForRecovery({
    wallet,
    expectedGuardian,
    newAuthenticatorId,
}: {
    wallet: Address;
    expectedGuardian: Address;
    newAuthenticatorId: string;
}): Promise<
    {
        chainId: AvailableChainIds;
        available: boolean;
        alreadyRecovered?: boolean;
    }[]
> {
    const chainsId = availableChains.map((c) => c.id) as AvailableChainIds[];
    return await map(chainsId, async (chainId) => {
        // Get the recovery option for the wallet
        const currentRecovery = await getCurrentRecoveryOption({
            wallet,
            chainId,
        });
        if (!currentRecovery) {
            return { chainId, available: false };
        }
        // If the address doesn't match, tell the user that the guardian is not the same
        if (
            !isAddressEqual(currentRecovery.guardianAddress, expectedGuardian)
        ) {
            return { chainId, available: false };
        }
        const viemClient = getViemClientFromChainId({ chainId });
        const [, potentiallyExistingPasskey] = await tryit(() =>
            readContract(viemClient, {
                address: kernelAddresses.multiWebAuthnValidator,
                abi: multiWebAuthNValidatorV2Abi,
                functionName: "getPasskey",
                args: [wallet, keccak256(toHex(newAuthenticatorId))],
            })
        )();
        // Check if the wallet already have this authenticator id enabled
        return {
            chainId,
            available: true,
            alreadyRecovered:
                potentiallyExistingPasskey &&
                potentiallyExistingPasskey[1].x !== 0n,
        };
    });
}
