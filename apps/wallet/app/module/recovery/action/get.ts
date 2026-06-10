import {
    addresses,
    getExecutionAbi,
    kernelAddresses,
    multiWebAuthNValidatorV2Abi,
} from "@frak-labs/app-essentials";
import type { CurrentRecovery } from "@frak-labs/wallet-shared";
import { currentViemClient } from "@frak-labs/wallet-shared";
import { tryit } from "radash";
import {
    type Address,
    type Hex,
    hexToBigInt,
    isAddressEqual,
    keccak256,
    toFunctionSelector,
    toHex,
    zeroAddress,
} from "viem";
import { readContract } from "viem/actions";
import {
    doAddPassKeyFnAbi,
    ecdsaValidatorStorageAbi,
} from "@/module/recovery/utils/abi";

/**
 * Get the current recovery options for the given wallet
 * @param wallet
 * @param chainId
 */
export async function getCurrentRecoveryOption({
    wallet,
}: {
    wallet: Address;
}): Promise<CurrentRecovery | null> {
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
        validAfter: recoveryOption.validAfter,
        validUntil: recoveryOption.validUntil,
    };
}

/**
 * Whether `passkey` is already registered on `wallet` in the on-chain WebAuthn
 * validator. Lets recovery retries resume from chain state instead of local
 * progress flags (the validator stores `keccak256(authenticatorId)` as key).
 */
export async function isPasskeyRegisteredOnWallet({
    wallet,
    passkey,
}: {
    wallet: Address;
    passkey: { authenticatorId: string; publicKey: { x: Hex; y: Hex } };
}): Promise<boolean> {
    const [, pubKey] = await readContract(currentViemClient, {
        address: addresses.webAuthNValidator,
        abi: multiWebAuthNValidatorV2Abi,
        functionName: "getPasskey",
        args: [wallet, keccak256(toHex(passkey.authenticatorId))],
    });
    return (
        pubKey.x === hexToBigInt(passkey.publicKey.x) &&
        pubKey.y === hexToBigInt(passkey.publicKey.y)
    );
}
