import { formatFrk } from "@/context/wallet/utils/frkFormatter";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { useWallet } from "@/module/wallet/provider/WalletProvider";
import { CircleDollarSign } from "lucide-react";

export function Balances() {
    const { balance } = useWallet();

    return (
        <Panel withShadow={true} size={"small"}>
            <Title icon={<CircleDollarSign width={32} height={32} />}>
                Balances
            </Title>
            <span>{formatFrk(Number(balance))}</span>
        </Panel>
    );
}
