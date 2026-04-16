import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { LogoFrak } from "@frak-labs/design-system/icons";
import { Cuer } from "cuer";
import { type ReactNode, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { trackAuthInitiated } from "../../../common/analytics";
import { CodeInput } from "../../../common/component/CodeInput";
import type { OnPairingSuccessCallback } from "../../clients/origin";
import { getOriginPairingClient } from "../../clients/store";
import type { OriginIdentityNode } from "../../types";
import { PairingStatus } from "../PairingStatus";
import * as styles from "./index.css";

type PairingViewProps = {
    /** Screen title (e.g. "Se connecter avec mon mobile") */
    title: ReactNode;
    /** Caption under the QR code */
    description: ReactNode;
    /** Callback fired when pairing completes */
    onSuccess?: OnPairingSuccessCallback;
    /** Optional origin identity (for onboarding / merchant-bound pairings) */
    originNode?: OriginIdentityNode;
};

/**
 * Reusable QR-code pairing screen.
 *
 * Initiates a pairing session and renders the Figma pairing layout:
 * title, QR code, instruction caption, code digits, and live status.
 */
export function PairingView({
    title,
    description,
    onSuccess,
    originNode,
}: PairingViewProps) {
    const { t } = useTranslation();
    const client = getOriginPairingClient();
    const clientState = useStore(client.store);
    const pairingInfo = clientState.pairing;

    useEffect(() => {
        client.initiatePairing({ onSuccess, originNode });
        trackAuthInitiated("pairing");
    }, [client, onSuccess, originNode]);

    return (
        <div className={styles.pairingView}>
            <Text as="h1" variant="heading1" className={styles.title}>
                {title}
            </Text>
            <Stack space="m" className={styles.qrCodeWrapper}>
                <div className={styles.qrCode}>
                    {pairingInfo ? (
                        <>
                            <Cuer
                                value={`${process.env.FRAK_WALLET_URL}/pairing?id=${pairingInfo.id}&mode=embedded`}
                                size={224}
                                errorCorrection="high"
                            />
                            <FrakArena />
                        </>
                    ) : (
                        <Spinner />
                    )}
                </div>
                <Text as="p" variant="body" align="center" color="secondary">
                    {description}
                </Text>
            </Stack>
            {pairingInfo?.code && (
                <Stack space="m" align="center">
                    <Text variant="body" weight="semiBold" align="center">
                        {t("wallet.pairing.code")}
                    </Text>
                    <CodeInput value={pairingInfo.code} mode="numeric" />
                </Stack>
            )}
            <div className={styles.status}>
                <PairingStatus status={clientState.status} />
            </div>
        </div>
    );
}

/**
 * QR code arena: blue rounded square with the white Frak logo.
 * Fills the Cuer.Arena container (Cuer sizes it ~25% of the QR).
 */
function FrakArena() {
    return (
        <div className={styles.arena}>
            <LogoFrak width={30} height={30} />
        </div>
    );
}
