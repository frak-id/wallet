import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import PairingsList from "@/module/wallet-connect/component/PairingsList";
import SessionsList from "@/module/wallet-connect/component/SessionsList";
import { Plug } from "lucide-react";

export function SessionsConnected() {
    return (
        <Panel size={"small"}>
            <Title icon={<Plug size={32} />}>Wallet Connect</Title>
            <PairingsList />
            <SessionsList />
        </Panel>
    );
}
