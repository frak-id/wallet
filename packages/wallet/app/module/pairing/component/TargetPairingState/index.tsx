import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { webauthnSessionAtom } from "../../../common/atoms/session";
import { getTargetPairingClient } from "../../clients/store";
import type { TargetPairingClient } from "../../clients/target";
import { useSignSignatureRequest } from "../../hook/useSignSignatureRequest";
import type { TargetPairingPendingSignature } from "../../types";

/**
 * Component displaying the live target pairing state
 *  - Only visible if the session is a webauthn one (if not we don't need to display anything)
 *
 * todo: should take a large portion of the screen once a signature is requested
 * todo: only displayed on the wallet
 */
export function TargetPairingState() {
    const session = useAtomValue(webauthnSessionAtom);

    if (!session) return null;
    return <InnerTargetPairingState />;
}

/**
 * Inner component displaying the live origin pairing state
 *  -> Should be a small box with an indicator a right doti ndicator
 *  -> dot: red "idle", orange "connecting", green "paired"
 */
function InnerTargetPairingState() {
    const client = useMemo(() => getTargetPairingClient(), []);
    const state = useAtomValue(client.stateAtom);

    return (
        <div>
            <h2>Pairing</h2>
            <p>Current: {state.status}</p>
            <p>Partner: {state.partnerDevice}</p>
            <p>Pending signatures: {state.pendingSignatures.size}</p>
            <br />
            {Array.from(state.pendingSignatures.values()).map((request) => (
                <SignatureRequestWidget
                    key={request.id}
                    request={request}
                    client={client}
                />
            ))}
        </div>
    );
}

function SignatureRequestWidget({
    request,
    client,
}: { request: TargetPairingPendingSignature; client: TargetPairingClient }) {
    const { mutate: signRequest, status } = useSignSignatureRequest({ client });

    return (
        <div>
            <p>Signature request</p>
            <p>From: {request.from}</p>
            <button onClick={() => signRequest(request)} type="button">
                Sign
            </button>
            <p>Signing state: {status}</p>
        </div>
    );
}
