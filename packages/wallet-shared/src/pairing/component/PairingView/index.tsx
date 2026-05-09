import { EmptyState } from "@frak-labs/design-system/components/EmptyState";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CodeInput } from "../../../common/component/CodeInput";
import type { OnPairingSuccessCallback } from "../../clients/origin";
import { useOriginPairingFlow } from "../../hook/useOriginPairingFlow";
import type { OriginIdentityNode } from "../../types";
import { PairingQrCode } from "../PairingQrCode";
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
    /**
     * Optional back-button slot rendered above the title.
     * Typically a `<Back onClick={...} />` element from the host app —
     * kept as a slot so this shared component stays decoupled from any
     * specific Back implementation (which lives in `apps/wallet`).
     */
    back?: ReactNode;
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
    back,
}: PairingViewProps) {
    const { t } = useTranslation();
    const { clientState, pairingInfo, isError, handleRetry } =
        useOriginPairingFlow({ onSuccess, originNode });

    return (
        <div className={styles.pairingView}>
            <Stack space="m" align="left" className={styles.header}>
                {back}
                <Text as="h1" variant="heading1">
                    {title}
                </Text>
            </Stack>
            {isError ? (
                <EmptyState
                    icon={<CircleAlert size={20} />}
                    title={t("wallet.pairing.launch.error.title")}
                    description={t("wallet.pairing.launch.error.description")}
                    action={{
                        label: t("wallet.pairing.launch.error.retry"),
                        onClick: handleRetry,
                    }}
                />
            ) : (
                <>
                    <Stack space="m" className={styles.qrCodeWrapper}>
                        {pairingInfo ? (
                            <PairingQrCode
                                value={`${process.env.FRAK_WALLET_URL ?? ""}/P/${pairingInfo.id}`.toUpperCase()}
                                size={224}
                                errorCorrection="high"
                            />
                        ) : (
                            <Spinner />
                        )}
                        <Text
                            as="p"
                            variant="body"
                            align="center"
                            color="secondary"
                        >
                            {description}
                        </Text>
                    </Stack>
                    {pairingInfo?.code && (
                        <Stack space="m" align="center">
                            <Text
                                variant="body"
                                weight="semiBold"
                                align="center"
                            >
                                {t("wallet.pairing.code")}
                            </Text>
                            <CodeInput
                                value={pairingInfo.code}
                                mode="numeric"
                            />
                        </Stack>
                    )}
                </>
            )}
            {!isError && (
                <div className={styles.status}>
                    <PairingStatus status={clientState.status} />
                </div>
            )}
        </div>
    );
}
