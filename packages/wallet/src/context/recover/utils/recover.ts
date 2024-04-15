import type { Address } from "viem";

/**
 * The recovery action details
 */
export const recoveryAction = {
    address: "0x2f65dB8039fe5CAEE0a8680D2879deB800F31Ae1",
    executorFn: "function doRecovery(address _validator, bytes calldata _data)",
} as const;

/**
 * Address of the ecdsa validator
 */
export const kernelEcdsaValidator: Address =
    "0xd9AB5096a832b9ce79914329DAEE236f8Eea0390";
