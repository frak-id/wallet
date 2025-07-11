import { trackAuthInitiated } from "@/module/common/analytics";
import { Spinner } from "@frak-labs/ui/component/Spinner";
import { cx } from "class-variance-authority";
import { Cuer } from "cuer";
import { atom, useAtom, useAtomValue } from "jotai";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Hex } from "viem";
import { getOriginPairingClient } from "../../clients/store";
import type { OriginPairingState } from "../../types";
import { PairingCode } from "../PairingCode";
import { PairingStatus } from "../PairingStatus";
import styles from "./index.module.css";

const showBrighterQRCodeAtom = atom(false);

/**
 * Launch a pairing session
 * @returns A QR code to scan to pair with the wallet
 */
export function LaunchPairing({ ssoId }: { ssoId?: Hex }) {
    const [showBrighterQRCode, setShowBrighterQRCode] = useAtom(
        showBrighterQRCodeAtom
    );
    const [showFullScreen, setShowFullScreen] = useState(showBrighterQRCode);
    const [isExiting, setIsExiting] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const client = getOriginPairingClient();

    // Get the current state of the client
    const clientState = useAtomValue(client.stateAtom);

    // Sync showFullScreen with jotai atom
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
        client.initiatePairing({ ssoId });
        trackAuthInitiated("pairing", {
            ssoId,
        });
    }, [client, ssoId]);

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

function PairingContent({
    clientState,
}: {
    clientState: OriginPairingState;
}) {
    const pairingInfo = clientState.pairing;
    const [showBrighterQRCode, setShowBrighterQRCode] = useAtom(
        showBrighterQRCodeAtom
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
                        value={`${process.env.FRAK_WALLET_URL}/pairing?id=${pairingInfo.id}`}
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
                <PairingCode
                    code={pairingInfo.code}
                    theme={showBrighterQRCode ? "dark" : "light"}
                />
            )}
        </div>
    );
}
