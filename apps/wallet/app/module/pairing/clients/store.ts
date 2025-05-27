import { OriginPairingClient } from "./origin";
import { TargetPairingClient } from "./target";

let cachedOriginPairingClient: OriginPairingClient | null = null;
export function getOriginPairingClient(): OriginPairingClient {
    if (!cachedOriginPairingClient) {
        cachedOriginPairingClient = new OriginPairingClient();
    }
    return cachedOriginPairingClient;
}

let cachedTargetPairingClient: TargetPairingClient | null = null;
export function getTargetPairingClient(): TargetPairingClient {
    if (!cachedTargetPairingClient) {
        cachedTargetPairingClient = new TargetPairingClient();
    }
    return cachedTargetPairingClient;
}
