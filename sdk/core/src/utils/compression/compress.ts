import { jsonEncode } from "@frak-labs/frame-connector";
import { base64urlEncode } from "./b64";

/**
 * Compress json data
 * @param data
 * @ignore
 */
export function compressJsonToB64(data: unknown): string {
    return base64urlEncode(jsonEncode(data));
}
