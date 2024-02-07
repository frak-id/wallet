"use client";

import { formatFrk } from "@/context/wallet/utils/frkFormatter";
import { PolygonLink } from "@/module/wallet/component/PolygonLink";
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
                    <p className={styles.header__wallet}>
                        <WalletAddress
                            wallet={smartWallet.address}
                            onlyIcon={true}
                        />
                        <PolygonLink
                            hash={smartWallet.address}
                            wallet={true}
                            icon={false}
                        />
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
