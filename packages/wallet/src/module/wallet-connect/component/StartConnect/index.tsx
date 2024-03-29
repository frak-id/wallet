import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { ConnectionWithUri } from "@/module/wallet-connect/component/ConnectionWithUri";
import { QrReader } from "@/module/wallet-connect/component/QrReader";
import { Plug } from "lucide-react";

export function CreateWalletConnectConnection() {
    return (
        <Panel withShadow={false} size={"small"}>
            <Title icon={<Plug size={32} />}>Wallet Connect</Title>
            <QrReader />
            <ConnectionWithUri />
        </Panel>
    );
}
