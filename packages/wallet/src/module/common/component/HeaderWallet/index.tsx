"use client";

import { WalletAddress } from "@/module/wallet/component/WalletAddress";
import { useAccount } from "wagmi";
import styles from "./index.module.css";

export function HeaderWallet() {
    const { address } = useAccount();

    return (
        <>
            {address && (
                <span className={styles.header__wallet}>
                    <WalletAddress wallet={address} />
                </span>
            )}
        </>
    );
}
