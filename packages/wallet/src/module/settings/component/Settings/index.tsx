"use client";

import { sessionAtom } from "@/module/common/atoms/session";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { BetaOptions } from "@/module/settings/component/BetaOptions";
import { SwitchChain } from "@/module/settings/component/SwitchChain";
import { SessionsConnected } from "@/module/wallet-connect/component/SessionsConnected";
import { WalletAddress } from "@/module/wallet/component/WalletAddress";
import { useAtomValue } from "jotai";
import { Fingerprint, Shield } from "lucide-react";
import { useAccount } from "wagmi";
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
    const { address } = useAccount();
    const { wallet } = useAtomValue(sessionAtom) ?? {};

    return (
        <Panel size={"small"}>
            <Title icon={<Fingerprint size={32} />}>
                Biometry informations
            </Title>
            <ul className={styles.settings__list}>
                <li>
                    Authenticator:{" "}
                    <WalletAddress wallet={wallet?.authenticatorId ?? "0"} />
                </li>

                <li>
                    Wallet: <WalletAddress wallet={address ?? "0x"} />
                </li>
            </ul>
        </Panel>
    );
}
