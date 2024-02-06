"use client";

import { formatFrk } from "@/context/wallet/utils/frkFormatter";
import { WalletAddress } from "@/module/wallet/component/WalletAddress";
import { useWallet } from "@/module/wallet/provider/WalletProvider";
import { Clock8, Home, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import styles from "./index.module.css";

export function HeaderRestricted() {
    const router = useRouter();
    const { balance, smartWallet } = useWallet();

    return (
        <header className={styles.header}>
            <div className={styles.header__row}>
                {smartWallet?.address && (
                    <p>
                        <WalletAddress wallet={smartWallet.address} />
                    </p>
                )}
                <p>{formatFrk(Number(balance))}</p>
            </div>
            <div
                className={`${styles.header__row} ${styles["header__row--centered"]}`}
            >
                <button
                    type={"button"}
                    className={styles.header__button}
                    onClick={() => router.push("/wallet")}
                >
                    <Home />
                </button>
                <button
                    type={"button"}
                    className={styles.header__button}
                    onClick={() => router.push("/history")}
                >
                    <Clock8 />
                </button>
                <button
                    type={"button"}
                    className={styles.header__button}
                    onClick={() => router.push("/settings")}
                >
                    <Settings />
                </button>
            </div>
        </header>
    );
}
