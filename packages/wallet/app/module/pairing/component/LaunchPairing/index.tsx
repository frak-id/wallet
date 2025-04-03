import { Spinner } from "@frak-labs/shared/module/component/Spinner";
import { Cuer } from "cuer";
import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import type { Hex } from "viem";
import { getOriginPairingClient } from "../../clients/store";
import styles from "./index.module.css";

/**
 * Launch a pairing session
 * @returns A QR code to scan to pair with the wallet
 */
export function LaunchPairing({ ssoId }: { ssoId?: Hex }) {
    const client = getOriginPairingClient();
    const [pairingCode, setPairingCode] = useState<string | null>(null);

    useEffect(() => {
        client
            .initiatePairing({ ssoId })
            .then(({ pairingCode }) => setPairingCode(pairingCode));
    }, [client, ssoId]);

    // Get the current state of the client
    const clientState = useAtomValue(client.stateAtom);

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
            {clientState.status}
        </div>
    );
}
