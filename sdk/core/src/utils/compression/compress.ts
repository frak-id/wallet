import { compressJson } from "@frak-labs/rpc";
import { base64urlEncode } from "./b64";

/**
 * Compress json data
 * @param data
 * @ignore
 */
export function compressJsonToB64(data: unknown): string {
    return base64urlEncode(compressJson(data));
}
