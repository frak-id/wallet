import { Spinner } from "@frak-labs/shared/module/component/Spinner";
import { Cuer } from "cuer";
import { useAtomValue } from "jotai";
import { useEffect } from "react";
import type { Hex } from "viem";
import { getOriginPairingClient } from "../../clients/store";
import styles from "./index.module.css";

/**
 * Launch a pairing session
 * @returns A QR code to scan to pair with the wallet
 */
export function LaunchPairing({ ssoId }: { ssoId?: Hex }) {
    const client = getOriginPairingClient();

    useEffect(() => {
        client.initiatePairing({ ssoId });
    }, [client, ssoId]);

    // Get the current state of the client
    const clientState = useAtomValue(client.stateAtom);

    const pairingCode = clientState.pairing?.code;

    return (
        <div className={styles.launchPairing}>
            {pairingCode ? (
                <Cuer
                    arena={"/icon.svg"}
                    value={`${process.env.FRAK_WALLET_URL}/pairing?code=${pairingCode}`}
                    size={200}
                />
            ) : (
                <Spinner />
            )}
            <p>{clientState.status}</p>
            <p>{clientState.partnerDevice}</p>
            <p>{pairingCode}</p>
        </div>
    );
}
