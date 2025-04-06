import { Grid } from "@/module/common/component/Grid";
import { Title } from "@/module/common/component/Title";
import { getTargetPairingClient } from "@/module/pairing/clients/store";
import { PairingHeader } from "@/module/pairing/component/PairingHeader";
import { PairingInfo } from "@/module/pairing/component/PairingInfo";
import { usePairingCode } from "@/module/pairing/hook/usePairingCode";
import { Button } from "@shared/module/component/Button";
import { Spinner } from "@shared/module/component/Spinner";
import { useAtomValue } from "jotai";
import { AlertCircle } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import styles from "./pairing.module.css";

/**
 * Pairing page
 * @returns A page to pair with the wallet
 */
export default function Pairing() {
    const client = getTargetPairingClient();
    const { t } = useTranslation();
    const { pairingCode } = usePairingCode();

    useEffect(() => {
        if (!pairingCode) return;
        client.joinPairing(pairingCode);
    }, [pairingCode, client]);

    const pairingState = useAtomValue(client.stateAtom);

    if (!pairingCode) {
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

    if (!pairingState.partnerDevice) {
        return (
            <Grid>
                <Title
                    size="big"
                    align="center"
                    className={styles.pairing__loading}
                >
                    <Spinner />
                    {t("wallet.pairing.loading.title")}
                </Title>
            </Grid>
        );
    }

    return (
        <Grid>
            <>
                <PairingHeader />
                <PairingInfo state={pairingState} />
                <div className={styles.pairing__buttons}>
                    <Button
                        variant="secondary"
                        onClick={() => {
                            client.disconnect();
                        }}
                    >
                        {t("wallet.pairing.cancel")}
                    </Button>
                    <Button>{t("wallet.pairing.confirm")}</Button>
                </div>
            </>
        </Grid>
    );
}
