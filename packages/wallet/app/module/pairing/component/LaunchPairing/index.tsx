import { OriginPairingClient } from "@/module/pairing/clients/origin";
import { Spinner } from "@frak-labs/shared/module/component/Spinner";
import { Cuer } from "cuer";
import { useEffect, useState } from "react";
import styles from "./index.module.css";

/**
 * Launch a pairing session
 * @returns A QR code to scan to pair with the wallet
 */
export function LaunchPairing({ ssoId }: { ssoId?: Hex }) {
    const [pairingCode, setPairingCode] = useState<string | null>(null);

    useEffect(() => {
        const client = new OriginPairingClient();
        client
            .initiatePairing({ ssoId })
            .then(({ pairingCode }) => setPairingCode(pairingCode));
    }, [ssoId]);

    if (!pairingCode) return null;

    return (
        <div className={styles.launchPairing}>
            {pairingCode ? (
                <Cuer
                    arena={"/icon.svg"}
                    value={`${process.env.FRAK_WALLET_URL}/pairing?code=${pairingCode}`}
                />
            ) : (
                <Spinner />
            )}
        </div>
    );
}
