import type { Address, Hex } from "viem";
import type { SiweMessage } from "viem/siwe";

export type AuthSession = {
    wallet: Address;
    siwe: {
        message: SiweMessage;
        signature: Hex;
    };
};

export type AuthSessionClient = {
    wallet: Address;
};
