import { formatUsd } from "@/context/wallet/utils/mUsdFormatter";
import { Panel } from "@/module/common/component/Panel";
import { Row } from "@/module/common/component/Row";
import { Title } from "@/module/common/component/Title";
import { AlertDialogArticle } from "@/module/history/component/AlertDialogArticle";
import { DrawerArticle } from "@/module/history/component/DrawerArticle";
import { ExplorerTxLink } from "@/module/wallet/component/ExplorerLink";
import type { RewardHistory } from "@/types/RewardHistory";
import { useMediaQuery } from "@module/hook/useMediaQuery";
import { HandCoins, Handshake } from "lucide-react";
import { useTranslation } from "react-i18next";

type RewardProps = {
    reward: RewardHistory;
};

export function Reward({ reward }: RewardProps) {
    const { t } = useTranslation();

    // Check if the screen is desktop or mobile
    const isDesktop = useMediaQuery("(min-width : 600px)");

    // Use a Drawer for mobile and an AlertDialog for desktop
    const Component = isDesktop ? AlertDialogArticle : DrawerArticle;

    const amount = formatUsd(Number(reward.amount));
    const label =
        reward.type === "claim" ? t("common.claimed") : t("common.added");
    const icon = reward.type === "claim" ? <Handshake /> : <HandCoins />;

    return (
        <Component
            trigger={
                <Panel size={"small"}>
                    <Title icon={icon}>
                        <strong>{amount}</strong> {label}
                    </Title>
                </Panel>
            }
        >
            <>
                <Title icon={icon}>
                    <strong>{amount}</strong> {label}
                </Title>
                <Row withIcon={true}>
                    Date: {new Date(reward.timestamp * 1000).toLocaleString()}
                </Row>
                <Row withIcon={true}>
                    Transaction: <ExplorerTxLink hash={reward.txHash} />
                </Row>
            </>
        </Component>
    );
}
