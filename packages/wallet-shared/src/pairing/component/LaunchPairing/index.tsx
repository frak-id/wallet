import { EmptyState } from "@frak-labs/design-system/components/EmptyState";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Text } from "@frak-labs/design-system/components/Text";
import { clsx as cx } from "clsx";
import { CircleAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { create } from "zustand";
import { CodeInput } from "../../../common/component/CodeInput";
import type { OnPairingSuccessCallback } from "../../clients/origin";
import { useOriginPairingFlow } from "../../hook/useOriginPairingFlow";
import type { OriginIdentityNode, OriginPairingState } from "../../types";
import { PairingQrCode } from "../PairingQrCode";
import { PairingStatus } from "../PairingStatus";
import * as styles from "./index.css";

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

    const { clientState, isError, handleRetry } = useOriginPairingFlow({
        onSuccess,
        originNode,
    });

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

    // The brighter-QR overlay is a white surface; the EmptyState text is dark
    // by default but inherits `color: "#000"` from the overlay — still, the
    // overlay is meaningless once the QR isn't usable. Dismiss it whenever
    // the client transitions into an error state so the user lands back on
    // the inline EmptyState retry block.
    useEffect(() => {
        if (isError && showBrighterQRCode) {
            setShowBrighterQRCode(false);
        }
    }, [isError, showBrighterQRCode, setShowBrighterQRCode]);

    const pairingContent = useMemo(
        () => (
            <PairingContent clientState={clientState} onRetry={handleRetry} />
        ),
        [clientState, handleRetry]
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
    onRetry,
}: {
    clientState: OriginPairingState;
    onRetry: () => void;
}) {
    const { t } = useTranslation();
    const pairingInfo = clientState.pairing;
    const showBrighterQRCode = useShowBrighterQRCodeStore(
        (state) => state.show
    );
    const setShowBrighterQRCode = useShowBrighterQRCodeStore(
        (state) => state.setShow
    );
    const isError =
        clientState.status === "error" || clientState.status === "retry-error";

    return (
        <div className={styles.launchPairing}>
            {isError ? (
                <EmptyState
                    icon={<CircleAlert size={20} />}
                    title={t("wallet.pairing.launch.error.title")}
                    description={t("wallet.pairing.launch.error.description")}
                    action={{
                        label: t("wallet.pairing.launch.error.retry"),
                        onClick: onRetry,
                    }}
                />
            ) : pairingInfo ? (
                <button
                    type="button"
                    className={styles.launchPairing__qrCode}
                    onClick={() => setShowBrighterQRCode(!showBrighterQRCode)}
                >
                    <PairingQrCode
                        value={`${process.env.FRAK_WALLET_URL}/pairing?id=${pairingInfo.id}&mode=embedded`}
                        size={200}
                        errorCorrection="medium"
                    />
                </button>
            ) : (
                <Spinner />
            )}
            {!isError && (
                <div className={styles.launchPairing__status}>
                    <PairingStatus status={clientState.status} />
                </div>
            )}
            {clientState.partnerDevice && (
                <Text variant="bodySmall" align="center">
                    {clientState.partnerDevice}
                </Text>
            )}
            {!isError && pairingInfo?.code && (
                <CodeInput value={pairingInfo.code} mode="numeric" fill />
            )}
        </div>
    );
}
