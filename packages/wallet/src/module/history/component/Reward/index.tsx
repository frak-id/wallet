"use client";

import { formatFrk } from "@/context/wallet/utils/frkFormatter";
import { Panel } from "@/module/common/component/Panel";
import Row from "@/module/common/component/Row";
import { Title } from "@/module/common/component/Title";
import { useConvertToEuro } from "@/module/common/hook/useConvertToEuro";
import { AlertDialogArticle } from "@/module/history/component/AlertDialogArticle";
import { DrawerArticle } from "@/module/history/component/DrawerArticle";
import { ExplorerLink } from "@/module/wallet/component/PolygonLink";
import type { RewardHistory } from "@/types/RewardHistory";
import { useMediaQuery } from "@module/hook/useMediaQuery";
import { HandCoins, Handshake } from "lucide-react";

type RewardProps = {
    reward: RewardHistory;
};

export function Reward({ reward }: RewardProps) {
    // Convert the amount to euro
    const { convertToEuro, isEnabled } = useConvertToEuro();

    // Check if the screen is desktop or mobile
    const isDesktop = useMediaQuery("(min-width : 600px)");

    // Use a Drawer for mobile and an AlertDialog for desktop
    const Component = isDesktop ? AlertDialogArticle : DrawerArticle;

    const amount = isEnabled
        ? convertToEuro(reward.amount)
        : formatFrk(Number(reward.amount));
    const label = reward.type === "claim" ? "claimed" : "added";
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
                    Transaction: <ExplorerLink hash={reward.txHash} />
                </Row>
            </>
        </Component>
    );
}
