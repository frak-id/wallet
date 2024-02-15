import { formatFrk } from "@/context/wallet/utils/frkFormatter";
import { Panel } from "@/module/common/component/Panel";
import { useWallet } from "@/module/wallet/provider/WalletProvider";
import { CircleDollarSign } from "lucide-react";
import styles from "./index.module.css";

export function Balances() {
    const { balance } = useWallet();

    return (
        <Panel withShadow={true} size={"small"}>
            <span className={styles.balances}>
                <CircleDollarSign width={32} height={32} /> Balances
            </span>
            <span>{formatFrk(Number(balance))}</span>
        </Panel>
    );
}
