import { formatHash } from "@/context/wallet/utils/hashFormatter";
import { useCopyToClipboard } from "@uidotdev/usehooks";
import { useEffect, useState } from "react";
import styles from "./index.module.css";

type WalletAddressProps = {
    wallet: string;
    onlyIcon?: boolean;
};

export function WalletAddress({ wallet }: WalletAddressProps) {
    const [copied, setCopied] = useState(false);
    const [, copyToClipboard] = useCopyToClipboard();

    useEffect(() => {
        if (copied) {
            setTimeout(() => {
                setCopied(false);
            }, 2000);
        }
    }, [copied]);

    if (!wallet) return null;
    return (
        <button
            type={"button"}
            className={styles.walletAddress}
            onClick={() => {
                if (!copied) {
                    copyToClipboard(wallet);
                    setCopied(true);
                }
            }}
        >
            {formatHash(wallet)}
        </button>
    );
}
