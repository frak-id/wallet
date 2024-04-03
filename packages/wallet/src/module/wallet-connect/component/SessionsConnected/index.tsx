import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { betaOptionsAtom } from "@/module/settings/atoms/betaOptions";
import SessionsList from "@/module/wallet-connect/component/SessionsList";
import { useAtomValue } from "jotai/index";
import { Plug } from "lucide-react";

export function SessionsConnected() {
    const options = useAtomValue(betaOptionsAtom);

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
