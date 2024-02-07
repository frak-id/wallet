"use client";

import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { useWallet } from "@/module/wallet/provider/WalletProvider";
import styles from "./index.module.css";

export function Settings() {
    const { username, wallet } = useWallet();

    return (
        <Panel>
            <Title>Account details</Title>
            <ul className={styles.list}>
                <li>ID: {username}</li>
                <li>AuthenticatorId: {wallet.authenticatorId}</li>
            </ul>
        </Panel>
    );
}
