import { webauthnSessionAtom } from "@/module/common/atoms/session";
import { getTargetPairingClient } from "@/module/pairing/clients/store";
import { StatusBoxWallet } from "@/module/pairing/component/PairingStatusBox";
import { SignatureRequestList } from "@/module/pairing/component/SignatureRequest";
import type { BasePairingState } from "@/module/pairing/types";
import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

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
            <SignatureRequestList
                requests={Array.from(state.pendingSignatures.values())}
                client={client}
            />
        </StatusBoxWallet>
    );
}

function getStatusDetails(state: BasePairingState): {
    status: "success" | "waiting" | "loading" | "error";
    text: string;
} {
    const { t } = useTranslation();

    switch (state.status) {
        case "paired":
            return {
                status: "success",
                text: t("wallet.pairing.target.state.paired"),
            };
        case "idle":
            return {
                status: "waiting",
                text: t("wallet.pairing.target.state.idle"),
            };
        case "connecting":
            return {
                status: "loading",
                text: t("wallet.pairing.target.state.connecting"),
            };
        case "retry-error":
            return {
                status: "error",
                text: t("wallet.pairing.target.state.retryError"),
            };
        default: {
            const exhaustiveCheck: never = state.status;
            throw new Error(`Unhandled status: ${exhaustiveCheck}`);
        }
    }
}
