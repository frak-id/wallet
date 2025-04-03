import { Grid } from "@/module/common/component/Grid";
import { TargetPairingClient } from "@/module/pairing/clients/target";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";

/**
 * Pairing page
 * @returns A page to pair with the wallet
 */
export default function Pairing() {
    const [searchParams] = useSearchParams();
    const { t } = useTranslation();
    const code = searchParams.get("code");

    useEffect(() => {
        if (!code) return;

        const client = new TargetPairingClient();
        client.joinPairing(code);
    }, [code]);

    return (
        <Grid>
            {code ? (
                <div>
                    <h1>
                        {t("wallet.pairing.title", "Pairing in progress...")}
                    </h1>
                    <p>
                        {t(
                            "wallet.pairing.processing",
                            "Processing your pairing request..."
                        )}
                    </p>
                </div>
            ) : (
                <div>
                    <h1>
                        {t(
                            "wallet.pairing.error.title",
                            "Invalid Pairing Request"
                        )}
                    </h1>
                    <p>
                        {t(
                            "wallet.pairing.error.noCode",
                            "No pairing code provided"
                        )}
                    </p>
                </div>
            )}
        </Grid>
    );
}
