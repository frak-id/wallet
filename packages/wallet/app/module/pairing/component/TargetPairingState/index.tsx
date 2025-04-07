import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { webauthnSessionAtom } from "../../../common/atoms/session";
import { getTargetPairingClient } from "../../clients/store";
import type { TargetPairingClient } from "../../clients/target";
import { useSignSignatureRequest } from "../../hook/useSignSignatureRequest";
import type {
    BasePairingState,
    TargetPairingPendingSignature,
} from "../../types";
import { StatusBoxWallet } from "../PairingStatusBox";

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
    const { status, text } = getStatusDetails(state);

    return (
        <StatusBoxWallet status={status} title={text}>
            {Array.from(state.pendingSignatures.values()).map((request) => (
                <SignatureRequestWidget
                    key={request.id}
                    request={request}
                    client={client}
                />
            ))}
        </StatusBoxWallet>
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

function getStatusDetails(state: BasePairingState) {
    const { t } = useTranslation();

    switch (state.status) {
        case "paired":
            return {
                status: "success",
                text: t("wallet.pairing.target.state.paired"),
            } as const;
        case "idle":
            return {
                status: "waiting",
                text: t("wallet.pairing.target.state.idle"),
            } as const;
        case "connecting":
            return {
                status: "loading",
                text: t("wallet.pairing.target.state.connecting"),
            } as const;
    }
}
