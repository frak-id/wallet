"use server";

import * as dns from "node:dns";
import { promisify } from "node:util";
import { flat } from "radash";
import { concatHex, keccak256, toHex } from "viem";

/**
 * Get the DNS txt record waited for the given domain
 */
export async function getDnsTxtString({
    name,
    domain,
}: { name: string; domain: string }) {
    const hash = keccak256(concatHex([toHex(domain), toHex(name)]));
    return `frak-business; hash=${hash}`;
}

/**
 * Check if the DNS txt record is set for the given domain
 * @param name
 * @param domain
 */
export async function isDnsTxtRecordSet({
    name,
    domain,
}: { name: string; domain: string }) {
    if (process.env.STAGE !== "prod") return true;

    const waitedTxtRecord = await getDnsTxtString({ name, domain });
    try {
        const records = flat(await promisify(dns.resolveTxt)(domain));
        return records.includes(waitedTxtRecord);
    } catch {
        return false;
    }
}
