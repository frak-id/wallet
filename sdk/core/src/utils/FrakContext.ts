import { type Address, bytesToHex, hexToBytes, isAddress } from "viem";
import type { FrakContext, FrakContextV2 } from "../types";
import { base64urlDecode, base64urlEncode } from "./compression/b64";
import { compressJsonToB64 } from "./compression/compress";
import { decompressJsonFromB64 } from "./compression/decompress";

const contextKey = "fCtx";

type FrakContextInput = {
    r?: Address;
    v?: 2;
    c?: string;
    m?: string;
    t?: number;
};

function isV2Input(context: FrakContextInput): boolean {
    return context.v === 2 && !!context.c && !!context.m && !!context.t;
}

function compress(context?: FrakContextInput): string | undefined {
    if (!context) return;
    try {
        if (isV2Input(context)) {
            return compressJsonToB64({
                v: 2,
                c: context.c,
                m: context.m,
                t: context.t,
            });
        }

        // V1 legacy: compress wallet address as raw bytes
        if (!context.r) return;
        const bytes = hexToBytes(context.r);
        return base64urlEncode(bytes);
    } catch (e) {
        console.error("Error compressing Frak context", { e, context });
    }
    return undefined;
}

function decompress(context?: string): FrakContext | undefined {
    if (!context || context.length === 0) return;
    try {
        // Try V2 JSON first — V2 payloads are longer than V1's 20-byte address
        const json = decompressJsonFromB64<FrakContextV2>(context);
        if (json && typeof json === "object" && json.v === 2) {
            if (json.c && json.m && json.t) {
                return { v: 2, c: json.c, m: json.m, t: json.t };
            }
            return undefined;
        }

        // Fall back to V1: raw 20-byte address
        const bytes = base64urlDecode(context);
        const hex = bytesToHex(bytes, { size: 20 }) as Address;
        if (isAddress(hex)) {
            return { r: hex };
        }
    } catch (e) {
        console.error("Error decompressing Frak context", { e, context });
    }
    return undefined;
}

function parse({ url }: { url: string }) {
    if (!url) return null;

    const urlObj = new URL(url);
    const frakContext = urlObj.searchParams.get(contextKey);
    if (!frakContext) return null;

    return decompress(frakContext);
}

function update({ url, context }: { url?: string; context: FrakContextInput }) {
    if (!url) return null;

    const compressedContext = compress(context);
    if (!compressedContext) return null;

    const urlObj = new URL(url);
    urlObj.searchParams.set(contextKey, compressedContext);
    return urlObj.toString();
}

function remove(url: string) {
    const urlObj = new URL(url);
    urlObj.searchParams.delete(contextKey);
    return urlObj.toString();
}

function replaceUrl({
    url: baseUrl,
    context,
}: {
    url?: string;
    context: FrakContextInput | null;
}) {
    if (!window.location?.href || typeof window === "undefined") {
        console.error("No window found, can't update context");
        return;
    }

    const url = baseUrl ?? window.location.href;

    let newUrl: string | null;
    if (context !== null) {
        newUrl = update({ url, context });
    } else {
        newUrl = remove(url);
    }

    if (!newUrl) return;

    window.history.replaceState(null, "", newUrl.toString());
}

export const FrakContextManager = {
    compress,
    decompress,
    parse,
    update,
    remove,
    replaceUrl,
};
