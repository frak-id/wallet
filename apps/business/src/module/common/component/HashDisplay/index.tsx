import { useMemo } from "react";
import { type Address, type Hex, slice } from "viem";
import { useCopyToClipboardWithState } from "@/module/common/hook/useCopyToClipboardWithState";
import { walletAddress } from "./hash-display.css";

export function formatHash({
    hash,
    format = { start: 2, end: 3 },
}: {
    hash: Hex;
    format?: { start: number; end: number };
}) {
    if (!hash) return undefined;
    const start = slice(hash, 0, format.start);
    const end = slice(hash, -format.end).replace("0x", "");
    return `${start}...${end}`;
}

export function WalletAddress({
    wallet,
    copiedText,
}: {
    wallet: Address;
    copiedText?: string;
}) {
    const { copied, copy } = useCopyToClipboardWithState();

    const hashedAddress = useMemo(
        () => formatHash({ hash: wallet, format: { start: 2, end: 3 } }),
        [wallet]
    );
    const copiedMessage = copiedText ?? "Copied";

    if (!wallet) return null;
    return (
        <button
            type="button"
            className={walletAddress}
            onClick={() => copy(wallet)}
        >
            {copied ? copiedMessage : hashedAddress}
        </button>
    );
}
