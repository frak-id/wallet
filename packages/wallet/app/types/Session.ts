import type { WebAuthNWallet } from "@/types/WebAuthN";
import type { Address, Hex } from "viem";

export type Session = {
    token: string;
} & (WebAuthNWallet | PrivyWallet);

export type PrivyWallet = {
    address: Address;
    publicKey: Hex;
    authenticatorId: `privy-${string}`;
    transports: undefined;
};

export type InteractionSession = {
    sessionStart: number;
    sessionEnd: number;
};

export type SdkSession = {
    token: string;
    expires: number;
};
