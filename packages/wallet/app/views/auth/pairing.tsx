import { Grid } from "@/module/common/component/Grid";
import { Title } from "@/module/common/component/Title";
import { getTargetPairingClient } from "@/module/pairing/clients/store";
import { PairingHeader } from "@/module/pairing/component/PairingHeader";
import { PairingInfo } from "@/module/pairing/component/PairingInfo";
import { usePairingCode } from "@/module/pairing/hook/usePairingCode";
import { Button } from "@shared/module/component/Button";
import { useAtomValue } from "jotai";
import { AlertCircle } from "lucide-react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import styles from "./pairing.module.css";

/**
 * Pairing page
 * @returns A page to pair with the wallet
 */
export default function Pairing() {
    const client = getTargetPairingClient();
    const { t } = useTranslation();
    const { pairingCode, resetPairingCode } = usePairingCode();
    const navigate = useNavigate();
    const pairingState = useAtomValue(client.stateAtom);

    const actionPairing = useCallback(
        (action: "join" | "cancel") => {
            if (action === "join" && pairingCode) {
                client.joinPairing(pairingCode.id, pairingCode.code);
            }
            if (action === "cancel") {
                client.disconnect();
            }
            resetPairingCode();
            navigate("/wallet");
        },
        [navigate, resetPairingCode, client, pairingCode]
    );

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

    return (
        <Grid>
            <>
                <PairingHeader />
                <PairingInfo state={pairingState} id={pairingCode.id} />
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
            </>
        </Grid>
    );
}
