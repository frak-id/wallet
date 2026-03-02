import { type Address, concatHex, type Hex, keccak256, toHex } from "viem";
import type { AuthenticatedContext } from "../types/context";
import { shopInfo } from "./shop";

/**
 * Generate a setup code from domain, wallet address, and salt.
 */
export function generateSetupCode(
    domain: string,
    walletAddress: Address,
    salt: string
): Hex {
    return keccak256(concatHex([toHex(domain), walletAddress, toHex(salt)]));
}

/**
 * Generate a product setup code for a wallet address
 */
export async function getProductSetupCode(
    ctx: AuthenticatedContext,
    walletAddress: Address
) {
    const { normalizedDomain: domain } = await shopInfo(ctx);

    return generateSetupCode(
        domain,
        walletAddress,
        process.env.PRODUCT_SETUP_CODE_SALT ?? ""
    );
}
