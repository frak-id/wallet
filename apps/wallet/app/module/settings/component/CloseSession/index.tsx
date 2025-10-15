import { Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAccount } from "wagmi";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { ToggleSession } from "@/module/common/component/ToggleSession";
import { useInteractionSessionStatus } from "@/module/wallet/hook/useInteractionSessionStatus";

export function CloseSession() {
    const { t } = useTranslation();
    const { address } = useAccount();

    const { data: sessionStatus, isPending: sessionStatusIsPending } =
        useInteractionSessionStatus({
            address,
        });

    if (sessionStatusIsPending) {
        return null;
    }

    return (
        <Panel size={"small"}>
            <Title icon={<Wallet size={32} />}>
                {sessionStatus
                    ? t("wallet.session.titleActivated")
                    : t("wallet.session.titleNotActivated")}
            </Title>
            <ToggleSession />
        </Panel>
    );
}
