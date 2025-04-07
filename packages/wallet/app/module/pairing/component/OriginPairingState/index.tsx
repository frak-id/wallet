import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { distantWebauthnSessionAtom } from "../../../common/atoms/session";
import { getOriginPairingClient } from "../../clients/store";
import type { BasePairingState } from "../../types";
import { StatusBoxModal, StatusBoxWalletEmbedded } from "../PairingStatusBox";

type OriginPairingStateType = "embedded" | "modal";

/**
 * Component displaying the live origin pairing state
 *  - Only visible if the session is a distant-webauthn one (if not we don't need to display anything)
 *
 * Visible on listener, embedded wallet, and wallet
 */
export function OriginPairingState({
    type = "embedded",
}: { type?: OriginPairingStateType }) {
    const session = useAtomValue(distantWebauthnSessionAtom);
    if (!session) return null;
    return <InnerOriginPairingState type={type} />;
}

/**
 * Inner component displaying the live origin pairing state
 *  -> Should be a smmall box with an indicator a right doti ndicator
 *  -> dot: red "idle", orange "connecting", green "paired"
 */
function InnerOriginPairingState({ type }: { type: OriginPairingStateType }) {
    const client = useMemo(() => getOriginPairingClient(), []);
    const state = useAtomValue(client.stateAtom);
    const { status, text } = getStatusDetails(state);
    const Component =
        type === "embedded" ? StatusBoxWalletEmbedded : StatusBoxModal;

    return <Component status={status} title={text} />;
}

function getStatusDetails(state: BasePairingState) {
    switch (state.status) {
        case "paired":
            return {
                status: "success",
                text: "Paired with your phone",
            } as const;
        case "idle":
            return {
                status: "waiting",
                text: "Phone not responding",
            } as const;
        case "connecting":
            return {
                status: "waiting",
                text: "Waiting phone signature",
            } as const;
    }
}
