import { useAtomValue } from "jotai";
import { useEffect } from "react";
import {
    distantWebauthnSessionAtom,
    webauthnSessionAtom,
} from "@/common/atoms/session";
import {
    getOriginPairingClient,
    getTargetPairingClient,
} from "../clients/store";

/**
 * Craft some persistent pairing client (auto reconnects etc)
 */
export function usePersistentPairingClient() {
    const webauthnSession = useAtomValue(webauthnSessionAtom);
    const distantWebauthnSession = useAtomValue(distantWebauthnSessionAtom);

    useEffect(() => {
        // If we got a webauthn session, create a target client and directly trigger a reconnection
        if (webauthnSession?.address) {
            getTargetPairingClient().reconnect();
            return;
        }

        // If we got a distant webauthn session, create an origin client and directly trigger a reconnection
        if (distantWebauthnSession?.address) {
            getOriginPairingClient().reconnect();
            return;
        }
    }, [distantWebauthnSession?.address, webauthnSession?.address]);
}
