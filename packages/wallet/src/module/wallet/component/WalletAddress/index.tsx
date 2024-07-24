import { formatHash } from "@/context/wallet/utils/hashFormatter";
import { useCopyAddress } from "@module/hook/useCopyAddress";
import styles from "./index.module.css";

type WalletAddressProps = {
    wallet: string;
};

export function WalletAddress({ wallet }: WalletAddressProps) {
    const { copied, copyAddress } = useCopyAddress();

    if (!wallet) return null;
    return (
        <button
            type={"button"}
            className={styles.walletAddress}
            onClick={() => copyAddress(wallet)}
        >
            {copied ? "Copied!" : formatHash(wallet)}
        </button>
    );
}
