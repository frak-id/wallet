"use client";

import { WalletAddress } from "@/module/wallet/component/WalletAddress";
import { useWallet } from "@/module/wallet/provider/WalletProvider";
import styles from "./index.module.css";

export function HeaderWallet() {
    const { smartWallet } = useWallet();

    return (
        <>
            {smartWallet?.address && (
                <span className={styles.header__wallet}>
                    <WalletAddress wallet={smartWallet.address} />
                </span>
            )}
        </>
    );
}
