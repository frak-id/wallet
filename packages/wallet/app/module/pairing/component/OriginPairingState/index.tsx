import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { distantWebauthnSessionAtom } from "../../../common/atoms/session";
import { getOriginPairingClient } from "../../clients/store";

/**
 * Component displaying the live origin pairing state
 *  - Only visible if the session is a distant-webauthn one (if not we don't need to display anything)
 *
 * Visible on listener, embedded wallet, and wallet
 */
export function OriginPairingState() {
    const session = useAtomValue(distantWebauthnSessionAtom);

    if (!session) return null;
    return <InnerOriginPairingState />;
}

/**
 * Inner component displaying the live origin pairing state
 *  -> Should be a smmall box with an indicator a right doti ndicator
 *  -> dot: red "idle", orange "connecting", green "paired"
 */
function InnerOriginPairingState() {
    const client = useMemo(() => getOriginPairingClient(), []);
    const state = useAtomValue(client.stateAtom);

    return (
        <div>
            <p>Current: {state.status}</p>
            <p>Partner: {state.partnerDevice}</p>
        </div>
    );
}
