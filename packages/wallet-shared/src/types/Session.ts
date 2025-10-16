import type {
    P256PubKey,
    WebAuthNWallet,
} from "@frak-labs/wallet-shared/types/WebAuthN";
import type { Address, Hex } from "viem";

export type Session = {
    token: string;
} & (WebAuthNWallet | EcdsaWallet | DistantWebAuthnWallet);

export type EcdsaWallet = {
    type: "ecdsa";
    address: Address;
    publicKey: Hex;
    authenticatorId: `ecdsa-${string}`;
    transports: undefined;
};
export type DistantWebAuthnWallet = {
    type: "distant-webauthn";
    address: Address;
    publicKey: P256PubKey;
    authenticatorId: string;
    pairingId: string;
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
