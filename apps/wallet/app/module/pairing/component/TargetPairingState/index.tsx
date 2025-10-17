import { getTargetPairingClient } from "@frak-labs/wallet-shared/pairing/clients/store";
import type { TargetPairingState as TargetPairingStateType } from "@frak-labs/wallet-shared/pairing/types";
import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { webauthnSessionAtom } from "@/module/common/atoms/session";
import { StatusBoxWallet } from "@/module/pairing/component/PairingStatusBox";
import { SignatureRequestList } from "@/module/pairing/component/SignatureRequest";

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
    const { status, text } = getStatusDetails(state) ?? {};

    // Don't display anything if the state is idle
    if (state.status === "idle" || !status || !text) return null;

    return (
        <StatusBoxWallet status={status} title={text}>
            <SignatureRequestList
                requests={Array.from(state.pendingSignatures.values())}
                client={client}
            />
        </StatusBoxWallet>
    );
}

function getStatusDetails(state: TargetPairingStateType): {
    status: "success" | "waiting" | "loading" | "error";
    text: string;
} | null {
    const { t } = useTranslation();

    if (state.status === "idle") {
        return null;
    }

    switch (state.status) {
        case "paired":
            return {
                status: "success",
                text: t("wallet.pairing.target.state.paired"),
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
