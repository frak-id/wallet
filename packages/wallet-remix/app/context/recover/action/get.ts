"use server";

import { currentViemClient } from "@/context/blockchain/provider";
import {
    doAddPassKeyFnAbi,
    ecdsaValidatorStorageAbi,
} from "@/context/recover/utils/abi";
import type { CurrentRecovery } from "@/types/Recovery";
import { kernelAddresses } from "@frak-labs/app-essentials";
import {
    addresses,
    getExecutionAbi,
    multiWebAuthNValidatorV2Abi,
} from "@frak-labs/app-essentials";
import { tryit } from "radash";
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
}: { wallet: Address }): Promise<CurrentRecovery | null> {
    // Get the recovery selector
    const addPasskeySelector = toFunctionSelector(doAddPassKeyFnAbi);

    // Query the kernel wallet to see the current recovery options
    const [, recoveryOption] = await tryit(() =>
        readContract(currentViemClient, {
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
            addresses.webAuthNRecoveryAction
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
    const guardianAddress = await readContract(currentViemClient, {
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
export async function getRecoveryAvailability({
    wallet,
    expectedGuardian,
    newAuthenticatorId,
}: {
    wallet: Address;
    expectedGuardian: Address;
    newAuthenticatorId: string;
}): Promise<{
    available: boolean;
    alreadyRecovered?: boolean;
}> {
    // Get the recovery option for the wallet
    const currentRecovery = await getCurrentRecoveryOption({
        wallet,
    });
    if (!currentRecovery) {
        return { available: false };
    }
    // If the address doesn't match, tell the user that the guardian is not the same
    if (!isAddressEqual(currentRecovery.guardianAddress, expectedGuardian)) {
        return { available: false };
    }
    const [, potentiallyExistingPasskey] = await tryit(() =>
        readContract(currentViemClient, {
            address: addresses.webAuthNValidator,
            abi: multiWebAuthNValidatorV2Abi,
            functionName: "getPasskey",
            args: [wallet, keccak256(toHex(newAuthenticatorId))],
        })
    )();
    // Check if the wallet already have this authenticator id enabled
    return {
        available: true,
        alreadyRecovered:
            potentiallyExistingPasskey &&
            potentiallyExistingPasskey[1].x !== 0n,
    };
}
