import { Grid } from "@/module/common/component/Grid";
import { Title } from "@/module/common/component/Title";
import { getTargetPairingClient } from "@/module/pairing/clients/store";
import { PairingHeader } from "@/module/pairing/component/PairingHeader";
import { PairingInfo } from "@/module/pairing/component/PairingInfo";
import { Button } from "@shared/module/component/Button";
import { Spinner } from "@shared/module/component/Spinner";
import { AlertCircle } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import styles from "./pairing.module.css";

/**
 * Pairing page
 * @returns A page to pair with the wallet
 */
export default function Pairing() {
    const client = getTargetPairingClient();
    const [searchParams] = useSearchParams();
    const code = searchParams.get("code");
    const { t } = useTranslation();

    useEffect(() => {
        if (!code) return;
        client.joinPairing(code);
    }, [code, client]);

    if (!code) {
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

    if (!client.state.partnerDevice) {
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
                <PairingInfo client={client} />
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
