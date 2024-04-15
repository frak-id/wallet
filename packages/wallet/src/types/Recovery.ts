import type {Address, Hex} from "viem";
import type {WebAuthNWallet} from "@/types/WebAuthN";

export type CurrentRecovery = {
    executor: Address;
    burnerAddress: Address;
};

export type GeneratedRecoveryData = {
    // The info about the initially deployed wallet
    wallet: WebAuthNWallet;
    // The info about the burner wallet used for recovery
    burner: {
        privateKey: Hex;
        address: Address;
    };
    // The tx to setup the recovery
    setupTxData: Hex;
};
