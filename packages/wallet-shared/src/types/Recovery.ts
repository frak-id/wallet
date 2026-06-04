import type { Address, Hex } from "viem";

export type CurrentRecovery = {
    executor: Address;
    guardianAddress: Address;
    /** Recovery becomes executable after this unix timestamp (seconds). */
    validAfter: number;
    /** Recovery stops working after this unix timestamp (seconds); 0 = never. */
    validUntil: number;
};

export type GeneratedRecoveryData = {
    // Guardian address
    guardianAddress: Address;
    // The tx to setup the recovery
    setupTxData: Hex;
};
