import { distantWebauthnSessionAtom } from "@/module/common/atoms/session";
import { getOriginPairingClient } from "@/module/pairing/clients/store";
import {
    StatusBoxModal,
    StatusBoxWalletEmbedded,
} from "@/module/pairing/component/PairingStatusBox";
import type { OriginPairingState as OriginPairingStateType } from "@/module/pairing/types";
import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

type OriginPairingStateProps = {
    type?: "embedded" | "modal";
};

/**
 * Component displaying the live origin pairing state
 *  - Only visible if the session is a distant-webauthn one (if not we don't need to display anything)
 *
 * Visible on listener, embedded wallet, and wallet
 */
export function OriginPairingState({
    type = "embedded",
}: OriginPairingStateProps) {
    const session = useAtomValue(distantWebauthnSessionAtom);
    if (!session) return null;
    return <InnerOriginPairingState type={type} />;
}

/**
 * Inner component displaying the live origin pairing state
 *  -> Should be a smmall box with an indicator a right doti ndicator
 *  -> dot: red "idle", orange "connecting", green "paired"
 */
function InnerOriginPairingState({ type }: OriginPairingStateProps) {
    const client = useMemo(() => getOriginPairingClient(), []);
    const state = useAtomValue(client.stateAtom);
    const { status, text } = getStatusDetails(state);
    const Component =
        type === "embedded" ? StatusBoxWalletEmbedded : StatusBoxModal;

    return <Component status={status} title={text} />;
}

function getStatusDetails(state: OriginPairingStateType): {
    status: "success" | "waiting" | "loading" | "error";
    text: string;
} {
    const { t } = useTranslation();

    // If there are pending signatures, we display the signature request state
    if (state.signatureRequests.size > 0) {
        switch (state.status) {
            case "paired":
                return {
                    status: "loading",
                    text: t("wallet.pairing.origin.state.requests.paired"),
                };
            case "connecting":
                return {
                    status: "waiting",
                    text: t("wallet.pairing.origin.state.requests.connecting"),
                };
        }
    }

    switch (state.status) {
        case "paired":
            return {
                status: "success",
                text: t("wallet.pairing.origin.state.paired"),
            };
        case "idle":
            return {
                status: "waiting",
                text: t("wallet.pairing.origin.state.idle"),
            };
        case "connecting":
            return {
                status: "waiting",
                text: t("wallet.pairing.origin.state.connecting"),
            };
        case "retry-error":
            return {
                status: "error",
                text: t("wallet.pairing.origin.state.retryError"),
            };
        default: {
            const exhaustiveCheck: never = state.status;
            throw new Error(`Unhandled status: ${exhaustiveCheck}`);
        }
    }
}
