"use server";

import * as dns from "node:dns";
import { promisify } from "node:util";
import { getSafeSession } from "@/context/auth/actions/session";
import { flat } from "radash";
import { type Address, concatHex, keccak256, toHex } from "viem";

/**
 * Mint a new content for the given user
 * @param name
 * @param domain
 */
export async function mintMyContent({
    name,
    domain,
}: { name: string; domain: string }) {
    const session = await getSafeSession();
    const waitedTxtRecord = await getDnsTxtString({
        domain,
        wallet: session.wallet,
    });
    const error = `The DNS txt record is not set for the domain ${domain}`;

    // Ensure the DNS txt record is set
    try {
        const records = flat(await promisify(dns.resolveTxt)(domain));
        if (!records.includes(waitedTxtRecord)) {
            return {
                error,
            };
        }
    } catch {
        return {
            error,
        };
    }

    console.log(`Minting content ${name} for ${session.wallet}`);

    return { success: true };
}

/**
 * Get the DNS txt record waited for the given domain
 */
export async function getDnsTxtString({
    domain,
    wallet,
}: { domain: string; wallet?: Address }) {
    const safeWallet = wallet ?? (await getSafeSession()).wallet;
    const hash = keccak256(concatHex([toHex(domain), toHex(safeWallet)]));
    return `frak-business hash=${hash}`;
}
