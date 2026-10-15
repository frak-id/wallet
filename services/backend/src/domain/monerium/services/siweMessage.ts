import { type Address, getAddress } from "viem";
import { createSiweMessage } from "viem/siwe";
import { generateSiweNonce } from "../../../utils/siwe";
import type { MoneriumConfig } from "../config";

const SIWE_STATEMENT = "Allow Frak Wallet to access my data on Monerium";
export const SIWE_VALIDITY_MS = 10 * 60_000;
const MONERIUM_SIWE_RESOURCE = "https://monerium.com/siwe";

/** Monerium requires an expiration time and the three resources, in this order. EIP-4361 wants the EIP-55 address. */
export function buildMoneriumSiweMessage(params: {
    address: Address;
    config: MoneriumConfig;
    now: Date;
    nonce?: string;
}): string {
    return createSiweMessage({
        domain: params.config.siweDomain,
        address: getAddress(params.address),
        statement: SIWE_STATEMENT,
        uri: params.config.redirectUri,
        version: "1",
        chainId: params.config.chainId,
        nonce: params.nonce ?? generateSiweNonce(),
        issuedAt: params.now,
        expirationTime: new Date(params.now.getTime() + SIWE_VALIDITY_MS),
        resources: [
            MONERIUM_SIWE_RESOURCE,
            "https://frak.id/privacy",
            "https://frak.id/terms",
        ],
    });
}
