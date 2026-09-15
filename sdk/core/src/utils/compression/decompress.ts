import { jsonDecode } from "@frak-labs/frame-connector";
import { base64urlDecode } from "./b64";

/**
 * Decompress json data
 * @ignore
 */
export function decompressJsonFromB64<T>(data: string): T | null {
    return jsonDecode<T>(base64urlDecode(data));
}
