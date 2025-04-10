import { Spinner } from "@frak-labs/shared/module/component/Spinner";
import { Cuer } from "cuer";
import { useAtomValue } from "jotai";
import { useEffect } from "react";
import type { Hex } from "viem";
import { getOriginPairingClient } from "../../clients/store";
import { PairingCode } from "../PairingCode";
import { PairingStatus } from "../PairingStatus";
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

    const pairingInfo = clientState.pairing;

    return (
        <div className={styles.launchPairing}>
            {pairingInfo ? (
                <Cuer
                    arena={"/icon.svg"}
                    value={`${process.env.FRAK_WALLET_URL}/pairing?id=${pairingInfo.id}`}
                    size={200}
                />
            ) : (
                <Spinner />
            )}
            <div className={styles.launchPairing__status}>
                <PairingStatus status={clientState.status} />
            </div>
            {clientState.partnerDevice && (
                <p className={styles.launchPairing__partnerDevice}>
                    {clientState.partnerDevice}
                </p>
            )}
            {pairingInfo?.code && <PairingCode code={pairingInfo.code} />}
        </div>
    );
}
