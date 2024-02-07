import { formatHash } from "@/context/wallet/utils/hashFormatter";
import { useCopyToClipboard } from "@uidotdev/usehooks";
import { Copy, CopyCheck } from "lucide-react";
import { useEffect, useState } from "react";
import styles from "./index.module.css";

type WalletAddressProps = {
    wallet: string;
    onlyIcon?: boolean;
};

export function WalletAddress({
    wallet,
    onlyIcon = false,
}: WalletAddressProps) {
    const [copied, setCopied] = useState(false);
    const [, copyToClipboard] = useCopyToClipboard();
    const Icon = copied ? CopyCheck : Copy;

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
            <Icon width={16} className={styles.walletAddress__icon} />
            {!onlyIcon && formatHash(wallet)}
        </button>
    );
}
