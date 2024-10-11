"use client";

import { sessionAtom } from "@/module/common/atoms/session";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { RemoveAllNotification } from "@/module/notification/component/RemoveAllNotification";
import { RecoveryLink } from "@/module/settings/component/Recovery";
import { WalletAddress } from "@module/component/HashDisplay";
import { useAtomValue } from "jotai";
import { Fingerprint } from "lucide-react";
import { toHex } from "viem";
import { useAccount } from "wagmi";
import styles from "./index.module.css";

export function Settings() {
    return (
        <>
            <BiometryInfo />
            <RecoveryLink />
            <RemoveAllNotification />
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
                    <WalletAddress
                        wallet={toHex(wallet?.authenticatorId ?? "0")}
                    />
                </li>

                <li>
                    Wallet: <WalletAddress wallet={address ?? "0x"} />
                </li>
            </ul>
        </Panel>
    );
}
