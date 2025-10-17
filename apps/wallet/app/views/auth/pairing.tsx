import { Button } from "@frak-labs/ui/component/Button";
import { Skeleton } from "@frak-labs/ui/component/Skeleton";
import { getTargetPairingClient } from "@frak-labs/wallet-shared/pairing/clients/store";
import { usePairingInfo } from "@frak-labs/wallet-shared/pairing/hook/usePairingInfo";
import { useAtomValue } from "jotai";
import { AlertCircle } from "lucide-react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { Grid } from "@/module/common/component/Grid";
import { Title } from "@/module/common/component/Title";
import { PairingCode } from "@/module/pairing/component/PairingCode";
import { PairingHeader } from "@/module/pairing/component/PairingHeader";
import { PairingInfo } from "@/module/pairing/component/PairingInfo";
import { usePendingPairingInfo } from "@/module/pairing/hook/usePendingPairingInfo";
import styles from "./pairing.module.css";

/**
 * Pairing page
 * @returns A page to pair with the wallet
 */
export default function Pairing() {
    const client = getTargetPairingClient();
    const { t } = useTranslation();
    const { pairingInfo: pendingPairingInfo, resetPairingInfo } =
        usePendingPairingInfo();
    const navigate = useNavigate();
    const pairingState = useAtomValue(client.stateAtom);
    const { data: pairingInfo } = usePairingInfo({
        id: pendingPairingInfo?.id,
    });

    const actionPairing = useCallback(
        (action: "join" | "cancel") => {
            if (action === "join" && pendingPairingInfo && pairingInfo) {
                client.joinPairing(
                    pendingPairingInfo.id,
                    pairingInfo.pairingCode
                );
            }
            if (action === "cancel") {
                client.disconnect();
            }
            resetPairingInfo();
            navigate("/wallet");
        },
        [navigate, resetPairingInfo, client, pairingInfo, pendingPairingInfo]
    );

    // No pairing info
    if (!pendingPairingInfo) {
        return (
            <Grid>
                <Title size="big" align="center">
                    {t("wallet.pairing.error.title")}
                </Title>
                <p className={styles.pairing__error}>
                    <AlertCircle size={24} />
                    {t("wallet.pairing.error.noCode")}
                </p>
            </Grid>
        );
    }

    // Loading state
    if (!pairingInfo) {
        return (
            <Grid>
                <PairingHeader />
                <Skeleton />
            </Grid>
        );
    }

    return (
        <Grid>
            <PairingHeader />
            <PairingInfo state={pairingState} id={pendingPairingInfo.id} />
            <PairingCode code={pairingInfo.pairingCode} />
            <div className={styles.pairing__buttons}>
                <Button
                    variant="secondary"
                    onClick={() => {
                        actionPairing("cancel");
                    }}
                >
                    {t("wallet.pairing.cancel")}
                </Button>
                <Button
                    onClick={() => {
                        actionPairing("join");
                    }}
                >
                    {t("wallet.pairing.confirm")}
                </Button>
            </div>
        </Grid>
    );
}
