import { useCopyAddress } from "@module/hook/useCopyAddress";
import { useMemo } from "react";
import { type Address, slice } from "viem";
import styles from "./index.module.css";

type WalletAddressProps = {
    wallet: Address;
    format?: {
        start: number;
        end: number;
    };
};

export function WalletAddress({
    wallet,
    format = { start: 2, end: 3 },
}: WalletAddressProps) {
    const { copied, copyAddress } = useCopyAddress();

    const hashedAddress = useMemo(() => {
        const start = slice(wallet, 0, format.start);
        const end = slice(wallet, -format.end).replace("0x", "");
        const shortenHash = `${start}...${end}`;
        return wallet ? shortenHash : undefined;
    }, [wallet, format]);

    if (!wallet) return null;
    return (
        <button
            type={"button"}
            className={styles.walletAddress}
            onClick={() => copyAddress(wallet)}
        >
            {copied ? "Copied!" : hashedAddress}
        </button>
    );
}
