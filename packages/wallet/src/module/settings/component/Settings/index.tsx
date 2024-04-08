"use client";

import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { BetaOptions } from "@/module/settings/component/BetaOptions";
import { SwitchChain } from "@/module/settings/component/SwitchChain";
import { SessionsConnected } from "@/module/wallet-connect/component/SessionsConnected";
import { WalletAddress } from "@/module/wallet/component/WalletAddress";
import { useWallet } from "@/module/wallet/provider/WalletProvider";
import { Fingerprint, Shield } from "lucide-react";
import styles from "./index.module.css";

export function Settings() {
    return (
        <>
            <BiometryInfo />

            <Panel size={"small"} className={styles.settings__disabled}>
                <Title icon={<Shield size={32} />}>Recovery setup</Title>
                <p className={styles.settings__comingSoon}>Coming soon</p>
            </Panel>

            <SwitchChain />
            <BetaOptions />
            <SessionsConnected />
        </>
    );
}

function BiometryInfo() {
    const { address, wallet } = useWallet();

    return (
        <Panel size={"small"}>
            <Title icon={<Fingerprint size={32} />}>
                Biometry informations
            </Title>
            <ul className={styles.settings__list}>
                <li>
                    Authenticator:{" "}
                    <WalletAddress wallet={wallet.authenticatorId} />
                </li>

                <li>
                    Wallet: <WalletAddress wallet={address ?? "0x"} />
                </li>
            </ul>
        </Panel>
    );
}
