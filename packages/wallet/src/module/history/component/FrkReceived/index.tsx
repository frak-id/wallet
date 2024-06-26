"use client";

import { formatFrk } from "@/context/wallet/utils/frkFormatter";
import { Panel } from "@/module/common/component/Panel";
import Row from "@/module/common/component/Row";
import { Title } from "@/module/common/component/Title";
import { useConvertToEuro } from "@/module/common/hook/useConvertToEuro";
import { AlertDialogArticle } from "@/module/history/component/AlertDialogArticle";
import { DrawerArticle } from "@/module/history/component/DrawerArticle";
import { ExplorerLink } from "@/module/wallet/component/PolygonLink";
import type { FrkReceived as FrkReceivedType } from "@/types/HistoryItem";
import { useMediaQuery } from "@uidotdev/usehooks";
import { HandCoins } from "lucide-react";

type ArticleUnlockProps = {
    frkReceived: FrkReceivedType;
};

export function FrkReceived({ frkReceived }: ArticleUnlockProps) {
    // Convert the amount to euro
    const { convertToEuro, isEnabled } = useConvertToEuro();

    // Check if the screen is desktop or mobile
    const isDesktop = useMediaQuery("(min-width : 600px)");

    // Use a Drawer for mobile and an AlertDialog for desktop
    const Component = isDesktop ? AlertDialogArticle : DrawerArticle;

    const amount = isEnabled
        ? convertToEuro(frkReceived.receivedAmount)
        : formatFrk(Number(frkReceived.receivedAmount));

    return (
        <Component
            trigger={
                <Panel size={"small"}>
                    <Title icon={<HandCoins />}>
                        <strong>{amount}</strong> received
                    </Title>
                </Panel>
            }
        >
            <>
                <Title icon={<HandCoins />}>
                    <strong>{amount}</strong> received
                </Title>
                <Row withIcon={true}>
                    From:{" "}
                    <ExplorerLink wallet={true} hash={frkReceived.fromHash} />
                </Row>
                <Row withIcon={true}>
                    Transaction: <ExplorerLink hash={frkReceived.txHash} />
                </Row>
            </>
        </Component>
    );
}
