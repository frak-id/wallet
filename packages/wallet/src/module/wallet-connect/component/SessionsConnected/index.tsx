import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { isWalletConnectEnableAtom } from "@/module/settings/atoms/betaOptions";
import { SessionsList } from "@/module/wallet-connect/component/SessionsConnected/SessionsList";
import { useAtomValue } from "jotai/index";
import { Plug } from "lucide-react";

export function SessionsConnected() {
    const isEnable = useAtomValue(isWalletConnectEnableAtom);
    if (!isEnable) {
        return <></>;
    }

    return (
        <Panel size={"small"}>
            <Title icon={<Plug size={32} />}>Wallet Connect</Title>
            <SessionsList />
        </Panel>
    );
}
