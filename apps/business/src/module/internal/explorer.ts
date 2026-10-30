import { viemClient } from "@/config/blockchain";

const baseUrl = viemClient.chain?.blockExplorers?.default.url;

/** `null` on a chain without a known explorer. */
export function explorerUrl(kind: "address" | "tx", value: string) {
    return baseUrl ? `${baseUrl}/${kind}/${value}` : null;
}
