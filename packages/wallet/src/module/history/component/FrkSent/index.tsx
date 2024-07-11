"use client";

import { formatFrk } from "@/context/wallet/utils/frkFormatter";
import { Panel } from "@/module/common/component/Panel";
import Row from "@/module/common/component/Row";
import { Title } from "@/module/common/component/Title";
import { useConvertToEuro } from "@/module/common/hook/useConvertToEuro";
import { AlertDialogArticle } from "@/module/history/component/AlertDialogArticle";
import { DrawerArticle } from "@/module/history/component/DrawerArticle";
import { ExplorerLink } from "@/module/wallet/component/PolygonLink";
import type { FrkSent as FrkSentType } from "@/types/HistoryItem";
import { useMediaQuery } from "@module/hook/useMediaQuery";
import { HandCoins } from "lucide-react";

type ArticleUnlockProps = {
    frkSent: FrkSentType;
};

export function FrkSent({ frkSent }: ArticleUnlockProps) {
    // Convert the amount to euro
    const { convertToEuro, isEnabled } = useConvertToEuro();

    // Check if the screen is desktop or mobile
    const isDesktop = useMediaQuery("(min-width : 600px)");

    // Use a Drawer for mobile and an AlertDialog for desktop
    const Component = isDesktop ? AlertDialogArticle : DrawerArticle;

    const amount = isEnabled
        ? convertToEuro(frkSent.sentAmount)
        : formatFrk(Number(frkSent.sentAmount));

    return (
        <Component
            trigger={
                <Panel size={"small"}>
                    <Title icon={<HandCoins />}>
                        <strong>{amount}</strong> sent
                    </Title>
                </Panel>
            }
        >
            <>
                <Title icon={<HandCoins />}>
                    <strong>{amount}</strong> sent
                </Title>
                <Row withIcon={true}>
                    To: <ExplorerLink wallet={true} hash={frkSent.toHash} />
                </Row>
                <Row withIcon={true}>
                    Transaction: <ExplorerLink hash={frkSent.txHash} />
                </Row>
            </>
        </Component>
    );
}
