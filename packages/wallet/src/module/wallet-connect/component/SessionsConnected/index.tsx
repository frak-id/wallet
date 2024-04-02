import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { useBetaOptions } from "@/module/common/hook/useBetaOptions";
import SessionsList from "@/module/wallet-connect/component/SessionsList";
import { Plug } from "lucide-react";

export function SessionsConnected() {
    const { options } = useBetaOptions();

    if (!options.walletConnect) {
        return <></>;
    }

    return (
        <Panel size={"small"}>
            <Title icon={<Plug size={32} />}>Wallet Connect</Title>
            <SessionsList />
        </Panel>
    );
}
