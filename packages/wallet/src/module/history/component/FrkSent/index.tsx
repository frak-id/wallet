"use client";

import { formatFrk } from "@/context/wallet/utils/frkFormatter";
import { Panel } from "@/module/common/component/Panel";
import Row from "@/module/common/component/Row";
import { Title } from "@/module/common/component/Title";
import { AlertDialogArticle } from "@/module/history/component/AlertDialogArticle";
import { DrawerArticle } from "@/module/history/component/DrawerArticle";
import { PolygonLink } from "@/module/wallet/component/PolygonLink";
import type { FrkSent as FrkSentType } from "@/types/HistoryItem";
import { useMediaQuery } from "@uidotdev/usehooks";
import { HandCoins } from "lucide-react";

type ArticleUnlockProps = {
    frkSent: FrkSentType;
};

export function FrkSent({ frkSent }: ArticleUnlockProps) {
    // Check if the screen is desktop or mobile
    const isDesktop = useMediaQuery("(min-width : 600px)");

    // Use a Drawer for mobile and an AlertDialog for desktop
    const Component = isDesktop ? AlertDialogArticle : DrawerArticle;

    return (
        <Component
            trigger={
                <Panel size={"small"}>
                    <Title icon={<HandCoins />}>
                        <strong>{formatFrk(Number(frkSent.sentAmount))}</strong>{" "}
                        sent
                    </Title>
                </Panel>
            }
        >
            <>
                <Title icon={<HandCoins />}>
                    <strong>{formatFrk(Number(frkSent.sentAmount))}</strong>{" "}
                    sent
                </Title>
                <Row withIcon={true}>
                    To: <PolygonLink wallet={true} hash={frkSent.toHash} />
                </Row>
                <Row withIcon={true}>
                    Transaction: <PolygonLink hash={frkSent.txHash} />
                </Row>
            </>
        </Component>
    );
}
