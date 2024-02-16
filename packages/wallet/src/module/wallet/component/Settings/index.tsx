"use client";

import { formatHash } from "@/context/wallet/utils/hashFormatter";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { useWallet } from "@/module/wallet/provider/WalletProvider";
import { Fingerprint, Shield } from "lucide-react";
import styles from "./index.module.css";

export function Settings() {
    const { address, username, wallet } = useWallet();

    return (
        <>
            <Panel size={"small"}>
                <Title icon={<Fingerprint size={32} />}>
                    Biometry informations
                </Title>
                <ul className={styles.settings__list}>
                    <li>Authenticator: {wallet.authenticatorId}</li>
                    <li>Username: {username}</li>
                    {/*<li>UsernameId: </li>*/}
                    <li>Wallet: {formatHash(address)}</li>
                </ul>
            </Panel>
            <Panel size={"small"} className={styles.settings__disabled}>
                <Title icon={<Shield size={32} />}>Recovery setup</Title>
                <p className={styles.settings__comingSoon}>Coming soon</p>
            </Panel>
        </>
    );
}
