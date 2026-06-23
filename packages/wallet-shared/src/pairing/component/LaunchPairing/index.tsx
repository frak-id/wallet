import { EmptyState } from "@frak-labs/design-system/components/EmptyState";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { CircleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CodeInput } from "../../../common/component/CodeInput";
import type { OnPairingSuccessCallback } from "../../clients/origin";
import { useOriginPairingFlow } from "../../hook/useOriginPairingFlow";
import type { OriginIdentityNode } from "../../types";
import { PairingQrCode } from "../PairingQrCode";
import { PairingStatus } from "../PairingStatus";
import * as styles from "./index.css";

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
    const { t } = useTranslation();
    const { clientState, handleRetry } = useOriginPairingFlow({
        onSuccess,
        originNode,
    });
    const pairingInfo = clientState.pairing;
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
                        onClick: handleRetry,
                    }}
                />
            ) : (
                <Stack space="m" align="center">
                    {pairingInfo ? (
                        <div
                            // E2E affordance: the pairing id only feeds the QR
                            // pattern (not otherwise in the DOM), and the
                            // pairing socket isn't observable from Playwright.
                            data-pairing-id={pairingInfo.id}
                            data-pairing-code={pairingInfo.code}
                            className={styles.launchPairing__qrCode}
                        >
                            <PairingQrCode
                                value={`${process.env.FRAK_WALLET_URL ?? ""}/p/${pairingInfo.id}`}
                                size={200}
                                errorCorrection="quartile"
                            />
                        </div>
                    ) : (
                        <Spinner />
                    )}
                    <Text variant="body" align="center" color="secondary">
                        {t("wallet.pairing.scanDescription")}
                    </Text>
                    {clientState.partnerDevice && (
                        <Text variant="bodySmall" align="center">
                            {clientState.partnerDevice}
                        </Text>
                    )}
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
                                fill
                            />
                        </Stack>
                    )}
                    <div className={styles.launchPairing__status}>
                        <PairingStatus status={clientState.status} />
                    </div>
                </Stack>
            )}
        </div>
    );
}
