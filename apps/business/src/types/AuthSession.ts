import type { Address, Hex } from "viem";

export type AuthSession = {
    wallet: Address;
    siwe: {
        message: string;
        signature: Hex;
    };
};

export type AuthSessionClient = {
    wallet: Address;
};
