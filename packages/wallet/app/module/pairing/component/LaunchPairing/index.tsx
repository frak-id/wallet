import { OriginPairingClient } from "@/module/pairing/clients/origin";
import { Cuer } from "cuer";
import { useEffect, useState } from "react";
import styles from "./index.module.css";

/**
 * Launch a pairing session
 * @returns A QR code to scan to pair with the wallet
 */
export function LaunchPairing() {
    const [pairingCode, setPairingCode] = useState<string | null>(null);

    useEffect(() => {
        const client = new OriginPairingClient();
        client
            .initiatePairing()
            .then(({ pairingCode }) => setPairingCode(pairingCode));
    }, []);

    if (!pairingCode) return null;

    return (
        <div className={styles.launchPairing}>
            <Cuer
                arena={"/icon.svg"}
                value={`${process.env.FRAK_WALLET_URL}/pairing?code=${pairingCode}`}
            />
        </div>
    );
}
