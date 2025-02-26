import { useCopyToClipboardWithState } from "@shared/module/hook/useCopyToClipboardWithState";
import { useMemo } from "react";
import { type Address, type Hex, slice } from "viem";
import styles from "./index.module.css";

export function formatHash({
    hash,
    format = { start: 2, end: 3 },
}: { hash: Hex; format?: { start: number; end: number } }) {
    if (!hash) return undefined;
    const start = slice(hash, 0, format.start);
    const end = slice(hash, -format.end).replace("0x", "");
    const shortenHash = `${start}...${end}`;
    return hash ? shortenHash : undefined;
}

export function WalletAddress({
    wallet,
    copiedText,
}: { wallet: Address; copiedText?: string }) {
    const { copied, copy } = useCopyToClipboardWithState();

    const hashedAddress = useMemo(
        () => formatHash({ hash: wallet, format: { start: 2, end: 3 } }),
        [wallet]
    );
    const copiedMessage = copiedText ?? "Copied";

    if (!wallet) return null;
    return (
        <button
            type={"button"}
            className={styles.walletAddress}
            onClick={() => copy(wallet)}
        >
            {copied ? copiedMessage : hashedAddress}
        </button>
    );
}

export function TransactionHash({
    hash,
    copiedText,
}: { hash: Hex; copiedText?: string }) {
    const { copied, copy } = useCopyToClipboardWithState();

    const hashedAddress = useMemo(
        () => formatHash({ hash, format: { start: 4, end: 4 } }),
        [hash]
    );
    const copiedMessage = copiedText ?? "Copied";

    if (!hash) return null;
    return (
        <button
            type={"button"}
            className={styles.walletAddress}
            onClick={() => copy(hash)}
        >
            {copied ? copiedMessage : hashedAddress}
        </button>
    );
}
