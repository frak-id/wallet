import { alchemyClient } from "@/context/common/blockchain/provider";
import { getTokenBalances } from "@/context/common/blockchain/viemActions/getTokenBalances";
import { formatFrk } from "@/context/wallet/utils/frkFormatter";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { useWallet } from "@/module/wallet/provider/WalletProvider";
import { useQuery } from "@tanstack/react-query";
import { CircleDollarSign } from "lucide-react";
import { useEffect } from "react";

export function Balances() {
    const { address, balance } = useWallet();

    const { data, error } = useQuery({
        queryKey: ["getAllBalances", address],
        queryFn: async () => {
            if (!address) {
                return;
            }
            console.log("Fetching all user balances", { address });
            const balances = await getTokenBalances(alchemyClient, {
                address,
                type: "erc20",
            });
            console.log("All user balances", { balances });
            return balances;
        },
        enabled: !!address,
    });

    useEffect(() => {
        console.log("Get balances output", { data, error });
    }, [data, error]);

    return (
        <Panel withShadow={true} size={"small"}>
            <Title icon={<CircleDollarSign width={32} height={32} />}>
                Balances
            </Title>
            <span>{formatFrk(Number(balance))}</span>
        </Panel>
    );
}
