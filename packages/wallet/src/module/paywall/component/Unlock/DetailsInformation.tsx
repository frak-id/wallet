import { formatFrk } from "@/context/wallet/utils/frkFormatter";
import { formatHash } from "@/context/wallet/utils/hashFormatter";
import styles from "@/module/paywall/component/Unlock/index.module.css";
import { useMemo } from "react";
import { formatEther } from "viem";

export function InformationBalance({ balance }: { balance: string }) {
    return (
        <p className={styles.unlock__row}>
            <span>Current balance</span>
            <span>{formatFrk(Number(balance))}</span>
        </p>
    );
}

export function InformationUnlockPriceOrExpiration({
    price,
    alreadyUnlockedExpiration,
}: { price: string; alreadyUnlockedExpiration?: string }) {
    const formattedPrice = useMemo(() => formatEther(BigInt(price)), [price]);

    // If already unlocked, directly exit with expiration date
    if (alreadyUnlockedExpiration) {
        return (
            <p className={styles.unlock__row}>
                <span>Expire in</span>
                <span>{alreadyUnlockedExpiration}</span>
            </p>
        );
    }

    // Otherwise, display the unlock price
    return (
        <p className={styles.unlock__row}>
            <span>Unlock price</span>
            <span>{formattedPrice} pFRK</span>
        </p>
    );
}

export function InformationOpHash({ userOpHash }: { userOpHash?: string }) {
    if (!userOpHash) {
        return null;
    }
    return (
        <p className={`${styles.unlock__row} ${styles.unlock__information}`}>
            <span>User op hash</span>
            <span>{formatHash(userOpHash)}</span>
        </p>
    );
}

export function InformationError({ reason }: { reason?: string }) {
    if (!reason) {
        return null;
    }
    return (
        <p
            className={`${styles.unlock__information} ${styles["unlock__information--error"]}`}
        >
            {reason}
        </p>
    );
}
