import type { Address, Hex } from "viem";
import type { WebAuthNWallet } from "./WebAuthN";

export type CurrentRecovery = {
    executor: Address;
    guardianAddress: Address;
};

export type GeneratedRecoveryData = {
    // Guardian address
    guardianAddress: Address;
    // The tx to setup the recovery
    setupTxData: Hex;
};

export type RecoveryFileContent = {
    // The wallet data
    initialWallet: WebAuthNWallet;
    // The guardian address
    guardianAddress: Address;
    // The encrypted guardian private key
    guardianPrivateKeyEncrypted: string;
};
