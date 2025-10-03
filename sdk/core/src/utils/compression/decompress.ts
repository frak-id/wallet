import { decompressJson } from "@frak-labs/rpc";
import { base64urlDecode } from "./b64";

/**
 * Decompress json data
 * @param data
 * @ignore
 */
export function decompressJsonFromB64<T>(data: string): T | null {
    return decompressJson(base64urlDecode(data));
}
