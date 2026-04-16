import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { cx } from "class-variance-authority";
import { Cuer } from "cuer";
import { useEffect, useMemo, useRef, useState } from "react";
import { create, useStore } from "zustand";
import { trackAuthInitiated } from "../../../common/analytics";
import { CodeInput } from "../../../common/component/CodeInput";
import type { OnPairingSuccessCallback } from "../../clients/origin";
import { getOriginPairingClient } from "../../clients/store";
import type { OriginIdentityNode, OriginPairingState } from "../../types";
import { PairingStatus } from "../PairingStatus";
import styles from "./index.module.css";

const useShowBrighterQRCodeStore = create<{
    show: boolean;
    setShow: (show: boolean) => void;
}>()((set) => ({
    show: false,
    setShow: (show) => set({ show }),
}));

/**
 * Launch a pairing session
 * @returns A QR code to scan to pair with the wallet
 */
export function LaunchPairing({
    onSuccess,
    originNode,
}: {
    onSuccess?: OnPairingSuccessCallback;
    originNode?: OriginIdentityNode;
}) {
    const showBrighterQRCode = useShowBrighterQRCodeStore(
        (state) => state.show
    );
    const setShowBrighterQRCode = useShowBrighterQRCodeStore(
        (state) => state.setShow
    );
    const [showFullScreen, setShowFullScreen] = useState(showBrighterQRCode);
    const [isExiting, setIsExiting] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const client = getOriginPairingClient();

    // Get the current state of the client
    const clientState = useStore(client.store);

    // Sync showFullScreen with store state
    useEffect(() => {
        if (showBrighterQRCode) {
            setShowFullScreen(true);
            setIsExiting(false);
        } else if (showFullScreen) {
            setIsExiting(true);
            timeoutRef.current = setTimeout(() => {
                setShowFullScreen(false);
                setIsExiting(false);
            }, 400); // match animation duration
        }
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [showBrighterQRCode, showFullScreen]);

    // Reset fullScreenAtom on unmount
    useEffect(() => {
        return () => setShowBrighterQRCode(false);
    }, [setShowBrighterQRCode]);

    useEffect(() => {
        client.initiatePairing({ onSuccess, originNode });
        trackAuthInitiated("pairing");
    }, [client, onSuccess]);

    const pairingContent = useMemo(
        () => <PairingContent clientState={clientState} />,
        [clientState]
    );

    return (
        <>
            {showFullScreen && (
                <div
                    className={
                        isExiting
                            ? cx(
                                  styles.launchPairing__brighterQRCode,
                                  styles.fadeOut
                              )
                            : styles.launchPairing__brighterQRCode
                    }
                >
                    {pairingContent}
                </div>
            )}
            {pairingContent}
        </>
    );
}

function PairingContent({ clientState }: { clientState: OriginPairingState }) {
    const pairingInfo = clientState.pairing;
    const showBrighterQRCode = useShowBrighterQRCodeStore(
        (state) => state.show
    );
    const setShowBrighterQRCode = useShowBrighterQRCodeStore(
        (state) => state.setShow
    );

    return (
        <div className={styles.launchPairing}>
            {pairingInfo ? (
                <button
                    type="button"
                    className={styles.launchPairing__qrCode}
                    onClick={() => setShowBrighterQRCode(!showBrighterQRCode)}
                >
                    <Cuer
                        arena={"/icon.svg"}
                        value={`${process.env.FRAK_WALLET_URL}/pairing?id=${pairingInfo.id}&mode=embedded`}
                        size={200}
                    />
                </button>
            ) : (
                <Spinner />
            )}
            <div className={styles.launchPairing__status}>
                <PairingStatus status={clientState.status} />
            </div>
            {clientState.partnerDevice && (
                <p className={styles.launchPairing__partnerDevice}>
                    {clientState.partnerDevice}
                </p>
            )}
            {pairingInfo?.code && (
                <CodeInput value={pairingInfo.code} mode="numeric" />
            )}
        </div>
    );
}
